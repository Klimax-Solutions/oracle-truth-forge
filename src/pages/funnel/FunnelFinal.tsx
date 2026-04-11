import { useParams, useSearchParams } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { Loader2, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';

// ============================================
// Funnel Final Page — Booking confirmation
// Route: /:slug/final
// ============================================

export default function FunnelFinal() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { config, loading } = useFunnelConfig(slug);

  const bookingDate = searchParams.get('date') || null;

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
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">

        {/* Badge */}
        {config.final_badge_text && (
          <div className="text-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-xs font-display text-emerald-400 uppercase tracking-widest">
              {config.final_badge_text}
            </span>
          </div>
        )}

        {/* Headline */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold">
            {config.final_headline_personalized || 'Bravo'},{' '}
            <span className="text-white/60">{config.final_headline_confirmation || 'ton appel est'}</span>{' '}
            <span className="text-primary">{config.final_headline_accent || 'reserve'}</span>
          </h1>
        </div>

        {/* Booking date */}
        {bookingDate && (
          <div className="flex items-center justify-center gap-3 bg-primary/10 border border-primary/20 rounded-xl px-5 py-3">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-display text-primary font-medium">{bookingDate}</span>
          </div>
        )}

        {/* Step 1 — Confirmation */}
        <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-display font-semibold">{config.final_step1_title || 'Confirme ta presence'}</h3>
          </div>

          <div className="space-y-2 text-sm text-white/60 leading-relaxed">
            {config.final_step1_congrats && <p className="text-emerald-400 font-display font-medium">{config.final_step1_congrats}</p>}
            {config.final_step1_instructions && <p>{config.final_step1_instructions}</p>}
            {config.final_step1_details && <p>{config.final_step1_details}</p>}
          </div>
        </div>

        {/* Warning */}
        {config.final_step1_warning_title && (
          <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-display font-semibold text-amber-400">{config.final_step1_warning_title}</h4>
            </div>
            {config.final_step1_warning_text && (
              <p className="text-sm text-white/50">{config.final_step1_warning_text}</p>
            )}
            {config.final_step1_warning_consequence && (
              <p className="text-sm text-amber-400/70 font-medium">{config.final_step1_warning_consequence}</p>
            )}
          </div>
        )}
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
