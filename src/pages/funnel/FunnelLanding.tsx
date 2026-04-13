import { useParams, useNavigate } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { Loader2, ArrowRight } from 'lucide-react';

// ============================================
// Funnel Landing Page
// Route: /:slug (root) or /:slug/landing
// CTA → redirects to /:slug/apply
// ============================================

export default function FunnelLanding() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { config, loading } = useFunnelConfig(slug);

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
    <div className="min-h-screen bg-[#0A0B10] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.04] rounded-full blur-[120px] pointer-events-none" />

      <div className="text-center space-y-8 max-w-lg relative z-10">
        {/* Brand */}
        <div className="font-display text-xs tracking-[0.4em] uppercase text-white/40">
          {config.brand_name || 'Oracle'}
        </div>

        {/* Headline */}
        <h1 className="font-display text-3xl md:text-4xl text-white leading-tight">
          {config.landing_headline || 'Titre principal'}{' '}
          <span className="text-primary">{config.landing_headline_accent || ''}</span>
        </h1>

        {/* Subtitle */}
        {config.landing_subtitle && (
          <p className="text-sm md:text-base text-white/50 leading-relaxed max-w-md mx-auto">
            {config.landing_subtitle}
          </p>
        )}

        {/* Divider */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-primary/30" />
          <div className="w-2 h-2 border border-primary/40 rotate-45" />
          <div className="w-12 h-px bg-gradient-to-l from-transparent to-primary/30" />
        </div>

        {/* CTA */}
        <div>
          <button
            onClick={() => navigate(`/${slug}/apply`)}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary rounded-xl text-white font-display text-sm tracking-wider shadow-[0_0_30px_rgba(25,183,201,0.3)] hover:shadow-[0_0_50px_rgba(25,183,201,0.4)] hover:scale-[1.02] transition-all"
          >
            {config.landing_cta_text || 'Commencer'}
            <ArrowRight className="w-4 h-4" />
          </button>
          {config.landing_cta_subtext && (
            <p className="text-[10px] text-white/25 mt-3">{config.landing_cta_subtext}</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-4">
        <p className="text-[9px] text-white/15 uppercase tracking-widest font-display">
          {config.landing_footer_text || config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString()) || `© ${new Date().getFullYear()} Oracle`}
        </p>
      </footer>
    </div>
  );
}
