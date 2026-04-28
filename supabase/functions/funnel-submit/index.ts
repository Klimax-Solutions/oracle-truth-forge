// ────────────────────────────────────────────────────────────────────────────
// funnel-submit
// Public endpoint pour capturer une demande funnel sans dépendre de RLS.
// Utilise SUPABASE_SERVICE_ROLE_KEY (auto-injectée par Lovable Cloud) qui
// bypass toutes les policies. Garantie : tant que cette fonction est up,
// le lead arrive en pipeline.
//
// CORS open (anon, public). Anti-spam serveur-side :
//   - validation email + first_name
//   - rate-limit 3 demandes par email / heure (déjà côté front, doublé ici)
//   - honeypot vérifié
// ────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Telegram notification helper ──────────────────────────────────────────────
async function sendTelegramNotification(p: {
  first_name?: string; email?: string; phone?: string;
  offer_amount?: string; budget_amount?: number | null;
  priorite?: string | null; difficulte_principale?: string;
  importance_trading?: number | null;
}) {
  try {
    const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const CHAT = Deno.env.get("TELEGRAM_NOTIFY_CHAT_ID");
    if (!BOT || !CHAT) return;
    const esc = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
    const lines = [
      `🔔 *Nouveau lead Oracle*`,
      ``,
      `👤 *Prénom :* ${esc(p.first_name || "?")}`,
      `📧 *Email :* ${esc(p.email || "?")}`,
      p.phone ? `📞 *Tél :* ${esc(p.phone)}` : `📞 *Tél :* ⚠️ absent`,
      ...(p.offer_amount   ? [`💰 *Offre :* ${esc(p.offer_amount)}`]                : []),
      ...(p.budget_amount != null ? [`💶 *Budget :* ${p.budget_amount}€`]           : []),
      ...(p.priorite       ? [`⚡ *Priorité :* ${esc(p.priorite)}`]                  : []),
      ...(p.importance_trading != null ? [`📊 *Importance :* ${p.importance_trading}/10`] : []),
      ...(p.difficulte_principale ? [`🎯 *Difficulté :* ${esc(p.difficulte_principale)}`] : []),
    ];
    const res = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text: lines.join("\n"), parse_mode: "MarkdownV2" }),
    });
    if (!res.ok) console.warn("[funnel-submit] Telegram error:", await res.text());
  } catch (err) {
    console.warn("[funnel-submit] Telegram notification failed (non-blocking):", err);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FunnelLeadPayload {
  first_name?: string;
  email?: string;
  phone?: string;
  honeypot?: string;
  form_answers?: Record<string, unknown>;
  offer_amount?: string;
  budget_amount?: number | null;
  priorite?: string | null;
  difficulte_principale?: string;
  importance_trading?: number | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let body: FunnelLeadPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Anti-spam server-side ───────────────────────────────────────────
    if (body.honeypot && String(body.honeypot).trim().length > 0) {
      // Bot — fake success silencieux pour ne rien apprendre à l'attaquant
      return new Response(JSON.stringify({ ok: true, queued: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validation minimale ─────────────────────────────────────────────
    const first_name = String(body.first_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim(); // colonne NOT NULL → '' OK

    if (!first_name || !email || !EMAIL_REGEX.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ── Rate-limit par email : 3 / heure ───────────────────────────────
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: recentCount } = await supabase
      .from("early_access_requests")
      .select("id", { count: "exact", head: true })
      .ilike("email", email)
      .gte("created_at", oneHourAgo);
    if ((recentCount ?? 0) >= 3) {
      return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Existing lead check ────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("early_access_requests")
      .select("id, status")
      .ilike("email", email)
      .in("status", ["approuvée", "en_attente"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const enrichment: Record<string, unknown> = {};
    if (body.form_answers && Object.keys(body.form_answers).length > 0) {
      enrichment.form_answers = body.form_answers;
    }
    if (body.offer_amount) enrichment.offer_amount = body.offer_amount;
    if (body.budget_amount != null) enrichment.budget_amount = body.budget_amount;
    if (body.priorite) enrichment.priorite = body.priorite;
    if (body.difficulte_principale) enrichment.difficulte_principale = body.difficulte_principale;
    if (body.importance_trading != null) enrichment.importance_trading = body.importance_trading;

    // Si le lead est déjà membre approuvé, on ne crée pas de doublon
    if (existing?.status === "approuvée") {
      return new Response(
        JSON.stringify({ ok: true, already_member: true, id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // S'il existe déjà en_attente, UPDATE
    if (existing?.status === "en_attente") {
      const updatePayload: Record<string, unknown> = {
        first_name,
        form_submitted: true,
        ...enrichment,
      };
      if (phone) updatePayload.phone = phone;

      const { error: updErr } = await supabase
        .from("early_access_requests")
        .update(updatePayload)
        .eq("id", existing.id);
      if (updErr) {
        console.error("[funnel-submit] UPDATE error:", updErr);
        return new Response(JSON.stringify({ ok: false, error: updErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, id: existing.id, updated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nouveau lead → INSERT
    const { data: inserted, error: insErr } = await supabase
      .from("early_access_requests")
      .insert({
        first_name,
        email,
        phone,
        status: "en_attente",
        form_submitted: true,
        ...enrichment,
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[funnel-submit] INSERT error:", insErr);
      return new Response(JSON.stringify({ ok: false, error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[funnel-submit] Lead created:", inserted?.id, email);

    // Notification Telegram — best-effort, non-blocking
    void sendTelegramNotification({
      first_name,
      email,
      phone,
      offer_amount: body.offer_amount,
      budget_amount: body.budget_amount,
      priorite: body.priorite,
      difficulte_principale: body.difficulte_principale,
      importance_trading: body.importance_trading,
    });

    return new Response(JSON.stringify({ ok: true, id: inserted?.id, created: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[funnel-submit] Exception:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
