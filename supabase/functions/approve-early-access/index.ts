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

    // ── Action: resend magic link for existing user ──
    if (action === "resend_magic_link") {
      const { email } = body;
      if (!email) throw new Error("email manquant");

      // Use signInWithOtp via admin - this actually sends the email
      const gotrue = `${supabaseUrl}/auth/v1/magiclink`;
      const otpRes = await fetch(gotrue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": anonKey!,
        },
        body: JSON.stringify({ email }),
      });

      if (!otpRes.ok) {
        const otpBody = await otpRes.text();
        // If rate limited, try generateLink as fallback to get a direct URL
        if (otpBody.includes("over_email_send_rate_limit")) {
          // Generate a link directly (won't send email but returns the URL)
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: {
              redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/setup-password`,
            },
          });

          if (linkError) throw new Error(`Impossible de générer le lien: ${linkError.message}`);

          // Return the action link so admin can share it manually
          const actionLink = linkData?.properties?.action_link;
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Rate limit atteint. Lien de connexion généré manuellement.`,
              magic_link: actionLink,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(`Erreur envoi email: ${otpBody}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: `Lien de connexion renvoyé à ${email}` }),
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

    // Generate a secure random password
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

    // Send magic link email - use the /auth/v1/magiclink endpoint which ACTUALLY sends an email
    const gotrue = `${supabaseUrl}/auth/v1/magiclink`;
    const otpRes = await fetch(gotrue, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey!,
      },
      body: JSON.stringify({ email: eaReq.email }),
    });

    let emailSent = true;
    let magicLink: string | null = null;

    if (!otpRes.ok) {
      const otpBody = await otpRes.text();
      console.warn("Magic link email failed, generating link manually:", otpBody);
      emailSent = false;

      // Fallback: generate the link directly so admin can share it
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: eaReq.email,
        options: {
          redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/setup-password`,
        },
      });
      magicLink = linkData?.properties?.action_link || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        magic_link: magicLink,
        message: emailSent
          ? `Compte créé pour ${eaReq.first_name} (${eaReq.email}). Email de connexion envoyé.`
          : `Compte créé pour ${eaReq.first_name} (${eaReq.email}). Email échoué — lien généré manuellement.`,
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
