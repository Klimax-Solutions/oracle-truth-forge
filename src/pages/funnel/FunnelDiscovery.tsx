import { useParams } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { useEffect, useRef } from 'react';
import { Loader2, Calendar, CheckCircle2 } from 'lucide-react';

// ============================================
// Funnel Discovery Page — Cal.com EMBED
// Route: /:slug/discovery
// Cal.com embed docs: https://cal.com/docs/embeds
// ============================================

/**
 * Extracts Cal.com username/event-slug from various URL formats:
 *   https://cal.com/username/event → username/event
 *   cal.com/username/event → username/event
 *   username/event → username/event
 */
function parseCalSlug(link: string): string | null {
  if (!link) return null;
  try {
    // Full URL
    if (link.includes('cal.com')) {
      const url = new URL(link.startsWith('http') ? link : `https://${link}`);
      // Remove leading slash, return path
      return url.pathname.replace(/^\//, '').replace(/\/$/, '') || null;
    }
    // Already a slug like "username/event"
    if (link.includes('/') && !link.includes(' ')) {
      return link.replace(/^\//, '').replace(/\/$/, '');
    }
    return null;
  } catch {
    return link.replace(/^\//, '').replace(/\/$/, '') || null;
  }
}

export default function FunnelDiscovery() {
  const { slug } = useParams<{ slug: string }>();
  const { config, loading } = useFunnelConfig(slug);
  const embedRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  const calSlug = config ? parseCalSlug(config.discovery_cal_link) : null;

  // Load Cal.com embed script and initialize
  useEffect(() => {
    if (!calSlug || scriptLoaded.current) return;

    // Load the Cal.com embed script
    const script = document.createElement('script');
    script.src = 'https://app.cal.com/embed/embed.js';
    script.async = true;
    script.onload = () => {
      scriptLoaded.current = true;
      // Initialize Cal inline embed
      if ((window as any).Cal) {
        (window as any).Cal("init", { origin: "https://cal.com" });
        (window as any).Cal("inline", {
          elementOrSelector: "#cal-embed",
          calLink: calSlug,
          layout: "month_view",
          config: {
            theme: "dark",
            hideEventTypeDetails: "false",
          },
        });
        // Style the embed
        (window as any).Cal("ui", {
          theme: "dark",
          styles: { branding: { brandColor: "#19B7C9" } },
          hideEventTypeDetails: false,
          layout: "month_view",
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script on unmount
      try { document.head.removeChild(script); } catch {}
    };
  }, [calSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080d] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-[#08080d] flex items-center justify-center text-white/40">
        Funnel non trouve
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col">
      {/* Header section */}
      <div className="text-center px-4 pt-10 pb-6">
        {/* Badge */}
        {config.discovery_badge_text && (
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-xs font-display text-emerald-400 uppercase tracking-widest mb-6">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {config.discovery_badge_text}
          </span>
        )}

        {/* Headline */}
        <h1 className="text-2xl md:text-3xl font-display font-bold mt-4">
          {config.discovery_headline || 'Reserve ton appel'}
        </h1>
        {config.discovery_subtitle && (
          <p className="text-white/50 text-sm md:text-base leading-relaxed mt-3 max-w-md mx-auto">
            {config.discovery_subtitle}
          </p>
        )}
      </div>

      {/* Cal.com embed */}
      {calSlug ? (
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 pb-8">
          <div
            id="cal-embed"
            ref={embedRef}
            className="w-full rounded-2xl overflow-hidden border border-white/[0.08]"
            style={{ minHeight: 500 }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-sm">
            <div className="w-14 h-14 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto">
              <Calendar className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">{config.discovery_cta_title || 'Appel strategique'}</h3>
              <p className="text-sm text-white/40 mt-1">{config.discovery_cta_subtitle || '30 minutes'}</p>
            </div>
            <div className="text-sm text-white/30 bg-white/[0.03] rounded-xl p-4 border border-dashed border-white/[0.10]">
              Lien Cal.com non configure. Ajoute-le dans le Funnel Editor.
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
