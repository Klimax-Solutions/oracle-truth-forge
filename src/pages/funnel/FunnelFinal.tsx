import { useParams, useSearchParams } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, AlertTriangle, Calendar, Send, Mail, Clock, Shield } from 'lucide-react';

export default function FunnelFinal() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { config, loading } = useFunnelConfig(slug);

  const bookingDate = searchParams.get('date') || null;
  const leadEmail = searchParams.get('email') || null;
  const leadName = searchParams.get('name') || null;

  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitQuestion = async () => {
    if (!question.trim() || !leadEmail) return;
    setSubmitting(true);
    try {
      await supabase
        .from('early_access_requests')
        .update({ precall_question: question.trim() } as any)
        .eq('email', leadEmail.toLowerCase().trim());
      setSubmitted(true);
    } catch {
      // Silent fail — not critical
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#19B7C9]" /></div>;
  if (!config) return <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center text-white/30 text-sm">Funnel non trouvé</div>;

  return (
    <div className="min-h-screen bg-[#0A0B10] text-white flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-8">

          {/* Success badge */}
          <div className="text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-xs font-display text-emerald-400 uppercase tracking-widest">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {config.final_badge_text || 'Confirmé'}
            </span>
          </div>

          {/* Headline with name */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-display font-bold leading-tight">
              {leadName ? `${leadName}, ton` : 'Ton'} appel est{' '}
              <span className="text-[#19B7C9]">réservé</span>
            </h1>
            <p className="text-sm text-white/40 max-w-sm mx-auto">
              Prépare-toi pour tirer le maximum de cet échange.
            </p>
          </div>

          {/* Booking date */}
          {bookingDate && (
            <div className="flex items-center justify-center gap-3 bg-[#19B7C9]/10 border border-[#19B7C9]/20 rounded-xl px-5 py-3">
              <Calendar className="w-5 h-5 text-[#19B7C9]" />
              <span className="font-display text-[#19B7C9] font-medium">{bookingDate}</span>
            </div>
          )}

          {/* 3 action cards */}
          <div className="space-y-3">

            {/* 1. Add to calendar */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-sm">Ajoute l'appel à ton calendrier</h3>
                <p className="text-xs text-white/40 mt-1">Tu as reçu un email de confirmation avec un lien pour l'ajouter à Google Calendar ou iCal. Vérifie ta boîte de réception.</p>
              </div>
            </div>

            {/* 2. Whitelist email */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-sm">Mets-nous hors spam</h3>
                <p className="text-xs text-white/40 mt-1">
                  Cherche l'email de <span className="text-white/70">contact.capitalmercure</span> dans ta boîte. S'il est dans les spams, déplace-le dans ta boîte principale et ajoute l'adresse à tes contacts.
                </p>
              </div>
            </div>

            {/* 3. Be on time */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-sm">Sois à l'heure et préparé</h3>
                <p className="text-xs text-white/40 mt-1">
                  Installe-toi dans un endroit calme, avec une bonne connexion. Prépare tes questions. Cet appel est une opportunité — traite-le comme tel.
                </p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-400 font-display font-semibold">Absence = place perdue</p>
              <p className="text-xs text-white/40 mt-1">Si tu ne te présentes pas sans prévenir, ta place sera définitivement attribuée à quelqu'un d'autre. Préviens-nous au moins 24h à l'avance si tu dois reporter.</p>
            </div>
          </div>

          {/* Pre-call question */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#19B7C9]/15 border border-[#19B7C9]/25 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 text-[#19B7C9]" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">{config.final_step2_title || 'Une question avant l\'appel ?'}</h3>
                <p className="text-[10px] text-white/30 font-display uppercase tracking-wider">Optionnel</p>
              </div>
            </div>

            {submitted ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm py-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-display">Merci, ta question a été envoyée !</span>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={config.final_step2_placeholder || 'Écris ta question ici...'}
                  className="w-full h-20 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-[#19B7C9]/40 focus:ring-1 focus:ring-[#19B7C9]/20"
                  maxLength={500}
                />
                <button
                  onClick={handleSubmitQuestion}
                  disabled={!question.trim() || !leadEmail || submitting}
                  className="w-full py-3 rounded-xl bg-[#19B7C9] text-[#0A0B10] font-display text-sm font-semibold tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(25,183,201,0.25)] transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Envoyer
                </button>
              </div>
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
