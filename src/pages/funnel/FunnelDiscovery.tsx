import { useParams } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { Loader2, Calendar, ExternalLink } from 'lucide-react';

// ============================================
// Funnel Discovery Page — Book a call
// Route: /:slug/discovery
// ============================================

export default function FunnelDiscovery() {
  const { slug } = useParams<{ slug: string }>();
  const { config, loading } = useFunnelConfig(slug);

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

  const calLink = config.discovery_cal_link;

  return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Badge */}
        {config.discovery_badge_text && (
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/15 border border-primary/25 text-xs font-display text-primary uppercase tracking-widest">
            {config.discovery_badge_text}
          </span>
        )}

        {/* Headline */}
        <div className="space-y-3">
          <h1 className="text-3xl font-display font-bold">
            {config.discovery_headline || 'Reserve ton appel'}
          </h1>
          {config.discovery_subtitle && (
            <p className="text-white/50 text-base leading-relaxed">{config.discovery_subtitle}</p>
          )}
        </div>

        {/* CTA Card */}
        <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl p-6 space-y-4">
          <div className="w-14 h-14 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto">
            <Calendar className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">{config.discovery_cta_title || 'Appel strategique'}</h3>
            <p className="text-sm text-white/40 mt-1">{config.discovery_cta_subtitle || '30 minutes'}</p>
          </div>

          {calLink ? (
            <a
              href={calLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-display text-sm font-semibold tracking-wide transition-all shadow-[0_0_20px_rgba(25,183,201,0.2)] flex items-center justify-center gap-2"
            >
              {config.discovery_cta_button || 'Reserver mon appel'}
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <div className="text-sm text-white/30 bg-white/[0.03] rounded-xl p-4 border border-dashed border-white/[0.10]">
              Lien Cal.com non configure. Ajoute-le dans le Funnel Editor.
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4">
        <p className="text-[10px] text-white/15 font-display">
          {config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString()) || `© ${new Date().getFullYear()} Oracle`}
        </p>
      </footer>
    </div>
  );
}
