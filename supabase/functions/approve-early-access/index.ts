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

      const password = crypto.randomUUID();

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      });

      if (updateErr) throw new Error(`Erreur reset: ${updateErr.message}`);
      const firstName = profile.first_name || profile.display_name || "utilisateur";

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

    // Send magic link email so the user can login immediately
    const { error: otpError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: eaReq.email,
      options: {
        redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/setup-password`,
      },
    });

    // Even if magic link generation fails, the account is created — we use signInWithOtp as fallback
    if (otpError) {
      console.warn("Magic link generation failed, user can request one manually:", otpError.message);
    }

    // Also send an OTP email directly so the user receives a clickable link
    // Using the admin client to call the GoTrue endpoint directly
    const gotrue = `${supabaseUrl}/auth/v1/magiclink`;
    const otpRes = await fetch(gotrue, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey!,
      },
      body: JSON.stringify({ email: eaReq.email }),
    });
    
    if (!otpRes.ok) {
      const otpBody = await otpRes.text();
      console.warn("OTP email fallback failed:", otpBody);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Compte créé pour ${eaReq.first_name} (${eaReq.email}). Un lien de connexion a été envoyé par email.`,
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
