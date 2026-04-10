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
      <div className="bg-[#0d0e14] border border-white/[0.08] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="shrink-0 p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white",
                lead.paid_at ? "bg-emerald-500" : lead.call_done ? "bg-blue-500" : lead.contacted ? "bg-purple-500" : lead.status === "approuvée" ? "bg-cyan-500" : "bg-muted-foreground/30"
              )}>
                {lead.first_name?.[0]?.toUpperCase() || "?"}
                {lead.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{lead.first_name || "Sans nom"}</h2>
                  {lead.early_access_type && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                      <Sparkles className="w-3 h-3 inline mr-1" />{lead.early_access_type}
                    </span>
                  )}
                </div>
                {lead.setter_name && (
                  <p className="text-xs text-cyan-400 font-mono">Setter: {lead.setter_name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {exp && (
                <span className={cn("text-xs font-mono px-2.5 py-1 rounded-lg border",
                  exp === "Expiré" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-muted text-muted-foreground border-border"
                )}><Timer className="w-3 h-3 inline mr-1" />{exp}</span>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}><X className="w-6 h-6" /></Button>
            </div>
          </div>

          {/* Pipeline visual */}
          <div className="flex items-center justify-between mt-5 px-4">
            {pipelineSteps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={cn("w-14 h-14 rounded-full flex items-center justify-center border-2",
                      s.done ? s.color : "border-muted-foreground/15 bg-background text-muted-foreground/20"
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={cn("text-xs font-mono uppercase font-medium", s.done ? "text-foreground" : "text-muted-foreground/30")}>{s.label}</span>
                    {s.date && <span className="text-[10px] font-mono text-muted-foreground">{fmtShort(s.date)}</span>}
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <div className={cn("w-12 h-[2px] mx-1 mt-[-20px]", s.done ? "bg-foreground/15" : "bg-muted-foreground/8")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Body: Left + Right ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT — Info + Call management */}
          <div className="flex-1 overflow-auto p-6 space-y-6 border-r border-border">

            {/* Contact */}
            <section>
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Phone className="w-4 h-4" /> Informations
              </h3>
              <div className="space-y-2">
                <button onClick={() => copy(lead.email, "Email")} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border border-border/50 hover:border-border hover:bg-accent/30 transition-all">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <span className="text-base flex-1 truncate">{lead.email}</span>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
                {lead.phone && (
                  <button onClick={() => copy(lead.phone, "Téléphone")} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border border-border/50 hover:border-border hover:bg-accent/30 transition-all">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <span className="text-base flex-1">{lead.phone}</span>
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </section>

            {/* Setting */}
            <section>
              <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <PhoneForwarded className="w-4 h-4" /> Setting
                {lead.contacted ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 ml-1">✓ Contacté</span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground ml-1">Non effectué</span>
                )}
              </h3>
              {lead.contacted && lead.contact_method && (
                <div className="px-3 py-2 rounded-lg bg-muted/50 text-xs">
                  <span className="text-muted-foreground">Méthode: </span>
                  <span className="font-medium">
                    {lead.contact_method === "whatsapp" ? "💬 WhatsApp" : lead.contact_method === "email" ? "📧 Email" : "📞 Opt-in Call"}
                  </span>
                </div>
              )}
            </section>

            {/* Call management */}
            {(lead.call_booked || lead.call_done) && (
              <section>
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Headphones className="w-4 h-4" /> Gestion du call
                </h3>

                {/* Outcome buttons */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Issue du call</p>
                    <div className="flex gap-2">
                      {OUTCOMES.map(o => (
                        <button key={o.value} onClick={() => setOutcome(o.value)}
                          className={cn("px-4 py-2.5 rounded-lg text-sm font-medium border transition-all",
                            outcome === o.value ? o.cls : "bg-muted/30 text-muted-foreground border-border/50 hover:border-border"
                          )}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Offer amount */}
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Montant offre (€)</p>
                    <input
                      value={offerAmount} onChange={e => setOfferAmount(e.target.value)}
                      placeholder="ex: 2997€"
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border/50 text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none"
                    />
                  </div>

                  {/* Debrief */}
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Débrief / Notes</p>
                    <Textarea
                      value={debrief} onChange={e => setDebrief(e.target.value)}
                      placeholder="Notes du call..."
                      className="min-h-[100px] bg-background border-border/50 text-sm resize-none"
                    />
                  </div>

                  {/* Save */}
                  {hasChanges && (
                    <Button onClick={saveCallData} disabled={saving} className="w-full">
                      {saving ? "Sauvegarde..." : "Sauvegarder"}
                    </Button>
                  )}
                </div>
              </section>
            )}

            {/* Payment */}
            {lead.paid_at && (
              <section>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xl font-bold text-emerald-400">{lead.paid_amount}€ payé</p>
                    <p className="text-xs text-muted-foreground">Le {fmtDate(lead.paid_at)}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Oracle Activity */}
            {lead.user_id && (
              <section>
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> Activité Oracle
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-3xl font-bold">{lead.session_count || 0}</p>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase">Sessions</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-3xl font-bold">{lead.execution_count || 0}</p>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase">Trades</p>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT — Timeline + Notes */}
          <div className="w-[420px] shrink-0 flex flex-col overflow-hidden bg-background/50">
            <div className="shrink-0 px-5 py-4 border-b border-border flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Timeline</h3>
              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{notes.length} notes</span>
            </div>

            {/* Events + Notes */}
            <div className="flex-1 overflow-auto p-5 space-y-3">
              {/* Pipeline events as timeline cards */}
              {lead.created_at && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                  <FileText className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-amber-400 uppercase">Formulaire soumis</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(lead.created_at)}</p>
                </div>
              )}

              {lead.reviewed_at && (
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                  <Shield className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-cyan-400 uppercase">EA Approuvé</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(lead.reviewed_at)}</p>
                </div>
              )}

              {lead.contacted && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
                  <PhoneForwarded className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-purple-400 uppercase">Contacté</p>
                  <p className="text-[10px] text-muted-foreground">
                    {lead.contact_method === "whatsapp" ? "WhatsApp" : lead.contact_method === "email" ? "Email" : "Téléphone"}
                    {lead.setter_name && ` · ${lead.setter_name}`}
                  </p>
                </div>
              )}

              {(lead.call_booked || lead.call_done) && (
                <div className={cn("border rounded-xl p-3 text-center",
                  lead.call_outcome === "contracted" ? "bg-violet-500/10 border-violet-500/20" : "bg-blue-500/10 border-blue-500/20"
                )}>
                  <Headphones className={cn("w-5 h-5 mx-auto mb-1", lead.call_outcome === "contracted" ? "text-violet-400" : "text-blue-400")} />
                  <p className={cn("text-sm font-bold uppercase", lead.call_outcome === "contracted" ? "text-violet-400" : "text-blue-400")}>
                    {lead.call_done ? (lead.call_outcome === "contracted" ? "Contracté ✓" : lead.call_outcome === "not_closed" ? "Non closé" : "Call effectué") : "Call réservé"}
                  </p>
                </div>
              )}

              {lead.paid_at && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <CreditCard className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-emerald-400 uppercase">Paiement reçu</p>
                  <p className="text-xl font-bold text-emerald-400">{lead.paid_amount}€</p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(lead.paid_at)}</p>
                </div>
              )}

              {/* Manual notes */}
              {notes.map(n => (
                <div key={n.id} className="bg-muted/30 border border-border/50 rounded-xl p-3">
                  <p className="text-xs text-foreground leading-relaxed">{n.note}</p>
                  <p className="text-[9px] text-muted-foreground mt-2 font-mono">{fmtDate(n.created_at)}</p>
                </div>
              ))}
            </div>

            {/* Add note */}
            <div className="shrink-0 p-4 border-t border-border">
              <div className="flex gap-2">
                <Textarea
                  value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="Écrire un message..."
                  className="min-h-[40px] max-h-[80px] text-xs bg-background border-border/50 resize-none flex-1"
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote(); }}
                />
                <Button variant="ghost" size="icon" onClick={submitNote} disabled={submitting || !newNote.trim()} className="shrink-0 h-10 w-10">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">⌘ + Entrée pour envoyer</p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 px-6 py-3 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>ID: {lead.id.slice(0, 8)} · Soumis le {fmtDate(lead.created_at)}</span>
          {lead.user_id && <span>Oracle User: {lead.user_id.slice(0, 8)}</span>}
        </div>
      </div>
    </div>
  );
}
