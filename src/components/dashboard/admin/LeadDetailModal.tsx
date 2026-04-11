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

interface Props {
  lead: PipelineLead;
  onClose: () => void;
  onLeadUpdated?: () => void;
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

export default function LeadDetailModal({ lead, onClose, onLeadUpdated }: Props) {
  const { toast } = useToast();
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

  const pipelineSteps = [
    { key: "form", label: "Form", icon: FileText, color: "text-amber-400 border-amber-500 bg-amber-500/20", done: true, date: lead.created_at },
    { key: "ea", label: "EA", icon: Shield, color: "text-cyan-400 border-cyan-500 bg-cyan-500/20", done: lead.status === "approuvée", date: lead.reviewed_at },
    { key: "setting", label: "Setting", icon: PhoneForwarded, color: "text-purple-400 border-purple-500 bg-purple-500/20", done: lead.contacted, date: null },
    { key: "call", label: "Call", icon: Headphones, color: "text-blue-400 border-blue-500 bg-blue-500/20", done: lead.call_done || lead.call_booked, date: null },
    { key: "paid", label: "Payé", icon: CheckCircle2, color: "text-emerald-400 border-emerald-500 bg-emerald-500/20", done: !!lead.paid_at, date: lead.paid_at },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0c0d12] border border-white/[0.10] rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>

        {/* ── Header — spike-launch style ── */}
        <div className="shrink-0 px-6 py-5 border-b border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white",
                lead.paid_at ? "bg-emerald-500" : lead.call_outcome === "contracted" ? "bg-violet-500" : lead.call_done ? "bg-blue-500" : lead.contacted ? "bg-purple-500" : lead.status === "approuvée" ? "bg-cyan-500" : "bg-white/20"
              )}>
                {lead.first_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-display font-bold text-white">{lead.first_name || "Sans nom"}</h2>
                  {lead.early_access_type && (
                    <span className="text-[10px] font-display uppercase px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-400 border border-violet-500/25">
                      <Sparkles className="w-3 h-3 inline mr-1" />{lead.early_access_type}
                    </span>
                  )}
                </div>
                {lead.call_scheduled_at && (
                  <p className="text-xs text-white/40 font-mono mt-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {fmtDate(lead.call_scheduled_at)} · {new Date(lead.call_scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {exp && (
                <span className={cn("text-xs font-mono px-2.5 py-1 rounded-lg border",
                  exp === "Expiré" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-white/[0.04] text-white/40 border-white/[0.10]"
                )}><Timer className="w-3 h-3 inline mr-1" />{exp}</span>
              )}
              <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                <X className="w-5 h-5 text-white/40" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Body: 3 columns (Info | Gestion Call | Timeline) ── */}
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

          {/* COL 3 — Timeline + Notes */}
          <div className="w-[340px] shrink-0 flex flex-col overflow-hidden bg-[#0a0b10]">
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
