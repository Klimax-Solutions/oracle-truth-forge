// Edge function: submit-funnel-lead
// FILET DE SÉCURITÉ ULTIME — bypass RLS via service role.
// Appelée uniquement quand l'INSERT direct côté client a échoué 3x.
// Garantit que ZÉRO lead n'est perdu, même si RLS casse, réseau flaky, etc.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  first_name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  phone: z.string().max(60).optional().default(""),
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
      // Idempotent : on retourne l'id existant + on log
      await admin.from("lead_events").insert({
        request_id: existing.id,
        event_type: "funnel_lead_fallback_dedup",
        source: "edge",
        metadata: { reason: "email already exists", slug: _slug ?? null },
      }).then(() => {}, () => {});
      return new Response(
        JSON.stringify({ ok: true, id: existing.id, deduped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) INSERT bypass RLS
    const { data: inserted, error: insertErr } = await admin
      .from("early_access_requests")
      .insert(payload as any)
      .select("id")
      .single();

    if (insertErr) {
      console.error("[submit-funnel-lead] INSERT failed:", insertErr);
      return new Response(
        JSON.stringify({ ok: false, error: insertErr.message }),
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
