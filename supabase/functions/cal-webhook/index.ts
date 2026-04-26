// ============================================
// Cal.com Webhook — Oracle CRM Integration
// Handles: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED
// Matches leads by email in early_access_requests
// Branch: crm-integration
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cal-signature, x-cal-signature-256",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// ── Types ──
interface CalPayload {
  triggerEvent: string;
  createdAt: string;
  payload: {
    title?: string;
    startTime?: string;
    endTime?: string;
    organizer?: { email: string; name: string; timeZone: string };
    attendees?: Array<{ email: string; name: string; timeZone: string; noShow?: boolean }>;
    uid?: string;
    bookingId?: number;
    metadata?: Record<string, unknown> | null;
    responses?: Record<string, unknown>;
    location?: string;
    status?: string;
    cancellationReason?: string;
    rescheduledFrom?: string;
    rescheduleReason?: string;
  };
}

// ── Logger ──
// Préfixe structuré pour retrouver facilement les logs dans Supabase Edge Logs.
// Format : [cal-webhook][EVENT] message
// Chaque opération critique logue : input → résultat → erreur éventuelle.
const log = {
  info:  (ctx: string, msg: string, data?: unknown) =>
    console.log(`[cal-webhook][${ctx}] ${msg}`, data !== undefined ? JSON.stringify(data) : ""),
  warn:  (ctx: string, msg: string, data?: unknown) =>
    console.warn(`[cal-webhook][${ctx}] ⚠️ ${msg}`, data !== undefined ? JSON.stringify(data) : ""),
  error: (ctx: string, msg: string, data?: unknown) =>
    console.error(`[cal-webhook][${ctx}] ❌ ${msg}`, data !== undefined ? JSON.stringify(data) : ""),
  ok:    (ctx: string, msg: string, data?: unknown) =>
    console.log(`[cal-webhook][${ctx}] ✅ ${msg}`, data !== undefined ? JSON.stringify(data) : ""),
};

// ── HMAC-SHA256 Signature Verification ──
async function verifySignature(bodyText: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === expected;
}

