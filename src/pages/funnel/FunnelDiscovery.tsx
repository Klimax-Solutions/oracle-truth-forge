import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { useEffect, useState } from 'react';
import { Loader2, Calendar, CheckCircle2 } from 'lucide-react';

// ============================================
// Funnel Discovery Page — Cal.com iframe embed
// Route: /:slug/discovery
// On booking success → redirect to /:slug/final
// ============================================

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
  if (!parts.length) return url;
  return `${url}&${parts.join('&')}`;
}

export default function FunnelDiscovery() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { config, loading } = useFunnelConfig(slug);

  const prefillName = searchParams.get('name') || undefined;
  const prefillEmail = searchParams.get('email') || undefined;
  const prefillPhone = searchParams.get('phone') || undefined;
  const embedUrl = config?.discovery_cal_link
    ? appendCalPrefill(buildCalEmbedUrl(config.discovery_cal_link)!, prefillName, prefillEmail, prefillPhone)
    : null;

  // Listen for Cal.com booking success via postMessage
  // Cal.com sends messages in various formats — catch them all
  const [booked, setBooked] = useState(false);
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || booked) return;

      const data = typeof event.data === 'string'
        ? (() => { try { return JSON.parse(event.data); } catch { return null; } })()
        : event.data;
      if (!data) return;

      // Log all Cal messages for debug
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
        // Cal.com v2 also sends __routeChanged to /booking/... after success
        (calAction === '__routeChanged' && typeof data?.Cal?.data?.url === 'string' && data.Cal.data.url.includes('/booking/'));

      if (isBooking) {
        setBooked(true);
        const bookingData = data.Cal?.data || data.data || {};
        const date = bookingData.date || bookingData.startTime || bookingData.booking?.startTime || '';
        const email = bookingData.attendees?.[0]?.email || bookingData.email || prefillEmail || '';

        let dateLabel = '';
        if (date) {
          try {
            dateLabel = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
          } catch { dateLabel = date; }
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
  }, [slug, navigate, prefillName, prefillEmail, booked]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center text-white/40">
        Funnel non trouvé
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B10] text-white flex flex-col">
      {/* Header */}
      <div className="text-center px-4 pt-10 pb-6">
        {config.discovery_badge_text && (
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-xs font-display text-emerald-400 uppercase tracking-widest mb-6">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {config.discovery_badge_text}
          </span>
        )}

        <h1 className="text-2xl md:text-3xl font-display font-bold mt-4">
          {config.discovery_headline || 'Réserve ton appel'}
        </h1>
        {config.discovery_subtitle && (
          <p className="text-white/50 text-sm md:text-base leading-relaxed mt-3 max-w-md mx-auto">
            {config.discovery_subtitle}
          </p>
        )}
      </div>

      {/* Cal.com embed */}
      {embedUrl ? (
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 pb-8">
          <iframe
            src={embedUrl}
            title="Réserver un appel"
            className="w-full rounded-2xl border border-white/[0.08]"
            style={{ minHeight: 650, border: 'none', colorScheme: 'dark' }}
            loading="lazy"
            allow="payment"
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-14 h-14 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto">
              <Calendar className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">{config.discovery_cta_title || 'Appel stratégique'}</h3>
              <p className="text-sm text-white/40 mt-1">{config.discovery_cta_subtitle || '30 minutes'}</p>
            </div>
            <div className="text-sm text-white/30 bg-white/[0.03] rounded-xl p-4 border border-dashed border-white/[0.10]">
              Lien Cal.com non configuré. Ajoute-le dans le Funnel Editor.
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-[10px] text-white/15 font-display">
          {config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString()) || `© ${new Date().getFullYear()} Oracle`}
        </p>
      </footer>
    </div>
  );
}
