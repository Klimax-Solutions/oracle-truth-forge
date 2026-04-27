import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { submitFunnelLead, flushPendingLeads, getFunnelSession } from '@/lib/funnelLeadQueue';
import { normalizePhone } from '@/lib/normalizePhone';
import { Loader2, ChevronLeft, Check, ArrowRight } from 'lucide-react';
import { z } from 'zod';

// Schéma strict appliqué AVANT envoi en base : durcit l'intégrité du lead.
const contactSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(2, 'Prénom trop court (2 caractères minimum)')
    .max(60, 'Prénom trop long (60 caractères maximum)')
    .regex(/^[\p{L}\p{M}'’\-\s]+$/u, 'Prénom invalide (lettres, tirets et apostrophes uniquement)'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email invalide')
    .max(255, 'Email trop long'),
  phone: z.string().trim().min(6, 'Téléphone requis').max(40, 'Téléphone trop long')
    .refine(v => {
      if (!v) return true;
      const digits = v.replace(/\D/g, '');
      return digits.length >= 9 && digits.length <= 15;
    }, 'Numéro invalide — vérifie le format (ex: 06 12 34 56 78)'),
  // Note: pas de regex \p{L} ici — compatibilité Safari pré-15.4
});

/**
 * Renders text with <u>...</u> as accent underlines.
 * In the institutional B&W palette, accents are rendered as a discreet underline
 * on `text-foreground`, no color — sobriety over flash.
 */
