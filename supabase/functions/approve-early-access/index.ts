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
    const [{ data: isSA }, { data: isAdmin }] = await Promise.all([
      callerClient.rpc("is_super_admin"),
      callerClient.rpc("is_admin"),
    ]);
    if (!isSA && !isAdmin) throw new Error("Accès refusé — admin requis");

    const body = await req.json();
    const { requestId, action } = body;
    // Timer EA : J+7 depuis l'approbation, déterministe, indépendant de la 1ère connexion
    const EA_EXPIRES_AT = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

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

    // ── Guard : email invalide / booking SMS sans vrai email ──────────────────
    // Les leads créés depuis un booking Cal.com par SMS (ex: 243974750209@sms.cal.com)
    // ou les placeholders générés par le webhook (.invalid) ne peuvent PAS recevoir
    // de magic link → l'envoyer causerait un bounce et une DSN dans ta boîte.
    // L'admin doit d'abord mettre à jour l'email du lead avec le vrai email.
    const invalidEmailPatterns = ["@sms.cal.com", "@sms.invalid", ".invalid"];
    const emailLower = eaReq.email?.toLowerCase() || "";
    if (invalidEmailPatterns.some(p => emailLower.includes(p))) {
      throw new Error(
        `Email invalide — ce lead a booké directement via SMS sans passer par le formulaire Oracle. ` +
        `Email actuel : "${eaReq.email}". Mets à jour son email réel dans le CRM avant d'approuver.`
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

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

    // Phone duplicate check — skip entirely if phone is absent (optional field)
    const phoneClean = eaReq.phone ? eaReq.phone.replace(/\s+/g, "") : null;
    if (phoneClean) {
      const { data: allApproved } = await supabaseAdmin
        .from("early_access_requests")
        .select("id, first_name, phone")
        .eq("status", "approuvée")
        .neq("id", requestId);

      const dupPhone = (allApproved || []).find(
        (r: any) => r.phone && r.phone.replace(/\s+/g, "") === phoneClean
      );
      if (dupPhone) {
        await supabaseAdmin
          .from("early_access_requests")
          .update({ status: "doublon", reviewed_at: new Date().toISOString() })
          .eq("id", requestId);
        throw new Error(`Doublon téléphone détecté — ${phoneClean} déjà approuvé (${dupPhone.first_name})`);
      }
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
      // ── POLITIQUE DOUBLON AUTH ──────────────────────────────────────────────
      // Si l'email existe déjà dans auth.users (test précédent, soumission multiple,
      // ou compte créé par un autre chemin), on NE recrée PAS l'utilisateur.
      // On retrouve son UUID via une requête directe sur le schéma auth (fiable,
      // pas de pagination contrairement à listUsers()).
      // Le compte existant est conservé tel quel : on met juste à jour son rôle
      // et son profil. Cette logique est INTENTIONNELLE et documentée.
      // ────────────────────────────────────────────────────────────────────────
      if (createErr.message.includes("already been registered")) {
        // Recherche paginée avec perPage=1000 — auth schema non exposé par PostgREST.
        // Avec 1000/page on couvre tous les cas réels en 1-2 requêtes max.
        let foundUserId: string | null = null;
        let page = 1;
        const perPage = 1000;
        while (!foundUserId) {
          const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
          if (listErr) throw new Error(`Impossible de lister les utilisateurs: ${listErr.message}`);
          const found = users.find((u: any) => u.email?.toLowerCase() === eaReq.email.toLowerCase());
          if (found) { foundUserId = found.id; break; }
          if (users.length < perPage) break; // dernière page atteinte
          page++;
        }
        if (!foundUserId) throw new Error(`Utilisateur introuvable dans auth.users pour ${eaReq.email}`);
        userId = foundUserId;
      } else {
        throw new Error(`Création du compte échouée: ${createErr.message}`);
      }
    } else {
      userId = newUser.user.id;
    }

    // Set profile to active
    await supabaseAdmin.from("profiles").update({ status: "active" }).eq("user_id", userId);

    // ── POLITIQUE RÔLES (dans le marbre) ─────────────────────────────────────
    // Hiérarchie : super_admin > admin > setter > is_client > early_access > member
    // Règle : on n'ajoute JAMAIS un rôle inférieur à ce que l'user possède déjà.
    //
    // - super_admin / admin / setter → personnel interne, skip EA
    // - is_client (profiles.is_client=true) → accès permanent, skip EA
    // - early_access déjà existant → mettre à jour expires_at
    // - rien → insérer le rôle EA normalement
    // ─────────────────────────────────────────────────────────────────────────

    // Récupérer rôles existants + is_client en parallèle
    const [{ data: existingRoles }, { data: profileData }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("id, role").eq("user_id", userId),
      supabaseAdmin.from("profiles").select("is_client").eq("user_id", userId).maybeSingle(),
    ]);

    const roles = (existingRoles || []).map((r: any) => r.role as string);
    const isPrivileged = roles.some(r => ["super_admin", "admin", "setter"].includes(r));
    const isClient = profileData?.is_client === true;

    let roleNote = "";
    if (isPrivileged) {
      roleNote = `Rôle EA non assigné — utilisateur déjà staff (${roles.filter(r => ["super_admin","admin","setter"].includes(r)).join(", ")})`;
      console.log(`[approve] ${eaReq.email}: ${roleNote}`);
    } else if (isClient) {
      roleNote = "Rôle EA non assigné — utilisateur déjà client (accès permanent)";
      console.log(`[approve] ${eaReq.email}: ${roleNote}`);
    } else {
      // Utilisateur normal → assigner/mettre à jour le rôle EA
      const existingEA = (existingRoles || []).find((r: any) => r.role === "early_access");
      if (existingEA) {
        await supabaseAdmin.from("user_roles").update({
          early_access_type: "precall",
          expires_at: EA_EXPIRES_AT,
        }).eq("id", existingEA.id);
      } else {
        await supabaseAdmin.from("user_roles").insert({
          user_id: userId,
          role: "early_access",
          early_access_type: "precall",
          expires_at: EA_EXPIRES_AT,
        });
      }
    }

    // Update request status with user_id for CRM matching
    const { data: { user: caller } } = await callerClient.auth.getUser();
    const now = new Date().toISOString();
    const { error: updateReqErr } = await supabaseAdmin
      .from("early_access_requests")
      .update({
        status: "approuvée",
        reviewed_at: now,
        reviewed_by: caller?.id || null,
        user_id: userId,
      })
      .eq("id", requestId);
    if (updateReqErr) throw new Error(`Mise à jour du statut échouée: ${updateReqErr.message}`);

    // Marquer les autres demandes en_attente du même email comme doublons
    // (cas: lead a soumis le formulaire plusieurs fois)
    await supabaseAdmin
      .from("early_access_requests")
      .update({ status: "doublon", reviewed_at: now })
      .eq("status", "en_attente")
      .ilike("email", eaReq.email.trim())
      .neq("id", requestId);

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

    const baseMsg = emailSent
      ? `Compte créé pour ${eaReq.first_name} (${eaReq.email}). Email envoyé.`
      : `Compte créé pour ${eaReq.first_name} (${eaReq.email}). Email échoué — lien généré.`;
    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        magic_link: magicLink,
        role_note: roleNote || null,
        message: roleNote ? `${baseMsg} ⚠️ ${roleNote}` : baseMsg,
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
