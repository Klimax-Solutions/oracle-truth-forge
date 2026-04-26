// ============================================
// Lead Detail Modal — Full-screen spike-launch style
// Split: Left (info + cards) | Right (timeline)
// Branch: crm-integration
// ============================================

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  X, Mail, Phone, Copy, CheckCircle2, Clock, Calendar,
  FileText, Shield, PhoneForwarded, Headphones, CreditCard,
  DollarSign, MessageCircle, Send, ExternalLink, Lock, Unlock,
  UserX, RotateCcw, Sparkles, Timer, Wifi, Eye, Users,
  ChevronDown, ChevronLeft, ChevronRight, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CRMLead } from "@/lib/admin/types";
import { getSetterColor } from "@/lib/admin/setterColors";
import { getTrialDay, getTrialColor, getChecklistStep, CHECKLIST_LABELS, CHECKLIST_FIELDS, formatRelativeDate } from "@/lib/admin/trialStatus";
import LeadThreadPanel from "./LeadThreadPanel";
import KitSequenceSection from "./KitSequenceSection";

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
  /** Permissions du user connecté — détermine ce qu'il peut éditer */
  canEditSetting?: boolean; // setter + admin + super_admin
  canEditCall?: boolean;    // closer + admin + super_admin
}

function fmtDate(d: string | null) {
  if (!d) return "";
  const date = new Date(d);
  // Format en heure de Paris pour rester cohérent avec l'équipe FR
  const day = date.toLocaleDateString("fr-FR", { day: "numeric", timeZone: "Europe/Paris" });
  const month = date.toLocaleDateString("fr-FR", { month: "long", timeZone: "Europe/Paris" });
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  return `${day} ${month} à ${time}`;
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

// Outcomes canoniques — valeurs stockées en DB
// Alignées avec CALL_OUTCOME_STYLES dans @/lib/admin/types
const CALL_OUTCOMES = [
  { value: "vendu",                label: "Vendu ✓",              cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25" },
  { value: "contracte_en_attente", label: "Contracté: en attente", cls: "bg-violet-500/15  text-violet-400  border-violet-500/25  hover:bg-violet-500/25"  },
  { value: "pas_vendu",            label: "Pas vendu",             cls: "bg-red-500/15     text-red-400     border-red-500/25     hover:bg-red-500/25"     },
  { value: "rappel",               label: "Rappel",                cls: "bg-amber-500/15   text-amber-400   border-amber-500/25   hover:bg-amber-500/25"   },
];

export default function LeadDetailModal({ lead, onClose, onLeadUpdated, initialView = "lead", canEditSetting = true, canEditCall = true }: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<LeadModalView>(initialView);
  // Mobile-only: which panel is in front (content vs timeline). Desktop shows both side-by-side.
  const [mobilePanel, setMobilePanel] = useState<"content" | "timeline">("content");
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState(lead.call_outcome || "");
  const [debrief, setDebrief] = useState(lead.call_debrief || "");
  const [briefCloser, setBriefCloser] = useState(lead.brief_closer || "");
  const [offerAmount, setOfferAmount] = useState(lead.offer_amount || "");
  const [saving, setSaving] = useState(false);
  const [settersList, setSettersList] = useState<string[]>([]);
  const [callDone, setCallDone] = useState(lead.call_done);
  const [paidAmount, setPaidAmount] = useState(lead.paid_amount?.toString() || "");
  const [paidAt, setPaidAt] = useState(lead.paid_at ? new Date(lead.paid_at).toISOString().slice(0, 16) : "");
  // ── SLICE: reschedule call ─────────────────────────────────────────────────
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(
    lead.call_scheduled_at ? new Date(lead.call_scheduled_at).toISOString().slice(0, 16) : ""
  );
  const [rescheduling, setRescheduling] = useState(false);

  const copy = (t: string, l: string) => { navigator.clipboard.writeText(t); toast({ title: `${l} copié` }); };

  // Load setters list (from user_roles + profiles, fallback to existing leads)
  useEffect(() => {
    (async () => {
      // Try getting setters from user_roles + profiles
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "setter");
      if (roleData && roleData.length > 0) {
        const userIds = roleData.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("first_name, display_name")
          .in("user_id", userIds);
        if (profiles && profiles.length > 0) {
          const names = profiles.map(p => p.display_name || p.first_name).filter(Boolean).sort();
          if (names.length > 0) { setSettersList(names as string[]); return; }
        }
      }
      // Fallback: derive from all leads with a setter_name
      const { data: leads } = await supabase
        .from("early_access_requests")
        .select("setter_name")
        .not("setter_name", "is", null);
      if (leads) {
        const names = [...new Set(leads.map(l => l.setter_name).filter(Boolean))].sort() as string[];
        setSettersList(names);
      }
    })();
  }, []);

  // Load notes
  useEffect(() => {
    supabase.from("ea_lead_notes").select("*").eq("request_id", lead.id).order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setNotes(data as LeadNote[]); });
  }, [lead.id]);

  // ── SLICE: emitEvent — antifragile, never throws ──────────────────────────
  // lead_events table may not exist on older envs (prod pre-migration).
  // Failures are swallowed — UI continues to work regardless.
  // ─────────────────────────────────────────────────────────────────────────
  const emitEvent = useCallback(async (eventType: string, metadata?: Record<string, any>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("lead_events").insert({
        request_id: lead.id,
        event_type: eventType,
        source: "admin",
        metadata: metadata || {},
        created_by: user?.id || null,
      });
    } catch (err) {
      console.warn("[CRM] emitEvent failed (non-blocking):", eventType, err);
    }
  }, [lead.id]);

  const updateField = useCallback(async (fields: Record<string, any>) => {
    const { error } = await supabase.from("early_access_requests").update(fields).eq("id", lead.id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Sauvegardé" }); onLeadUpdated?.(); }
  }, [lead.id, toast, onLeadUpdated]);

  // ── Activate as paid member (1-clic) ─────────────────────────────────
  // Conversion complète : profile.is_client + role member, retire EA, log event.
  // Email envoyé côté Lovable (SMTP intégré).
  const [activating, setActivating] = useState(false);
  const activateAsMember = useCallback(async () => {
    if (!lead.user_id) {
      toast({ title: "Impossible", description: "Le lead n'a pas encore de compte (approuver d'abord).", variant: "destructive" });
      return;
    }
    if (!confirm(`Activer ${lead.first_name} comme membre actif ?\n\n• Ajoute le rôle "member" (accès complet)\n• Retire "early_access" (clear timer)\n• Marque comme client payant\n• Archive en closed_won`)) return;
    setActivating(true);
    try {
      const now = new Date().toISOString();
      const userId = lead.user_id;
      const [pRes, mRes, eaRes, cRes] = await Promise.all([
        supabase.from("profiles").update({ is_client: true, status: "active" as any } as any).eq("user_id", userId),
        supabase.from("user_roles").upsert({ user_id: userId, role: "member" as any } as any, { onConflict: "user_id,role", ignoreDuplicates: true }),
        supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "early_access" as any),
        supabase.from("early_access_requests").update({ status: "closed_won" as any, paid_at: lead.paid_at || now } as any).eq("id", lead.id),
      ]);
      const firstError = [pRes, mRes, eaRes, cRes].find((r: any) => r.error);
      if (firstError && (firstError as any).error) throw (firstError as any).error;
      emitEvent("activated_as_member", { paid_at: lead.paid_at || now });
      toast({ title: "✅ Membre activé", description: `${lead.first_name} a accès complet.` });
      onLeadUpdated?.();
    } catch (err: any) {
      toast({ title: "Erreur activation", description: err.message, variant: "destructive" });
      console.error("[ActivateMember]", err);
    } finally {
      setActivating(false);
    }
  }, [lead.id, lead.user_id, lead.first_name, lead.paid_at, toast, onLeadUpdated, emitEvent]);

  // ── Archive / Unarchive ─────────────────────────────────────────────
  // Soft-hide du pipeline. archived_at = timestamp + raison libre.
  // Réversible via Désarchiver.
  const [archiving, setArchiving] = useState(false);
  const archiveLead = useCallback(async () => {
    const reason = window.prompt(
      `Archiver ${lead.first_name} ?\n\nLe lead sera masqué du pipeline (toujours retrouvable via "Archivés").\n\nRaison (optionnelle) :`,
      ""
    );
    // null = annulation. "" = OK sans raison. On accepte les deux.
    if (reason === null) return;
    setArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("early_access_requests")
        .update({
          archived_at: new Date().toISOString(),
          archived_by: user?.id,
          archive_reason: reason.trim() || null,
        } as any)
        .eq("id", lead.id);
      if (error) throw error;
      emitEvent("lead_archived", { reason: reason.trim() || null });
      toast({ title: "Lead archivé", description: `${lead.first_name} masqué du pipeline.` });
      onLeadUpdated?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Erreur archivage", description: err.message, variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  }, [lead.id, lead.first_name, toast, onLeadUpdated, onClose, emitEvent]);

  const unarchiveLead = useCallback(async () => {
    if (!confirm(`Désarchiver ${lead.first_name} ?\n\nLe lead réapparaîtra dans le pipeline.`)) return;
    setArchiving(true);
    try {
      const { error } = await supabase
        .from("early_access_requests")
        .update({ archived_at: null, archived_by: null, archive_reason: null } as any)
        .eq("id", lead.id);
      if (error) throw error;
      emitEvent("lead_unarchived");
      toast({ title: "Lead désarchivé", description: `${lead.first_name} de retour dans le pipeline.` });
      onLeadUpdated?.();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setArchiving(false);
    }
  }, [lead.id, lead.first_name, toast, onLeadUpdated, emitEvent]);

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

  // Save call data (includes call_done auto-set when outcome chosen)
  const saveCallData = async () => {
    setSaving(true);
    const { error } = await supabase.from("early_access_requests").update({
      call_outcome: outcome || null,
      call_debrief: debrief || null,
      offer_amount: offerAmount || null,
      call_done: outcome ? true : callDone,
    }).eq("id", lead.id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Sauvegardé" });
      if (outcome) {
        setCallDone(true);
        // Émettre l'event de changement d'outcome si nouveau
        if (outcome !== lead.call_outcome) {
          if (lead.call_outcome) emitEvent("outcome_changed", { previous_outcome: lead.call_outcome, new_outcome: outcome });
          else emitEvent(`outcome_${outcome}`); // outcome_vendu, outcome_rappel, etc.
        }
      }
      if ((outcome ? true : callDone) && !lead.call_done) emitEvent("call_done");
      onLeadUpdated?.();
    }
    setSaving(false);
  };

  const hasChanges = outcome !== (lead.call_outcome || "") || debrief !== (lead.call_debrief || "") || offerAmount !== (lead.offer_amount || "") || callDone !== lead.call_done;
  const exp = expiresIn(lead.expires_at);

  // Pipeline: Form → EA (trial access) → Setting (setter contact) → Call (closing) → Payé
  const pipelineSteps = [
    { key: "form", label: "Form", icon: FileText, color: "amber", done: true, date: lead.created_at, view: "lead" as LeadModalView },
    { key: "ea", label: "EA", icon: Shield, color: "cyan", done: lead.status === "approuvée", date: lead.reviewed_at, view: "lead" as LeadModalView },
    { key: "setting", label: "Setting", icon: PhoneForwarded, color: "purple", done: lead.contacted, date: (lead as any).contacted_at || null, view: "setting" as LeadModalView },
    { key: "call", label: "Call", icon: Headphones, color: "blue", done: lead.call_done || lead.call_booked, date: lead.call_scheduled_at || lead.call_done_at || null, view: "call" as LeadModalView },
    { key: "paid", label: "Paye", icon: CheckCircle2, color: "emerald", done: !!lead.paid_at, date: lead.paid_at, view: "lead" as LeadModalView },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-[#0c0d12] border border-white/[0.10] rounded-none md:rounded-2xl w-full max-w-6xl h-full md:h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>

        {/* ── Header — compact with inline view switcher (responsive) ── */}
        <div className="shrink-0 px-3 md:px-6 py-3 md:py-4 border-b border-white/[0.08]">
          {/* Row 1 — Identity + actions (always one line) */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Avatar */}
            <button
              onClick={() => setView("lead")}
              className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-base md:text-lg font-bold text-white shrink-0 transition-all hover:scale-105 hover:ring-2 hover:ring-white/20",
                lead.paid_at ? "bg-emerald-500" : lead.call_outcome === "contracted" ? "bg-violet-500" : lead.call_done ? "bg-blue-500" : lead.contacted ? "bg-purple-500" : lead.status === "approuvée" ? "bg-cyan-500" : "bg-white/20"
              )}
              title="Voir fiche lead"
            >
              {lead.first_name?.[0]?.toUpperCase() || "?"}
            </button>

            {/* Name + email + sub info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-xl font-display font-bold text-white truncate">{lead.first_name || "Sans nom"}</h2>
                {lead.early_access_type && (
                  <span className="hidden sm:inline-flex text-[9px] font-display uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/25 shrink-0">
                    <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />{lead.early_access_type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 md:gap-3 mt-0.5 min-w-0">
                {lead.email && (
                  <button onClick={() => copy(lead.email, "Email")} className="flex items-center gap-1 text-[11px] md:text-[12px] text-white/50 hover:text-white/80 transition-colors group min-w-0">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[140px] md:max-w-[200px]">{lead.email}</span>
                    <Copy className="hidden md:inline w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                {lead.phone && (
                  <button onClick={() => copy(lead.phone, "Tel")} className="hidden sm:flex items-center gap-1 text-[12px] text-white/50 hover:text-white/80 transition-colors group">
                    <Phone className="w-3 h-3" />
                    <span>{lead.phone}</span>
                    <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
              {lead.call_scheduled_at && (
                <p className="hidden md:flex text-[11px] text-white/35 font-mono mt-0.5 items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {fmtDate(lead.call_scheduled_at)} · {new Date(lead.call_scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}
                </p>
              )}
            </div>

            {/* View switcher — DESKTOP ONLY (mobile gets a dedicated row below) */}
            <div className="hidden md:flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5 shrink-0">
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

            {/* Trial timer + actions */}
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              {lead.status === "approuvée" && (
                <div className={cn("hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border",
                  exp === "Expiré" ? "bg-red-500/10 border-red-500/25" : exp && !exp.includes("j") ? "bg-amber-500/10 border-amber-500/25" : "bg-cyan-500/10 border-cyan-500/25"
                )}>
                  <Timer className={cn("w-3 h-3", exp === "Expiré" ? "text-red-400" : "text-cyan-400")} />
                  <span className={cn("text-[10px] font-display font-bold", exp === "Expiré" ? "text-red-400" : "text-cyan-400")}>
                    {exp || "Trial actif"}
                  </span>
                  {lead.reviewed_at && (
                    <span className="text-[9px] text-white/25 font-mono ml-1">depuis {fmtShort(lead.reviewed_at)}</span>
                  )}
                </div>
              )}
              {/* Archive / Unarchive — desktop only, hidden on mobile to declutter */}
              {(lead as any).archived_at ? (
                <button
                  onClick={unarchiveLead}
                  disabled={archiving}
                  title="Désarchiver — remettre dans le pipeline"
                  className="hidden md:flex h-8 px-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 items-center gap-1.5 text-[10px] font-display uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Désarchiver
                </button>
              ) : (
                <button
                  onClick={archiveLead}
                  disabled={archiving}
                  title="Archiver — masquer du pipeline"
                  className="hidden md:flex w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-amber-500/15 hover:border-amber-500/30 border border-transparent items-center justify-center transition-colors disabled:opacity-50"
                >
                  <UserX className="w-4 h-4 text-white/40 hover:text-amber-300" />
                </button>
              )}
              <button onClick={onClose} className="w-9 h-9 md:w-8 md:h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>
          </div>

          {/* Row 2 — MOBILE ONLY: full-width segmented switcher */}
          <div className="md:hidden mt-2.5 grid grid-cols-3 gap-0.5 bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5">
            {([
              { key: "lead" as LeadModalView, label: "Profil", icon: Eye },
              { key: "setting" as LeadModalView, label: "Setting", icon: PhoneForwarded },
              { key: "call" as LeadModalView, label: "Call", icon: Headphones },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => { setView(t.key); setMobilePanel("content"); }}
                className={cn("flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[11px] font-display uppercase tracking-wider transition-all",
                  view === t.key && mobilePanel === "content"
                    ? "bg-white/[0.10] text-white shadow-sm"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Row 3 — MOBILE ONLY: trial timer (only when relevant) */}
          {lead.status === "approuvée" && (
            <div className={cn("md:hidden mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border w-fit",
              exp === "Expiré" ? "bg-red-500/10 border-red-500/25" : exp && !exp.includes("j") ? "bg-amber-500/10 border-amber-500/25" : "bg-cyan-500/10 border-cyan-500/25"
            )}>
              <Timer className={cn("w-3 h-3", exp === "Expiré" ? "text-red-400" : "text-cyan-400")} />
              <span className={cn("text-[10px] font-display font-bold", exp === "Expiré" ? "text-red-400" : "text-cyan-400")}>
                {exp || "Trial actif"}
              </span>
            </div>
          )}
        </div>

        {/* ── Body: Left (switches by view) + Right (Timeline)  ── */}
        {/* Desktop: side-by-side. Mobile: one panel at a time, controlled by mobilePanel. */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

          {/* Mobile-only: floating chevron to toggle between content and timeline */}
          <button
            onClick={() => setMobilePanel(p => p === "content" ? "timeline" : "content")}
            aria-label={mobilePanel === "content" ? "Voir la timeline" : "Voir la fiche"}
            className="md:hidden absolute z-30 top-1/2 -translate-y-1/2 right-2 w-9 h-14 rounded-l-lg rounded-r-none bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] border-r-0 flex items-center justify-center transition-all shadow-lg backdrop-blur-sm"
            style={{ right: mobilePanel === "timeline" ? "auto" : "0", left: mobilePanel === "timeline" ? "0" : "auto", borderRadius: mobilePanel === "timeline" ? "0 0.5rem 0.5rem 0" : "0.5rem 0 0 0.5rem", borderLeftWidth: mobilePanel === "timeline" ? 0 : 1, borderRightWidth: mobilePanel === "timeline" ? 1 : 0 }}
          >
            {mobilePanel === "content" ? (
              <ChevronLeft className="w-5 h-5 text-white/70" />
            ) : (
              <ChevronRight className="w-5 h-5 text-white/70" />
            )}
            {/* Subtle label hint */}
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-[8px] font-display uppercase tracking-widest text-cyan-300 whitespace-nowrap">
              {mobilePanel === "content" ? "Timeline" : "Fiche"}
            </span>
          </button>

          {/* CONTENT WRAPPER — hidden on mobile when timeline is shown */}
          <div className={cn("flex-1 flex flex-col md:flex-row overflow-hidden", mobilePanel === "timeline" ? "hidden md:flex" : "flex")}>

          {/* LEFT — Content switches by view */}
          {view === "lead" ? (
          /* ── FICHE LEAD — Level 5 spike-launch style ── */
          <div className="flex-1 overflow-auto">
            {/* Premium header with gradient glow */}
            <div className="relative p-3 md:p-6 pb-4 md:pb-5 border-b border-white/[0.08] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-violet-500/5 pointer-events-none" />
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

              {/* Pipeline visual — premium icons with glow connectors */}
              <div className="relative flex items-center justify-between px-0 md:px-2 mt-2 overflow-x-auto">
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
                      <button onClick={() => setView(s.view)} className="flex flex-col items-center gap-1.5 md:gap-2 group/step shrink-0">
                        <div className={cn("w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center border-2 transition-all group-hover/step:scale-110",
                          s.done ? c.active : "bg-white/[0.03] border-white/[0.10] group-hover/step:border-white/[0.20]"
                        )}>
                          <Icon className={cn("w-4 h-4 md:w-6 md:h-6", s.done ? "" : "text-white/20")} />
                        </div>
                        <span className={cn("text-[10px] md:text-sm font-display font-semibold", s.done ? "text-white" : "text-white/25")}>{s.label}</span>
                        {s.date && <span className="hidden md:inline text-[11px] font-mono text-white/50">{fmtShort(s.date)}</span>}
                      </button>
                      {i < pipelineSteps.length - 1 && (
                        <div className={cn("flex-1 h-[2px] md:h-[3px] mx-1.5 md:mx-3 rounded-full -mt-4 md:mt-[-24px]",
                          s.done && nextDone ? `bg-gradient-to-r ${c.glow} ${nextColor ? "to-" + pipelineSteps[i+1].color + "-500/50" : "to-white/10"}` :
                          s.done ? `bg-gradient-to-r ${c.glow} to-white/10` : "bg-white/[0.06]"
                        )} style={{ minWidth: 20 }} />
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
            <div className="p-3 md:p-6 space-y-4">

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

              {/* Qualification — réponses au formulaire d'inscription */}
              {Object.keys(lead.form_answers || {}).length > 0 && (
                <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-amber-400/70" />
                    <span className="text-[10px] font-display uppercase tracking-widest text-white/30">Qualification</span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {Object.entries(lead.form_answers).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-4 px-4 py-2.5">
                        <span className="text-[10px] text-white/25 font-display capitalize shrink-0 pt-0.5" style={{ maxWidth: '38%' }}>
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-white/70 font-display text-right leading-relaxed">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="text-[10px] text-white/15 font-mono space-y-0.5 pt-1">
                <p>{lead.id}</p>
                <p>Soumis: {fmtDate(lead.created_at)}</p>
              </div>
            </div>
          </div>
        ) : view === "setting" ? (
          /* ── SETTING VIEW — spec CRM: trial tracker ── */
          <div className="flex-1 overflow-auto p-3 md:p-5 space-y-3">
            {(() => {
              const trial = getTrialDay(lead);
              const color = getTrialColor(lead);
              const step = getChecklistStep(lead);
              const colorStyles = { red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400' }, orange: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400' }, green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' } };
              const cs = colorStyles[color.color];
              return <>
                {/* ── Barre 3 blocs ── */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#111318] border border-white/[0.10] rounded-lg px-3 py-2.5 text-center">
                    <p className="text-2xl font-display font-bold text-white">J{trial.day}<span className="text-sm text-white/25">/{7}</span></p>
                    <p className={cn("text-[10px] font-display", trial.expired ? "text-red-400" : "text-emerald-400")}>{trial.expired ? 'Expiré' : `${trial.remaining}j restants`}</p>
                  </div>
                  <div className={cn("rounded-lg px-3 py-2.5 text-center border", cs.bg, cs.border)}>
                    <div className={cn("w-2.5 h-2.5 rounded-full mx-auto mb-1", cs.dot)} />
                    <p className={cn("text-xs font-display font-bold", cs.text)}>{color.label}</p>
                    <p className={cn("text-[9px] font-display", cs.text, "opacity-70")}>{color.reason}</p>
                  </div>
                  <div className="bg-[#111318] border border-white/[0.10] rounded-lg px-3 py-2.5 text-center">
                    <p className="text-[9px] font-display text-white/30 uppercase tracking-wider">Interaction</p>
                    <p className="text-sm font-display font-bold text-white mt-0.5">{formatRelativeDate(lead.derniere_interaction)}</p>
                  </div>
                </div>

                {/* ── Checklist 6 étapes ── */}
                <div className="bg-[#111318] border border-white/[0.10] rounded-lg">
                  <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
                    <span className="text-[10px] font-display uppercase tracking-widest text-white/40">Progression</span>
                    <span className="text-[10px] font-display font-bold text-white/50">{step}/6</span>
                  </div>
                  {CHECKLIST_LABELS.map((label, i) => {
                    const field = CHECKLIST_FIELDS[i] as string;
                    const checked = !!(lead as any)[field];
                    const prevChecked = i === 0 || !!(lead as any)[CHECKLIST_FIELDS[i - 1] as string];
                    const isNext = !checked && prevChecked;
                    const disabled = !prevChecked || !canEditSetting;
                    return (
                      <button key={field} disabled={disabled}
                        onClick={async () => { if (!canEditSetting) return; await updateField({ [field]: !checked }); }}
                        className={cn("flex items-center gap-2.5 w-full px-3 py-2 text-left transition-all border-b border-white/[0.03] last:border-0",
                          disabled ? "opacity-25 cursor-not-allowed" : "hover:bg-white/[0.03] cursor-pointer"
                        )}>
                        <div className={cn("w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 transition-all",
                          checked ? "bg-emerald-500/20 border-emerald-500" : "border-white/20"
                        )}>
                          {checked && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        </div>
                        <span className={cn("text-xs font-display", checked ? "text-white" : "text-white/40")}>{label}</span>
                        {isNext && <span className="ml-auto text-[8px] font-display font-bold text-orange-400 bg-orange-500/15 border border-orange-500/30 px-1.5 py-0.5 rounded">NEXT</span>}
                      </button>
                    );
                  })}
                </div>

                {/* ── Contacté aujourd'hui + setter + WhatsApp ── */}
                <div className="bg-[#111318] border border-white/[0.10] rounded-lg p-3 space-y-2.5">
                  {/* Setter inline */}
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <Select value={lead.setter_name || ""} onValueChange={async (v) => { if (!canEditSetting) return; const name = v === "__none__" ? null : v; await updateField({ setter_name: name }); if (name) emitEvent("lead_assigned_setter", { setter_name: name }); }} disabled={!canEditSetting}>
                      <SelectTrigger className={cn("w-32 h-7 bg-transparent border-none text-xs font-display text-cyan-400 font-bold p-0 focus:ring-0", !canEditSetting && "opacity-50 cursor-default")}><SelectValue placeholder="Setter" /></SelectTrigger>
                      <SelectContent className="bg-[hsl(220,13%,8%)] border-white/[0.10] rounded-xl shadow-2xl p-1">
                        <SelectItem value="__none__" className="text-white/40 font-display text-xs">Non assigné</SelectItem>
                        {settersList.map(s => <SelectItem key={s} value={s} className="font-display text-xs">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* WhatsApp + canal */}
                  <div className="flex gap-1.5">
                    {lead.phone && (
                      <a href={`https://wa.me/${lead.phone.replace(/[\s+()-]/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/15 transition-all font-display text-[10px] font-semibold">
                        <MessageCircle className="w-3 h-3" /> WhatsApp <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                      </a>
                    )}
                    <button onClick={() => { if (!canEditSetting) return; updateField({ contacted: true, contact_method: "whatsapp", contacted_at: new Date().toISOString(), derniere_interaction: new Date().toISOString() }); emitEvent("setting_contacted_whatsapp"); }}
                      disabled={!canEditSetting}
                      className={cn("px-2.5 py-1.5 rounded-md border font-display text-[10px] font-semibold transition-all",
                        lead.contact_method === "whatsapp" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "border-white/[0.08] text-white/30 hover:text-emerald-400",
                        !canEditSetting && "opacity-40 cursor-not-allowed"
                      )}>WA</button>
                    <button onClick={() => { if (!canEditSetting) return; updateField({ contacted: true, contact_method: "email", contacted_at: new Date().toISOString(), derniere_interaction: new Date().toISOString() }); emitEvent("setting_contacted_email"); }}
                      disabled={!canEditSetting}
                      className={cn("px-2.5 py-1.5 rounded-md border font-display text-[10px] font-semibold transition-all",
                        lead.contact_method === "email" ? "bg-amber-500/15 border-amber-500/30 text-amber-400" : "border-white/[0.08] text-white/30 hover:text-amber-400",
                        !canEditSetting && "opacity-40 cursor-not-allowed"
                      )}>Email</button>
                    {lead.contacted && canEditSetting && (
                      <button onClick={() => { updateField({ contacted: false, contact_method: null }); emitEvent("setting_contact_reset"); }}
                        className="px-2 py-1.5 rounded-md text-white/15 hover:text-white/40 transition-all">
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── 4 cartes info (read-only) ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  <div className="bg-[#111318] border border-white/[0.08] rounded-lg px-2.5 py-2">
                    <p className="text-[8px] font-display uppercase tracking-wider text-white/30">Budget</p>
                    <p className="text-[11px] font-display font-bold text-white mt-0.5 truncate">{lead.offer_amount || '—'}</p>
                  </div>
                  <div className="bg-[#111318] border border-white/[0.08] rounded-lg px-2.5 py-2">
                    <p className="text-[8px] font-display uppercase tracking-wider text-white/30">Priorité</p>
                    <p className={cn("text-[11px] font-display font-bold mt-0.5",
                      lead.priorite === 'P1' ? 'text-emerald-400' : lead.priorite === 'P2' ? 'text-amber-400' : lead.priorite === 'P3' ? 'text-red-400' : 'text-white/30'
                    )}>{lead.priorite || '—'}</p>
                  </div>
                  <div className="bg-[#111318] border border-white/[0.08] rounded-lg px-2.5 py-2">
                    <p className="text-[8px] font-display uppercase tracking-wider text-white/30">Difficulté</p>
                    <p className="text-[11px] font-display font-bold text-white mt-0.5 truncate">{lead.difficulte_principale?.split('(')[0]?.trim() || '—'}</p>
                  </div>
                  <div className="bg-[#111318] border border-white/[0.08] rounded-lg px-2.5 py-2">
                    <p className="text-[8px] font-display uppercase tracking-wider text-white/30">Importance</p>
                    <p className="text-[11px] font-display font-bold text-white mt-0.5">{lead.importance_trading ? `${lead.importance_trading}/10` : '—'}</p>
                  </div>
                </div>

                {/* ── Brief closer — rédigé par le setter, lu par le closer ── */}
                <div className="bg-[#111318] border border-cyan-500/20 rounded-lg overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-cyan-500/10 bg-cyan-500/[0.03] flex items-center justify-between">
                    <span className="text-[10px] font-display text-cyan-400 font-semibold">Brief pour le closer</span>
                    {!canEditSetting && (
                      <span className="text-[9px] text-white/25 font-display">Lecture seule</span>
                    )}
                  </div>
                  <Textarea
                    value={briefCloser}
                    onChange={e => canEditSetting && setBriefCloser(e.target.value)}
                    readOnly={!canEditSetting}
                    placeholder={canEditSetting ? "Résumé du setting pour préparer le closer au call..." : "Aucun brief rédigé par le setter"}
                    className="min-h-[80px] bg-transparent border-0 text-xs text-white/90 placeholder:text-white/20 resize-y rounded-none px-3 py-2 leading-relaxed focus-visible:ring-0 read-only:opacity-60 read-only:cursor-default"
                  />
                </div>

                {/* Save brief closer */}
                {canEditSetting && briefCloser !== (lead.brief_closer || "") && (
                  <Button
                    onClick={async () => { setSaving(true); await updateField({ brief_closer: briefCloser || null }); emitEvent("setting_debrief_saved"); setSaving(false); }}
                    disabled={saving}
                    className="w-full h-9 bg-[#19B7C9] hover:bg-[#19B7C9]/90 text-[#0A0B10] font-display text-xs font-bold tracking-wide rounded-lg"
                  >
                    {saving ? "Sauvegarde..." : "Sauvegarder le brief"}
                  </Button>
                )}
              </>;
            })()}
          </div>
        ) : (
        /* ── CALL VIEW — 2 columns like spike-launch ── */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* COL LEFT — Informations */}
          <div className="w-full md:w-[340px] shrink-0 overflow-auto p-3 md:p-5 space-y-3 border-b md:border-b-0 md:border-r border-white/[0.08]">
            {/* Section label */}
            <p className="text-[10px] font-display uppercase tracking-widest text-white/30 flex items-center gap-1.5"><Users className="w-3 h-3" /> Informations</p>

            {/* Email + Tel */}
            <button onClick={() => copy(lead.email, "Email")} className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 rounded-lg bg-[#111318] border border-white/[0.10] hover:border-white/[0.18] transition-all group">
              <Mail className="w-3.5 h-3.5 text-white/30 shrink-0" />
              <span className="text-xs text-white/80 flex-1 truncate">{lead.email}</span>
              <Copy className="w-3 h-3 text-white/10 group-hover:text-white/30 shrink-0" />
            </button>
            {lead.phone && (
              <button onClick={() => copy(lead.phone, "Tel")} className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 rounded-lg bg-[#111318] border border-white/[0.10] hover:border-white/[0.18] transition-all group">
                <Phone className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <span className="text-xs text-white/80 flex-1 font-mono">{lead.phone}</span>
                <Copy className="w-3 h-3 text-white/10 group-hover:text-white/30 shrink-0" />
              </button>
            )}

            {/* Budget déclaré */}
            {lead.offer_amount && (
              <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-lg px-4 py-2.5">
                <p className="text-[9px] font-display uppercase tracking-widest text-emerald-400/60">Budget déclaré</p>
                <p className="text-sm font-display font-bold text-emerald-400 mt-0.5">{lead.offer_amount}</p>
              </div>
            )}

            {/* Call scheduled */}
            {lead.call_scheduled_at && (
              <p className="text-[10px] text-white/30 font-display flex items-center gap-1.5 px-1">
                <Calendar className="w-3 h-3" /> Call réservé le {fmtDate(lead.call_scheduled_at)}
              </p>
            )}

            {/* Brief setter (read-only) */}
            <div>
              <p className="text-[10px] font-display uppercase tracking-widest text-cyan-400/50 flex items-center gap-1.5 mb-1.5">
                <PhoneForwarded className="w-3 h-3" /> Setting
                {lead.brief_closer ? '' : ' — non effectué'}
              </p>
              {lead.brief_closer ? (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-3">
                  <p className="text-xs text-white/70 leading-relaxed">{lead.brief_closer}</p>
                </div>
              ) : (
                <div className="bg-[#111318] border border-white/[0.08] rounded-lg p-3 text-center">
                  <p className="text-[10px] text-white/20">Aucun setting enregistré</p>
                  <button onClick={() => setView("setting")} className="text-xs font-display font-semibold text-cyan-400 mt-1.5 flex items-center gap-1 mx-auto">
                    <PhoneForwarded className="w-3 h-3" /> Faire le setting
                  </button>
                </div>
              )}
            </div>

            {/* Meeting link */}
            {lead.call_meeting_url && (
              <a href={lead.call_meeting_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-blue-500/[0.08] border border-blue-500/25 hover:bg-blue-500/[0.12] transition-all">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Headphones className="w-4 h-4 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-display font-semibold text-blue-400">Google Meet</p>
                  <p className="text-[10px] text-white/30 truncate">{lead.call_meeting_url}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-blue-400/50 shrink-0" />
              </a>
            )}

            {/* Bottom: Fiche Lead + Voir Setting */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => setView("lead")} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#111318] border border-white/[0.10] text-white/50 hover:text-white hover:border-white/[0.18] transition-all font-display text-[10px] uppercase tracking-wider">
                <Eye className="w-3 h-3" /> Fiche lead
              </button>
              <button onClick={() => setView("setting")} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/15 transition-all font-display text-[10px] uppercase tracking-wider font-semibold">
                <MessageCircle className="w-3 h-3" /> Voir setting
              </button>
            </div>

            {/* No-show + Reprogrammer */}
            {(lead.call_booked || lead.call_done) && (
              <div className="flex gap-2">
                <button onClick={() => { if (!canEditCall) return; updateField({ call_no_show: !lead.call_no_show }); if (!lead.call_no_show) emitEvent("call_no_show"); }}
                  disabled={!canEditCall}
                  className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-display transition-all",
                    lead.call_no_show ? "bg-red-500/10 border-red-500/25 text-red-400" : "border-white/[0.08] text-white/30 hover:text-red-400",
                    !canEditCall && "opacity-40 cursor-not-allowed pointer-events-none"
                  )}>
                  <UserX className="w-3 h-3" /> No-show
                </button>
                {canEditCall && (
                  <button onClick={() => setShowReschedule(v => !v)}
                    className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-display transition-all",
                      showReschedule ? "bg-amber-500/10 border-amber-500/25 text-amber-400" : "border-white/[0.08] text-white/30 hover:text-amber-400"
                    )}>
                    <RotateCcw className="w-3 h-3" /> Reprogrammer
                  </button>
                )}
              </div>
            )}

            {/* ── SLICE: reschedule inline ──────────────────────────────────── */}
            {showReschedule && canEditCall && (
              <div className="bg-[#111318] border border-amber-500/20 rounded-lg p-3 space-y-2.5">
                <p className="text-[10px] font-display uppercase tracking-widest text-amber-400/60">Nouvelle date du call</p>
                <input
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-white/[0.10] text-sm text-white font-mono focus:border-amber-500/40 outline-none transition-all [color-scheme:dark]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!rescheduleDate) return;
                      setRescheduling(true);
                      const prevDate = lead.call_scheduled_at;
                      await updateField({ call_scheduled_at: new Date(rescheduleDate).toISOString(), call_booked: true });
                      await emitEvent("call_rescheduled", {
                        previous_scheduled_at: prevDate,
                        new_scheduled_at: new Date(rescheduleDate).toISOString(),
                      });
                      setShowReschedule(false);
                      setRescheduling(false);
                    }}
                    disabled={rescheduling || !rescheduleDate}
                    className="flex-1 h-8 rounded-lg bg-amber-500 hover:bg-amber-500/90 text-white font-display text-[11px] font-bold disabled:opacity-50 transition-all"
                  >
                    {rescheduling ? "..." : "Confirmer la reprogrammation"}
                  </button>
                  <button onClick={() => setShowReschedule(false)}
                    className="px-3 h-8 rounded-lg border border-white/[0.08] text-white/30 hover:text-white font-display text-[11px] transition-all">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* COL RIGHT — Gestion du Call */}
          <div className="flex-1 overflow-auto p-3 md:p-5 space-y-3">
            <p className="text-[10px] font-display uppercase tracking-widest text-white/30 flex items-center gap-1.5"><Headphones className="w-3 h-3" /> Gestion du call</p>

            {/* Closer assigné */}
            <div className="bg-[#111318] border border-white/[0.10] rounded-lg p-3 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                lead.closer_name ? "bg-violet-500/20 border border-violet-500/30 text-violet-400" : "bg-white/10 text-white/30"
              )}>
                {lead.closer_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-xs font-display font-bold text-white">{lead.closer_name || 'Non assigné'}</p>
                {lead.closer_name && lead.call_scheduled_at && (
                  <p className="text-[9px] text-white/30 font-display">Assigné le {fmtShort(lead.call_scheduled_at)}</p>
                )}
              </div>
            </div>

            {/* Call effectué */}
            <div className="bg-[#111318] border border-white/[0.10] rounded-lg px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones className="w-3.5 h-3.5 text-white/40" />
                <span className="text-xs font-display text-white/70">Call effectué</span>
              </div>
              <button onClick={() => { if (!canEditCall) return; const next = !callDone; setCallDone(next); updateField({ call_done: next, call_done_at: next ? new Date().toISOString() : null }); if (next && !lead.call_done) emitEvent("call_done"); }}
                disabled={!canEditCall}
                className={cn("w-10 h-5 rounded-full transition-colors flex items-center px-0.5", callDone ? "bg-blue-500 justify-end" : "bg-white/10 justify-start", canEditCall ? "cursor-pointer" : "cursor-not-allowed opacity-40")}>
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            {/* Issue du call */}
            <div>
              <p className="text-[10px] font-display uppercase tracking-widest text-white/30 mb-2">Issue du call</p>
              <div className="grid grid-cols-2 gap-1.5">
                {CALL_OUTCOMES.map(o => (
                  <button key={o.value} onClick={() => { if (!canEditCall) return; setOutcome(o.value); if (o.value !== outcome) emitEvent("outcome_changed", { previous: outcome, new_outcome: o.value }); }}
                    disabled={!canEditCall}
                    className={cn("px-3 py-2.5 rounded-lg text-[11px] font-display font-semibold border transition-all text-center",
                      outcome === o.value ? o.cls : "bg-[#0c0d12] text-white/30 border-white/[0.08] hover:border-white/[0.15]",
                      !canEditCall && "opacity-40 cursor-not-allowed"
                    )}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Raison perdu */}
            {outcome === "pas_vendu" && (
              <div className="bg-[#111318] border border-red-500/20 rounded-lg p-3">
                <p className="text-[9px] font-display uppercase tracking-widest text-red-400/60 mb-2">Raison</p>
                <div className="flex gap-1.5 flex-wrap">
                  {["Budget", "Timing", "Pas convaincu", "Ghost"].map(r => (
                    <button key={r} onClick={() => { if (!canEditCall) return; updateField({ raison_perdu: r }); }}
                      disabled={!canEditCall}
                      className={cn("px-2.5 py-1.5 rounded-md text-[10px] font-display font-semibold border transition-all",
                        lead.raison_perdu === r ? "bg-red-500/15 border-red-500/30 text-red-400" : "border-white/[0.08] text-white/30 hover:text-red-400 hover:border-red-500/25",
                        !canEditCall && "opacity-40 cursor-not-allowed"
                      )}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Debrief / Notes closer */}
            <div>
              <p className="text-[10px] font-display uppercase tracking-widest text-white/30 mb-1.5">Debrief / Notes</p>
              <Textarea
                value={debrief} onChange={e => canEditCall && setDebrief(e.target.value)}
                readOnly={!canEditCall}
                placeholder={canEditCall ? "Notes sur le call..." : "Aucune note rédigée par le closer"}
                className={cn("min-h-[70px] bg-[#111318] border-white/[0.10] text-xs text-white/90 placeholder:text-white/20 resize-y rounded-lg leading-relaxed", !canEditCall && "opacity-50 cursor-default")}
              />
            </div>

            {/* Paiement */}
            {(outcome === "vendu" || outcome === "contracte_en_attente" || lead.paid_at) && (
              <div className={cn("rounded-lg border overflow-hidden", lead.paid_at ? "bg-emerald-500/[0.05] border-emerald-500/25" : "bg-[#111318] border-white/[0.10]")}>
                <div className={cn("px-3 py-1.5 border-b flex items-center gap-2", lead.paid_at ? "border-emerald-500/15" : "border-white/[0.06]")}>
                  <CreditCard className={cn("w-3.5 h-3.5", lead.paid_at ? "text-emerald-400" : "text-white/30")} />
                  <span className={cn("text-[10px] font-display uppercase tracking-widest", lead.paid_at ? "text-emerald-400" : "text-white/40")}>Paiement</span>
                  {lead.paid_at && <span className="text-[9px] font-display text-emerald-400/60 ml-auto">Payé</span>}
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[8px] text-white/30 font-display uppercase mb-1">Montant (EUR)</p>
                      <input value={paidAmount} onChange={e => canEditCall && setPaidAmount(e.target.value)} readOnly={!canEditCall} placeholder="0" type="number"
                        className={cn("w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-white/[0.10] text-sm text-white font-mono placeholder:text-white/15 focus:border-emerald-500/40 outline-none transition-all", !canEditCall && "opacity-50 cursor-default")} />
                    </div>
                    <div>
                      <p className="text-[8px] text-white/30 font-display uppercase mb-1">Date</p>
                      <input value={paidAt} onChange={e => canEditCall && setPaidAt(e.target.value)} readOnly={!canEditCall} type="datetime-local"
                        className={cn("w-full px-3 py-2 rounded-lg bg-[#0c0d12] border border-white/[0.10] text-sm text-white font-mono focus:border-emerald-500/40 outline-none transition-all [color-scheme:dark]", !canEditCall && "opacity-50 cursor-default")} />
                    </div>
                  </div>
                  {canEditCall && (paidAmount !== (lead.paid_amount?.toString() || "") || paidAt !== (lead.paid_at ? new Date(lead.paid_at).toISOString().slice(0, 16) : "")) && (
                    <Button onClick={async () => {
                      await updateField({ paid_amount: paidAmount ? parseFloat(paidAmount) : null, paid_at: paidAt ? new Date(paidAt).toISOString() : null });
                      emitEvent("payment_received", { amount: paidAmount });
                    }} className="w-full h-8 mt-2 bg-emerald-500 hover:bg-emerald-500/90 text-white font-display text-xs rounded-lg">
                      Enregistrer le paiement
                    </Button>
                  )}

                  {/* Activer comme membre — 1 clic full conversion */}
                  {canEditCall && lead.user_id && lead.status !== "closed_won" && (
                    <Button
                      onClick={activateAsMember}
                      disabled={activating}
                      className="w-full h-9 mt-2 bg-cyan-500 hover:bg-cyan-500/90 text-[#0A0B10] font-display text-xs font-bold tracking-wide rounded-lg gap-2"
                    >
                      {activating ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {activating ? "Activation..." : "Activer comme membre"}
                    </Button>
                  )}
                  {canEditCall && lead.user_id && lead.status === "closed_won" && (
                    <div className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-display">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Membre actif sur la plateforme
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Save */}
            {hasChanges && canEditCall && (
              <Button onClick={saveCallData} disabled={saving} className="w-full h-9 bg-[#19B7C9] hover:bg-[#19B7C9]/90 text-[#0A0B10] font-display text-xs font-bold tracking-wide rounded-lg">
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            )}
          </div>
        </div>
        )}
          </div>
          {/* /CONTENT WRAPPER */}

          {/* TIMELINE — Desktop: always visible on the right. Mobile: shown when mobilePanel === "timeline". */}
          <div className={cn(
            "shrink-0 overflow-hidden bg-[#0a0b10] md:border-l border-white/[0.08]",
            "w-full md:w-[360px]",
            mobilePanel === "timeline" ? "flex flex-col flex-1" : "hidden md:flex md:flex-col"
          )}>
            {/* Mobile-only mini header — shows current lead context */}
            <div className="md:hidden shrink-0 px-3 py-2 border-b border-white/[0.08] bg-white/[0.02] flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400/60" />
              <span className="text-[10px] font-display uppercase tracking-widest text-white/50">Timeline</span>
              <span className="text-[10px] font-display text-white/30 truncate ml-auto">{lead.first_name || "Lead"}</span>
            </div>
            <KitSequenceSection requestId={lead.id} />
            <div className="flex-1 overflow-hidden">
              <LeadThreadPanel lead={lead} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
