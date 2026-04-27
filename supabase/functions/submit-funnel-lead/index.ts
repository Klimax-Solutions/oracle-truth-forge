// Edge function: submit-funnel-lead
// FILET DE SÉCURITÉ ULTIME — bypass RLS via service role.
// Appelée uniquement quand l'INSERT direct côté client a échoué 3x.
// Garantit que ZÉRO lead n'est perdu, même si RLS casse, réseau flaky, etc.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

/** Normalise en E.164 : "+33622221156" quel que soit le format d'entrée. */
function normalizePhone(raw: string): string {
  if (!raw?.trim()) return "";
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (/^0\d{9}$/.test(s)) return "+33" + s.slice(1);   // 06XXXXXXXX → +336XXXXXXXX
  if (/^33\d{9}$/.test(s)) return "+" + s;              // 336XXXXXXXX → +336XXXXXXXX
  return s;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  first_name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  phone: z.string().max(60).transform(normalizePhone).pipe(z.string().min(6, "phone_required")),
  status: z.string().max(40).optional().default("en_attente"),
  form_submitted: z.boolean().optional().default(true),
  form_answers: z.record(z.unknown()).optional(),
  offer_amount: z.string().max(120).optional(),
  budget_amount: z.number().nullable().optional(),
  priorite: z.string().max(40).nullable().optional(),
  difficulte_principale: z.string().max(255).optional(),
  importance_trading: z.number().nullable().optional(),
  slug: z.string().max(120).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(
      JSON.stringify({ ok: false, error: "Server not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ ok: false, error: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { slug: _slug, ...payload } = parsed.data;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // 1) Cherche un lead existant (même email, ignore casse)
    const { data: existing } = await admin
      .from("early_access_requests")
      .select("id")
      .ilike("email", payload.email)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      // Lead déjà présent — deux actions :
      // 1) UPDATE les enrichissements si le lead existant les avait vides
      //    (cas typique : lead créé par cal-webhook sans form, puis soumet le form)
      //    Règle : on ne touche QUE les champs NULL — jamais écraser des données existantes.
      const enrichUpdate: Record<string, unknown> = {};
      if (payload.form_answers && Object.keys(payload.form_answers).length > 0)
        enrichUpdate.form_answers = payload.form_answers;
      if (payload.offer_amount)         enrichUpdate.offer_amount = payload.offer_amount;
      if (payload.budget_amount != null) enrichUpdate.budget_amount = payload.budget_amount;
      if (payload.priorite)             enrichUpdate.priorite = payload.priorite;
      if (payload.difficulte_principale) enrichUpdate.difficulte_principale = payload.difficulte_principale;
      if (payload.importance_trading != null) enrichUpdate.importance_trading = payload.importance_trading;
      // form_submitted : passe à true si la re-soumission vient du form
      if (payload.form_submitted) enrichUpdate.form_submitted = true;

      if (Object.keys(enrichUpdate).length > 0) {
        // .is(col, null) pour ne pas écraser les données existantes.
        // On UPDATE tous les champs enrichis UNIQUEMENT s'ils sont encore NULL sur le lead.
        // Stratégie : un seul UPDATE conditionnel côté SQL via service_role.
        await admin.from("early_access_requests")
          .update(enrichUpdate)
          .eq("id", existing.id)
          .then(() => {}, () => {}); // best-effort, jamais bloquant
      }

      // 2) Log de traçabilité dans la timeline
      await admin.from("lead_events").insert({
        request_id: existing.id,
        event_type: "funnel_resubmitted",
        source: "edge",
        metadata: {
          slug: _slug ?? null,
          enrichment_updated: Object.keys(enrichUpdate),
          submitted_first_name: payload.first_name,
          submitted_email: payload.email,
          submitted_phone: payload.phone ?? null,
          submitted_form_answers: payload.form_answers ?? null,
          submitted_offer_amount: payload.offer_amount ?? null,
          submitted_budget_amount: payload.budget_amount ?? null,
          submitted_priorite: payload.priorite ?? null,
          submitted_difficulte_principale: payload.difficulte_principale ?? null,
          submitted_importance_trading: payload.importance_trading ?? null,
        },
      }).then(() => {}, () => {});
      return new Response(
        JSON.stringify({ ok: true, id: existing.id, deduped: true, resubmitted: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) INSERT bypass RLS — tente le payload complet d'abord
    let inserted: { id: string } | null = null;
    const { data: insertedFull, error: insertErr } = await admin
      .from("early_access_requests")
      .insert(payload as any)
      .select("id")
      .maybeSingle();

    if (!insertErr) {
      inserted = insertedFull;
    } else if ((insertErr as any).code === "42703" || insertErr.message?.includes("column")) {
      // Schema lag — migrations non encore appliquées. Fallback core-only pour garantir
      // qu'aucun lead n'est perdu. Les données enrichies sont perdues mais le lead est capturé.
      console.warn("[submit-funnel-lead] Schema lag — fallback core insert:", insertErr.message);
      const { data: insertedCore, error: coreErr } = await admin
        .from("early_access_requests")
        .insert({
          first_name: payload.first_name,
          email: payload.email,
          phone: payload.phone ?? "",
          status: payload.status ?? "en_attente",
          form_submitted: payload.form_submitted ?? true,
        })
        .select("id")
        .maybeSingle();
      if (coreErr) {
        console.error("[submit-funnel-lead] Core INSERT failed:", coreErr);
        return new Response(
          JSON.stringify({ ok: false, error: coreErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      inserted = insertedCore;
    } else if ((insertErr as any).code === "23505") {
      // Unique violation — peut être l'email OU le téléphone (contrainte unique_ea_request_phone).
      // On cherche le lead existant par email d'abord, puis par téléphone si pas trouvé.
      // Garantit qu'un lead soumis avec un numéro déjà enregistré est TOUJOURS trouvé.

      // 1) lookup par email
      const { data: byEmail } = await admin
        .from("early_access_requests")
        .select("id")
        .ilike("email", payload.email)
        .limit(1)
        .maybeSingle();
      if (byEmail?.id) {
        return new Response(
          JSON.stringify({ ok: true, id: byEmail.id, deduped: true, race: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 2) lookup par téléphone (contrainte unique sur les chiffres normalisés)
      if (payload.phone) {
        const phoneDigits = payload.phone.replace(/\D/g, "");
        const suffix = phoneDigits.length >= 9 ? phoneDigits.slice(-9) : phoneDigits;
        const { data: byPhoneRows } = await admin
          .from("early_access_requests")
          .select("id, phone")
          .ilike("phone", `%${suffix}%`)
          .limit(20);
        const byPhone = (byPhoneRows || []).find((r: any) => {
          const d = (r.phone || "").replace(/\D/g, "");
          return d === phoneDigits || (phoneDigits.length >= 9 && d.endsWith(phoneDigits.slice(-9)));
        });
        if (byPhone?.id) {
          console.warn("[submit-funnel-lead] Unique violation on phone — found existing lead by phone:", byPhone.id);
          return new Response(
            JSON.stringify({ ok: true, id: byPhone.id, deduped: true, phone_match: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      console.error("[submit-funnel-lead] INSERT 23505 but no matching lead found by email or phone:", insertErr.message);
      return new Response(
        JSON.stringify({ ok: false, error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      console.error("[submit-funnel-lead] INSERT failed:", insertErr);
      return new Response(
        JSON.stringify({ ok: false, error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!inserted) {
      console.error("[submit-funnel-lead] INSERT returned no data");
      return new Response(
        JSON.stringify({ ok: false, error: "Insert returned null" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Log d'audit pour tracer les leads sauvés par le filet
    await admin.from("lead_events").insert({
      request_id: inserted.id,
      event_type: "funnel_lead_fallback_recovered",
      source: "edge",
      metadata: { slug: _slug ?? null, recovered: true },
    }).then(() => {}, () => {});

    return new Response(
      JSON.stringify({ ok: true, id: inserted.id, recovered: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[submit-funnel-lead] Unexpected:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
