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
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const bodyText = await req.text();

    // ── Verify webhook signature ──
    const calWebhookSecret = Deno.env.get("CAL_WEBHOOK_SECRET");
    if (!calWebhookSecret) {
      console.error("CAL_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature =
      req.headers.get("x-cal-signature-256") ||
      req.headers.get("X-Cal-Signature-256") ||
      req.headers.get("cal-signature");

    if (!signature) {
      console.error("No signature header found");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifySignature(bodyText, signature, calWebhookSecret);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Webhook signature verified");

    // ── Parse payload ──
    const payload: CalPayload = JSON.parse(bodyText);
    const event = payload.triggerEvent;
    const booking = payload.payload;

    console.log(`[Cal.com] Event: ${event}, UID: ${booking.uid}`);

    // ── Init Supabase (service role for DB writes) ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Extract attendee info ──
    const attendee = booking.attendees?.[0];
    const attendeeEmail = attendee?.email?.toLowerCase().trim();
    const attendeeName = attendee?.name || "";

    if (!attendeeEmail) {
      console.warn("[Cal.com] No attendee email found, skipping");
      return new Response(JSON.stringify({ success: true, skipped: "no_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip Cal.com system emails
    if (attendeeEmail.endsWith("@cal.com") || attendeeEmail.endsWith("@sms.cal.com")) {
      console.log("[Cal.com] Skipping Cal.com system email:", attendeeEmail);
      return new Response(JSON.stringify({ success: true, skipped: "system_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BOOKING_CREATED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (event === "BOOKING_CREATED") {
      console.log(`[BOOKING_CREATED] ${attendeeName} <${attendeeEmail}> at ${booking.startTime}`);

      // Find lead by email
      const { data: leads, error: lookupError } = await supabase
        .from("early_access_requests")
        .select("*")
        .eq("email", attendeeEmail)
        .order("created_at", { ascending: false })
        .limit(5);

      if (lookupError) {
        console.error("[BOOKING_CREATED] Lookup error:", lookupError);
        throw new Error(`Lookup error: ${lookupError.message}`);
      }

      const callScheduledAt = booking.startTime
        ? new Date(booking.startTime).toISOString()
        : new Date().toISOString();

      // Build meeting URL from location or Cal.com default
      const meetingUrl = booking.location || null;

      if (leads && leads.length > 0) {
        // Prefer lead with form_submitted=true, fallback to most recent
        const lead = leads.find((l: any) => l.form_submitted) || leads[0];

        console.log(`[BOOKING_CREATED] Matched lead: ${lead.id} (${lead.first_name})`);

        const { error: updateError } = await supabase
          .from("early_access_requests")
          .update({
            call_booked: true,
            call_scheduled_at: callScheduledAt,
            call_meeting_url: meetingUrl,
            call_no_show: false,
            booking_event_id: booking.uid || null,
          })
          .eq("id", lead.id);

        if (updateError) {
          console.error("[BOOKING_CREATED] Update error:", updateError);
          throw new Error(`Update error: ${updateError.message}`);
        }

        console.log(`[BOOKING_CREATED] ✅ Lead ${lead.id} updated — call_booked=true, scheduled=${callScheduledAt}`);
      } else {
        // No matching lead → create a new one from the booking
        console.log(`[BOOKING_CREATED] No existing lead for ${attendeeEmail}, creating new`);

        const firstName = attendeeName.split(" ")[0] || attendeeEmail.split("@")[0];
        // Try to get phone from responses
        let phone = null;
        if (booking.responses) {
          const r = booking.responses as Record<string, any>;
          phone = r.phone?.value || r.phone || r.smsReminderNumber?.value || null;
        }

        const { error: insertError } = await supabase
          .from("early_access_requests")
          .insert({
            first_name: firstName,
            email: attendeeEmail,
            phone: phone || "",
            status: "en_attente",
            form_submitted: false,
            call_booked: true,
            call_scheduled_at: callScheduledAt,
            call_meeting_url: meetingUrl,
            booking_event_id: booking.uid || null,
          });

        if (insertError) {
          console.error("[BOOKING_CREATED] Insert error:", insertError);
          throw new Error(`Insert error: ${insertError.message}`);
        }

        console.log(`[BOOKING_CREATED] ✅ New lead created for ${attendeeEmail}`);
      }

      return new Response(JSON.stringify({ success: true, event: "booking_created", email: attendeeEmail }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BOOKING_CANCELLED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (event === "BOOKING_CANCELLED") {
      console.log(`[BOOKING_CANCELLED] ${attendeeEmail}, uid=${booking.uid}`);

      // Try by booking_event_id first, then fallback to email
      let lead = null;

      if (booking.uid) {
        const { data } = await supabase
          .from("early_access_requests")
          .select("*")
          .eq("booking_event_id", booking.uid)
          .maybeSingle();
        lead = data;
      }

      if (!lead) {
        const { data } = await supabase
          .from("early_access_requests")
          .select("*")
          .eq("email", attendeeEmail)
          .eq("call_booked", true)
          .order("call_scheduled_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        lead = data;
      }

      if (lead) {
        const { error } = await supabase
          .from("early_access_requests")
          .update({
            call_booked: false,
            call_scheduled_at: null,
            call_meeting_url: null,
            call_rescheduled_at: null,
          })
          .eq("id", lead.id);

        if (error) {
          console.error("[BOOKING_CANCELLED] Update error:", error);
          throw error;
        }

        console.log(`[BOOKING_CANCELLED] ✅ Lead ${lead.id} — call_booked=false`);
      } else {
        console.warn(`[BOOKING_CANCELLED] No lead found for uid=${booking.uid} / email=${attendeeEmail}`);
      }

      return new Response(JSON.stringify({ success: true, event: "booking_cancelled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BOOKING_RESCHEDULED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (event === "BOOKING_RESCHEDULED") {
      console.log(`[BOOKING_RESCHEDULED] ${attendeeEmail}, new time=${booking.startTime}`);

      let lead = null;

      // Find by booking_event_id or rescheduledFrom uid
      if (booking.uid) {
        const { data } = await supabase
          .from("early_access_requests")
          .select("*")
          .eq("booking_event_id", booking.uid)
          .maybeSingle();
        lead = data;
      }

      if (!lead && booking.rescheduledFrom) {
        const { data } = await supabase
          .from("early_access_requests")
          .select("*")
          .eq("booking_event_id", booking.rescheduledFrom)
          .maybeSingle();
        lead = data;
      }

      if (!lead) {
        const { data } = await supabase
          .from("early_access_requests")
          .select("*")
          .eq("email", attendeeEmail)
          .eq("call_booked", true)
          .order("call_scheduled_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        lead = data;
      }

      if (lead) {
        const newTime = booking.startTime
          ? new Date(booking.startTime).toISOString()
          : null;

        const { error } = await supabase
          .from("early_access_requests")
          .update({
            call_booked: true,
            call_scheduled_at: newTime,
            call_rescheduled_at: new Date().toISOString(),
            call_meeting_url: booking.location || lead.call_meeting_url,
            booking_event_id: booking.uid || lead.booking_event_id,
          })
          .eq("id", lead.id);

        if (error) {
          console.error("[BOOKING_RESCHEDULED] Update error:", error);
          throw error;
        }

        console.log(`[BOOKING_RESCHEDULED] ✅ Lead ${lead.id} — new time=${newTime}`);
      } else {
        console.warn(`[BOOKING_RESCHEDULED] No lead found for ${attendeeEmail}`);
      }

      return new Response(JSON.stringify({ success: true, event: "booking_rescheduled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Unhandled event ──
    console.log(`[Cal.com] Unhandled event: ${event} — ignoring`);
    return new Response(JSON.stringify({ success: true, event, skipped: "unhandled_event" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[Cal.com] Webhook error:", errMsg, err);
    return new Response(JSON.stringify({ error: "Internal server error", details: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
