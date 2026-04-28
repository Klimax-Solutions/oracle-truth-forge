// ──────────────────────────────────────────────────────────────────────────────
// notify-funnel-lead — Telegram notification for new Oracle leads
// Called from:
//   • oracle-funnel-clean/src/lib/funnelLeadQueue.ts (direct client INSERT path)
//   • submit-funnel-lead edge function (edge fallback path)
//   • funnel-submit edge function (legacy funnel path)
//
// Required Supabase secrets (set via dashboard or CLI):
//   TELEGRAM_BOT_TOKEN   — token from @BotFather
//   TELEGRAM_NOTIFY_CHAT_ID — Charles' personal chat ID (get via getUpdates API)
//
// Non-blocking: if secrets are missing or Telegram is down, function returns 200
// so the notification never blocks the lead capture flow.
//
// Security: public endpoint — no auth, no sensitive action (just read + HTTP send).
// ──────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface NotifyPayload {
  first_name?: string;
  email?: string;
  phone?: string;
  offer_amount?: string;
  budget_amount?: number | null;
  priorite?: string | null;
  difficulte_principale?: string;
  importance_trading?: number | null;
  slug?: string;
  is_resubmit?: boolean; // true = lead déjà en DB qui re-soumet le form
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function buildMessage(p: NotifyPayload): string {
  const icon = p.is_resubmit ? '🔄' : '🔔';
  const title = p.is_resubmit ? 'Re-soumission lead Oracle' : 'Nouveau lead Oracle';

  const lines: string[] = [
    `${icon} *${escapeMarkdown(title)}*`,
    '',
    `👤 *Prénom :* ${escapeMarkdown(p.first_name || '?')}`,
    `📧 *Email :* ${escapeMarkdown(p.email || '?')}`,
  ];

  if (p.phone) {
    lines.push(`📞 *Tél :* ${escapeMarkdown(p.phone)}`);
  } else {
    lines.push(`📞 *Tél :* ⚠️ absent`);
  }

  if (p.offer_amount) lines.push(`💰 *Offre :* ${escapeMarkdown(p.offer_amount)}`);
  if (p.budget_amount != null) lines.push(`💶 *Budget :* ${p.budget_amount}€`);
  if (p.priorite) lines.push(`⚡ *Priorité :* ${escapeMarkdown(p.priorite)}`);
  if (p.importance_trading != null) lines.push(`📊 *Importance trading :* ${p.importance_trading}/10`);
  if (p.difficulte_principale) lines.push(`🎯 *Difficulté :* ${escapeMarkdown(p.difficulte_principale)}`);
  if (p.slug) lines.push(`🌐 *Funnel :* ${escapeMarkdown(p.slug)}`);

  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const CHAT_ID = Deno.env.get("TELEGRAM_NOTIFY_CHAT_ID");

  // Silently succeed if not configured — never block lead capture
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("[notify-funnel-lead] TELEGRAM_BOT_TOKEN or TELEGRAM_NOTIFY_CHAT_ID not set — skipping");
    return new Response(JSON.stringify({ ok: true, skipped: "not_configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: NotifyPayload = {};
  try {
    payload = await req.json();
  } catch {
    // If JSON fails, still ok — we'll send with defaults
  }

  try {
    const text = buildMessage(payload);
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "MarkdownV2" }),
      }
    );
    const tgBody = await tgRes.json();
    if (!tgRes.ok) {
      console.warn("[notify-funnel-lead] Telegram error:", JSON.stringify(tgBody));
    } else {
      console.log("[notify-funnel-lead] Notification sent:", payload.email);
    }
  } catch (err) {
    // Never throw — notification failure must never block lead capture
    console.warn("[notify-funnel-lead] Exception (non-blocking):", err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
