import { useParams, useSearchParams } from 'react-router-dom';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { flushPendingLeads, getFunnelSession } from '@/lib/funnelLeadQueue';
import { Loader2, CheckCircle2, AlertTriangle, Calendar, Send, Mail, Clock } from 'lucide-react';

export default function FunnelFinal() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { config, loading } = useFunnelConfig(slug);

  const bookingDate = searchParams.get('date') || null;
  const leadEmail   = searchParams.get('email') || null;
  const leadName    = searchParams.get('name')  || null;

  // Session locale — source de vérité pour le request_id (évite UPDATE par email ambigu)
  const session = getFunnelSession();

  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Rejoue tout lead bloqué dans la queue locale (best-effort, non-blocking)
  useEffect(() => { flushPendingLeads().catch(() => {}); }, []);

  const handleSubmitQuestion = async () => {
    const email = leadEmail || session?.email || '';
    if (!question.trim() || !email) return;
    setSubmitting(true);
    try {
      const requestId = session?.request_id;
      if (requestId) {
        // UPDATE par ID → précis, pas de risque de toucher le mauvais lead
        await supabase
          .from('early_access_requests')
          .update({ precall_question: question.trim() } as any)
          .eq('id', requestId);
      } else {
        // Fallback : UPDATE par email (legacy — OK si un seul lead avec cet email)
        await supabase
          .from('early_access_requests')
          .update({ precall_question: question.trim() } as any)
          .eq('email', email.toLowerCase().trim());
      }
      setSubmitted(true);
    } catch {
      // Silent fail — not critical
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-12 md:py-16">

        {/* Header — Auth pattern */}
        <div className="text-center mb-8 md:mb-12 animate-fade-in">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] md:text-xs font-mono text-emerald-500 uppercase tracking-[0.25em] mb-6">
            <CheckCircle2 className="w-3 h-3" />
            {config.final_badge_text || 'Confirmé'}
          </span>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-tight">
            {leadName ? `${leadName}, ton` : 'Ton'} appel est réservé
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-4 max-w-sm mx-auto">
            Prépare-toi pour tirer le maximum de cet échange.
          </p>
        </div>

        <div className="w-full max-w-md h-px bg-border mb-8 md:mb-12" />

        <div className="w-full max-w-lg space-y-6">

          {/* Booking date */}
          {bookingDate && (
            <div className="flex items-center justify-center gap-3 border border-border bg-card rounded-md px-5 py-4">
              <Calendar className="w-4 h-4 text-foreground" />
              <span className="text-sm font-bold text-foreground">{bookingDate}</span>
            </div>
          )}

          {/* 3 action cards */}
          <div className="space-y-3">

            {/* 1. Add to calendar */}
            <div className="border border-border bg-card rounded-md p-5 flex items-start gap-4">
              <div className="w-9 h-9 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-bold text-foreground">Ajoute l'appel à ton calendrier</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tu as reçu un email de confirmation avec un lien pour l'ajouter à Google Calendar ou iCal. Vérifie ta boîte de réception.
                </p>
              </div>
            </div>

            {/* 2. Whitelist email */}
            <div className="border border-border bg-card rounded-md p-5 flex items-start gap-4">
              <div className="w-9 h-9 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-bold text-foreground">Mets-nous hors spam</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cherche l'email de <span className="text-foreground font-mono">contact.capitalmercure</span> dans ta boîte. S'il est dans les spams, déplace-le dans ta boîte principale et ajoute l'adresse à tes contacts.
                </p>
              </div>
            </div>

            {/* 3. Be on time */}
            <div className="border border-border bg-card rounded-md p-5 flex items-start gap-4">
              <div className="w-9 h-9 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-bold text-foreground">Sois à l'heure et préparé</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Installe-toi dans un endroit calme, avec une bonne connexion. Prépare tes questions. Cet appel est une opportunité — traite-le comme tel.
                </p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="border border-amber-500/30 bg-amber-500/10 rounded-md p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-500 font-mono uppercase tracking-widest">Absence = place perdue</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Si tu ne te présentes pas sans prévenir, ta place sera définitivement attribuée à quelqu'un d'autre. Préviens-nous au moins 24h à l'avance si tu dois reporter.
              </p>
            </div>
          </div>

          {/* Pre-call question */}
          <div className="border border-border bg-card rounded-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{config.final_step2_title || 'Une question avant l\'appel ?'}</h3>
                <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-0.5">Optionnel</p>
              </div>
            </div>

            {submitted ? (
              <div className="flex items-center gap-2 text-emerald-500 text-sm py-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Merci, ta question a été envoyée.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={config.final_step2_placeholder || 'Écris ta question ici...'}
                  className="w-full h-24 bg-background border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-ring transition-colors"
                  maxLength={500}
                />
                <button
                  onClick={handleSubmitQuestion}
                  disabled={!question.trim() || (!leadEmail && !session?.email) || submitting}
                  className="w-full h-12 rounded-md bg-foreground hover:bg-foreground/90 text-background font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Envoyer
                </button>
              </div>
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
