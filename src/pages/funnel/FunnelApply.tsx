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
    setSubmitting(true); setError('');
    try {
      const email = contact.email.trim().toLowerCase();
      const phone = contact.phone.trim() ? `${contact.countryCode} ${contact.phone.trim()}` : null;
      // Extract structured fields from form answers
      const investmentAnswer = answers['investment_amount'] || '';
      const difficulte = answers['main_difficulty'] || null;
      const importanceRaw = answers['time_commitment'] || '';

      // Parse budget number from range string (e.g. "3 000 € - 5 000 €" → 3000)
      const budgetMatch = investmentAnswer.match(/(\d[\d\s]*)\s*€/);
      const budgetAmount = budgetMatch ? parseInt(budgetMatch[1].replace(/\s/g, ''), 10) : null;

      // Auto-calculate priority from budget
      const priorite = budgetAmount && budgetAmount >= 5000 ? 'P1' : budgetAmount && budgetAmount >= 3000 ? 'P2' : budgetAmount && budgetAmount >= 1000 ? 'P3' : null;

      // Parse importance (1-10) from range string (e.g. "7-9" → 8)
      const impMatch = importanceRaw.match(/(\d+)/);
      const importance = impMatch ? parseInt(impMatch[1], 10) : null;

      const specFields: any = {
        form_answers: answers,
        offer_amount: investmentAnswer || null,
        budget_amount: budgetAmount,
        priorite,
        difficulte_principale: difficulte,
        importance_trading: importance,
      };

      const row: any = {
        first_name: contact.first_name.trim(), email, phone,
        status: 'en_attente', form_submitted: true,
        ...specFields,
      };
      const { error: dbError } = await supabase.from('early_access_requests').insert(row);
      if (dbError) {
        if (dbError.message.includes('duplicate') || dbError.message.includes('unique') || dbError.code === '23505') {
          await supabase.from('early_access_requests').update({
            first_name: contact.first_name.trim(), phone: phone || undefined,
            form_submitted: true, ...specFields,
          }).eq('email', email);
        } else { setError(dbError.message); setSubmitting(false); return; }
      }
      setSubmitted(true);
      const params = new URLSearchParams();
      params.set('name', contact.first_name.trim());
      params.set('email', email);
      if (phone) params.set('phone', phone);
      setTimeout(() => navigate(`/${slug}/discovery?${params}`), 1500);
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
        <div className="relative z-10">
          <div className="px-3 md:px-4 pt-6 md:pt-10 pb-8 md:pb-10">
            <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

              {/* Headline — near full-width on desktop */}
              <div className="text-center space-y-6">
                <AccentText
                  html={config.apply_headline || 'Découvre la méthode'}
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display text-white leading-[1.3] md:leading-[1.35] px-2"
                />
                {(config.apply_subtitle || config.landing_subtitle) && (
                  <AccentText
                    html={config.apply_subtitle || config.landing_subtitle}
                    as="p"
                    className="text-xl sm:text-2xl md:text-3xl font-display text-white/90 max-w-2xl mx-auto mt-6 md:mt-10 px-4 leading-relaxed"
                  />
                )}
              </div>

              {/* VSL — full-width glowing container */}
              <div className="w-full max-w-6xl mx-auto">
                <div className="relative pt-4 md:pt-6 pb-4 md:pb-6 px-2 md:px-4">
                  <div className="relative z-10 rounded-lg md:rounded-xl overflow-hidden border border-primary/30 md:border-2 md:border-primary/40 shadow-[0_0_8px_0px_rgba(25,183,201,0.3)] md:shadow-[0_0_12px_0px_rgba(25,183,201,0.4),0_0_25px_5px_rgba(25,183,201,0.25),0_0_50px_10px_rgba(25,183,201,0.15),0_0_80px_20px_rgba(25,183,201,0.08)]">
                    {hasVSLEmbed ? renderEmbed() : (
                      <div className="w-full aspect-video bg-white/[0.02] flex items-center justify-center">
                        <p className="text-sm text-white/20 font-display">VSL — coller le code Vidalytics dans la config</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CTA — big, glowing, appears after delay */}
              <div className={`w-full text-center transition-all duration-700 ${ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <button
                  onClick={() => setShowForm(true)}
                  className="group relative px-12 py-5 bg-[#19B7C9] text-[#0A0B10] font-display text-lg font-bold uppercase tracking-wider rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(25,183,201,0.3)]"
                >
                  <span className="absolute inset-0 rounded-xl bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative flex items-center gap-3 justify-center">
                    {config.landing_cta_text || 'Candidater'}
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </button>
                {config.landing_cta_subtext && (
                  <p className="text-xs text-white/25 mt-4">{config.landing_cta_subtext}</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="py-4 text-center">
            <p className="text-[10px] text-white/15 font-display">
              {config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString()) || `© ${new Date().getFullYear()} Oracle`}
            </p>
          </footer>
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

        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg">

            {disqualified ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto"><span className="text-3xl">🙏</span></div>
                <h2 className="text-2xl font-display font-bold">Merci pour ton honnêteté</h2>
                <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">Malheureusement, ton profil ne correspond pas aux critères requis pour le moment.</p>
              </div>
            ) : submitted ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6"><Check className="w-8 h-8 text-emerald-400" /></div>
                <h2 className="text-2xl font-display font-bold mb-2">Candidature envoyée !</h2>
                <p className="text-white/50">Redirection en cours...</p>
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
              <div className="space-y-6" key={step}>
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
