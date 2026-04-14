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

    // ── Action: reset password ──
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
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (updateErr) throw new Error(`Erreur reset: ${updateErr.message}`);
      const firstName = profile.first_name || profile.display_name || "utilisateur";
      return new Response(
        JSON.stringify({ success: true, message: `Mot de passe réinitialisé pour ${firstName}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Action: resend magic link ──
    if (action === "resend_magic_link") {
      const { email } = body;
      if (!email) throw new Error("email manquant");
      const gotrue = `${supabaseUrl}/auth/v1/magiclink`;
      const otpRes = await fetch(gotrue, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": anonKey! },
        body: JSON.stringify({ email }),
      });
      if (!otpRes.ok) {
        const otpBody = await otpRes.text();
        if (otpBody.includes("over_email_send_rate_limit")) {
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email,
            options: { redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/setup-password` },
          });
          if (linkError) throw new Error(`Impossible de générer le lien: ${linkError.message}`);
          return new Response(
            JSON.stringify({ success: true, message: `Rate limit atteint. Lien généré manuellement.`, magic_link: linkData?.properties?.action_link }),
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

    const { data: eaReq, error: fetchErr } = await supabaseAdmin
      .from("early_access_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchErr || !eaReq) throw new Error("Demande introuvable");
    if (eaReq.status !== "en_attente") throw new Error("Demande déjà traitée");

    // ── Duplicate check: email & phone ──
    const { data: dupEmail } = await supabaseAdmin
      .from("early_access_requests")
      .select("id, first_name, status")
      .eq("status", "approuvée")
      .ilike("email", eaReq.email.trim())
      .neq("id", requestId)
      .limit(1);

    if (dupEmail && dupEmail.length > 0) {
      // Auto-reject the duplicate and mark the old one as canonical
      await supabaseAdmin
        .from("early_access_requests")
        .update({ status: "doublon", reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      throw new Error(`Doublon email détecté — ${eaReq.email} déjà approuvé (${dupEmail[0].first_name})`);
    }

    const phoneClean = eaReq.phone.replace(/\s+/g, "");
    const { data: allApproved } = await supabaseAdmin
      .from("early_access_requests")
      .select("id, first_name, phone")
      .eq("status", "approuvée")
      .neq("id", requestId);

    const dupPhone = (allApproved || []).find(
      (r: any) => r.phone.replace(/\s+/g, "") === phoneClean
    );
    if (dupPhone) {
      await supabaseAdmin
        .from("early_access_requests")
        .update({ status: "doublon", reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      throw new Error(`Doublon téléphone détecté — ${phoneClean} déjà approuvé (${dupPhone.first_name})`);
    }

    // Try to create user, or find existing one
    let userId: string;
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: eaReq.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { display_name: eaReq.first_name },
    });

    if (createErr) {
      // If user already exists, look them up
      if (createErr.message.includes("already been registered")) {
        const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) throw new Error(`Impossible de lister les utilisateurs: ${listErr.message}`);
        const existingUser = users.find((u: any) => u.email?.toLowerCase() === eaReq.email.toLowerCase());
        if (!existingUser) throw new Error("Utilisateur introuvable malgré doublon email");
        userId = existingUser.id;
      } else {
        throw new Error(`Création du compte échouée: ${createErr.message}`);
      }
    } else {
      userId = newUser.user.id;
    }

    // Set profile to active
    await supabaseAdmin.from("profiles").update({ status: "active" }).eq("user_id", userId);

    // Check if early_access role already exists
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "early_access")
      .maybeSingle();

    if (existingRole) {
      // Update existing role
      await supabaseAdmin.from("user_roles").update({
        early_access_type: "precall",
        expires_at: expiresAt || null,
      }).eq("id", existingRole.id);
    } else {
      // Insert new role
      await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: "early_access",
        early_access_type: "precall",
        expires_at: expiresAt || null,
      });
    }

    // Update request status with user_id for CRM matching
    const { data: { user: caller } } = await callerClient.auth.getUser();
    await supabaseAdmin
      .from("early_access_requests")
      .update({
        status: "approuvée",
        reviewed_at: new Date().toISOString(),
        reviewed_by: caller?.id || null,
        user_id: userId,
        date_activation_trial: new Date().toISOString(),
      })
      .eq("id", requestId);

    // Send magic link
    const gotrue = `${supabaseUrl}/auth/v1/magiclink`;
    const otpRes = await fetch(gotrue, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": anonKey! },
      body: JSON.stringify({ email: eaReq.email }),
    });

    let emailSent = true;
    let magicLink: string | null = null;

    if (!otpRes.ok) {
      console.warn("Magic link email failed, generating link manually");
      emailSent = false;
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: eaReq.email,
        options: { redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/setup-password` },
      });
      magicLink = linkData?.properties?.action_link || null;
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        magic_link: magicLink,
        message: emailSent
          ? `Compte créé pour ${eaReq.first_name} (${eaReq.email}). Email envoyé.`
          : `Compte créé pour ${eaReq.first_name} (${eaReq.email}). Email échoué — lien généré.`,
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
