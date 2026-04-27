import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Loader2, Calendar, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { flushPendingLeads, getFunnelSession, storeFunnelSession } from '@/lib/funnelLeadQueue';

// ── SLICE: syncBookingToDB ────────────────────────────────────────────────────
// Best-effort côté client — purement de la redondance.
// ⚠️  RLS NOTE : les utilisateurs anon du funnel ne peuvent pas UPDATE ni SELECT
// sur early_access_requests (policy : is_super_admin() / is_setter() uniquement).
// Cette fonction sera donc silencieusement no-op pour les visiteurs non-auth.
// C'est INTENTIONNEL : le cal-webhook (edge function service_role) est la source
// de vérité canonique pour call_booked / call_scheduled_at / call_meeting_url.
// syncBookingToDB ne sert que si le webhook Cal.com est en retard ou absent.
// Never throws — failure is logged but never blocks the redirect flow.
// ─────────────────────────────────────────────────────────────────────────────
async function syncBookingToDB(opts: {
  requestId?: string | null;
  email: string;
  scheduledAt: string | null;
  meetingUrl: string | null;
}) {
  try {
    let requestId = opts.requestId || null;

    // Si pas de request_id direct, lookup par email
    if (!requestId) {
      if (!opts.email.trim()) return;
      const { data: rows, error: findErr } = await supabase
        .from('early_access_requests')
        .select('id')
        .ilike('email', opts.email.trim())
        .limit(1);
      if (findErr || !rows?.length) {
        console.warn('[Discovery] syncBookingToDB: lead not found for', opts.email);
        return;
      }
      requestId = rows[0].id;
    }

    await supabase.from('early_access_requests').update({
      call_booked: true,
      ...(opts.scheduledAt ? { call_scheduled_at: opts.scheduledAt } : {}),
      ...(opts.meetingUrl   ? { call_meeting_url: opts.meetingUrl }   : {}),
    }).eq('id', requestId);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('lead_events').insert({
      request_id: requestId,
      event_type: 'call_booked',
      source: 'funnel',
      metadata: {
        scheduled_at: opts.scheduledAt,
        meeting_url: opts.meetingUrl,
      },
      created_by: user?.id || null,
    });
  } catch (err) {
    console.warn('[Discovery] syncBookingToDB failed (non-blocking):', err);
  }
}

