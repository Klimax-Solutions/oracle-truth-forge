// ============================================
// Admin Funnel Config — Premium split editor
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Save, Eye, Globe, FileText,
  MessageSquare, Phone, Calendar, Video, Type,
  ChevronDown, ChevronRight, ExternalLink, Shield,
  CheckCircle2, Send, ArrowRight, Plus, Trash2,
  GripVertical, Sparkles, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';




import { useAdminFunnelConfig, SaveStatus } from '@/hooks/useFunnelConfig';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ---- Premium Config Components ----

function Section({
  title, icon: Icon, children, defaultOpen = true, badge,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.07] backdrop-blur-sm"
    >
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-all duration-200 group">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/15 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-display text-[11px] tracking-[0.15em] uppercase text-white/90">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/20 text-[9px] text-primary font-display">{badge}</span>
          )}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-white/30" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-white/[0.10] pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Field({
  label, value, onChange, placeholder, hint, multiline, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; multiline?: boolean; disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="font-display text-[10px] tracking-[0.15em] uppercase text-white/40">{label}</Label>
      {multiline ? (
        <Textarea
          value={value || ''} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/15 focus:border-primary/40 focus:ring-1 focus:ring-primary/15 text-sm min-h-[72px] resize-none rounded-xl transition-all duration-200 hover:bg-white/[0.05]"
        />
      ) : (
        <Input
          value={value || ''} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/15 focus:border-primary/40 focus:ring-1 focus:ring-primary/15 text-sm h-10 rounded-xl transition-all duration-200 hover:bg-white/[0.05]"
        />
      )}
      {hint && <p className="text-[10px] text-white/25 leading-relaxed">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-1">
      <Label className="font-display text-[10px] tracking-[0.15em] uppercase text-white/40">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

// ---- Question Card (premium) ----

function QuestionCard({
  question, index, total, canEdit, onUpdate, onDelete,
}: {
  question: any; index: number; total: number; canEdit: boolean;
  onUpdate: (q: any) => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06] hover:border-white/[0.1] transition-all duration-200"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3"
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center text-[10px] font-display text-primary font-bold">
            {index + 1}
          </span>
        </div>
        <span className="text-xs text-white/70 truncate text-left flex-1">
          {question.title || 'Nouvelle question...'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-white/20 font-display">
            {(question.options || []).length} opt
          </span>
          {(question.options || []).some((o: any) => o.disqualifying) && (
            <AlertTriangle className="w-3 h-3 text-amber-400/50" />
          )}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronDown className="w-3.5 h-3.5 text-white/25" />
          </motion.div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3">
              {/* Question text */}
              <div className="space-y-1.5">
                <Label className="font-display text-[9px] tracking-[0.15em] uppercase text-white/30">Intitulé</Label>
                <Input
                  value={question.title || ''}
                  onChange={(e) => onUpdate({ ...question, title: e.target.value })}
                  disabled={!canEdit}
                  className="bg-white/[0.03] border-white/[0.06] text-white text-sm h-9 rounded-lg"
                />
              </div>

              {/* Options */}
              <div className="space-y-1.5">
                <Label className="font-display text-[9px] tracking-[0.15em] uppercase text-white/30">Réponses</Label>
                <div className="space-y-1.5">
                  {(question.options || []).map((opt: any, oIdx: number) => (
                    <div key={oIdx} className="flex items-center gap-2 group/opt">
                      <div className="w-4 h-4 rounded-full border-2 border-white/10 shrink-0" />
                      <Input
                        value={opt.label || ''}
                        onChange={(e) => {
                          const options = [...(question.options || [])];
                          options[oIdx] = { ...options[oIdx], label: e.target.value };
                          onUpdate({ ...question, options });
                        }}
                        disabled={!canEdit}
                        className={cn(
                          "bg-white/[0.02] border-white/[0.10] text-white text-xs h-8 rounded-lg flex-1 transition-all",
                          opt.disqualifying && "border-amber-500/20 bg-amber-500/[0.03]"
                        )}
                      />
                      <button
                        onClick={() => {
                          const options = [...(question.options || [])];
                          options[oIdx] = { ...options[oIdx], disqualifying: !opt.disqualifying };
                          onUpdate({ ...question, options });
                        }}
                        disabled={!canEdit}
                        className={cn(
                          "shrink-0 px-1.5 py-1 rounded-md text-[8px] font-display tracking-wider uppercase border transition-all",
                          opt.disqualifying
                            ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                            : "bg-transparent border-white/[0.06] text-white/20 hover:text-white/40 hover:border-white/[0.1]"
                        )}
                      >
                        DQ
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => {
                            const options = [...(question.options || [])];
                            options.splice(oIdx, 1);
                            onUpdate({ ...question, options });
                          }}
                          className="shrink-0 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3 text-red-400/40 hover:text-red-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <button
                    onClick={() => {
                      const options = [...(question.options || []), { label: '', disqualifying: false }];
                      onUpdate({ ...question, options });
                    }}
                    className="flex items-center gap-1.5 text-[10px] text-primary/50 hover:text-primary transition-colors pt-1"
                  >
                    <Plus className="w-3 h-3" /> Ajouter une réponse
                  </button>
                )}
              </div>

              {/* Delete */}
              {canEdit && (
                <div className="pt-2 border-t border-white/[0.04]">
                  <button onClick={onDelete} className="flex items-center gap-1.5 text-[10px] text-red-400/40 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" /> Supprimer cette question
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---- Preview Components ----

function PreviewLanding({ c }: { c: any }) {
  return (
    <div className="min-h-full bg-[#0a0a0f] flex items-center justify-center p-8">
      <div className="text-center space-y-8 max-w-md">
        <div className="font-display text-xs tracking-[0.4em] uppercase text-white/40">{c.brand_name || 'Oracle'}</div>
        <h1 className="font-display text-3xl text-white leading-tight">
          {c.landing_headline || 'Titre principal'}{' '}
          <span className="text-[#19B7C9]">{c.landing_headline_accent || 'Accroche'}</span>
        </h1>
        <p className="text-sm text-white/50 leading-relaxed">{c.landing_subtitle || 'Sous-titre'}</p>
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#19B7C9]/30" />
          <div className="w-2 h-2 border border-[#19B7C9]/40 rotate-45" />
          <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#19B7C9]/30" />
        </div>
        <div className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#19B7C9] rounded-xl text-white font-display text-sm tracking-wider shadow-[0_0_30px_rgba(25,183,201,0.3)]">
          {c.landing_cta_text || 'Commencer'}
          <ArrowRight className="w-4 h-4" />
        </div>
        <p className="text-[10px] text-white/25">{c.landing_cta_subtext || 'Sous-texte CTA'}</p>
        <p className="text-[9px] text-white/15 uppercase tracking-widest pt-6">{c.landing_footer_text || 'Footer'}</p>
      </div>
    </div>
  );
}

function PreviewApply({ c }: { c: any }) {
  const questions = c.apply_form_questions || [];
  const [previewStep, setPreviewStep] = useState(0);
  const totalSteps = questions.length + 1; // questions + contact info
  const isContactStep = previewStep >= questions.length;
  const currentQ = questions[previewStep];

  return (
    <div className="min-h-full bg-[#0a0a0f] p-8">
      <div className="max-w-md mx-auto space-y-8 pt-6">
        <h1 className="font-display text-2xl text-white text-center leading-relaxed">
          {c.apply_headline || 'Dépose ta candidature'}
        </h1>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5 backdrop-blur-sm">
          {/* Progress bar */}
          <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-[#19B7C9] rounded-full transition-all duration-300" style={{ width: `${((previewStep + 1) / totalSteps) * 100}%` }} />
          </div>

          {isContactStep ? (
            /* Contact info step preview */
            <div className="space-y-4">
              <p className="text-lg text-white font-display leading-snug">Tes coordonnées</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 font-display uppercase tracking-wider">{c.apply_form_name_label || 'Comment tu t\'appelles ?'}</label>
                  <div className="h-12 rounded-xl bg-white/[0.06] border border-white/[0.10]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 font-display uppercase tracking-wider">{c.apply_form_phone_label || 'Sur quel numéro te joindre ?'}</label>
                  <div className="h-12 rounded-xl bg-white/[0.06] border border-white/[0.10] flex items-center px-3 gap-2">
                    <span className="text-sm text-white/40">🇫🇷 +33</span>
                    <div className="w-px h-6 bg-white/10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 font-display uppercase tracking-wider">{c.apply_form_email_label || 'Quelle est ton adresse email ?'}</label>
                  <div className="h-12 rounded-xl bg-white/[0.06] border border-white/[0.10]" />
                </div>
              </div>
            </div>
          ) : currentQ ? (
            <>
              <p className="text-lg text-white font-display leading-snug">{currentQ.title}</p>
              <div className="space-y-2.5">
                {(currentQ.options || []).slice(0, 6).map((opt: any, i: number) => (
                  <div key={i} className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all",
                    i === 0
                      ? "border-[#19B7C9]/40 bg-[#19B7C9]/10 text-white shadow-[0_0_20px_rgba(25,183,201,0.15)]"
                      : "border-white/[0.06] bg-white/[0.02] text-white/60"
                  )}>
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 shrink-0",
                      i === 0 ? "border-white bg-white" : "border-white/20"
                    )}>
                      {i === 0 && <div className="w-1.5 h-1.5 rounded-full bg-[#19B7C9] m-auto mt-[3px]" />}
                    </div>
                    <span>{opt.label || 'Option...'}</span>
                    {opt.disqualifying && <AlertTriangle className="w-3 h-3 text-amber-400/60 ml-auto" />}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-white/30 text-center py-8">Aucune question</p>
          )}
        </div>

        {/* Step navigation */}
        {totalSteps > 1 && (
          <div className="space-y-3 px-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPreviewStep(Math.max(0, previewStep - 1))}
                disabled={previewStep === 0}
                className="text-[10px] font-display text-white/30 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors px-2 py-1"
              >
                ← Précédent
              </button>
              <span className="text-[10px] font-display text-white/30">
                {previewStep + 1} / {totalSteps} {isContactStep ? '(Contact)' : ''}
              </span>
              <button
                onClick={() => setPreviewStep(Math.min(totalSteps - 1, previewStep + 1))}
                disabled={previewStep >= totalSteps - 1}
                className="text-[10px] font-display text-primary/60 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors px-2 py-1"
              >
                Suivant →
              </button>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewStep(i)}
                  className={cn(
                    "h-1.5 rounded-full flex-1 transition-all cursor-pointer hover:opacity-80",
                    i <= previewStep ? "bg-[#19B7C9]" : "bg-white/[0.06]"
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewDiscovery({ c }: { c: any }) {
  return (
    <div className="min-h-full bg-[#0a0a0f] p-8">
      <div className="max-w-md mx-auto space-y-8 pt-8 text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {c.discovery_badge_text || 'Candidature acceptée'}
        </span>
        <h1 className="font-display text-3xl text-white leading-tight">
          {c.discovery_headline_personalized || 'Bienvenue'} Charles
        </h1>
        <p className="text-sm text-white/45 leading-relaxed">{c.discovery_subtitle || 'Sous-titre'}</p>
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#19B7C9]/40 to-transparent mx-auto" />
        <div className="space-y-3">
          <h2 className="font-display text-lg text-white">{c.discovery_cta_title || 'Choisis ton créneau'}</h2>
          <p className="text-xs text-white/35">{c.discovery_cta_subtitle || 'Appel de 30 min'}</p>
        </div>
        <div className="inline-flex px-10 py-4 bg-[#19B7C9] rounded-xl text-white font-display text-base uppercase tracking-wider shadow-[0_0_40px_rgba(25,183,201,0.3)]">
          {c.discovery_cta_button || 'Réserver mon appel'}
        </div>
      </div>
    </div>
  );
}

function PreviewFinal({ c }: { c: any }) {
  return (
    <div className="min-h-full bg-[#0a0a0f] p-8">
      <div className="max-w-md mx-auto space-y-6 pt-6">
        <div className="text-center space-y-5">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {c.final_badge_text || 'Confirmé'}
          </span>
          <h1 className="font-display text-2xl text-white leading-tight">
            {c.final_headline_personalized || 'Bravo'} Charles,{' '}
            <span className="text-[#19B7C9]">{c.final_headline_confirmation || 'ton appel est'} !</span>
          </h1>
          <div className="inline-flex items-center gap-3 px-5 py-3 bg-white/[0.04] border border-[#19B7C9]/20 rounded-xl">
            <Calendar className="w-4 h-4 text-[#19B7C9]" />
            <span className="text-sm text-white font-display">Lundi 24 mars, 14:00</span>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-display text-[#19B7C9]/80">1</span>
            <span className="text-xs text-white/25">/2</span>
            <span className="text-sm font-display text-white">{c.final_step1_title || 'Confirme ta présence'}</span>
          </div>
          <p className="text-[#19B7C9] font-display">{c.final_step1_congrats || 'Félicitations !'}</p>
          <p className="text-xs text-white/45 leading-relaxed">{c.final_step1_instructions || 'Instructions...'}</p>
          <div className="bg-red-500/[0.04] border border-red-500/10 rounded-xl p-4">
            <p className="text-xs text-red-400/60 font-display mb-1">{c.final_step1_warning_title || 'Important'}</p>
            <p className="text-[11px] text-white/35">{c.final_step1_warning_text || 'Message...'}</p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-display text-[#19B7C9]/80">2</span>
            <span className="text-xs text-white/25">/2</span>
            <span className="text-sm font-display text-white">{c.final_step2_title || 'Une question ?'}</span>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.10] rounded-xl p-4">
            <div className="h-20 rounded-lg bg-white/[0.02] border border-white/[0.04] mb-3 flex items-start p-3">
              <span className="text-xs text-white/15">{c.final_step2_placeholder || 'Écris ta question...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/25">{c.final_step2_subtext || 'Réponse avant ton appel'}</span>
              <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#19B7C9] rounded-full text-white text-xs font-display">
                <Send className="w-3 h-3" /> Envoyer
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBranding({ c }: { c: any }) {
  return (
    <div className="min-h-full bg-[#0a0a0f] flex items-center justify-center p-8">
      <div className="text-center space-y-8 max-w-sm">
        <div className="font-display text-4xl tracking-wider text-white uppercase">{c.brand_name || 'Oracle'}</div>
        <p className="text-sm text-white/35">
          {(c.brand_footer_text || '© {year} Oracle. Tous droits réservés.').replace('{year}', '2026')}
        </p>
        {c.vsl_enabled && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 space-y-3">
            <Video className="w-10 h-10 text-[#19B7C9]/40 mx-auto" />
            <p className="text-sm text-white/35">VSL — {c.vsl_provider || 'vidalytics'}</p>
            <p className="text-xs text-white/20">Page : {c.vsl_page || 'discovery'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Tab Button ----

function TabButton({ active, icon: Icon, label, onClick }: {
  active: boolean; icon: React.ElementType; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-display tracking-[0.15em] uppercase transition-all duration-200",
        active
          ? "bg-gradient-to-r from-primary/20 to-primary/10 text-white border border-primary/25 shadow-[0_0_15px_rgba(25,183,201,0.1)]"
          : "text-white/35 hover:text-white/55 hover:bg-white/[0.03] border border-transparent"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ---- Block Types ----

const BLOCK_TYPES = [
  { type: 'form', label: 'Formulaire', icon: FileText, description: 'Questionnaire de candidature' },
  { type: 'cal', label: 'Cal.com', icon: Calendar, description: 'Calendrier de réservation' },
  { type: 'vsl', label: 'Vidéo / VSL', icon: Video, description: 'Lecteur vidéo (Vidalytics, YouTube...)' },
  { type: 'text', label: 'Texte', icon: Type, description: 'Titre + paragraphe personnalisé' },
  { type: 'cta', label: 'Bouton CTA', icon: ArrowRight, description: 'Bouton d\'action avec lien' },
] as const;

function BlockEditor({
  blocks, onChange, canEdit, calEvents = [], calEventsLoading = false,
}: {
  blocks: any[]; onChange: (blocks: any[]) => void; canEdit: boolean;
  calEvents?: { id: number; title: string; slug: string; length: number; link: string }[];
  calEventsLoading?: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);

  const addBlock = (type: string) => {
    const defaultConfigs: Record<string, any> = {
      form: { variant: 'vip' },
      cal: { link: '', title: 'Choisis ton créneau', subtitle: 'Appel stratégique de 30 min', button_text: 'Réserver mon appel' },
      vsl: { provider: 'vidalytics', embed_code: '' },
      text: { title: '', body: '' },
      cta: { text: 'Commencer', url: '/vip/apply', style: 'primary' },
    };
    onChange([...blocks, { type, id: `block_${Date.now()}`, config: defaultConfigs[type] || {} }]);
    setShowAdd(false);
  };

  const updateBlock = (idx: number, config: any) => {
    const updated = [...blocks];
    updated[idx] = { ...updated[idx], config };
    onChange(updated);
  };

  const removeBlock = (idx: number) => {
    const updated = [...blocks];
    updated.splice(idx, 1);
    onChange(updated);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    if (idx + dir < 0 || idx + dir >= blocks.length) return;
    const updated = [...blocks];
    [updated[idx], updated[idx + dir]] = [updated[idx + dir], updated[idx]];
    onChange(updated);
  };

  const blockMeta = (type: string) => BLOCK_TYPES.find(b => b.type === type);

  return (
    <Section title="Composants" icon={Sparkles} badge={blocks.length > 0 ? `${blocks.length}` : undefined}>
      <div className="space-y-2">
        <AnimatePresence>
          {blocks.map((block, idx) => {
            const meta = blockMeta(block.type);
            const Icon = meta?.icon || FileText;
            return (
              <motion.div
                key={block.id || idx}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06] overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-xs text-white/70 font-display tracking-wider uppercase flex-1">{meta?.label || block.type}</span>
                  <div className="flex items-center gap-1">
                    {canEdit && idx > 0 && (
                      <button onClick={() => moveBlock(idx, -1)} className="p-1 text-white/20 hover:text-white/50 transition-colors text-[10px]">▲</button>
                    )}
                    {canEdit && idx < blocks.length - 1 && (
                      <button onClick={() => moveBlock(idx, 1)} className="p-1 text-white/20 hover:text-white/50 transition-colors text-[10px]">▼</button>
                    )}
                    {canEdit && (
                      <button onClick={() => removeBlock(idx)} className="p-1 text-red-400/30 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Block-specific config */}
                <div className="px-4 pb-3 space-y-2 border-t border-white/[0.04] pt-2">
                  {block.type === 'text' && (
                    <>
                      <Field label="Titre" value={block.config?.title || ''} onChange={(v) => updateBlock(idx, { ...block.config, title: v })} disabled={!canEdit} />
                      <Field label="Paragraphe" value={block.config?.body || ''} onChange={(v) => updateBlock(idx, { ...block.config, body: v })} multiline disabled={!canEdit} />
                    </>
                  )}
                  {block.type === 'cta' && (
                    <>
                      <Field label="Texte du bouton" value={block.config?.text || ''} onChange={(v) => updateBlock(idx, { ...block.config, text: v })} disabled={!canEdit} />
                      <Field label="URL de destination" value={block.config?.url || ''} onChange={(v) => updateBlock(idx, { ...block.config, url: v })} disabled={!canEdit} />
                    </>
                  )}
                  {block.type === 'cal' && (
                    <>
                      <div className="space-y-2">
                        <Label className="font-display text-[9px] tracking-[0.15em] uppercase text-white/30">Événement Cal.com</Label>
                        {calEvents.length > 0 ? (
                          <select
                            value={block.config?.link || ''}
                            onChange={(e) => updateBlock(idx, { ...block.config, link: e.target.value })}
                            disabled={!canEdit}
                            className="w-full h-9 bg-white/[0.03] border border-white/[0.06] text-white text-sm rounded-lg px-3 focus:border-primary/40"
                          >
                            <option value="">Sélectionner un événement...</option>
                            {calEvents.map((ev) => (
                              <option key={ev.id} value={ev.link}>
                                {ev.title} ({ev.length}min) — {ev.link}
                              </option>
                            ))}
                          </select>
                        ) : calEventsLoading ? (
                          <p className="text-[10px] text-white/30">Chargement des événements...</p>
                        ) : (
                          <Field label="" value={block.config?.link || ''} onChange={(v) => updateBlock(idx, { ...block.config, link: v })} disabled={!canEdit} hint="username/event-type" />
                        )}
                      </div>
                      <Field label="Titre au-dessus du calendrier" value={block.config?.title || ''} onChange={(v) => updateBlock(idx, { ...block.config, title: v })} disabled={!canEdit} />
                      <Field label="Sous-titre" value={block.config?.subtitle || ''} onChange={(v) => updateBlock(idx, { ...block.config, subtitle: v })} disabled={!canEdit} />
                      <Field label="Texte du bouton" value={block.config?.button_text || ''} onChange={(v) => updateBlock(idx, { ...block.config, button_text: v })} disabled={!canEdit} />
                      {calEvents.length === 0 && !calEventsLoading && (
                        <p className="text-[10px] text-white/25">
                          Configure ta clé API Cal.com dans{' '}
                          <a href="/admin/integrations" className="text-primary/60 hover:text-primary underline">Intégrations</a>
                        </p>
                      )}
                    </>
                  )}
                  {block.type === 'vsl' && (
                    <>
                      <div className="space-y-2">
                        <Label className="font-display text-[10px] tracking-[0.15em] uppercase text-white/40">Fournisseur</Label>
                        <select value={block.config?.provider || 'vidalytics'} onChange={(e) => updateBlock(idx, { ...block.config, provider: e.target.value })} disabled={!canEdit}
                          className="w-full h-9 bg-white/[0.03] border border-white/[0.06] text-white text-sm rounded-lg px-3">
                          <option value="vidalytics">Vidalytics</option>
                          <option value="youtube">YouTube</option>
                          <option value="vimeo">Vimeo</option>
                        </select>
                      </div>
                      <Field label="Code embed / URL" value={block.config?.embed_code || ''} onChange={(v) => updateBlock(idx, { ...block.config, embed_code: v })} multiline disabled={!canEdit} />
                    </>
                  )}
                  {block.type === 'form' && (
                    <p className="text-[10px] text-white/30">Le formulaire utilise les questions configurées dans l'onglet Apply.</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Add block */}
        {canEdit && (
          <div className="relative">
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="w-full py-3 rounded-xl border border-dashed border-white/[0.08] text-xs text-white/30 hover:text-white/50 hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-200 font-display tracking-wider uppercase flex items-center justify-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter un composant
            </button>

            <AnimatePresence>
              {showAdd && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-full mt-2 z-10 rounded-xl bg-[#12121a] border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden"
                >
                  {BLOCK_TYPES.map((bt) => (
                    <button
                      key={bt.type}
                      onClick={() => addBlock(bt.type)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
                        <bt.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-white/80 font-display">{bt.label}</p>
                        <p className="text-[10px] text-white/30">{bt.description}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Section>
  );
}

// ---- Main ----

export default function AdminFunnel({ funnelId, onBack }: { funnelId?: string; onBack?: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  // Oracle: no tenant context, use null (hook handles fallback)
  const { config, loading, saving, saveStatus, save, setConfig } = useAdminFunnelConfig(null, funnelId);
  const [activeTab, setActiveTab] = useState('landing');
  const [funnelName, setFunnelName] = useState('');
  const [funnelSlug, setFunnelSlug] = useState('');
  const [calEvents, setCalEvents] = useState<{ id: number; title: string; slug: string; length: number; link: string }[]>([]);
  const [calEventsLoading, setCalEventsLoading] = useState(false);

  // Load funnel metadata
  useEffect(() => {
    if (!funnelId) return;
    supabase.from('funnels').select('name, slug').eq('id', funnelId).single()
      .then(({ data }) => {
        if (data) {
          setFunnelName((data as any).name);
          setFunnelSlug((data as any).slug);
        }
      });
  }, [funnelId]);

  const canEdit = true; // Oracle: admins can always edit

  // Cal.com events — disabled (no tenant-integrations edge function in Oracle)
  useEffect(() => {
    setCalEventsLoading(false);
  }, []);

  

  const updateField = (field: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await save(config);
      toast({ title: 'Configuration sauvegardee' });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Erreur lors de la sauvegarde', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const previewMap: Record<string, React.ReactNode> = {
    landing: <PreviewLanding c={config} />,
    apply: <PreviewApply c={config} />,
    discovery: <PreviewDiscovery c={config} />,
    final: <PreviewFinal c={config} />,
    branding: <PreviewBranding c={config} />,
  };

  const s = funnelSlug || 'vip';
  const tabs = [
    { value: 'landing', label: 'Landing', icon: Globe, slug: '/', path: '/' },
    { value: 'apply', label: 'Apply', icon: FileText, slug: `/${s}/apply`, path: `/${s}/apply` },
    { value: 'discovery', label: 'Discovery', icon: Calendar, slug: `/${s}/discovery`, path: `/${s}/discovery` },
    { value: 'final', label: 'Final', icon: MessageSquare, slug: `/${s}/final`, path: `/${s}/final` },
    { value: 'branding', label: 'Brand', icon: Video, slug: '', path: '' },
  ];

  const activeTabInfo = tabs.find(t => t.value === activeTab);

  const statusIndicator = {
    saved: { color: 'bg-emerald-400', text: 'Sauvegardé', textColor: 'text-emerald-400/70' },
    unsaved: { color: 'bg-amber-400', text: 'Non sauvegardé', textColor: 'text-amber-400/70' },
    saving: { color: 'bg-primary animate-pulse', text: 'Sauvegarde...', textColor: 'text-primary/70' },
    error: { color: 'bg-red-400', text: 'Erreur', textColor: 'text-red-400/70' },
  }[saveStatus];

  return (
      <div className="h-full flex flex-col bg-[#08080d] overflow-hidden">

        {/* Header */}
        <header className="relative border-b border-white/[0.10] bg-black/60 backdrop-blur-xl shrink-0 z-50">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => onBack ? onBack() : navigate(-1)} className="hover:bg-white/[0.04] text-white/50 hover:text-white h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="font-display text-sm tracking-[0.2em] text-white uppercase">
                  {funnelName || 'Funnel Editor'}
                </h1>
                {funnelSlug && (
                  <p className="text-[10px] text-primary/50 tracking-wider font-mono">/{funnelSlug}/apply</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Save status indicator */}
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", statusIndicator.color)} />
                <span className={cn("text-[10px] font-display tracking-wider", statusIndicator.textColor)}>
                  {statusIndicator.text}
                </span>
              </div>
              {funnelSlug && (
                <div className="flex items-center gap-2">
                  <a
                    href={`/${funnelSlug}/apply`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-display tracking-wider uppercase text-white/40 hover:text-primary border border-white/[0.06] hover:border-primary/30 transition-all"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Voir en live
                  </a>
                  <a
                    href={`/${funnelSlug}/apply`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-display tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all"
                  >
                    <Send className="h-3 w-3" />
                    Tester le funnel
                  </a>
                </div>
              )}
              
              {canEdit && (
                <Button
                  onClick={handleSave} disabled={saving} size="sm"
                  className="font-display text-[10px] tracking-[0.15em] uppercase bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(25,183,201,0.2)] h-9 px-5 rounded-xl"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
                  Sauvegarder
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Split */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT — Config (450px) */}
          <div className="w-[450px] shrink-0 border-r border-white/[0.10] flex flex-col overflow-hidden bg-[#0a0a10]">
            {/* Tabs */}
            <div className="shrink-0 px-4 py-3 border-b border-white/[0.10] flex flex-wrap gap-1.5">
              {tabs.map((t) => (
                <TabButton key={t.value} active={activeTab === t.value} icon={t.icon} label={t.label} onClick={() => setActiveTab(t.value)} />
              ))}
            </div>

            {/* Scrollable config */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Page slug + external link */}
              {activeTabInfo?.slug && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.10]">
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] text-primary/70 font-mono">{activeTabInfo.slug}</code>
                  </div>
                  <a
                    href={activeTabInfo.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-primary transition-colors font-display tracking-wider uppercase"
                  >
                    Ouvrir <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* LANDING */}
              {activeTab === 'landing' && (
                <>
                  <Section title="Titre & Accroche" icon={Type}>
                    <Field label="Titre principal" value={config.landing_headline || ''} onChange={(v) => updateField('landing_headline', v)} placeholder="Titre principal" disabled={!canEdit} />
                    <Field label="Mot d'accroche" value={config.landing_headline_accent || ''} onChange={(v) => updateField('landing_headline_accent', v)} placeholder="Accroche" disabled={!canEdit} hint="Affiché en couleur primaire" />
                    <Field label="Sous-titre" value={config.landing_subtitle || ''} onChange={(v) => updateField('landing_subtitle', v)} multiline disabled={!canEdit} />
                  </Section>
                  <Section title="Call-to-Action" icon={Sparkles} defaultOpen={false}>
                    <Field label="Texte du bouton" value={config.landing_cta_text || ''} onChange={(v) => updateField('landing_cta_text', v)} disabled={!canEdit} />
                    <Field label="Sous-texte" value={config.landing_cta_subtext || ''} onChange={(v) => updateField('landing_cta_subtext', v)} disabled={!canEdit} />
                  </Section>
                  <Section title="Footer" icon={FileText} defaultOpen={false}>
                    <Field label="Texte" value={config.landing_footer_text || ''} onChange={(v) => updateField('landing_footer_text', v)} multiline disabled={!canEdit} />
                  </Section>
                  <BlockEditor blocks={config.landing_blocks || []} onChange={(b) => updateField('landing_blocks', b)} canEdit={canEdit} calEvents={calEvents} calEventsLoading={calEventsLoading} />
                </>
              )}

              {/* APPLY */}
              {activeTab === 'apply' && (
                <>
                  <Section title="Titre de la page" icon={Type}>
                    <Field label="Headline" value={config.apply_headline || ''} onChange={(v) => updateField('apply_headline', v)} disabled={!canEdit} />
                  </Section>

                  <Section title="Questions du formulaire" icon={MessageSquare} badge={`${(config.apply_form_questions || []).length}`}>
                    <div className="space-y-2">
                      <AnimatePresence>
                        {(config.apply_form_questions || []).map((q: any, qIdx: number) => (
                          <QuestionCard
                            key={q.id || qIdx}
                            question={q}
                            index={qIdx}
                            total={(config.apply_form_questions || []).length}
                            canEdit={canEdit}
                            onUpdate={(updated) => {
                              const questions = [...(config.apply_form_questions || [])];
                              questions[qIdx] = updated;
                              updateField('apply_form_questions', questions);
                            }}
                            onDelete={() => {
                              const questions = [...(config.apply_form_questions || [])];
                              questions.splice(qIdx, 1);
                              updateField('apply_form_questions', questions);
                            }}
                          />
                        ))}
                      </AnimatePresence>

                      {canEdit && (
                        <button
                          onClick={() => {
                            const questions = [...(config.apply_form_questions || [])];
                            questions.push({ id: `q_${Date.now()}`, title: '', options: [{ label: '', disqualifying: false }] });
                            updateField('apply_form_questions', questions);
                          }}
                          className="w-full py-3 rounded-xl border border-dashed border-white/[0.08] text-xs text-white/30 hover:text-white/50 hover:border-white/[0.15] hover:bg-white/[0.02] transition-all duration-200 font-display tracking-wider uppercase flex items-center justify-center gap-2"
                        >
                          <Plus className="w-3.5 h-3.5" /> Ajouter une question
                        </button>
                      )}
                    </div>
                  </Section>

                  <Section title="Labels contact" icon={Phone} defaultOpen={true}>
                    <Field label="Nom" value={config.apply_form_name_label || ''} onChange={(v) => updateField('apply_form_name_label', v)} disabled={!canEdit} />
                    <Field label="Téléphone" value={config.apply_form_phone_label || ''} onChange={(v) => updateField('apply_form_phone_label', v)} disabled={!canEdit} />
                    <Field label="Email" value={config.apply_form_email_label || ''} onChange={(v) => updateField('apply_form_email_label', v)} disabled={!canEdit} />
                  </Section>

                  <Section title="Social Proof" icon={Eye} defaultOpen={false}>
                    <Toggle label="Activer" checked={config.apply_social_proof_enabled || false} onChange={(v) => updateField('apply_social_proof_enabled', v)} disabled={!canEdit} />
                    {config.apply_social_proof_enabled && (
                      <Field label="Texte" value={config.apply_social_proof_text || ''} onChange={(v) => updateField('apply_social_proof_text', v)} multiline disabled={!canEdit} />
                    )}
                  </Section>
                  <BlockEditor blocks={config.apply_blocks || []} onChange={(b) => updateField('apply_blocks', b)} canEdit={canEdit} calEvents={calEvents} calEventsLoading={calEventsLoading} />
                </>
              )}

              {/* DISCOVERY */}
              {activeTab === 'discovery' && (
                <>
                  <Section title="En-tête" icon={Type}>
                    <Field label="Badge" value={config.discovery_badge_text || ''} onChange={(v) => updateField('discovery_badge_text', v)} disabled={!canEdit} />
                    <Field label="Titre (visiteur)" value={config.discovery_headline || ''} onChange={(v) => updateField('discovery_headline', v)} disabled={!canEdit} />
                    <Field label="Titre personnalisé" value={config.discovery_headline_personalized || ''} onChange={(v) => updateField('discovery_headline_personalized', v)} disabled={!canEdit} hint="Suivi du prénom du lead" />
                    <Field label="Sous-titre" value={config.discovery_subtitle || ''} onChange={(v) => updateField('discovery_subtitle', v)} multiline disabled={!canEdit} />
                  </Section>
                  <Section title="Réservation Cal.com" icon={Calendar}>
                    {/* Cal.com link — the main config */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="font-display text-[10px] tracking-[0.15em] uppercase text-white/40">Lien Cal.com</Label>
                        {config.discovery_cal_link ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[9px] text-emerald-400 font-display">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Connecté
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] text-red-400/70 font-display">
                            <AlertTriangle className="w-2.5 h-2.5" /> Non configuré
                          </span>
                        )}
                      </div>
                      <Input
                        value={config.discovery_cal_link || ''}
                        onChange={(e) => updateField('discovery_cal_link', e.target.value)}
                        disabled={!canEdit}
                        placeholder="https://cal.com/ton-nom/oracle"
                        className={cn(
                          "bg-white/[0.03] border text-white placeholder:text-white/20 text-sm h-10 rounded-xl transition-all duration-200 hover:bg-white/[0.05]",
                          config.discovery_cal_link
                            ? "border-emerald-500/20 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/15"
                            : "border-white/[0.06] focus:border-primary/40 focus:ring-1 focus:ring-primary/15"
                        )}
                      />
                      <p className="text-[10px] text-white/25 leading-relaxed">
                        Colle l'URL de ton événement Cal.com. Le webhook est déjà configuré — quand un lead réserve, le CRM se met à jour automatiquement.
                      </p>
                    </div>

                    <div className="w-full h-px bg-white/[0.06] my-1" />

                    {/* CTA texts */}
                    <Field label="Titre section" value={config.discovery_cta_title || ''} onChange={(v) => updateField('discovery_cta_title', v)} disabled={!canEdit} placeholder="Choisis ton créneau" />
                    <Field label="Sous-titre" value={config.discovery_cta_subtitle || ''} onChange={(v) => updateField('discovery_cta_subtitle', v)} disabled={!canEdit} placeholder="Appel stratégique de 30 min" />
                    <Field label="Texte du bouton" value={config.discovery_cta_button || ''} onChange={(v) => updateField('discovery_cta_button', v)} disabled={!canEdit} placeholder="Réserver mon appel" />
                  </Section>
                  <BlockEditor blocks={config.discovery_blocks || []} onChange={(b) => updateField('discovery_blocks', b)} canEdit={canEdit} calEvents={calEvents} calEventsLoading={calEventsLoading} />
                </>
              )}

              {/* FINAL */}
              {activeTab === 'final' && (
                <>
                  <Section title="En-tête" icon={Type}>
                    <Field label="Badge" value={config.final_badge_text || ''} onChange={(v) => updateField('final_badge_text', v)} disabled={!canEdit} />
                    <Field label="Préfixe personnalisé" value={config.final_headline_personalized || ''} onChange={(v) => updateField('final_headline_personalized', v)} disabled={!canEdit} />
                    <Field label="Texte confirmation" value={config.final_headline_confirmation || ''} onChange={(v) => updateField('final_headline_confirmation', v)} disabled={!canEdit} />
                    <Field label="Mot d'accent" value={config.final_headline_accent || ''} onChange={(v) => updateField('final_headline_accent', v)} disabled={!canEdit} />
                  </Section>
                  <Section title="Confirmation" icon={CheckCircle2}>
                    <Field label="Titre" value={config.final_step1_title || ''} onChange={(v) => updateField('final_step1_title', v)} disabled={!canEdit} />
                    <Field label="Félicitations" value={config.final_step1_congrats || ''} onChange={(v) => updateField('final_step1_congrats', v)} disabled={!canEdit} />
                    <Field label="Instructions" value={config.final_step1_instructions || ''} onChange={(v) => updateField('final_step1_instructions', v)} multiline disabled={!canEdit} />
                    <Field label="Détails" value={config.final_step1_details || ''} onChange={(v) => updateField('final_step1_details', v)} multiline disabled={!canEdit} />
                  </Section>
                  <Section title="Avertissement" icon={AlertTriangle} defaultOpen={false}>
                    <Field label="Titre" value={config.final_step1_warning_title || ''} onChange={(v) => updateField('final_step1_warning_title', v)} disabled={!canEdit} />
                    <Field label="Message" value={config.final_step1_warning_text || ''} onChange={(v) => updateField('final_step1_warning_text', v)} multiline disabled={!canEdit} />
                    <Field label="Conséquences" value={config.final_step1_warning_consequence || ''} onChange={(v) => updateField('final_step1_warning_consequence', v)} multiline disabled={!canEdit} />
                  </Section>
                  <Section title="Question" icon={Send} defaultOpen={false}>
                    <Field label="Titre" value={config.final_step2_title || ''} onChange={(v) => updateField('final_step2_title', v)} disabled={!canEdit} />
                    <Field label="Placeholder" value={config.final_step2_placeholder || ''} onChange={(v) => updateField('final_step2_placeholder', v)} disabled={!canEdit} />
                    <Field label="Sous-texte" value={config.final_step2_subtext || ''} onChange={(v) => updateField('final_step2_subtext', v)} disabled={!canEdit} />
                  </Section>
                  <BlockEditor blocks={config.final_blocks || []} onChange={(b) => updateField('final_blocks', b)} canEdit={canEdit} calEvents={calEvents} calEventsLoading={calEventsLoading} />
                </>
              )}

              {/* BRANDING */}
              {activeTab === 'branding' && (
                <>
                  <Section title="Marque" icon={Globe}>
                    <Field label="Nom" value={config.brand_name || ''} onChange={(v) => updateField('brand_name', v)} disabled={!canEdit} />
                    <Field label="Footer" value={config.brand_footer_text || ''} onChange={(v) => updateField('brand_footer_text', v)} disabled={!canEdit} hint="{year} = année dynamique" />
                  </Section>
                  <Section title="VSL / Vidéo" icon={Video}>
                    <Toggle label="Activer" checked={config.vsl_enabled || false} onChange={(v) => updateField('vsl_enabled', v)} disabled={!canEdit} />
                    {config.vsl_enabled && (
                      <>
                        <div className="space-y-2">
                          <Label className="font-display text-[10px] tracking-[0.15em] uppercase text-white/40">Fournisseur</Label>
                          <select value={config.vsl_provider || 'vidalytics'} onChange={(e) => updateField('vsl_provider', e.target.value)} disabled={!canEdit}
                            className="w-full h-10 bg-white/[0.03] border border-white/[0.06] text-white text-sm rounded-xl px-3 focus:border-primary/40">
                            <option value="vidalytics">Vidalytics</option>
                            <option value="youtube">YouTube</option>
                            <option value="vimeo">Vimeo</option>
                          </select>
                        </div>
                        <Field label="Code embed / URL" value={config.vsl_embed_code || ''} onChange={(v) => updateField('vsl_embed_code', v)} multiline disabled={!canEdit} />
                        <div className="space-y-2">
                          <Label className="font-display text-[10px] tracking-[0.15em] uppercase text-white/40">Page</Label>
                          <select value={config.vsl_page || 'discovery'} onChange={(e) => updateField('vsl_page', e.target.value)} disabled={!canEdit}
                            className="w-full h-10 bg-white/[0.03] border border-white/[0.06] text-white text-sm rounded-xl px-3 focus:border-primary/40">
                            <option value="landing">Landing</option>
                            <option value="apply">Apply</option>
                            <option value="discovery">Discovery</option>
                          </select>
                        </div>
                      </>
                    )}
                  </Section>
                </>
              )}
            </div>
          </div>

          {/* RIGHT — Preview (flex-1) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-5 py-2.5 border-b border-white/[0.10] bg-black/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-white/25" />
                <span className="font-display text-[10px] tracking-[0.2em] uppercase text-white/25">Aperçu en direct</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#0a0a0f]">
              {previewMap[activeTab]}
            </div>
          </div>
        </div>
      </div>
  );
}
