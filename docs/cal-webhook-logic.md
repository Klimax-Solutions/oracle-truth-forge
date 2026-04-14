# Cal.com Webhook — Logique complète

## URL
`https://<project-ref>.supabase.co/functions/v1/cal-webhook`

## Sécurité
- **JWT désactivé** (`--no-verify-jwt`) car Cal.com n'envoie pas de token Supabase
- **HMAC-SHA256** vérifie chaque requête : Cal.com signe le body avec `CAL_WEBHOOK_SECRET`
- Exception : les events `PING` passent sans signature (bouton "tester" de Cal.com)

## Flow complet

```
Cal.com → POST /functions/v1/cal-webhook
  │
  ├─ PING ? → 200 OK (pas de vérification)
  │
  ├─ Vérifier signature HMAC-SHA256
  │   Headers: x-cal-signature-256 ou cal-signature
  │   Si invalide → 403
  │
  ├─ Extraire attendee email
  │   ├─ Email normal (ex: john@gmail.com) → match par email
  │   └─ @sms.cal.com (ex: 33612345678@sms.cal.com)
  │       → Booking par téléphone
  │       → Extraire digits, matcher par phone dans la DB
  │       → Compare les digits uniquement (ignore +, espaces)
  │
  ├─ BOOKING_CREATED
  │   ├─ Lead trouvé (par email ou phone)
  │   │   → Préfère celui avec form_submitted=true
  │   │   → UPDATE: call_booked=true, call_scheduled_at,
  │   │            call_meeting_url, booking_event_id, call_no_show=false
  │   │
  │   └─ Aucun lead trouvé
  │       → INSERT nouveau lead:
  │         first_name (depuis attendee name), email, phone (depuis responses),
  │         status='en_attente', form_submitted=false, call_booked=true
  │
  ├─ BOOKING_CANCELLED
  │   Match par: booking_event_id → email → phone (dans cet ordre)
  │   → UPDATE: call_booked=false, call_scheduled_at=null,
  │            call_meeting_url=null, call_rescheduled_at=null
  │
  ├─ BOOKING_RESCHEDULED
  │   Match par: booking_event_id → rescheduledFrom uid → email → phone
  │   → UPDATE: call_scheduled_at=nouveau, call_rescheduled_at=now(),
  │            booking_event_id=nouveau uid
  │
  └─ Autre event → 200 OK, log "Unhandled", ignoré
```

## Champs mis à jour dans early_access_requests

| Champ | BOOKING_CREATED | BOOKING_CANCELLED | BOOKING_RESCHEDULED |
|-------|----------------|-------------------|---------------------|
| call_booked | true | false | true |
| call_scheduled_at | startTime du booking | null | nouveau startTime |
| call_meeting_url | location du booking | null | nouveau ou ancien |
| booking_event_id | uid Cal.com | inchangé | nouveau uid |
| call_no_show | false | inchangé | inchangé |
| call_rescheduled_at | inchangé | null | now() |

## Matching des leads

### Par email (cas standard)
```
SELECT * FROM early_access_requests
WHERE email = '<attendee_email>'
ORDER BY created_at DESC LIMIT 5
```
→ Prend celui avec `form_submitted=true` en priorité, sinon le plus récent.

### Par téléphone (booking SMS)
Cal.com convertit le tel en faux email : `33781748022@sms.cal.com`
```
1. Extraire digits: "33781748022"
2. SELECT * FROM early_access_requests (les 50 plus récents)
3. Filtrer: lead.phone.replace(/\D/g, '') === digits
```
→ Compare uniquement les chiffres, ignore +, espaces, tirets.

### Par booking_event_id (cancel/reschedule)
```
SELECT * FROM early_access_requests
WHERE booking_event_id = '<uid>'
```
→ Match exact, le plus fiable.

## Configuration requise

### Cal.com (Settings > Developer > Webhooks)
- **URL** : `https://<ref>.supabase.co/functions/v1/cal-webhook`
- **Events** : BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED
- **Secret** : une clé secrète (même valeur que dans Supabase)

### Supabase (Edge Functions > Secrets)
- `CAL_WEBHOOK_SECRET` : même clé que dans Cal.com

### Deploy
```bash
npx supabase functions deploy cal-webhook --project-ref <ref> --no-verify-jwt
```
Le `--no-verify-jwt` est obligatoire car Cal.com n'envoie pas de JWT Supabase.

## Debugging
- Logs : Supabase Dashboard > Edge Functions > cal-webhook > Logs
- Chaque étape est loggée avec des préfixes : `[BOOKING_CREATED]`, `[Cal.com]`, etc.
- Les erreurs sont loggées et retournées en 500 avec le message
