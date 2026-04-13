import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useFunnelConfig } from '@/hooks/useFunnelConfig';
import { Loader2, ChevronRight, ChevronLeft, Check, ArrowRight, Play } from 'lucide-react';

// ============================================
// Funnel Apply Page — VSL + Multi-step form
// Route: /:slug/apply
//
// Flow:
// 1. If VSL enabled for this page → show headline + VSL + CTA
// 2. CTA click → show form (questions + contact)
// 3. If disqualified → rejection screen
// 4. If qualified → submit → redirect to /discovery
// ============================================

export default function FunnelApply() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { config, loading } = useFunnelConfig(slug);

  // VSL phase: if VSL is enabled for apply, show it first
  const hasVSL = config?.vsl_enabled && config?.vsl_page === 'apply' && config?.vsl_embed_code;
  const [showForm, setShowForm] = useState(false);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ first_name: '', phone: '', email: '', countryCode: '+33' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [disqualified, setDisqualified] = useState(false);
  const [error, setError] = useState('');

  const vslRef = useRef<HTMLDivElement>(null);

  const questions = useMemo(() => config?.apply_form_questions || [], [config]);
  const totalSteps = questions.length + 1;
  const isContactStep = step >= questions.length;
  const currentQuestion = !isContactStep ? questions[step] : null;
  const progress = ((step + 1) / totalSteps) * 100;

  const hasAnswer = currentQuestion ? !!answers[currentQuestion.id] : (contact.first_name && contact.email);

  // If no VSL → show form directly
  useEffect(() => {
    if (!hasVSL) setShowForm(true);
  }, [hasVSL]);

  // Execute Vidalytics script after mounting
  useEffect(() => {
    if (!hasVSL || showForm || !vslRef.current) return;
    if (config?.vsl_provider === 'vidalytics' && config?.vsl_embed_code) {
      // Vidalytics uses <script> tags — we need to extract and execute them
      const container = vslRef.current;
      container.innerHTML = config.vsl_embed_code;
      // Find and re-execute script tags (innerHTML doesn't execute scripts)
      const scripts = container.querySelectorAll('script');
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
        newScript.textContent = oldScript.textContent;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
    }
  }, [hasVSL, showForm, config?.vsl_provider, config?.vsl_embed_code]);

  const handleAnswer = (questionId: string, optionLabel: string, isDisqualifying?: boolean) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionLabel }));
    if (isDisqualifying) {
      setDisqualified(true);
      return;
    }
    setTimeout(() => setStep(s => Math.min(s + 1, totalSteps - 1)), 300);
  };

  const handleSubmit = async () => {
    if (!contact.first_name.trim() || !contact.email.trim()) {
      setError('Nom et email requis');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const emailNormalized = contact.email.trim().toLowerCase();
      const phoneFormatted = contact.phone.trim() ? `${contact.countryCode} ${contact.phone.trim()}` : null;

      const { error: dbError } = await supabase
        .from('early_access_requests')
        .insert({
          first_name: contact.first_name.trim(),
          email: emailNormalized,
          phone: phoneFormatted,
          status: 'en_attente',
          form_submitted: true,
        });

      if (dbError) {
        if (dbError.message.includes('duplicate') || dbError.message.includes('unique') || dbError.code === '23505') {
          await supabase
            .from('early_access_requests')
            .update({
              first_name: contact.first_name.trim(),
              phone: phoneFormatted || undefined,
              form_submitted: true,
            })
            .eq('email', emailNormalized);
        } else {
          setError(dbError.message);
          setSubmitting(false);
          return;
        }
      }

      setSubmitted(true);
      setTimeout(() => navigate(`/${slug}/discovery`), 1500);
    } catch (err) {
      setError('Erreur de connexion. Réessaie.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080d] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-[#08080d] flex items-center justify-center">
        <p className="text-white/40">Funnel non trouvé</p>
      </div>
    );
  }

  // ── Helper: Build embed for YouTube/Vimeo ──
  const renderVideoEmbed = () => {
    if (!config.vsl_embed_code) return null;

    if (config.vsl_provider === 'vidalytics') {
      // Vidalytics: inject raw HTML + scripts
      return (
        <div
          ref={vslRef}
          className="w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-black"
          style={{ minHeight: 320 }}
        />
      );
    }

    if (config.vsl_provider === 'youtube') {
      // Extract YouTube video ID from URL or use as-is
      const code = config.vsl_embed_code.trim();
      let videoId = code;
      try {
        if (code.includes('youtube.com') || code.includes('youtu.be')) {
          const url = new URL(code.startsWith('http') ? code : `https://${code}`);
          videoId = url.searchParams.get('v') || url.pathname.split('/').pop() || code;
        }
      } catch { /* use as-is */ }
      return (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
          title="VSL"
          className="w-full aspect-video rounded-2xl border border-white/[0.08]"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
          allowFullScreen
        />
      );
    }

    if (config.vsl_provider === 'vimeo') {
      const code = config.vsl_embed_code.trim();
      let videoId = code;
      try {
        if (code.includes('vimeo.com')) {
          const url = new URL(code.startsWith('http') ? code : `https://${code}`);
          videoId = url.pathname.split('/').pop() || code;
        }
      } catch { /* use as-is */ }
      return (
        <iframe
          src={`https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0`}
          title="VSL"
          className="w-full aspect-video rounded-2xl border border-white/[0.08]"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      );
    }

    // Fallback: raw HTML embed
    return (
      <div
        ref={vslRef}
        className="w-full rounded-2xl overflow-hidden border border-white/[0.08]"
        dangerouslySetInnerHTML={{ __html: config.vsl_embed_code }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col">

      {/* ═══════════════════════════════════════ */}
      {/* PHASE 1: VSL (before form)              */}
      {/* ═══════════════════════════════════════ */}
      {hasVSL && !showForm && !disqualified && !submitted ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-3xl space-y-8">

            {/* Headline */}
            <div className="text-center space-y-3">
              {config.apply_social_proof_enabled && config.apply_social_proof_text && (
                <p className="text-xs text-primary/70 font-display uppercase tracking-widest">
                  {config.apply_social_proof_text}
                </p>
              )}
              <h1 className="text-2xl md:text-3xl font-display font-bold leading-tight">
                {config.apply_headline || 'Découvre la méthode'}
              </h1>
              {config.landing_subtitle && (
                <p className="text-white/50 text-sm md:text-base leading-relaxed max-w-xl mx-auto">
                  {config.landing_subtitle}
                </p>
              )}
            </div>

            {/* VSL Embed */}
            <div className="relative">
              {renderVideoEmbed()}
            </div>

            {/* CTA → open form */}
            <div className="text-center space-y-3">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2.5 px-10 py-4 bg-primary rounded-xl text-white font-display text-base font-semibold tracking-wider shadow-[0_0_40px_rgba(25,183,201,0.3)] hover:shadow-[0_0_60px_rgba(25,183,201,0.4)] hover:scale-[1.02] transition-all"
              >
                {config.landing_cta_text || 'Déposer ma candidature'}
                <ArrowRight className="w-5 h-5" />
              </button>
              {config.landing_cta_subtext && (
                <p className="text-[11px] text-white/25">{config.landing_cta_subtext}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-auto pt-8">
            <p className="text-[10px] text-white/15 font-display">
              {config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString()) || `© ${new Date().getFullYear()} Oracle`}
            </p>
          </footer>
        </div>
      ) : (

      /* ═══════════════════════════════════════ */
      /* PHASE 2: Form (existing behavior)       */
      /* ═══════════════════════════════════════ */
      <>
        {/* Progress bar (only during form) */}
        {!disqualified && !submitted && (
          <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/[0.06]">
            <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-lg">

            {disqualified ? (
              <div className="text-center animate-fade-in space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto">
                  <span className="text-3xl">🙏</span>
                </div>
                <h2 className="text-2xl font-display font-bold">Merci pour ton honnêteté</h2>
                <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
                  Malheureusement, ton profil ne correspond pas aux critères requis pour le moment. On te souhaite le meilleur pour la suite.
                </p>
              </div>
            ) : submitted ? (
              <div className="text-center animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-display font-bold mb-2">Candidature envoyée !</h2>
                <p className="text-white/50">Redirection en cours...</p>
              </div>
            ) : isContactStep ? (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <p className="text-xs text-primary/60 font-display uppercase tracking-widest mb-2">Dernière étape</p>
                  <h2 className="text-2xl font-display font-bold">Tes coordonnées</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-white/40 font-display uppercase tracking-wider mb-1.5 block">
                      {config.apply_form_name_label || 'Prénom'}
                    </label>
                    <input
                      type="text"
                      value={contact.first_name}
                      onChange={e => setContact(c => ({ ...c, first_name: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                      placeholder="Ton prénom"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 font-display uppercase tracking-wider mb-1.5 block">
                      {config.apply_form_phone_label || 'Téléphone'}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={contact.countryCode}
                        onChange={e => setContact(c => ({ ...c, countryCode: e.target.value }))}
                        className="h-12 px-3 rounded-xl bg-[#111318] border border-white/[0.10] text-white text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer [&>option]:bg-[#111318] [&>option]:text-white"
                      >
                        <option value="+33">🇫🇷 +33</option>
                        <option value="+32">🇧🇪 +32</option>
                        <option value="+41">🇨🇭 +41</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+49">🇩🇪 +49</option>
                        <option value="+34">🇪🇸 +34</option>
                        <option value="+39">🇮🇹 +39</option>
                        <option value="+351">🇵🇹 +351</option>
                        <option value="+212">🇲🇦 +212</option>
                        <option value="+213">🇩🇿 +213</option>
                        <option value="+216">🇹🇳 +216</option>
                        <option value="+225">🇨🇮 +225</option>
                        <option value="+221">🇸🇳 +221</option>
                        <option value="+237">🇨🇲 +237</option>
                        <option value="+243">🇨🇩 +243</option>
                        <option value="+352">🇱🇺 +352</option>
                        <option value="+377">🇲🇨 +377</option>
                      </select>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={e => {
                          const val = e.target.value.replace(/[^\d\s]/g, '');
                          const formatted = val.replace(/(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
                          setContact(c => ({ ...c, phone: formatted }));
                        }}
                        className="flex-1 h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-mono tracking-wider"
                        placeholder="6 12 34 56 78"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 font-display uppercase tracking-wider mb-1.5 block">
                      {config.apply_form_email_label || 'Email'}
                    </label>
                    <input
                      type="email"
                      value={contact.email}
                      onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/25 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                      placeholder="ton@email.com"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{error}</p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setStep(s => s - 1)}
                    className="h-12 px-5 rounded-xl bg-white/[0.04] border border-white/[0.10] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all font-display text-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !contact.first_name.trim() || !contact.email.trim()}
                    className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-display text-sm font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(25,183,201,0.2)]"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Envoyer ma candidature'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in" key={step}>
                <div>
                  <p className="text-xs text-primary/60 font-display uppercase tracking-widest mb-2">
                    Question {step + 1} / {questions.length}
                  </p>
                  <h2 className="text-xl font-display font-bold leading-relaxed">
                    {currentQuestion?.title}
                  </h2>
                </div>

                <div className="space-y-2.5">
                  {(currentQuestion?.options || []).map((opt: any, i: number) => {
                    const selected = answers[currentQuestion!.id] === opt.label;
                    return (
                      <button
                        key={i}
                        onClick={() => handleAnswer(currentQuestion!.id, opt.label, opt.disqualifying)}
                        className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 ${
                          selected
                            ? 'bg-primary/15 border-primary/40 text-white shadow-[0_0_15px_rgba(25,183,201,0.1)]'
                            : 'bg-white/[0.03] border-white/[0.08] text-white/80 hover:bg-white/[0.06] hover:border-white/[0.15]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            selected ? 'border-primary bg-primary' : 'border-white/20'
                          }`}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm font-display">{opt.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {step > 0 && (
                  <button
                    onClick={() => setStep(s => s - 1)}
                    className="text-xs text-white/30 hover:text-white/60 font-display uppercase tracking-wider transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3 inline mr-1" />Retour
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="py-4 text-center">
          <p className="text-[10px] text-white/15 font-display">
            {config.brand_footer_text?.replace('{year}', new Date().getFullYear().toString()) || `© ${new Date().getFullYear()} Oracle`}
          </p>
        </footer>
      </>
      )}
    </div>
  );
}
