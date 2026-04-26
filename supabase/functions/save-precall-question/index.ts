// Edge function: save-precall-question
// Sauvegarde la question pré-call du lead via service role (bypass RLS anon).
// La table early_access_requests est protégée par RLS — les utilisateurs anonymes
// du funnel ne peuvent pas faire d'UPDATE directement. Cette fonction accepte un
// appel public, valide les inputs, et fait l'UPDATE via service_role.
//
// Sécurité : seul le champ `precall_question` est mis à jour.
// Identification : request_id (UUID, préféré) OU email (fallback).
// Pas d'auth requise — la question pré-call n'est pas une donnée sensible.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  question:   z.string().trim().min(1).max(1000),
  request_id: z.string().uuid().optional(),
  email:      z.string().email().max(255).optional(),
}).refine(d => d.request_id || d.email, {
  message: "request_id ou email requis",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL  = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

  const { question, request_id, email } = parsed.data;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    let query = admin
      .from("early_access_requests")
      .update({ precall_question: question });

    if (request_id) {
      // Identifiant exact — préféré (pas d'ambiguïté)
      query = (query as any).eq("id", request_id);
    } else {
      // Fallback par email (normalisation casse)
      query = (query as any).ilike("email", email!.trim());
    }

    const { error } = await query;
    if (error) {
      console.error("[save-precall-question] UPDATE failed:", error);
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[save-precall-question] Unexpected:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