function buildCalEmbedUrl(link: string): string | null {
  if (!link?.trim()) return null;
  const trimmed = link.trim();
  let calPath: string;
  try {
    if (trimmed.includes('cal.com')) {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      calPath = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    } else if (trimmed.includes('/') && !trimmed.includes(' ')) {
      calPath = trimmed.replace(/^\//, '').replace(/\/$/, '');
    } else {
      return null;
    }
  } catch {
    calPath = trimmed.replace(/^\//, '').replace(/\/$/, '');
  }
  if (!calPath) return null;
  return `https://cal.com/${calPath}?embed=true&theme=dark&layout=month_view`;
}

function appendCalPrefill(url: string, name?: string, email?: string, phone?: string): string {
  if (!url) return url;
  const parts: string[] = [];
  if (name) parts.push(`name=${encodeURIComponent(name)}`);
  if (email) parts.push(`email=${encodeURIComponent(email)}`);
  if (phone) parts.push(`phone=${encodeURIComponent(phone)}`);
  // Filet de sécurité : on passe l'email du form en metadata Cal.com.
  // Si l'utilisateur change l'email dans Cal OU book par SMS, le webhook
  // pourra retrouver le lead d'origine via metadata.form_email (cf. cal-webhook).
  if (email) parts.push(`metadata[form_email]=${encodeURIComponent(email)}`);
  if (phone) parts.push(`metadata[form_phone]=${encodeURIComponent(phone)}`);
  if (!parts.length) return url;
  return `${url}&${parts.join('&')}`;
}

export default function FunnelDiscovery() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { config, loading } = useFunnelConfig(slug);

  // ── Guard : accès direct sans form ────────────────────────────────────────
  // Bloque les visiteurs qui arrivent sur /discovery sans avoir rempli le form.
  // Cas légitimes sans session locale : email Kit avec lead_id dans l'URL.
  // Tous les autres sans session → redirect vers /apply.
  const leadIdParam = searchParams.get('lead_id') || null;
  const hasValidEntry = useMemo(() => {
    if (leadIdParam) return true;                      // Email Kit avec lead_id
    if (searchParams.get('email')) return true;        // Email Kit avec email param (nurture séquence)
    const s = getFunnelSession();
    return !!s?.email;                                 // A rempli le form dans cette session
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasValidEntry && !loading && slug) {
      navigate(`/${slug}/apply`, { replace: true });
    }
  }, [hasValidEntry, loading, slug, navigate]);

  // ── lead_id URL param (depuis emails Kit) ──────────────────────────────────
  // Format email Kit : /discovery?lead_id={{ subscriber.lead_id }}&email=...&name=...
  // Le lead_id est l'UUID de early_access_requests — on le stocke en session
  // pour que FunnelFinal puisse faire UPDATE par ID (pas par email).
  // On fetche aussi le téléphone depuis la DB pour le prefill Cal.com (absent de l'URL Kit).
  useEffect(() => {
    if (!leadIdParam) return;
    const existingSession = getFunnelSession();

    // Fetch le lead en DB pour récupérer first_name + phone (absents du lien Kit)
    supabase
      .from('early_access_requests')
      .select('first_name, phone')
      .eq('id', leadIdParam)
      .maybeSingle()
      .then(({ data }) => {
        storeFunnelSession({
          request_id: leadIdParam,
          email:      searchParams.get('email') || existingSession?.email || '',
          first_name: searchParams.get('name')  || data?.first_name || existingSession?.first_name || '',
          phone:      searchParams.get('phone') || data?.phone      || existingSession?.phone      || undefined,
        });
      })
      .catch(() => {
        // Fallback sans phone si la DB est injoignable
        if (!existingSession?.request_id) {
          storeFunnelSession({
            request_id: leadIdParam,
            email:      searchParams.get('email') || existingSession?.email || '',
            first_name: searchParams.get('name')  || existingSession?.first_name || '',
            phone:      searchParams.get('phone') || existingSession?.phone || undefined,
          });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdParam]);

  // Session locale (stockée par funnelLeadQueue après submit du form)
  // Fallback si les URL params sont perdus (ex: refresh de page)
  const session = useMemo(() => getFunnelSession(), []);

  // prefillPhone est réactif : il se met à jour quand le fetch DB (lead_id path) retourne
  // le numéro. On initialise depuis l'URL ou la session locale, et on override si la DB
  // retourne un numéro plus complet (ex: arrivée via email Kit sans phone dans l'URL).
  const [prefillPhone, setPrefillPhone] = useState<string | undefined>(
    searchParams.get('phone') || session?.phone || undefined
  );
  useEffect(() => {
    if (!leadIdParam) return;
    // Le useEffect leadIdParam fetche la DB et store en session.
    // On poll la session une fois la promesse résolue. 800ms = marge suffisante
    // même sur réseau lent (3G/4G mobile) pour que le fetch DB soit terminé avant
    // que l'iframe Cal.com soit montée — évite la race condition phone absent du prefill.
    const t = setTimeout(() => {
      const s = getFunnelSession();
      if (s?.phone) setPrefillPhone(s.phone);
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdParam]);

  const prefillName  = searchParams.get('name')  || session?.first_name || undefined;
  const prefillEmail = searchParams.get('email') || session?.email      || undefined;
  const calBase = config?.discovery_cal_link ? buildCalEmbedUrl(config.discovery_cal_link) : null;
  const embedUrl = calBase ? appendCalPrefill(calBase, prefillName, prefillEmail, prefillPhone) : null;

  // Rejoue tout lead bloqué dans la queue locale (best-effort, non-blocking)
  useEffect(() => { flushPendingLeads().catch(() => {}); }, []);

  const [booked, setBooked] = useState(false);
  // Ref synchrone pour éviter le double-fire : Cal.com envoie parfois plusieurs
  // events booking successifs (bookingSuccessfulV2 + __routeChanged) avant que
  // React ne re-render avec booked=true (closure stale). Le ref est mis à jour
  // immédiatement et empêche le deuxième event de déclencher syncBookingToDB.
  const bookedRef = useRef(false);
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || bookedRef.current) return;

      const data = typeof event.data === 'string'
        ? (() => { try { return JSON.parse(event.data); } catch { return null; } })()
        : event.data;
      if (!data) return;

      const calAction = data?.Cal?.action || data?.action || data?.type || '';
      if (calAction || data?.Cal) {
        console.log('[Discovery] Cal.com message:', calAction, data);
      }

      const isBooking =
        calAction === 'bookingSuccessful' ||
        calAction === 'bookingSuccessfulV2' ||
        data.type === 'CAL:booking_successful' ||
        data.type === '__cal_booking_successful' ||
        data.action === 'bookingSuccessful' ||
        (calAction === '__routeChanged' && typeof data?.Cal?.data?.url === 'string' && data.Cal.data.url.includes('/booking/'));

      if (isBooking) {
        bookedRef.current = true; // synchrone — bloque tout event suivant immédiatement
        setBooked(true);
        const bookingData = data.Cal?.data || data.data || {};
        const rawDate = bookingData.date || bookingData.startTime || bookingData.booking?.startTime || '';
        const email = bookingData.attendees?.[0]?.email || bookingData.email || prefillEmail || '';
        const meetingUrl = bookingData.meeting?.url || bookingData.meetingUrl || bookingData.booking?.metadata?.videoCallUrl || null;

        const scheduledAt = rawDate ? new Date(rawDate).toISOString() : null;
        let dateLabel = '';
        if (rawDate) {
          try {
            dateLabel = new Date(rawDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
          } catch { dateLabel = rawDate; }
        }

        // Relire la session directement (pas via le memo stale) pour avoir
        // le request_id même si storeFunnelSession() a été appelé après le mount
        // (ex: lead_id URL param arrivé et hydraté par le useEffect).
        const liveSession = getFunnelSession();
        const syncEmail = email || liveSession?.email || '';
        if (syncEmail) {
          syncBookingToDB({
            requestId: liveSession?.request_id,
            email: syncEmail,
            scheduledAt,
            meetingUrl,
          });
        }

        const params = new URLSearchParams();
        if (dateLabel) params.set('date', dateLabel);
        if (email) params.set('email', email);
        if (prefillName) params.set('name', prefillName);

        navigate(`/${slug}/final${params.toString() ? `?${params}` : ''}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [slug, navigate, prefillName, prefillEmail, session, booked]);

  // Redirect en cours (guard) — écran vide pour éviter le flash de contenu
  if (!hasValidEntry) {
    return <div className="min-h-screen bg-background" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
        Funnel non trouvé
      </div>
    );
  }

  const footerText = config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString())
    || `Oracle © ${new Date().getFullYear()} — Accès confidentiel`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Header */}
      <div className="text-center px-4 md:px-6 pt-12 md:pt-16 pb-6">
        {config.discovery_badge_text && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] md:text-xs font-mono text-emerald-500 uppercase tracking-[0.25em] mb-6">
            <CheckCircle2 className="w-3 h-3" />
            {config.discovery_badge_text}
          </span>
        )}

        <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] md:tracking-[0.4em] text-muted-foreground mb-4 md:mb-6">
          Réservation
        </p>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground">
          {config.discovery_headline || 'Réserve ton appel'}
        </h1>
        {config.discovery_subtitle && (
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed mt-4 max-w-md mx-auto">
            {config.discovery_subtitle}
          </p>
        )}
      </div>

      <div className="w-full max-w-md h-px bg-border mx-auto mb-8" />

      {/* Cal.com embed */}
      {embedUrl ? (
        <div className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 pb-10">
          <div className="border border-border bg-card rounded-md overflow-hidden">
            <iframe
              src={embedUrl}
              title="Réserver un appel"
              className="w-full block"
              style={{
                height: 'min(calc((100vw - 3rem) * 9 / 16), 78vh)',
                minHeight: 560,
                border: 'none',
                colorScheme: 'dark',
              }}
              loading="lazy"
              allow="payment"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4 md:px-6 pb-10">
          <div className="text-center space-y-5 max-w-sm border border-border bg-card rounded-md p-8">
            <div className="w-12 h-12 rounded-md bg-muted border border-border flex items-center justify-center mx-auto">
              <Calendar className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{config.discovery_cta_title || 'Appel stratégique'}</h3>
              <p className="text-sm text-muted-foreground mt-1">{config.discovery_cta_subtitle || '30 minutes'}</p>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-4">
              Lien Cal.com non configuré. Ajoute-le dans le Funnel Editor.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] md:tracking-[0.3em]">
          {footerText}
        </p>
      </footer>
    </div>
  );
}