// ── Main Handler ──
Deno.serve(async (req: Request) => {
  // Log chaque requête entrante — méthode + headers utiles
  log.info("REQUEST", `${req.method} ${req.url}`, {
    headers: {
      "content-type": req.headers.get("content-type"),
      "x-cal-signature-256": req.headers.get("x-cal-signature-256") ? "[present]" : "[absent]",
      "cal-signature": req.headers.get("cal-signature") ? "[present]" : "[absent]",
    },
  });

  // CORS preflight
  if (req.method === "OPTIONS") {
    log.info("REQUEST", "CORS preflight — OK");
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    log.warn("REQUEST", `Method not allowed: ${req.method}`);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const bodyText = await req.text();
    // Log le body brut (tronqué à 2000 chars pour éviter les logs trop lourds)
    log.info("BODY", `Raw body (${bodyText.length} chars)`, bodyText.slice(0, 2000));

    // ── Vérification du secret ──
    const calWebhookSecret = Deno.env.get("CAL_WEBHOOK_SECRET");
    if (!calWebhookSecret) {
      log.error("CONFIG", "CAL_WEBHOOK_SECRET n'est pas configuré dans les secrets de la fonction");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    log.info("CONFIG", "CAL_WEBHOOK_SECRET présent ✓");

    // ── PING : Cal.com envoie un PING sans signature pour tester ──
    const parsedForPing = (() => { try { return JSON.parse(bodyText); } catch { return null; } })();
    if (parsedForPing?.triggerEvent === "PING") {
      log.ok("PING", "PING reçu — réponse 200");
      return new Response(JSON.stringify({ success: true, event: "PING" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Vérification de la signature HMAC ──
    const signature =
      req.headers.get("x-cal-signature-256") ||
      req.headers.get("X-Cal-Signature-256") ||
      req.headers.get("cal-signature");

    log.info("SIGNATURE", `Header reçu: ${signature ? signature.slice(0, 20) + "..." : "ABSENT"}`);

    if (!signature) {
      log.error("SIGNATURE", "Aucun header de signature trouvé — requête rejetée");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifySignature(bodyText, signature, calWebhookSecret);
    if (!isValid) {
      log.error("SIGNATURE", "Signature invalide — requête rejetée", { received: signature.slice(0, 20) });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    log.ok("SIGNATURE", "Signature vérifiée");

    // ── Parse du payload ──
    const payload: CalPayload = JSON.parse(bodyText);
    const event = payload.triggerEvent;
    const booking = payload.payload;

    log.info("EVENT", `Type: ${event}`, {
      uid: booking.uid,
      title: booking.title,
      startTime: booking.startTime,
      attendees: booking.attendees?.map(a => ({ name: a.name, email: a.email })),
      location: booking.location,
    });

    // ── Init Supabase (service role pour les writes DB) ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    log.info("SUPABASE", `Init client — URL: ${supabaseUrl}`);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Extraction de l'email de l'attendee ──
    const attendee = booking.attendees?.[0];
    const attendeeEmail = attendee?.email?.toLowerCase().trim();
    const attendeeName = attendee?.name || "";

    log.info("ATTENDEE", `email=${attendeeEmail}, name=${attendeeName}`);

    if (!attendeeEmail) {
      log.warn("ATTENDEE", "Aucun email d'attendee — event ignoré");
      return new Response(JSON.stringify({ success: true, skipped: "no_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip les emails Cal.com internes (sauf @sms.cal.com = booking par SMS)
    if (attendeeEmail.endsWith("@cal.com") && !attendeeEmail.endsWith("@sms.cal.com")) {
      log.info("ATTENDEE", `Email système Cal.com ignoré: ${attendeeEmail}`);
      return new Response(JSON.stringify({ success: true, skipped: "system_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pour les bookings SMS (@sms.cal.com) : extraire le numéro de téléphone
    const isSmsBooking = attendeeEmail.endsWith("@sms.cal.com");
    let smsPhone: string | null = null;
    if (isSmsBooking) {
      // Format : 33781748022@sms.cal.com → +33781748022
      const digits = attendeeEmail.split("@")[0];
      smsPhone = `+${digits}`;
      log.info("SMS", `Booking SMS détecté — téléphone extrait: ${smsPhone}`);
    }

    // ── Filet de sécurité : metadata Cal.com (form_email / form_phone) ──
    // On a injecté ces métadonnées au prefill Cal côté FunnelDiscovery pour
    // garantir qu'on retrouve le lead d'origine MÊME si l'utilisateur
    // change l'email dans Cal ou book par SMS. C'est notre source de vérité.
    const bookingMeta = (booking as any).metadata || {};
    const formEmail: string | null = typeof bookingMeta.form_email === "string"
      ? bookingMeta.form_email.toLowerCase().trim()
      : null;
    const formPhone: string | null = typeof bookingMeta.form_phone === "string"
      ? bookingMeta.form_phone.trim()
      : null;
    if (formEmail || formPhone) {
      log.info("METADATA", `form_email=${formEmail || "∅"}, form_phone=${formPhone || "∅"}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BOOKING_CREATED
    // Quand un lead réserve un call via Cal.com :
    // → on cherche son lead dans early_access_requests (par email ou tel)
    // → on met à jour call_booked=true + les infos de rdv
    // → si pas de lead trouvé, on en crée un nouveau
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (event === "BOOKING_CREATED") {
      log.info("BOOKING_CREATED", `Recherche du lead pour ${attendeeEmail}`);

      let leads: any[] | null = null;
      let lookupError: any = null;

      // Stratégie de réconciliation (par ordre de priorité) :
      // 1. metadata.form_email (notre source de vérité injectée au prefill)
      // 2. metadata.form_phone (idem)
      // 3. attendee.email si pas SMS
      // 4. téléphone extrait du @sms.cal.com OU de attendee.phoneNumber
      const tryLookupByEmail = async (email: string) => {
        const res = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, phone, call_booked, status, form_submitted")
          .ilike("email", email)
          .order("created_at", { ascending: false })
          .limit(5);
        return res;
      };

      const tryLookupByPhone = async (phoneRaw: string) => {
        const digits = phoneRaw.replace(/\D/g, '');
        if (!digits) return { data: [], error: null };
        const res = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, phone, call_booked, status, form_submitted")
          .order("created_at", { ascending: false })
          .limit: undefined as never; // sentinel — on fait limit après
        // (on refait proprement ci-dessous)
        const res2 = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, phone, call_booked, status, form_submitted")
          .order("created_at", { ascending: false })
          .limit(100);
        const filtered = (res2.data || []).filter((l: any) => {
          if (!l.phone) return false;
          const leadDigits = l.phone.replace(/\D/g, '');
          return leadDigits === digits || leadDigits === digits.replace(/^0+/, '') || leadDigits.endsWith(digits.slice(-9));
        });
        return { data: filtered, error: res2.error };
      };

      // Étape 1 : metadata.form_email
      if (formEmail) {
        log.info("BOOKING_CREATED", `Lookup #1 (metadata.form_email): ${formEmail}`);
        const res = await tryLookupByEmail(formEmail);
        leads = res.data; lookupError = res.error;
        log.info("BOOKING_CREATED", `Résultat lookup form_email`, { count: leads?.length });
      }

      // Étape 2 : metadata.form_phone
      if ((!leads || leads.length === 0) && formPhone) {
        log.info("BOOKING_CREATED", `Lookup #2 (metadata.form_phone): ${formPhone}`);
        const res = await tryLookupByPhone(formPhone);
        leads = res.data; lookupError = res.error;
        log.info("BOOKING_CREATED", `Résultat lookup form_phone`, { count: leads?.length });
      }

      // Étape 3 : attendee.email (si pas SMS)
      if ((!leads || leads.length === 0) && !isSmsBooking) {
        log.info("BOOKING_CREATED", `Lookup #3 (attendee.email): ${attendeeEmail}`);
        const res = await tryLookupByEmail(attendeeEmail);
        leads = res.data; lookupError = res.error;
        log.info("BOOKING_CREATED", `Résultat lookup attendee.email`, { count: leads?.length });
      }

      // Étape 4 : téléphone (SMS booking ou attendee.phoneNumber)
      if (!leads || leads.length === 0) {
        const phoneCandidate = smsPhone || (attendee as any)?.phoneNumber || null;
        if (phoneCandidate) {
          log.info("BOOKING_CREATED", `Lookup #4 (phone fallback): ${phoneCandidate}`);
          const res = await tryLookupByPhone(phoneCandidate);
          leads = res.data; lookupError = res.error;
          log.info("BOOKING_CREATED", `Résultat lookup phone`, { count: leads?.length });
        }
      }

      if (lookupError) {
        log.error("BOOKING_CREATED", "Erreur lors du lookup DB", lookupError);
        throw new Error(`Lookup error: ${lookupError.message}`);
      }

      const callScheduledAt = booking.startTime
        ? new Date(booking.startTime).toISOString()
        : new Date().toISOString();
      const meetingUrl = booking.location || null;

      log.info("BOOKING_CREATED", `Données à écrire`, {
        call_booked: true,
        call_scheduled_at: callScheduledAt,
        call_meeting_url: meetingUrl,
        booking_event_id: booking.uid,
      });

      if (leads && leads.length > 0) {
        // Préférer le lead avec form_submitted=true, fallback sur le plus récent
        const lead = leads.find((l: any) => l.form_submitted) || leads[0];
        log.info("BOOKING_CREATED", `Lead sélectionné: ${lead.id} (${lead.first_name} — ${lead.email})`);

        const updateData = {
          call_booked: true,
          call_scheduled_at: callScheduledAt,
          call_meeting_url: meetingUrl,
          call_no_show: false,
          booking_event_id: booking.uid || null,
        };

        log.info("BOOKING_CREATED", `UPDATE early_access_requests id=${lead.id}`, updateData);
        const { error: updateError } = await supabase
          .from("early_access_requests")
          .update(updateData)
          .eq("id", lead.id);

        if (updateError) {
          log.error("BOOKING_CREATED", "Erreur UPDATE", updateError);
          throw new Error(`Update error: ${updateError.message}`);
        }

        log.ok("BOOKING_CREATED", `Lead ${lead.id} mis à jour — call_booked=true, scheduled=${callScheduledAt}`);
      } else {
        // Aucun lead trouvé → création automatique depuis le booking
        log.warn("BOOKING_CREATED", `Aucun lead trouvé pour ${attendeeEmail} — création d'un nouveau lead`);

        const firstName = attendeeName.split(" ")[0] || attendeeEmail.split("@")[0];
        let phone = null;
        if (booking.responses) {
          const r = booking.responses as Record<string, any>;
          phone = r.phone?.value || r.phone || r.smsReminderNumber?.value || null;
          log.info("BOOKING_CREATED", `Téléphone extrait des responses: ${phone}`);
        }

        const insertData = {
          first_name: firstName,
          email: attendeeEmail,
          phone: phone || "",
          status: "en_attente",
          form_submitted: false,
          call_booked: true,
          call_scheduled_at: callScheduledAt,
          call_meeting_url: meetingUrl,
          booking_event_id: booking.uid || null,
        };

        log.info("BOOKING_CREATED", `INSERT early_access_requests`, insertData);
        const { error: insertError } = await supabase
          .from("early_access_requests")
          .insert(insertData);

        if (insertError) {
          log.error("BOOKING_CREATED", "Erreur INSERT", insertError);
          throw new Error(`Insert error: ${insertError.message}`);
        }

        log.ok("BOOKING_CREATED", `Nouveau lead créé pour ${attendeeEmail}`);
      }

      return new Response(JSON.stringify({ success: true, event: "booking_created", email: attendeeEmail }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BOOKING_CANCELLED
    // Quand un lead annule son call :
    // → on cherche par booking_event_id (le plus fiable) puis par email
    // → call_booked=false + on efface les champs de rdv
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (event === "BOOKING_CANCELLED") {
      log.info("BOOKING_CANCELLED", `uid=${booking.uid}, email=${attendeeEmail}`);

      let lead = null;

      // Étape 1 : recherche par booking_event_id (le plus fiable — évite les faux matchs)
      if (booking.uid) {
        log.info("BOOKING_CANCELLED", `Lookup par booking_event_id: ${booking.uid}`);
        const { data, error } = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, call_booked")
          .eq("booking_event_id", booking.uid)
          .maybeSingle();
        log.info("BOOKING_CANCELLED", `Résultat lookup uid`, { found: !!data, error: error?.message });
        lead = data;
      }

      // Étape 2 : fallback par email si UID ne match pas
      if (!lead && !isSmsBooking) {
        log.info("BOOKING_CANCELLED", `Fallback lookup par email: ${attendeeEmail}`);
        const { data, error } = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, call_booked")
          .eq("email", attendeeEmail)
          .eq("call_booked", true)
          .order("call_scheduled_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        log.info("BOOKING_CANCELLED", `Résultat lookup email`, { found: !!data, error: error?.message });
        lead = data;
      }

      // Étape 3 : fallback par téléphone pour SMS bookings
      if (!lead && isSmsBooking && smsPhone) {
        const digits = smsPhone.replace(/\D/g, '');
        log.info("BOOKING_CANCELLED", `Fallback lookup par téléphone, digits: ${digits}`);
        const { data: all } = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, phone, call_booked")
          .eq("call_booked", true);
        lead = (all || []).find((l: any) => l.phone && l.phone.replace(/\D/g, '') === digits) || null;
        log.info("BOOKING_CANCELLED", `Résultat lookup téléphone`, { found: !!lead });
      }

      if (lead) {
        const updateData = {
          call_booked: false,
          call_scheduled_at: null,
          call_meeting_url: null,
          call_rescheduled_at: null,
        };

        log.info("BOOKING_CANCELLED", `UPDATE lead ${lead.id} (${lead.first_name})`, updateData);
        const { error } = await supabase
          .from("early_access_requests")
          .update(updateData)
          .eq("id", lead.id);

        if (error) {
          log.error("BOOKING_CANCELLED", "Erreur UPDATE", error);
          throw error;
        }

        log.ok("BOOKING_CANCELLED", `Lead ${lead.id} — call_booked=false, champs rdv effacés`);
      } else {
        log.warn("BOOKING_CANCELLED", `Aucun lead trouvé — uid=${booking.uid}, email=${attendeeEmail}`);
      }

      return new Response(JSON.stringify({ success: true, event: "booking_cancelled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BOOKING_RESCHEDULED
    // Quand un lead reprogramme son call :
    // → on cherche par uid ou rescheduledFrom uid, puis par email
    // → on met à jour le nouveau créneau + call_rescheduled_at (ancienne heure)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (event === "BOOKING_RESCHEDULED") {
      log.info("BOOKING_RESCHEDULED", `uid=${booking.uid}, rescheduledFrom=${booking.rescheduledFrom}, newTime=${booking.startTime}`);

      let lead = null;

      // Étape 1 : par uid courant
      if (booking.uid) {
        log.info("BOOKING_RESCHEDULED", `Lookup par booking_event_id (uid courant): ${booking.uid}`);
        const { data, error } = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, call_booked, call_meeting_url, booking_event_id")
          .eq("booking_event_id", booking.uid)
          .maybeSingle();
        log.info("BOOKING_RESCHEDULED", `Résultat lookup uid courant`, { found: !!data, error: error?.message });
        lead = data;
      }

      // Étape 2 : par l'ancien uid (rescheduledFrom)
      if (!lead && booking.rescheduledFrom) {
        log.info("BOOKING_RESCHEDULED", `Lookup par rescheduledFrom: ${booking.rescheduledFrom}`);
        const { data, error } = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, call_booked, call_meeting_url, booking_event_id")
          .eq("booking_event_id", booking.rescheduledFrom)
          .maybeSingle();
        log.info("BOOKING_RESCHEDULED", `Résultat lookup rescheduledFrom`, { found: !!data, error: error?.message });
        lead = data;
      }

      // Étape 3 : fallback par email
      if (!lead && !isSmsBooking) {
        log.info("BOOKING_RESCHEDULED", `Fallback lookup par email: ${attendeeEmail}`);
        const { data, error } = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, call_booked, call_meeting_url, booking_event_id")
          .eq("email", attendeeEmail)
          .eq("call_booked", true)
          .order("call_scheduled_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        log.info("BOOKING_RESCHEDULED", `Résultat lookup email`, { found: !!data, error: error?.message });
        lead = data;
      }

      // Étape 4 : fallback par téléphone
      if (!lead && isSmsBooking && smsPhone) {
        const digits = smsPhone.replace(/\D/g, '');
        log.info("BOOKING_RESCHEDULED", `Fallback lookup par téléphone, digits: ${digits}`);
        const { data: all } = await supabase
          .from("early_access_requests")
          .select("id, first_name, email, phone, call_booked, call_meeting_url, booking_event_id")
          .eq("call_booked", true);
        lead = (all || []).find((l: any) => l.phone && l.phone.replace(/\D/g, '') === digits) || null;
        log.info("BOOKING_RESCHEDULED", `Résultat lookup téléphone`, { found: !!lead });
      }

      if (lead) {
        const newTime = booking.startTime
          ? new Date(booking.startTime).toISOString()
          : null;

        const updateData = {
          call_booked: true,
          call_scheduled_at: newTime,
          call_rescheduled_at: new Date().toISOString(), // heure de la reprogrammation
          call_meeting_url: booking.location || lead.call_meeting_url,
          booking_event_id: booking.uid || lead.booking_event_id,
        };

        log.info("BOOKING_RESCHEDULED", `UPDATE lead ${lead.id} (${lead.first_name})`, updateData);
        const { error } = await supabase
          .from("early_access_requests")
          .update(updateData)
          .eq("id", lead.id);

        if (error) {
          log.error("BOOKING_RESCHEDULED", "Erreur UPDATE", error);
          throw error;
        }

        log.ok("BOOKING_RESCHEDULED", `Lead ${lead.id} — nouveau créneau: ${newTime}`);
      } else {
        log.warn("BOOKING_RESCHEDULED", `Aucun lead trouvé — uid=${booking.uid}, email=${attendeeEmail}`);
      }

      return new Response(JSON.stringify({ success: true, event: "booking_rescheduled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Événement non géré ──
    log.warn("EVENT", `Événement non géré: ${event} — ignoré`);
    return new Response(JSON.stringify({ success: true, event, skipped: "unhandled_event" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
    log.error("CATCH", `Erreur non gérée: ${errMsg}`, err);
    return new Response(JSON.stringify({ error: "Internal server error", details: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
