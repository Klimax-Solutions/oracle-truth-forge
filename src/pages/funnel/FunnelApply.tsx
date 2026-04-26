import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { Loader2, ChevronLeft, Check, ArrowRight } from 'lucide-react';

/**
 * Renders text with <u>...</u> tags as spike-launch style accent underlines.
 * "hello <u>world</u> foo" → ["hello ", <AccentSpan>world</AccentSpan>, " foo"]
 */
/**
 * Renders text with <u>...</u> as spike-launch accent underlines.
 * Uses absolute-positioned bar (not CSS text-decoration) for the accent effect.
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
            <span className="relative z-10 text-[#19B7C9] font-semibold">{p.text}</span>
            <span className="absolute bottom-0 left-0 w-full h-[4px] md:h-[6px] bg-[#19B7C9]/30 -z-0" />
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </Tag>
  );
}

// ============================================
// Funnel Apply Page — VSL + Multi-step form
// Style: spike-launch exact (wide headline, glowing VSL, premium CTA)
// ============================================

export default function FunnelApply() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { config, loading } = useFunnelConfig(slug);

  const hasVSL = config?.vsl_enabled && config?.vsl_page === 'apply';
  const hasVSLEmbed = hasVSL && !!config?.vsl_embed_code;
  const [showForm, setShowForm] = useState(false);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ first_name: '', phone: '', email: '', countryCode: '+33' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const [error, setError] = useState('');
  const vslRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(false);

  // ── Anti-spam : 3 couches défensives ────────────────────────────────────
  // 1. Honeypot — champ invisible. Bot le remplit → silently fake success.
  // 2. Time-trap — submit < 2s après mount = bot. Silently fake success.
  // 3. Rate-limit DB — > 3 'en_attente' du même email en 1h → reject explicite.
  const [honeypot, setHoneypot] = useState('');
  const formMountedAt = useRef<number>(Date.now());

  // Phone formatting patterns per country code (groups of digits)
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
  const hasAnswer = currentQuestion ? !!answers[currentQuestion.id] : (contact.first_name && contact.email);

  // Show form directly if no VSL. Reset to VSL phase if VSL gets enabled.
  useEffect(() => {
    if (config && !loading) {
      setShowForm(!hasVSL);
    }
  }, [hasVSL, config, loading]);

  // CTA delay timer — show CTA after X seconds of video page being visible
  // Antifragile: coerce to number, cap at 30min, fallback to visible on any weird value
  useEffect(() => {
    const raw = Number(config?.vsl_cta_delay_seconds);
    const delay = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 1800) : 0;
    if (!hasVSL || showForm || delay === 0) {
      setCtaVisible(true);
      return;
    }
    setCtaVisible(false);
    const timer = setTimeout(() => setCtaVisible(true), delay * 1000);
    // Safety net: if setTimeout somehow doesn't fire (tab throttle, etc.), force show after delay + 5s
    const safety = setTimeout(() => setCtaVisible(true), (delay + 5) * 1000);
    return () => { clearTimeout(timer); clearTimeout(safety); };
  }, [hasVSL, showForm, config?.vsl_cta_delay_seconds]);

  // Execute Vidalytics scripts
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

  const handleSubmit = async () => {
    if (!contact.first_name.trim() || !contact.email.trim()) { setError('Nom et email requis'); return; }

    // ── ANTI-SPAM Couche 1 : honeypot (champ invisible rempli = bot)
    if (honeypot.trim()) {
      console.warn('[Apply] honeypot triggered — silent reject');
      setSubmitted(true); // fake success pour ne pas alerter le bot
      setTimeout(() => navigate('/'), 1500);
      return;
    }
    // ── ANTI-SPAM Couche 2 : time-trap (submit < 2s = bot, humain n'a pas le temps)
    if (Date.now() - formMountedAt.current < 2000) {
      console.warn('[Apply] time-trap triggered — silent reject');
      setSubmitted(true);
      setTimeout(() => navigate('/'), 1500);
      return;
    }

    setSubmitting(true); setError('');
    try {
      const email = contact.email.trim().toLowerCase();
      const phone = contact.phone.trim() ? `${contact.countryCode} ${contact.phone.trim()}` : null;

      // ── ANTI-SPAM Couche 3 : rate-limit DB (>3 demandes du même email en 1h)
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      const { count: recentCount } = await supabase
        .from('early_access_requests')
        .select('id', { count: 'exact', head: true })
        .ilike('email', email)
        .gte('created_at', oneHourAgo);
      if ((recentCount ?? 0) >= 3) {
        setSubmitting(false);
        setError('Trop de tentatives. Réessaie dans une heure.');
        return;
      }

      // ── PRE-CHECK: état de l'email dans le pipeline ───────────────────────
      // POLITIQUE (dans le marbre) :
      //   - 'approuvée' → lead déjà membre, ne pas créer de doublon, rediriger vers login
      //   - 'en_attente' → lead a déjà soumis, on met à jour sa demande existante (pas de nouvelle row)
      //   - absent ou autre → nouveau lead, INSERT normal
      // Cette logique garantit que chaque email n'a qu'une seule demande active.
      const { data: existingReq } = await supabase
        .from('early_access_requests')
        .select('id, status')
        .ilike('email', email)
        .in('status', ['approuvée', 'en_attente'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingReq?.status === 'approuvée') {
        // Membre actif → ne pas créer de doublon. Orienter vers login.
        setSubmitting(false);
        setError('Vous avez déjà un accès Oracle. Connectez-vous directement.');
        return;
      }

      let isUpdate = false;
      if (existingReq?.status === 'en_attente') {
        // Soumission multiple → mettre à jour la demande existante, pas d'INSERT
        isUpdate = true;
        await supabase.from('early_access_requests').update({
          first_name: contact.first_name.trim(),
          phone: phone ?? undefined,
          form_submitted: true,
        } as any).eq('id', existingReq.id);
      }

      // ── SLICE A: Core submit — colonnes garanties, jamais en échec ────────
      // Seules les colonnes du schéma Lovable de base. Antifragile par design.
      if (!isUpdate) {
        const { error: dbError } = await supabase.from('early_access_requests').insert({
          first_name: contact.first_name.trim(), email, phone,
          status: 'en_attente', form_submitted: true,
        } as any);
        if (dbError) { setError(dbError.message); setSubmitting(false); return; }
      }

      // ── SLICE B: CRM enrichment — best-effort, jamais bloquant ───────────
      // Colonnes ajoutées par migrations CRM. Si absentes → warn + continue.
      const investmentAnswer = answers['investment_amount'] || '';
      const budgetMatch = investmentAnswer.match(/(\d[\d\s]*)\s*€/);
      const budgetAmount = budgetMatch ? parseInt(budgetMatch[1].replace(/\s/g, ''), 10) : null;
      const priorite = budgetAmount && budgetAmount >= 5000 ? 'P1'
        : budgetAmount && budgetAmount >= 3000 ? 'P2'
        : budgetAmount && budgetAmount >= 1000 ? 'P3' : null;
      const impMatch = (answers['time_commitment'] || '').match(/(\d+)/);
      const importance = impMatch ? parseInt(impMatch[1], 10) : null;

      const enrichment: Record<string, any> = {};
      if (Object.keys(answers).length > 0) enrichment.form_answers = answers;
      if (investmentAnswer)        enrichment.offer_amount           = investmentAnswer;
      if (budgetAmount != null)    enrichment.budget_amount          = budgetAmount;
      if (priorite)                enrichment.priorite               = priorite;
      if (answers['main_difficulty']) enrichment.difficulte_principale = answers['main_difficulty'];
      if (importance != null)      enrichment.importance_trading     = importance;

      if (Object.keys(enrichment).length > 0) {
        const { error: enrichErr } = await supabase
          .from('early_access_requests')
          .update(enrichment as any)
          .eq('email', email);
        if (enrichErr) console.warn('[Apply] CRM enrichment skipped (non-blocking):', enrichErr.message);
      }

      // ── Proceed ──────────────────────────────────────────────────────────
      setSubmitted(true);
      // Pas de redirect auto : l'utilisateur clique le CTA "sécuriser ton accès"
      // pour aller à /discovery. Les params sont stockés dans le state pour le bouton.
    } catch { setError('Erreur de connexion.'); setSubmitting(false); }
  };

  // ── Video embed renderer ──
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

  if (loading) return <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!config) return <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center text-white/40">Funnel non trouvé</div>;

  return (
    <div className="min-h-screen bg-[#0A0B10] text-white">

      {/* ═══════════════════════════════════════════════ */}
      {/* PHASE 1: VSL — spike-launch exact style         */}
      {/* ═══════════════════════════════════════════════ */}
      {hasVSL && !showForm && !disqualified && !submitted ? (
        /* ── Phase VSL : tient en 100vh, pas de scroll ── */
        <div className="h-screen flex flex-col overflow-hidden">

          {/* Headline — plus bas, plus grand, forcé sur 2 lignes via max-w */}
          <div className="shrink-0 text-center px-4 pt-12 md:pt-16 pb-3">
            <AccentText
              html={config.apply_headline || 'Découvre la méthode'}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display text-white leading-tight max-w-3xl mx-auto"
            />
            {(config.apply_subtitle || config.landing_subtitle) && (
              <AccentText
                html={config.apply_subtitle || config.landing_subtitle}
                as="p"
                className="text-base md:text-lg font-display text-white/55 max-w-2xl mx-auto mt-3 leading-snug"
              />
            )}
          </div>

          {/* VSL — prend tout l'espace restant, 16:9 contraint */}
          <div className="flex-1 flex items-center justify-center px-3 md:px-6 py-2 min-h-0">
            <div className="w-full max-w-5xl">
              <div className="relative rounded-lg md:rounded-xl overflow-hidden border border-primary/30 md:border-2 md:border-primary/40
                shadow-[0_0_12px_0px_rgba(25,183,201,0.35),0_0_30px_8px_rgba(25,183,201,0.18),0_0_60px_16px_rgba(25,183,201,0.09)]">
                {hasVSLEmbed ? renderEmbed() : (
                  <div className="w-full aspect-video bg-white/[0.02] flex items-center justify-center">
                    <p className="text-sm text-white/20 font-display">VSL — coller le code Vidalytics dans la config</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CTA + footer — remonté pour ne pas coller au bas */}
          <div className="shrink-0 pb-10 md:pb-14 pt-3 text-center space-y-2">
            <div className={`transition-all duration-700 ${ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
              <button
                onClick={() => setShowForm(true)}
                className="group relative inline-flex items-center gap-3 px-10 py-3.5 bg-[#19B7C9] text-[#0A0B10] font-display text-sm font-bold uppercase tracking-wider rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(25,183,201,0.35)]"
              >
                <span className="absolute inset-0 rounded-xl bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2.5">
                  {config.landing_cta_text || 'Candidater'}
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
              {config.landing_cta_subtext && (
                <p className="text-[11px] text-white/20 mt-2">{config.landing_cta_subtext}</p>
              )}
            </div>
            <p className="text-[9px] text-white/10 tracking-[0.3em] uppercase font-display">
              {config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString()) || `© ${new Date().getFullYear()} Oracle`}
            </p>
          </div>
        </div>
      ) : (

      /* ═══════════════════════════════════════════════ */
      /* PHASE 2: Form                                   */
      /* ═══════════════════════════════════════════════ */
      <div className="flex flex-col min-h-screen">
        {/* Progress bar */}
        {!disqualified && !submitted && (
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/[0.06]">
            <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="flex-1 flex items-center justify-center px-4 py-16 md:py-24">
          <div className="w-full max-w-lg">

            {/* Header au-dessus du form (caché en cas de submit / disqualification) */}
            {!disqualified && !submitted && (
              <div className="text-center mb-12 space-y-4">
                <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight leading-tight">
                  Oracle<sup className="text-[0.45em] font-normal align-super ml-0.5 text-white/70">™</sup>
                  {' '}<span className="text-primary">Free Trial</span>
                  <span className="block text-white/90 mt-1">7 jours</span>
                </h1>
                <p className="text-sm md:text-base text-white/50 font-display tracking-wide">
                  Faire ma demande pour rejoindre
                </p>
              </div>
            )}

            <div className={!disqualified && !submitted ? "rounded-2xl border border-white/80 bg-white/[0.02] backdrop-blur-sm p-6 md:p-10 shadow-[0_0_40px_rgba(255,255,255,0.04)]" : ""}>
            {disqualified ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto"><span className="text-3xl">🙏</span></div>
                <h2 className="text-2xl font-display font-bold">Merci pour ton honnêteté</h2>
                <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">Malheureusement, ton profil ne correspond pas aux critères requis pour le moment.</p>
              </div>
            ) : submitted ? (
              <div className="text-center space-y-10 py-4">
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
                      Demande de Free Trial étudiée
                    </h2>
                    <p className="text-sm md:text-base text-white/55 font-display leading-relaxed max-w-sm mx-auto">
                      Un membre de notre équipe reviendra vers toi pour valider ta candidature.
                    </p>
                  </div>
                </div>

                <div className="h-px w-16 bg-white/15 mx-auto" />

                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set('name', contact.first_name.trim());
                    params.set('email', contact.email.trim().toLowerCase());
                    const phone = contact.phone ? `${contact.countryCode}${contact.phone.replace(/\s/g, '')}` : '';
                    if (phone) params.set('phone', phone);
                    navigate(`/${slug}/discovery?${params}`);
                  }}
                  className="w-full h-14 rounded-xl bg-[#19B7C9] hover:bg-[#19B7C9]/90 text-[#0A0B10] font-display text-sm md:text-base font-semibold tracking-wide transition-all shadow-[0_0_30px_rgba(25,183,201,0.25)] hover:shadow-[0_0_40px_rgba(25,183,201,0.35)]"
                >
                  Clique ici pour sécuriser ton accès à vie à Oracle<sup className="text-[0.55em] font-normal align-super ml-0.5">™</sup>
                </button>
              </div>
            ) : isContactStep ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-primary/60 font-display uppercase tracking-widest mb-2">Dernière étape</p>
                  <h2 className="text-2xl font-display font-bold">Tes coordonnées</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-white/40 font-display uppercase tracking-wider mb-1.5 block">{config.apply_form_name_label || 'Prénom'}</label>
                    <input type="text" value={contact.first_name} onChange={e => setContact(c => ({ ...c, first_name: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all" placeholder="Ton prénom" autoFocus />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 font-display uppercase tracking-wider mb-1.5 block">{config.apply_form_phone_label || 'Téléphone'}</label>
                    <div className="flex gap-2">
                      <select value={contact.countryCode} onChange={e => { const code = e.target.value; setContact(c => ({ ...c, countryCode: code, phone: formatPhone(c.phone, code) })); }}
                        className="h-12 px-3 rounded-xl bg-[#111318] border border-white/[0.10] text-white text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer [&>option]:bg-[#111318] [&>option]:text-white">
                        <option value="+33">🇫🇷 +33</option><option value="+32">🇧🇪 +32</option><option value="+41">🇨🇭 +41</option>
                        <option value="+44">🇬🇧 +44</option><option value="+1">🇺🇸 +1</option><option value="+49">🇩🇪 +49</option>
                        <option value="+34">🇪🇸 +34</option><option value="+39">🇮🇹 +39</option><option value="+351">🇵🇹 +351</option>
                        <option value="+212">🇲🇦 +212</option><option value="+213">🇩🇿 +213</option><option value="+216">🇹🇳 +216</option>
                        <option value="+225">🇨🇮 +225</option><option value="+221">🇸🇳 +221</option><option value="+237">🇨🇲 +237</option>
                        <option value="+243">🇨🇩 +243</option><option value="+352">🇱🇺 +352</option><option value="+377">🇲🇨 +377</option>
                      </select>
                      <input type="tel" value={contact.phone} onChange={e => { const formatted = formatPhone(e.target.value, contact.countryCode); setContact(c => ({ ...c, phone: formatted })); }}
                        className="flex-1 h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-mono tracking-wider" placeholder={currentPhoneFmt.placeholder} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 font-display uppercase tracking-wider mb-1.5 block">{config.apply_form_email_label || 'Email'}</label>
                    <input type="email" value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all" placeholder="ton@email.com" />
                  </div>
                </div>
                {/* Honeypot — invisible aux humains, rempli par les bots */}
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
                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{error}</p>}
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => setStep(s => s - 1)} className="h-12 px-5 rounded-xl bg-white/[0.04] border border-white/[0.10] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={handleSubmit} disabled={submitting || !contact.first_name.trim() || !contact.email.trim()}
                    className="flex-1 h-12 rounded-xl bg-[#19B7C9] hover:bg-[#19B7C9]/90 text-[#0A0B10] font-display text-sm font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(25,183,201,0.2)]">
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Envoyer ma candidature'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-7" key={step}>
                <div>
                  <p className="text-xs text-primary/60 font-display uppercase tracking-widest mb-2">Question {step + 1} / {questions.length}</p>
                  <h2 className="text-xl font-display font-bold leading-relaxed">{currentQuestion?.title}</h2>
                </div>
                <div className="space-y-2.5">
                  {(currentQuestion?.options || []).map((opt: any, i: number) => {
                    const selected = answers[currentQuestion!.id] === opt.label;
                    return (
                      <button key={i} onClick={() => handleAnswer(currentQuestion!.id, opt.label, opt.disqualifying)}
                        className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 ${selected ? 'bg-primary/15 border-primary/40 text-white shadow-[0_0_15px_rgba(25,183,201,0.1)]' : 'bg-white/[0.03] border-white/[0.08] text-white/80 hover:bg-white/[0.06] hover:border-white/[0.15]'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'border-primary bg-primary' : 'border-white/20'}`}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm font-display">{opt.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {step > 0 && <button onClick={() => setStep(s => s - 1)} className="text-xs text-white/30 hover:text-white/60 font-display uppercase tracking-wider transition-colors"><ChevronLeft className="w-3 h-3 inline mr-1" />Retour</button>}
              </div>
            )}
            </div>
          </div>
        </div>

        <footer className="py-4 text-center">
          <p className="text-[10px] text-white/15 font-display">
            {config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString()) || `© ${new Date().getFullYear()} Oracle`}
          </p>
        </footer>
      </div>
      )}
    </div>
  );
}
