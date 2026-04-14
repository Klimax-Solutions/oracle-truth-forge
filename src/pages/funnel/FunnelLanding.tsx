import { useParams, useNavigate } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { Loader2, ArrowRight } from 'lucide-react';

export default function FunnelLanding() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { config, loading } = useFunnelConfig(slug);

  if (loading) return <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#19B7C9]" /></div>;
  if (!config) return <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center text-white/30 text-sm">Funnel non trouvé</div>;

  return (
    <div className="min-h-screen bg-[#0A0B10] text-white flex flex-col">

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full text-center space-y-10">

          {/* Brand */}
          <p className="text-[11px] tracking-[0.5em] uppercase text-white/25 font-display">
            {config.brand_name || 'Oracle'}
          </p>

          {/* Headline */}
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-display font-bold leading-[1.15] tracking-tight">
            {config.landing_headline || 'Titre principal'}
            {config.landing_headline_accent && (
              <>
                {' '}
                <span className="text-[#19B7C9]">{config.landing_headline_accent}</span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          {config.landing_subtitle && (
            <p className="text-base md:text-lg text-white/40 leading-relaxed max-w-lg mx-auto">
              {config.landing_subtitle}
            </p>
          )}

          {/* Divider */}
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-px bg-gradient-to-r from-transparent to-white/10" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#19B7C9]/40" />
            <div className="w-16 h-px bg-gradient-to-l from-transparent to-white/10" />
          </div>

          {/* CTA */}
          <div>
            <button
              onClick={() => navigate(`/${slug}/apply`)}
              className="inline-flex items-center gap-3 px-10 py-4 bg-[#19B7C9] text-[#0A0B10] font-display text-sm font-bold uppercase tracking-widest rounded-xl transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(25,183,201,0.25)]"
            >
              {config.landing_cta_text || 'Commencer'}
              <ArrowRight className="w-4 h-4" />
            </button>
            {config.landing_cta_subtext && (
              <p className="text-[11px] text-white/20 mt-4">{config.landing_cta_subtext}</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-5 text-center">
        <p className="text-[9px] text-white/10 tracking-[0.3em] uppercase font-display">
          {config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString()) || `© ${new Date().getFullYear()}`}
        </p>
      </footer>
    </div>
  );
}
