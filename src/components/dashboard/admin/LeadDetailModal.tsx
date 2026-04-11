// ============================================
// Lead Detail Modal — Full-screen spike-launch style
// Split: Left (info + cards) | Right (timeline)
// Branch: crm-integration
// ============================================

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  X, Mail, Phone, Copy, CheckCircle2, Clock, Calendar,
  FileText, Shield, PhoneForwarded, Headphones, CreditCard,
  DollarSign, MessageCircle, Send, ExternalLink, Lock, Unlock,
  UserX, RotateCcw, Sparkles, Timer, Wifi, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CRMLead } from "@/lib/admin/types";

type PipelineLead = CRMLead; // Alias local pour compatibilite

interface LeadNote {
  id: string;
  note: string;
  created_at: string;
  author_id: string;
}

export type LeadModalView = "call" | "lead" | "setting";

interface Props {
  lead: PipelineLead;
  onClose: () => void;
  onLeadUpdated?: () => void;
  initialView?: LeadModalView;
}

function fmtDate(d: string | null) {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getDate()} ${date.toLocaleString("fr-FR", { month: "long" })} à ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function fmtShort(d: string | null) {
  if (!d) return "";
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function expiresIn(d: string | null): string | null {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return "Expiré";
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h}h restantes`;
  return `${Math.floor(h / 24)}j ${h % 24}h restantes`;
}

const OUTCOMES = [
  { value: "not_closed", label: "Non closé", cls: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25" },
  { value: "closing_in_progress", label: "En cours", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25" },
  { value: "contracted", label: "Contracté ✓", cls: "bg-violet-500/15 text-violet-400 border-violet-500/25 hover:bg-violet-500/25" },
];

export default function LeadDetailModal({ lead, onClose, onLeadUpdated, initialView = "lead" }: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<LeadModalView>(initialView);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState(lead.call_outcome || "");
  const [debrief, setDebrief] = useState(lead.call_debrief || "");
  const [offerAmount, setOfferAmount] = useState(lead.offer_amount || "");
  const [saving, setSaving] = useState(false);

  const copy = (t: string, l: string) => { navigator.clipboard.writeText(t); toast({ title: `${l} copié` }); };

  // Load notes
  useEffect(() => {
    supabase.from("ea_lead_notes").select("*").eq("request_id", lead.id).order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setNotes(data as LeadNote[]); });
  }, [lead.id]);

  // Submit note
  const submitNote = async () => {
    if (!newNote.trim()) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("ea_lead_notes").insert({
      request_id: lead.id, note: newNote.trim(), author_id: user?.id,
    });
    if (!error) {
      setNewNote("");
      const { data } = await supabase.from("ea_lead_notes").select("*").eq("request_id", lead.id).order("created_at", { ascending: true });
      if (data) setNotes(data as LeadNote[]);
    }
    setSubmitting(false);
  };

  // Save call data
  const saveCallData = async () => {
    setSaving(true);
    const { error } = await supabase.from("early_access_requests").update({
      call_outcome: outcome || null,
      call_debrief: debrief || null,
      offer_amount: offerAmount || null,
    }).eq("id", lead.id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Sauvegardé" }); onLeadUpdated?.(); }
    setSaving(false);
  };

  const hasChanges = outcome !== (lead.call_outcome || "") || debrief !== (lead.call_debrief || "") || offerAmount !== (lead.offer_amount || "");
  const exp = expiresIn(lead.expires_at);

  // Pipeline: Form → EA (trial access) → Setting (setter contact) → Call (closing) → Payé
  const pipelineSteps = [
    { key: "form", label: "Form", icon: FileText, color: "amber", done: true, date: lead.created_at, view: "lead" as LeadModalView },
    { key: "ea", label: "EA", icon: Shield, color: "cyan", done: lead.status === "approuvée", date: lead.reviewed_at, view: "lead" as LeadModalView },
    { key: "setting", label: "Setting", icon: PhoneForwarded, color: "purple", done: lead.contacted, date: null, view: "setting" as LeadModalView },
    { key: "call", label: "Call", icon: Headphones, color: "blue", done: lead.call_done || lead.call_booked, date: lead.call_scheduled_at, view: "call" as LeadModalView },
    { key: "paid", label: "Paye", icon: CheckCircle2, color: "emerald", done: !!lead.paid_at, date: lead.paid_at, view: "lead" as LeadModalView },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0c0d12] border border-white/[0.10] rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>

        {/* ── Header — compact with inline view switcher ── */}
        <div className="shrink-0 px-6 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-4">
            {/* Avatar — click to go back to Lead view */}
            <button
              onClick={() => setView("lead")}
              className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white shrink-0 transition-all hover:scale-105 hover:ring-2 hover:ring-white/20",
                lead.paid_at ? "bg-emerald-500" : lead.call_outcome === "contracted" ? "bg-violet-500" : lead.call_done ? "bg-blue-500" : lead.contacted ? "bg-purple-500" : lead.status === "approuvée" ? "bg-cyan-500" : "bg-white/20"
              )}
              title="Voir fiche lead"
            >
              {lead.first_name?.[0]?.toUpperCase() || "?"}
            </button>

            {/* Name + sub info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-bold text-white truncate">{lead.first_name || "Sans nom"}</h2>
                {lead.early_access_type && (
                  <span className="text-[9px] font-display uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/25 shrink-0">
                    <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />{lead.early_access_type}
                  </span>
                )}
              </div>
              {lead.call_scheduled_at && (
                <p className="text-[11px] text-white/35 font-mono mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmtDate(lead.call_scheduled_at)} · {new Date(lead.call_scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* View switcher — inline pills */}
            <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5 ml-auto shrink-0">
              {([
                { key: "lead" as LeadModalView, label: "Profil", icon: Eye },
                { key: "setting" as LeadModalView, label: "Setting", icon: PhoneForwarded },
                { key: "call" as LeadModalView, label: "Call", icon: Headphones },
              ]).map(t => (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-display uppercase tracking-wider transition-all",
                    view === t.key
                      ? "bg-white/[0.10] text-white shadow-sm"
                      : "text-white/30 hover:text-white/60"
                  )}
                >
                  <t.icon className="w-3 h-3" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Timer + Close */}
            <div className="flex items-center gap-2 shrink-0">
              {exp && (
                <span className={cn("text-[10px] font-mono px-2 py-1 rounded-lg border",
                  exp === "Expiré" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-white/[0.04] text-white/35 border-white/[0.08]"
                )}><Timer className="w-3 h-3 inline mr-1" />{exp}</span>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Body: Left (switches by view) + Right (Timeline always visible) ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT — Content switches by view */}
          {view === "lead" ? (
          /* ── FICHE LEAD — Level 5 spike-launch style ── */
          <div className="flex-1 overflow-auto">
            {/* Premium header with gradient glow */}
            <div className="relative p-6 pb-5 border-b border-white/[0.08] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-violet-500/5 pointer-events-none" />
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

              {/* Pipeline visual — premium icons with glow connectors */}
              <div className="relative flex items-center justify-between px-2 mt-2">
                {pipelineSteps.map((s, i) => {
                  const Icon = s.icon;
                  const colors: Record<string, { active: string; glow: string }> = {
                    amber: { active: "bg-amber-500/20 border-amber-500/50 shadow-[0_0_25px_rgba(245,158,11,0.2)]", glow: "from-amber-500/50" },
                    cyan: { active: "bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_25px_rgba(34,211,238,0.2)]", glow: "from-cyan-500/50" },
                    purple: { active: "bg-purple-500/20 border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.2)]", glow: "from-purple-500/50" },
                    blue: { active: "bg-blue-500/20 border-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.2)]", glow: "from-blue-500/50" },
                    emerald: { active: "bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)]", glow: "from-emerald-500/50" },
                  };
                  const c = colors[s.color] || colors.blue;
                  const nextDone = i < pipelineSteps.length - 1 && pipelineSteps[i + 1].done;
                  const nextColor = i < pipelineSteps.length - 1 ? (colors[pipelineSteps[i + 1].color] || colors.blue) : null;

                  return (
                    <div key={s.key} className="flex items-center">
                      <button onClick={() => setView(s.view)} className="flex flex-col items-center gap-2 group/step">
                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all group-hover/step:scale-110",
                          s.done ? c.active : "bg-white/[0.03] border-white/[0.10] group-hover/step:border-white/[0.20]"
                        )}>
                          <Icon className={cn("w-6 h-6", s.done ? "" : "text-white/20")} />
                        </div>
                        <span className={cn("text-sm font-display font-semibold", s.done ? "text-white" : "text-white/25")}>{s.label}</span>
                        {s.date && <span className="text-[11px] font-mono text-white/50">{fmtShort(s.date)}</span>}
                      </button>
                      {i < pipelineSteps.length - 1 && (
                        <div className={cn("flex-1 h-[3px] mx-3 rounded-full mt-[-24px]",
                          s.done && nextDone ? `bg-gradient-to-r ${c.glow} ${nextColor ? "to-" + pipelineSteps[i+1].color + "-500/50" : "to-white/10"}` :
                          s.done ? `bg-gradient-to-r ${c.glow} to-white/10` : "bg-white/[0.06]"
                        )} style={{ minWidth: 50 }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Setting + Call clickable cards */}
              <div className="grid grid-cols-2 gap-3 mt-5">
                {/* Setting card */}
                <button onClick={() => setView("setting")} className={cn("p-4 rounded-xl text-left transition-all border",
                  lead.contacted
                    ? "bg-gradient-to-br from-cyan-500/12 to-cyan-500/5 border-cyan-500/30 hover:border-cyan-500/50"
                    : "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", lead.contacted ? "bg-cyan-500/20" : "bg-white/[0.05]")}>
                      <Phone className={cn("w-4 h-4", lead.contacted ? "text-cyan-400" : "text-white/30")} />
                    </div>
                    {lead.contacted ? (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium">✓ Rempli</span>
                    ) : (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">A faire</span>
                    )}
                  </div>
                  <p className={cn("text-sm font-display font-semibold", lead.contacted ? "text-cyan-300" : "text-white/50")}>Setting</p>
                  {lead.setter_name && <p className="text-[10px] text-white/30 mt-0.5">{lead.setter_name}</p>}
                  <p className="text-[10px] text-cyan-400/60 mt-1.5 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Ouvrir fiche</p>
                </button>

                {/* Call card */}
                <button onClick={() => setView("call")} className={cn("p-4 rounded-xl text-left transition-all border",
                  lead.call_outcome === "contracted" ? "bg-gradient-to-br from-violet-500/12 to-violet-500/5 border-violet-500/30 hover:border-violet-500/50" :
                  lead.call_booked ? "bg-gradient-to-br from-blue-500/12 to-blue-500/5 border-blue-500/30 hover:border-blue-500/50" :
                  "bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15]"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", lead.call_booked ? "bg-blue-500/20" : "bg-white/[0.05]")}>
                      <Calendar className={cn("w-4 h-4", lead.call_booked ? "text-blue-400" : "text-white/30")} />
                    </div>
                    {lead.call_outcome === "contracted" ? (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">Close</span>
                    ) : lead.call_booked ? (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">Reserve</span>
                    ) : (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">-</span>
                    )}
                  </div>
                  <p className={cn("text-sm font-display font-semibold", lead.call_booked ? "text-blue-300" : "text-white/50")}>Call</p>
                  {lead.call_scheduled_at && <p className="text-[10px] text-white/30 mt-0.5">{fmtDate(lead.call_scheduled_at)}</p>}
                  <p className="text-[10px] text-blue-400/60 mt-1.5 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Ouvrir fiche</p>
                </button>
              </div>
            </div>

            {/* Body — premium sections */}
            <div className="p-6 space-y-4">

              {/* Budget + Engagement cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.10] hover:border-white/[0.15] transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-white/40 text-[10px] font-display tracking-wider uppercase">Budget</p>
                  </div>
                  <p className="text-emerald-400 text-lg font-display font-semibold">{lead.offer_amount || "Non renseigne"}</p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.10] hover:border-white/[0.15] transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-white/40 text-[10px] font-display tracking-wider uppercase">Activite</p>
                  </div>
                  <p className="text-blue-400 text-lg font-display font-semibold">{(lead.session_count || 0) + (lead.execution_count || 0)} actions</p>
                </div>
              </div>

              {/* Payment banner */}
              {lead.paid_at && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-emerald-400 font-display text-2xl font-bold">{lead.paid_amount?.toLocaleString()}€ paye</p>
                      <p className="text-emerald-400/60 text-xs mt-0.5">Le {fmtDate(lead.paid_at)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status details */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">Status EA</span>
                  <span className={lead.status === "approuvée" ? "text-cyan-400 font-display font-medium" : "text-white/60"}>{lead.status}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">Setter</span>
                  <span className="text-cyan-400 font-display font-medium">{lead.setter_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">Closer</span>
                  <span className="text-violet-400 font-display font-medium">{lead.closer_name || "—"}</span>
                </div>
                {lead.checkout_unlocked && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40">Checkout</span>
                    <span className="text-emerald-400 font-display">✓ Debloque</span>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="text-[10px] text-white/15 font-mono space-y-0.5 pt-1">
                <p>{lead.id}</p>
                <p>Soumis: {fmtDate(lead.created_at)}</p>
              </div>
            </div>
          </div>
        ) : view === "setting" ? (
          /* ── SETTING VIEW ── */
          <div className="flex-1 overflow-auto p-6 space-y-5">
            {/* Setting header */}
            <div className="bg-[#111318] border border-emerald-500/25 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-emerald-500/15 bg-emerald-500/[0.05]">
                <div className="flex items-center gap-2">
                  <PhoneForwarded className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-display uppercase tracking-widest text-emerald-400">Setting</span>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {/* Setter info */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/40">Setter assigne</span>
                  <span className="text-base font-display text-cyan-400 font-semibold">{lead.setter_name || "Non assigne"}</span>
                </div>

                {/* Contact method */}
                <div>
                  <p className="text-[10px] font-display uppercase tracking-widest text-white/30 mb-2">Methode de contact</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { method: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "emerald" },
                      { method: "email", label: "Email", icon: Mail, color: "amber" },
                      { method: "opt_in_call", label: "Telephone", icon: Phone, color: "cyan" },
                    ].map(m => {
                      const isActive = lead.contact_method === m.method;
                      const colors: Record<string, string> = {
                        emerald: isActive ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400" : "",
                        amber: isActive ? "bg-amber-500/15 border-amber-500/40 text-amber-400" : "",
                        cyan: isActive ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400" : "",
                      };
                      return (
                        <div key={m.method} className={cn("rounded-xl border-2 p-3 text-center transition-all",
                          isActive ? colors[m.color] : "border-white/[0.08] text-white/25"
                        )}>
                          <m.icon className={cn("w-6 h-6 mx-auto mb-1", isActive ? "" : "opacity-30")} />
                          <p className="text-xs font-display">{m.label}</p>
                          {isActive && lead.contacted && (
                            <p className="text-[9px] mt-1 opacity-70">✓ Contacte</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Setting status */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  {lead.contacted ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-sm font-display text-emerald-400 font-semibold">Setting effectue</p>
                        <p className="text-[10px] text-white/30">Le lead a ete contacte avec succes</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="text-sm font-display text-amber-400 font-semibold">En attente de setting</p>
                        <p className="text-[10px] text-white/30">Le lead n'a pas encore ete contacte</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Debrief setting */}
            <div className="bg-[#111318] border border-white/[0.12] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.08]">
                <span className="text-[10px] font-display uppercase tracking-widest text-red-400/70">Debrief setting</span>
              </div>
              <div className="p-5">
                <Textarea
                  value={debrief} onChange={e => setDebrief(e.target.value)}
                  placeholder="Notes du setting call... Ex: S'interesse au trading depuis 3 ans, pret a investir dans sa fourchette de prix..."
                  className="min-h-[140px] bg-[#0c0d12] border-white/[0.10] text-sm text-white placeholder:text-white/15 resize-none rounded-xl"
                />
              </div>
            </div>

            {/* Contact info */}
            <div className="bg-[#111318] border border-white/[0.12] rounded-xl p-5 space-y-3">
              <h3 className="text-[10px] font-display uppercase tracking-widest text-white/30">Coordonnees du lead</h3>
              <div className="space-y-2">
                <button onClick={() => copy(lead.email, "Email")} className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg border border-white/[0.08] hover:border-white/[0.15] transition-all group">
                  <Mail className="w-4 h-4 text-white/30" />
                  <span className="text-sm text-white/80 flex-1 truncate">{lead.email}</span>
                  <Copy className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40" />
                </button>
                {lead.phone && (
                  <button onClick={() => copy(lead.phone, "Tel")} className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg border border-white/[0.08] hover:border-white/[0.15] transition-all group">
                    <Phone className="w-4 h-4 text-white/30" />
                    <span className="text-sm text-white/80 flex-1">{lead.phone}</span>
                    <Copy className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40" />
                  </button>
                )}
              </div>
            </div>

            {/* Save */}
            {hasChanges && (
              <Button onClick={saveCallData} disabled={saving} className="w-full h-11 bg-primary hover:bg-primary/90 font-display text-sm tracking-wide shadow-[0_0_20px_rgba(25,183,201,0.2)] rounded-xl">
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            )}
          </div>
        ) : (
        /* ── CALL VIEW — 2 columns (Info+Closing | ) ── */
        <div className="flex-1 flex overflow-hidden">

          {/* COL 1 — Informations + Setting (spike-launch exact) */}
          <div className="w-[320px] shrink-0 overflow-auto p-5 space-y-4 border-r border-white/[0.08]">

            {/* Contact cards */}
            <div className="space-y-2">
              <button onClick={() => copy(lead.email, "Email")} className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl bg-[#111318] border border-white/[0.12] hover:border-white/[0.20] hover:bg-[#151820] transition-all group">
                <Mail className="w-4 h-4 text-white/40 shrink-0" />
                <span className="text-sm text-white/90 flex-1 truncate">{lead.email}</span>
                <Copy className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
              </button>
              {lead.phone && (
                <button onClick={() => copy(lead.phone, "Tel")} className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl bg-[#111318] border border-white/[0.12] hover:border-white/[0.20] hover:bg-[#151820] transition-all group">
                  <Phone className="w-4 h-4 text-white/40 shrink-0" />
                  <span className="text-sm text-white/90 flex-1">{lead.phone}</span>
                  <Copy className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
                </button>
              )}
            </div>

            {/* Call date */}
            {lead.call_scheduled_at && (
              <div className="text-xs text-white/40 flex items-center gap-1.5 px-1">
                <Clock className="w-3 h-3" />
                Call reserve le {fmtDate(lead.call_scheduled_at)}
              </div>
            )}

            {/* Setting card */}
            <div className="rounded-xl bg-[#111318] border border-white/[0.12] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center gap-2">
                <PhoneForwarded className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-display uppercase tracking-widest text-emerald-400">Setting</span>
              </div>
              <div className="p-4 space-y-3">
                {lead.setter_name ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/40">par</span>
                      <span className="font-display text-cyan-400 font-medium">{lead.setter_name}</span>
                    </div>
                    {lead.contacted && lead.contact_method && (
                      <div className={cn("rounded-xl p-3 border-2 flex items-center gap-3",
                        lead.contact_method === "whatsapp"
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-amber-500/10 border-amber-500/30"
                      )}>
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center",
                          lead.contact_method === "whatsapp" ? "bg-emerald-500/20" : "bg-amber-500/20"
                        )}>
                          {lead.contact_method === "whatsapp"
                            ? <MessageCircle className="w-5 h-5 text-emerald-400" />
                            : <Mail className="w-5 h-5 text-amber-400" />
                          }
                        </div>
                        <div>
                          <p className={cn("text-base font-display font-semibold",
                            lead.contact_method === "whatsapp" ? "text-emerald-400" : "text-amber-400"
                          )}>
                            {lead.contact_method === "whatsapp" ? "WhatsApp" : "Email"}
                          </p>
                          {lead.contacted && (
                            <p className="text-[10px] text-emerald-400/60">✓ A repondu</p>
                          )}
                        </div>
                        {lead.contacted && (
                          <div className="ml-auto w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                        )}
                      </div>
                    )}
                    {lead.call_debrief && (
                      <div>
                        <p className="text-[10px] font-display uppercase tracking-widest text-red-400/70 mb-1.5">Debrief setting</p>
                        <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-3">
                          <p className="text-xs text-white/70 leading-relaxed">{lead.call_debrief}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-white/25 py-2">Non assigne</p>
                )}
              </div>
            </div>

            {/* Bottom buttons */}
            <div className="space-y-2 pt-2">
              {/* No-show */}
              {(lead.call_booked || lead.call_done) && (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#111318] border border-white/[0.12]">
                  <UserX className="w-4 h-4 text-white/40" />
                  <span className="text-sm text-white/60 font-display">No-show</span>
                  <div className={cn("ml-auto w-9 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5",
                    lead.call_no_show ? "bg-red-500 justify-end" : "bg-white/10 justify-start"
                  )}>
                    <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </div>
                </div>
              )}

              {/* Oracle Activity */}
              {lead.user_id && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#111318] border border-white/[0.12] rounded-xl p-3 text-center">
                    <p className="text-2xl font-display font-bold text-white">{lead.session_count || 0}</p>
                    <p className="text-[9px] text-white/30 font-display uppercase">Sessions</p>
                  </div>
                  <div className="bg-[#111318] border border-white/[0.12] rounded-xl p-3 text-center">
                    <p className="text-2xl font-display font-bold text-white">{lead.execution_count || 0}</p>
                    <p className="text-[9px] text-white/30 font-display uppercase">Trades</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COL 2 — Gestion du Call + Offre & Closing */}
          <div className="flex-1 overflow-auto p-5 space-y-5 border-r border-white/[0.08]">

            {/* Closer card */}
            <div className="rounded-xl bg-[#111318] border border-white/[0.12] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center gap-2">
                <Headphones className="w-3.5 h-3.5 text-white/30" />
                <span className="text-[10px] font-display uppercase tracking-widest text-white/40">Closer assigne</span>
              </div>
              <div className="p-4">
                {lead.closer_name ? (
                  <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                      <span className="text-sm font-display text-violet-400 font-bold">{lead.closer_name[0]?.toUpperCase()}</span>
                    </div>
                    <span className="text-base font-display text-violet-300 font-medium">{lead.closer_name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-white/25">Non assigne</p>
                )}
              </div>
            </div>

            {/* Issue du Call card */}
            <div className="rounded-xl bg-[#111318] border border-white/[0.12] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between">
                <span className="text-[10px] font-display uppercase tracking-widest text-white/40">Issue du call</span>
                {outcome && (
                  <button onClick={() => setOutcome("")} className="text-[10px] font-display text-white/30 hover:text-white/60 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] transition-colors">
                    Reinitialiser
                  </button>
                )}
              </div>
              <div className="p-4">
                <div className="flex gap-2">
                  {OUTCOMES.map(o => (
                    <button key={o.value} onClick={() => setOutcome(o.value)}
                      className={cn("flex-1 px-3 py-3 rounded-xl text-sm font-display font-semibold border-2 transition-all text-center",
                        outcome === o.value ? o.cls : "bg-[#0c0d12] text-white/40 border-white/[0.10] hover:border-white/[0.20] hover:bg-white/[0.03]"
                      )}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Offre & Closing card */}
            <div className="rounded-xl bg-[#111318] border border-white/[0.12] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-white/30" />
                <span className="text-[10px] font-display uppercase tracking-widest text-white/40">Offre & Closing</span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[10px] text-white/30 font-display uppercase mb-1.5">Montant demande (€)</p>
                  <input
                    value={offerAmount} onChange={e => setOfferAmount(e.target.value)}
                    placeholder="1500"
                    className="w-full px-4 py-3 rounded-xl bg-[#0c0d12] border border-white/[0.12] text-base text-white font-mono placeholder:text-white/15 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
                  {lead.checkout_unlocked ? (
                    <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-xs text-emerald-400 font-display">✓ Acces checkout debloque automatiquement</span></>
                  ) : (
                    <><Lock className="w-4 h-4 text-white/20" /><span className="text-xs text-white/30 font-display">Checkout verrouille</span></>
                  )}
                </div>
              </div>
            </div>

            {/* Payment card */}
            {lead.paid_at && (
              <div className="rounded-xl bg-[#111318] border border-emerald-500/30 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-emerald-500/20 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-display uppercase tracking-widest text-emerald-400/70">Paiement collecte</span>
                </div>
                <div className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-display font-bold text-emerald-400">{lead.paid_amount}€</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{fmtDate(lead.paid_at)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Save button */}
            {hasChanges && (
              <Button onClick={saveCallData} disabled={saving} className="w-full h-11 bg-primary hover:bg-primary/90 font-display text-sm tracking-wide shadow-[0_0_20px_rgba(25,183,201,0.2)] rounded-xl">
                {saving ? "Sauvegarde..." : "Sauvegarder les modifications"}
              </Button>
            )}
          </div>

        </div>
        )}

          {/* TIMELINE — Always visible on the right, all views */}
          <div className="w-[340px] shrink-0 flex flex-col overflow-hidden bg-[#0a0b10] border-l border-white/[0.08]">
            <div className="shrink-0 px-5 py-3.5 border-b border-white/[0.08] flex items-center gap-2.5">
              <MessageCircle className="w-4 h-4 text-white/30" />
              <h3 className="text-sm font-display text-white/80 font-medium">Timeline</h3>
              <span className="text-[10px] font-mono text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-md">{notes.length} notes</span>
              <span className="text-[10px] font-mono text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-md">{(lead.contacted ? 1 : 0) + (lead.call_booked ? 1 : 0) + (lead.paid_at ? 1 : 0)} events</span>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {/* Notes (most recent first) */}
              {notes.slice().reverse().map(n => (
                <div key={n.id} className="bg-[#111318] border border-white/[0.10] rounded-xl p-3.5">
                  <p className="text-sm text-white/80 leading-relaxed">{n.note}</p>
                  <p className="text-[10px] text-white/25 mt-2 font-mono text-right">{fmtDate(n.created_at)}</p>
                </div>
              ))}

              {/* Event: Call reserve */}
              {lead.call_scheduled_at && (
                <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <p className="text-sm font-display text-blue-400 font-bold uppercase">Call reserve</p>
                  </div>
                  <p className="text-base font-display text-blue-300">{fmtDate(lead.call_scheduled_at)}</p>
                </div>
              )}

              {/* Event: Contracte */}
              {lead.call_outcome === "contracted" && (
                <div className="bg-violet-500/15 border border-violet-500/30 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-violet-400" />
                    <p className="text-sm font-display text-violet-400 font-bold uppercase">Contracte ✓</p>
                  </div>
                  <p className="text-[11px] text-white/30">Contrat signe · En attente du paiement</p>
                </div>
              )}

              {/* Event: Paiement */}
              {lead.paid_at && (
                <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <p className="text-sm font-display text-emerald-400 font-bold uppercase">Paiement recu</p>
                  </div>
                  <p className="text-2xl font-display font-bold text-emerald-400 mt-1">{lead.paid_amount}€</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{fmtDate(lead.paid_at)}</p>
                </div>
              )}
            </div>

            {/* Add note input */}
            <div className="shrink-0 p-4 border-t border-white/[0.08]">
              <div className="flex gap-2">
                <Textarea
                  value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="Ecrire un message..."
                  className="min-h-[38px] max-h-[80px] text-sm bg-[#111318] border-white/[0.10] text-white placeholder:text-white/25 resize-none flex-1 rounded-xl"
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }}
                />
                <Button variant="ghost" size="icon" onClick={submitNote} disabled={submitting || !newNote.trim()} className="shrink-0 h-10 w-10 text-white/30 hover:text-primary rounded-xl">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[9px] text-white/20 mt-1.5">⌘ + Entree pour envoyer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
