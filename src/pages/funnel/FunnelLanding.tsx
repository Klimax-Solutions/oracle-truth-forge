import { useParams, useNavigate } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { Loader2, ArrowRight } from 'lucide-react';

export default function FunnelLanding() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { config, loading } = useFunnelConfig(slug);

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
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 md:px-6 py-12 md:py-16">

        {/* Header — Auth.tsx pattern */}
        <div className="text-center mb-8 md:mb-16 animate-fade-in">
          <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] md:tracking-[0.4em] text-muted-foreground mb-4 md:mb-6">
            Accès anticipé
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-semibold tracking-tight text-foreground">
            Oracle<sup className="text-lg md:text-xl lg:text-2xl font-normal align-super ml-0.5 md:ml-1">™</sup>
          </h1>
        </div>

        <div className="w-full max-w-md h-px bg-border mb-8 md:mb-12" />

        <div className="w-full max-w-2xl text-center space-y-8 md:space-y-10">

          {/* Headline */}
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-semibold leading-[1.15] tracking-tight text-foreground">
            {config.landing_headline || 'Titre principal'}
            {config.landing_headline_accent && (
              <>
                {' '}
                <span className="text-muted-foreground">{config.landing_headline_accent}</span>
              </>
            )}
          </h2>

          {/* Subtitle */}
          {config.landing_subtitle && (
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
              {config.landing_subtitle}
            </p>
          )}

          {/* CTA */}
          <div className="pt-4">
            <button
              onClick={() => navigate(`/${slug}/apply`)}
              className="inline-flex items-center gap-3 h-12 px-10 bg-foreground text-background font-bold text-sm rounded-md hover:bg-foreground/90 transition-colors"
            >
              {config.landing_cta_text || 'Commencer'}
              <ArrowRight className="w-4 h-4" />
            </button>
            {config.landing_cta_subtext && (
              <p className="mt-4 text-[10px] md:text-xs text-muted-foreground font-mono uppercase tracking-widest">
                {config.landing_cta_subtext}
              </p>
            )}
          </div>
        </div>

        <p className="mt-12 md:mt-16 text-[10px] md:text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] md:tracking-[0.3em] text-center">
          {footerText}
        </p>
      </div>
    </div>
  );
}
