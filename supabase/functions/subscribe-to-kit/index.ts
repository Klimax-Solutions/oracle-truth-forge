// Edge function: subscribe-to-kit
// Inscrit un lead à une séquence Kit (ex-ConvertKit) dès le submit du form /apply.
// Non-bloquant côté funnel : si Kit échoue, on log dans lead_events et on retourne 200.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  email: z.string().email().max(255),
  first_name: z.string().min(1).max(120),
  request_id: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const KIT_API_SECRET = Deno.env.get("KIT_API_SECRET");
  const KIT_SEQUENCE_ID = Deno.env.get("KIT_SEQUENCE_ID");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!KIT_API_SECRET || !KIT_SEQUENCE_ID) {
    return new Response(
      JSON.stringify({ ok: false, error: "Kit secrets not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ ok: false, error: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { email, first_name, request_id } = parsed.data;
  const admin = SUPABASE_URL && SERVICE_ROLE
    ? createClient(SUPABASE_URL, SERVICE_ROLE)
    : null;

  const logEvent = async (
    event_type: string,
    metadata: Record<string, unknown>,
  ) => {
    if (!admin || !request_id) return;
    try {
      await admin.from("lead_events").insert({
        request_id,
        event_type,
        source: "kit",
        metadata,
      });
    } catch (err) {
      console.error("[subscribe-to-kit] lead_events insert failed:", err);
    }
  };

  // Kit API v3 : POST /v3/sequences/{id}/subscribe
  // https://developers.kit.com/v3#add-subscriber-to-a-sequence
  const kitUrl = `https://api.convertkit.com/v3/sequences/${encodeURIComponent(KIT_SEQUENCE_ID)}/subscribe`;

  // 3 tentatives avec backoff exponentiel : 0ms / 200ms / 600ms
  const BACKOFF_MS = [0, 200, 600];
  let lastResp: Response | null = null;
  let lastData: Record<string, unknown> = {};

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
        console.log(`[subscribe-to-kit] Retry ${attempt}/2 for ${email}`);
      }
      lastResp = await fetch(kitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_secret: KIT_API_SECRET,
          email,
          first_name,
          // Stocke le request_id Oracle comme champ custom Kit "lead_id".
          // Permet de générer des liens email CTA avec {{ subscriber.lead_id }}
          // → /[slug]/discovery?lead_id={{ subscriber.lead_id }}&email=...&name=...
          ...(request_id ? { fields: { lead_id: request_id } } : {}),
        }),
      });
      lastData = await lastResp.json().catch(() => ({}));
      if (lastResp.ok) break; // succès → sortie immédiate
    }

    if (!lastResp) throw new Error("Kit API unavailable — no response");

    if (!lastResp.ok) {
      console.error("[subscribe-to-kit] Kit API error after retries", lastResp.status, lastData);
      await logEvent("kit_subscribe_failed", {
        status: lastResp.status,
        response: lastData,
        sequence_id: KIT_SEQUENCE_ID,
      });
      return new Response(
        JSON.stringify({ ok: false, status: lastResp.status, kit: lastData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await logEvent("kit_sequence_subscribed", {
      sequence_id: KIT_SEQUENCE_ID,
      subscription_id: (lastData as any)?.subscription?.id ?? null,
    });

    return new Response(
      JSON.stringify({ ok: true, subscription: (lastData as any)?.subscription ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[subscribe-to-kit] Network/unknown error:", msg);
    await logEvent("kit_subscribe_failed", { error: msg });
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
