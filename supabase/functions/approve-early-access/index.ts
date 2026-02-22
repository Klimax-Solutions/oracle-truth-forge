import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const callerClient = createClient(supabaseUrl, anonKey!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isSA } = await callerClient.rpc("is_super_admin");
    if (!isSA) throw new Error("Accès refusé — super admin requis");

    const body = await req.json();
    const { requestId, action, expiresAt } = body;

    // ── Action: reset password for existing EA user ──
    if (action === "reset_password") {
      const { userId } = body;
      if (!userId) throw new Error("userId manquant");

      // Get profile to find first name
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("first_name, display_name")
        .eq("user_id", userId)
        .single();

      if (!profile) throw new Error("Profil introuvable");

      const firstName = profile.first_name || profile.display_name || "";
      const basePwd = firstName.trim().toLowerCase();
      const password = basePwd.length >= 6 ? basePwd : basePwd.padEnd(6, basePwd);

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      });

      if (updateErr) throw new Error(`Erreur reset: ${updateErr.message}`);

      return new Response(
        JSON.stringify({ success: true, message: `Mot de passe réinitialisé pour ${firstName}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Default action: approve request ──
    if (!requestId) throw new Error("requestId manquant");

    // Fetch the request
    const { data: eaReq, error: fetchErr } = await supabaseAdmin
      .from("early_access_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchErr || !eaReq) throw new Error("Demande introuvable");
    if (eaReq.status !== "en_attente") throw new Error("Demande déjà traitée");

    // Generate a secure random password (user will login via magic link, never needs this)
    const tempPassword = crypto.randomUUID();

    // Create the user via admin API
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: eaReq.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { display_name: eaReq.first_name },
    });

    if (createErr) throw new Error(`Création du compte échouée: ${createErr.message}`);

    const userId = newUser.user.id;

    // The profile and member role are created automatically via triggers.
    // Set the profile to active status
    await supabaseAdmin
      .from("profiles")
      .update({ status: "active" })
      .eq("user_id", userId);

    // Add early_access role with type precall + expiration
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "early_access",
      early_access_type: "precall",
      expires_at: expiresAt || null,
    });

    // Update the request status
    const { data: { user: caller } } = await callerClient.auth.getUser();
    await supabaseAdmin
      .from("early_access_requests")
      .update({
        status: "approuvée",
        reviewed_at: new Date().toISOString(),
        reviewed_by: caller?.id || null,
      })
      .eq("id", requestId);

    // No recovery email needed — EA users login with first name + email

    return new Response(
      JSON.stringify({
        success: true,
        message: `Compte créé pour ${eaReq.first_name} (${eaReq.email}).`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("approve-early-access error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