function AccentText({ html, className, as: Tag = 'h1' }: { html: string; className?: string; as?: 'h1' | 'p' | 'span' }) {
  const parts = useMemo(() => {
    if (!html) return [{ text: '', accent: false }];
    const result: { text: string; accent: boolean }[] = [];
    const regex = /<u>(.*?)<\/u>/gi;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(html)) !== null) {
      if (match.index > lastIndex) result.push({ text: html.slice(lastIndex, match.index), accent: false });
      result.push({ text: match[1], accent: true });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < html.length) result.push({ text: html.slice(lastIndex), accent: false });
    return result;
  }, [html]);

  return (
    <Tag className={className}>
      {parts.map((p, i) =>
        p.accent ? (
          <span key={i} className="relative inline-block">
            <span className="relative z-10 text-foreground font-semibold">{p.text}</span>
            <span className="absolute bottom-0 left-0 w-full h-[2px] bg-foreground/30 -z-0" />
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </Tag>
  );
}

// ============================================
// Funnel Apply Page — Institutional B&W
// Reference: /auth — semantic tokens, font-mono labels, rounded-md cards.
// ============================================

export default function FunnelApply() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { config, loading } = useFunnelConfig(slug);

  // Pré-remplissage depuis URL params (liens Kit : ?email=...&name=...)
  const prefillEmail = searchParams.get('email') || '';
  const prefillName  = searchParams.get('name')  || '';

  const hasVSL = config?.vsl_enabled && config?.vsl_page === 'apply';
  const hasVSLEmbed = hasVSL && !!config?.vsl_embed_code;
  const [showForm, setShowForm] = useState(false);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({
    first_name: prefillName || '',
    phone: '',
    email: prefillEmail,
    countryCode: '+33',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const [error, setError] = useState('');
  // Récap obligatoire avant l'envoi définitif → l'utilisateur DOIT relire son prénom/email/tel
  const [confirming, setConfirming] = useState(false);
  const vslRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(false);

  // ── Anti-spam : 3 couches défensives ────────────────────────────────────
  const [honeypot, setHoneypot] = useState('');
  // ── Anti-spam time-trap ───────────────────────────────────────────────────────
  // Reset quand le form devient visible (pas au mount du composant, qui peut arriver
  // pendant le chargement de la VSL — sinon le délai est déjà écoulé avant même
  // que l'utilisateur voie le form).
  const formMountedAt = useRef<number>(Date.now());
  useEffect(() => {
    if (showForm) {
      formMountedAt.current = Date.now();
    }
  }, [showForm]);

  const phoneFormats: Record<string, { groups: number[]; placeholder: string }> = {
    '+33':  { groups: [1, 2, 2, 2, 2], placeholder: '6 12 34 56 78' },
    '+32':  { groups: [3, 2, 2, 2],    placeholder: '412 34 56 78' },
    '+41':  { groups: [2, 3, 2, 2],    placeholder: '76 123 45 67' },
    '+44':  { groups: [4, 3, 3],       placeholder: '7911 123 456' },
    '+1':   { groups: [3, 3, 4],       placeholder: '212 555 1234' },
    '+49':  { groups: [3, 3, 4],       placeholder: '151 234 5678' },
    '+34':  { groups: [3, 3, 3],       placeholder: '612 345 678' },
    '+39':  { groups: [3, 3, 4],       placeholder: '312 345 6789' },
    '+351': { groups: [3, 3, 3],       placeholder: '912 345 678' },
    '+212': { groups: [3, 2, 2, 2],    placeholder: '612 34 56 78' },
    '+213': { groups: [3, 2, 2, 2],    placeholder: '551 23 45 67' },
    '+216': { groups: [2, 3, 3],       placeholder: '20 123 456' },
    '+225': { groups: [2, 2, 2, 2],    placeholder: '07 12 34 56' },
    '+221': { groups: [2, 3, 2, 2],    placeholder: '77 123 45 67' },
    '+237': { groups: [3, 2, 2, 2],    placeholder: '671 23 45 67' },
    '+243': { groups: [3, 3, 3],       placeholder: '815 123 456' },
    '+352': { groups: [3, 3],          placeholder: '621 123' },
    '+377': { groups: [2, 2, 2, 2],    placeholder: '06 12 34 56' },
  };

  const formatPhone = (raw: string, code: string) => {
    const digits = raw.replace(/\D/g, '');
    const fmt = phoneFormats[code] || { groups: [3, 3, 4] };
    let result = '';
    let pos = 0;
    for (const len of fmt.groups) {
      if (pos >= digits.length) break;
      if (result) result += ' ';
      result += digits.slice(pos, pos + len);
      pos += len;
    }
    return result;
  };

  const currentPhoneFmt = phoneFormats[contact.countryCode] || phoneFormats['+33'];

  const questions = useMemo(() => config?.apply_form_questions || [], [config]);
  const totalSteps = questions.length + 1;
  const isContactStep = step >= questions.length;
  const currentQuestion = !isContactStep ? questions[step] : null;
  const progress = ((step + 1) / totalSteps) * 100;

  useEffect(() => {
    if (config && !loading) {
      setShowForm(!hasVSL);
    }
  }, [hasVSL, config, loading]);

  // Flush any leads queued from previous failed submissions (best-effort, non-blocking)
  useEffect(() => {
    flushPendingLeads().catch(() => {});
  }, []);

  useEffect(() => {
    const raw = Number(config?.vsl_cta_delay_seconds);
    const delay = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 1800) : 0;
    if (!hasVSL || showForm || delay === 0) {
      setCtaVisible(true);
      return;
    }
    setCtaVisible(false);
    const timer = setTimeout(() => setCtaVisible(true), delay * 1000);
    const safety = setTimeout(() => setCtaVisible(true), (delay + 5) * 1000);
    return () => { clearTimeout(timer); clearTimeout(safety); };
  }, [hasVSL, showForm, config?.vsl_cta_delay_seconds]);

  useEffect(() => {
    if (!hasVSL || showForm || !vslRef.current || !config?.vsl_embed_code) return;
    if (config.vsl_provider === 'vidalytics') {
      const container = vslRef.current;
      container.innerHTML = config.vsl_embed_code;
      container.querySelectorAll('script').forEach((old) => {
        const s = document.createElement('script');
        Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
        s.textContent = old.textContent;
        old.parentNode?.replaceChild(s, old);
      });
    }
  }, [hasVSL, showForm, config?.vsl_provider, config?.vsl_embed_code]);

  const handleAnswer = (questionId: string, optionLabel: string, isDisqualifying?: boolean) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionLabel }));
    if (isDisqualifying) { setDisqualified(true); return; }
    setTimeout(() => setStep(s => Math.min(s + 1, totalSteps - 1)), 300);
  };

  // Étape 1 : valider strictement et basculer sur l'écran de récap.
  // Aucune écriture en DB ici — l'utilisateur DOIT relire ses infos avant.
  const prepareSubmit = () => {
    setError('');

    // Honeypot et time-trap restent silencieux (anti-bot)
    if (honeypot.trim()) {
      console.warn('[Apply] honeypot triggered — silent reject');
      setSubmitted(true);
      return;
    }
    if (Date.now() - formMountedAt.current < 1500) {
      console.warn('[Apply] time-trap triggered — silent reject');
      setSubmitted(true);
      return;
    }

    const parsed = contactSchema.safeParse({
      first_name: contact.first_name,
      email: contact.email,
      phone: contact.phone,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Champs invalides');
      return;
    }

    setConfirming(true);
  };

  // Étape 2 : envoi réel. Appelé uniquement depuis l'écran de récap.
  const confirmSubmit = async () => {
    setSubmitting(true); setError('');

    const parsed = contactSchema.safeParse({
      first_name: contact.first_name,
      email: contact.email,
      phone: contact.phone,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Champs invalides');
      setSubmitting(false);
      setConfirming(false);
      return;
    }

    const { first_name, email } = parsed.data;
    // Normalise en E.164 avant stockage — couvre +33/0/33 et tous formats avec espaces.
    const phone = normalizePhone(parsed.data.phone ? `${contact.countryCode}${parsed.data.phone}` : '');

    // Compute enrichment fields from answers
    const investmentAnswer = answers['investment_amount'] || '';
    const budgetMatch = investmentAnswer.match(/(\d[\d\s]*)\s*€/);
    const budgetAmount = budgetMatch ? parseInt(budgetMatch[1].replace(/\s/g, ''), 10) : null;
    const priorite = budgetAmount && budgetAmount >= 5000 ? 'P1'
      : budgetAmount && budgetAmount >= 3000 ? 'P2'
      : budgetAmount && budgetAmount >= 1000 ? 'P3' : null;
    const impMatch = (answers['time_commitment'] || '').match(/(\d+)/);
    const importance = impMatch ? parseInt(impMatch[1], 10) : null;

    const leadPayload = {
      first_name,
      email,
      phone,
      status: 'en_attente',
      form_submitted: true,
      ...(Object.keys(answers).length > 0 ? { form_answers: answers } : {}),
      ...(investmentAnswer ? { offer_amount: investmentAnswer } : {}),
      ...(budgetAmount != null ? { budget_amount: budgetAmount } : {}),
      ...(priorite ? { priorite } : {}),
      ...(answers['main_difficulty'] ? { difficulte_principale: answers['main_difficulty'] } : {}),
      ...(importance != null ? { importance_trading: importance } : {}),
    };

    try {
      const result = await submitFunnelLead(leadPayload, slug);
      if (result.queued) {
        console.warn('[Apply] Lead queued for retry — backend unreachable, will sync later:', email);
      }
    } catch (err) {
      console.error('[Apply] Unexpected error during submit:', err);
    }

    setSubmitted(true);
    setSubmitting(false);
    setConfirming(false);
  };

  const renderEmbed = () => {
    if (!config?.vsl_embed_code) return null;
    if (config.vsl_provider === 'vidalytics') {
      return <div ref={vslRef} className="w-full [&>div]:!static [&>div]:!pt-0 [&>div]:aspect-video" />;
    }
    if (config.vsl_provider === 'youtube') {
      const code = config.vsl_embed_code.trim();
      let vid = code;
      try { if (code.includes('youtu')) { const u = new URL(code.startsWith('http') ? code : `https://${code}`); vid = u.searchParams.get('v') || u.pathname.split('/').pop() || code; } } catch {}
      return <iframe src={`https://www.youtube.com/embed/${vid}?rel=0&modestbranding=1`} title="VSL" className="w-full aspect-video" allow="autoplay; encrypted-media" allowFullScreen />;
    }
    if (config.vsl_provider === 'vimeo') {
      const code = config.vsl_embed_code.trim();
      let vid = code;
      try { if (code.includes('vimeo')) { vid = new URL(code.startsWith('http') ? code : `https://${code}`).pathname.split('/').pop() || code; } } catch {}
      return <iframe src={`https://player.vimeo.com/video/${vid}?title=0&byline=0`} title="VSL" className="w-full aspect-video" allow="autoplay; fullscreen" allowFullScreen />;
    }
    return <div ref={vslRef} className="w-full" dangerouslySetInnerHTML={{ __html: config.vsl_embed_code }} />;
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
    <div className="min-h-screen bg-background text-foreground">

      {/* ═══════════════════════════════════════════════ */}
      {/* PHASE 1: VSL                                    */}
      {/* ═══════════════════════════════════════════════ */}
      {hasVSL && !showForm && !disqualified && !submitted ? (
        <div className="h-screen flex flex-col overflow-hidden">

          <div className="shrink-0 text-center px-4 pt-12 md:pt-16 pb-3">
            <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] md:tracking-[0.4em] text-muted-foreground mb-4 md:mb-6">
              Présentation
            </p>
            <AccentText
              html={config.apply_headline || 'Découvre la méthode'}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-tight max-w-3xl mx-auto"
            />
            {(config.apply_subtitle || config.landing_subtitle) && (
              <AccentText
                html={config.apply_subtitle || config.landing_subtitle}
                as="p"
                className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto mt-3 leading-snug"
              />
            )}
          </div>

          <div className="flex-1 flex items-center justify-center px-3 md:px-6 py-2 min-h-0">
            <div className="w-full max-w-5xl">
              <div className="relative rounded-md overflow-hidden border border-border">
                {hasVSLEmbed ? renderEmbed() : (
                  <div className="w-full aspect-video bg-card flex items-center justify-center">
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">VSL — coller le code Vidalytics dans la config</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 pb-10 md:pb-14 pt-3 text-center space-y-3">
            <div className={`transition-all duration-700 ${ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-3 h-12 px-10 bg-foreground text-background font-bold text-sm rounded-md hover:bg-foreground/90 transition-colors"
              >
                {config.landing_cta_text || 'Candidater'}
                <ArrowRight className="w-4 h-4" />
              </button>
              {config.landing_cta_subtext && (
                <p className="text-[11px] text-muted-foreground/70 mt-3 font-mono uppercase tracking-widest">{config.landing_cta_subtext}</p>
              )}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] md:tracking-[0.3em]">
              {footerText}
            </p>
          </div>
        </div>
      ) : (

      /* ═══════════════════════════════════════════════ */
      /* PHASE 2: Form                                   */
      /* ═══════════════════════════════════════════════ */
      <div className="flex flex-col min-h-screen relative overflow-hidden">
        {/* Progress bar */}
        {!disqualified && !submitted && (
          <div className="fixed top-0 left-0 right-0 z-50 h-px bg-border">
            <div className="h-full bg-foreground transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 md:px-6 py-12 md:py-16">

          {/* Header — Auth.tsx pattern */}
          {!disqualified && !submitted && (
            <div className="text-center mb-8 md:mb-16 animate-fade-in">
              <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] md:tracking-[0.4em] text-muted-foreground mb-4 md:mb-6">
                Free Trial · 7 jours
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-7xl font-semibold tracking-tight text-foreground">
                Oracle<sup className="text-lg md:text-xl lg:text-2xl font-normal align-super ml-0.5 md:ml-1">™</sup>
              </h1>
              <p className="mt-4 md:mt-6 text-sm md:text-base font-medium tracking-tight text-foreground/80">
                Vérifier mon éligibilité
              </p>
            </div>
          )}

          {!disqualified && !submitted && (
            <div className="w-full max-w-md h-px bg-border mb-8 md:mb-12" />
          )}

          <div className="w-full max-w-md">
            <div className={!disqualified && !submitted ? "border border-border bg-card p-6 md:p-8 rounded-md" : ""}>
            {disqualified ? (
              <div className="text-center space-y-5 py-4">
                <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
                  Candidature étudiée
                </p>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                  Merci pour ton honnêteté
                </h2>
                <div className="h-px w-12 bg-border mx-auto" />
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  Ton profil ne correspond pas aux critères requis pour le moment.
                </p>
              </div>
            ) : submitted ? (
              <div className="text-center space-y-8 py-2">
                {/* Green check icon */}
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <Check className="w-7 h-7 text-emerald-500" strokeWidth={2.5} />
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                    Demande envoyée
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                    Votre demande a bien été reçue. Un membre de notre équipe reviendra vers vous pour valider votre candidature.
                  </p>
                </div>

                {/* Sub-card: prochaine étape */}
                <div className="text-left border border-border bg-background/50 rounded-md p-5 space-y-3">
                  <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.25em] text-muted-foreground">
                    Prochaine étape
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    Sécurise dès maintenant ton <span className="font-semibold">accès à vie</span> à Oracle<sup className="text-[0.6em] font-normal align-super ml-0.5">™</sup> en réservant un échange avec notre équipe.
                  </p>
                </div>

                {/* CTA principal — book a call, mis en évidence */}
                <div className="relative pt-2">
                  <div className="absolute inset-0 rounded-md bg-foreground/20 blur-xl opacity-60" aria-hidden="true" />
                  <button
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set('name', contact.first_name.trim());
                      params.set('email', contact.email.trim().toLowerCase());
                      const phone = contact.phone ? `${contact.countryCode}${contact.phone.replace(/\s/g, '')}` : '';
                      if (phone) params.set('phone', phone);
                      // Passe le lead_id dans l'URL pour que Discovery puisse retrouver
                      // le lead sans dépendre du sessionStorage (qui peut être vidé entre tabs).
                      const session = getFunnelSession();
                      if (session?.request_id) params.set('lead_id', session.request_id);
                      navigate(`/${slug}/discovery?${params}`);
                    }}
                    className="relative w-full min-h-[64px] py-4 px-5 rounded-md bg-foreground hover:bg-foreground/90 text-background font-bold text-sm md:text-base transition-all hover:scale-[1.02] inline-flex items-center justify-center gap-3 ring-2 ring-foreground/20 ring-offset-2 ring-offset-card shadow-lg"
                  >
                    <span className="text-center leading-snug">
                      Clique ici pour sécuriser ton accès à vie à Oracle<sup className="text-[0.6em] font-normal align-super ml-0.5">™</sup>
                    </span>
                    <ArrowRight className="w-5 h-5 shrink-0" />
                  </button>
                  <p className="mt-3 text-[10px] md:text-xs font-mono uppercase tracking-[0.25em] text-muted-foreground text-center">
                    Réserve un échange avec l'équipe
                  </p>
                </div>
              </div>
            ) : isContactStep ? (
              confirming ? (
                /* ─── ÉCRAN DE CONFIRMATION : l'utilisateur DOIT relire ─── */
                <div className="space-y-6">
                  <div className="mb-4">
                    <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground mb-3">
                      Vérification finale
                    </p>
                    <h2 className="text-base md:text-lg font-bold text-foreground mb-1">
                      Confirme tes informations
                    </h2>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Vérifie que ton prénom, email et téléphone sont corrects avant l'envoi.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-md border border-border bg-background/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">Prénom</span>
                      <span className="text-sm font-semibold text-foreground text-right break-words">{contact.first_name.trim()}</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">Email</span>
                      <span className="text-sm font-mono text-foreground text-right break-all">{contact.email.trim().toLowerCase()}</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">Téléphone</span>
                      <span className="text-sm font-mono text-foreground text-right">
                        {contact.phone.trim() ? `${contact.countryCode} ${contact.phone.trim()}` : '—'}
                      </span>
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 font-mono">
                      {error}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => { setConfirming(false); setError(''); }}
                      disabled={submitting}
                      className="h-12 px-4 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4 inline mr-1" />
                      Modifier
                    </button>
                    <button
                      onClick={confirmSubmit}
                      disabled={submitting}
                      className="flex-1 h-12 rounded-md bg-foreground hover:bg-foreground/90 text-background font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmer et envoyer'}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="space-y-6">
                <div className="mb-6 md:mb-8">
                  <h2 className="text-base md:text-lg font-bold text-foreground mb-1">
                    Tes coordonnées
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    Dernière étape avant validation
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="apply-first-name" className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      {config.apply_form_name_label || 'Prénom'}
                    </label>
                    <input
                      id="apply-first-name"
                      name="given-name"
                      type="text"
                      autoComplete="given-name"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={60}
                      value={contact.first_name}
                      onChange={e => setContact(c => ({ ...c, first_name: e.target.value }))}
                      className="w-full h-12 px-4 bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none rounded-md transition-colors"
                      placeholder="Votre prénom"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="apply-phone" className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      {config.apply_form_phone_label || 'Numéro de téléphone'}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={contact.countryCode}
                        onChange={e => { const code = e.target.value; setContact(c => ({ ...c, countryCode: code, phone: formatPhone(c.phone, code) })); }}
                        className="h-12 px-3 bg-background border border-border text-foreground text-sm focus:border-ring focus:outline-none rounded-md transition-colors appearance-none cursor-pointer"
                      >
                        <option value="+33">🇫🇷 +33</option><option value="+32">🇧🇪 +32</option><option value="+41">🇨🇭 +41</option>
                        <option value="+44">🇬🇧 +44</option><option value="+1">🇺🇸 +1</option><option value="+49">🇩🇪 +49</option>
                        <option value="+34">🇪🇸 +34</option><option value="+39">🇮🇹 +39</option><option value="+351">🇵🇹 +351</option>
                        <option value="+212">🇲🇦 +212</option><option value="+213">🇩🇿 +213</option><option value="+216">🇹🇳 +216</option>
                        <option value="+225">🇨🇮 +225</option><option value="+221">🇸🇳 +221</option><option value="+237">🇨🇲 +237</option>
                        <option value="+243">🇨🇩 +243</option><option value="+352">🇱🇺 +352</option><option value="+377">🇲🇨 +377</option>
                      </select>
                      <input
                        id="apply-phone"
                        name="tel-national"
                        type="tel"
                        autoComplete="tel-national"
                        maxLength={30}
                        value={contact.phone}
                        onChange={e => { const formatted = formatPhone(e.target.value, contact.countryCode); setContact(c => ({ ...c, phone: formatted })); }}
                        className="flex-1 h-12 px-4 bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none rounded-md transition-colors font-mono tracking-wider"
                        placeholder={currentPhoneFmt.placeholder}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="apply-email" className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      {config.apply_form_email_label || 'Adresse email'}
                    </label>
                    <input
                      id="apply-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={255}
                      value={contact.email}
                      onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                      className="w-full h-12 px-4 bg-background border border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none rounded-md transition-colors"
                      placeholder="vous@exemple.com"
                    />
                  </div>
                </div>

                {/* Honeypot */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
                />

                {error && (
                  <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 font-mono">
                    {error}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setStep(s => s - 1)}
                    className="h-12 px-4 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Retour"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={prepareSubmit}
                    disabled={submitting || !contact.first_name.trim() || !contact.email.trim()}
                    className="flex-1 h-12 rounded-md bg-foreground hover:bg-foreground/90 text-background font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Vérifier ma candidature
                  </button>
                </div>
              </div>
              )
            ) : (
              <div className="space-y-6" key={step}>
                <div className="mb-6 md:mb-8">
                  <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground mb-3">
                    Question {step + 1} / {questions.length}
                  </p>
                  <h2 className="text-base md:text-lg font-bold text-foreground leading-snug">
                    {currentQuestion?.title}
                  </h2>
                </div>

                <div className="space-y-2">
                  {(currentQuestion?.options || []).map((opt: any, i: number) => {
                    const selected = answers[currentQuestion!.id] === opt.label;
                    return (
                      <button
                        key={i}
                        onClick={() => handleAnswer(currentQuestion!.id, opt.label, opt.disqualifying)}
                        className={`w-full text-left px-4 py-3.5 rounded-md border transition-colors ${
                          selected
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-background border-border text-foreground hover:border-foreground/40 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                            selected ? 'border-background bg-background' : 'border-border'
                          }`}>
                            {selected && <Check className="w-2.5 h-2.5 text-foreground" />}
                          </div>
                          <span className="text-sm">{opt.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {step > 0 && (
                  <button
                    onClick={() => setStep(s => s - 1)}
                    className="text-[10px] md:text-xs text-muted-foreground hover:text-foreground font-mono uppercase tracking-widest transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3 inline mr-1" />Retour
                  </button>
                )}
              </div>
            )}
            </div>
          </div>

          <p className="mt-8 md:mt-16 text-[10px] md:text-xs text-muted-foreground font-mono uppercase tracking-[0.2em] md:tracking-[0.3em] text-center">
            {footerText}
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
