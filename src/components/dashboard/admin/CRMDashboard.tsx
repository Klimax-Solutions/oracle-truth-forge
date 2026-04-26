// ============================================
// CRM Dashboard V2 — Spike-launch style pipeline
// Adapted for Oracle EA flow
// Branch: crm-integration
// ============================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import LeadDetailModal from "./LeadDetailModal";
import {
  Loader2, Search, Users, Phone, Mail, Copy, CheckCircle2,
  Circle, Clock, ArrowUpDown, Eye, PhoneCall, CreditCard,
  X, Calendar, BarChart3, ChevronDown, MessageCircle,
  Timer, Wifi, PhoneForwarded, ClipboardCheck, Target,
  Lock, Unlock, DollarSign, FileText, Headphones, Shield,
  Send, UserCheck, Sparkles, UserX, Trash2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CRMLead, StageFilter, getStage, mapRowToCRMLead } from "@/lib/admin/types";
import { getTrialDay, getTrialColor, getChecklistStep, formatRelativeDate } from "@/lib/admin/trialStatus";
import { getSetterColor } from "@/lib/admin/setterColors";
import AgendaTab from "./AgendaTab";
import CockpitTab from "./CockpitTab";
import ConversionsTab from "./ConversionsTab";
import PeriodSelector, { type PeriodMode } from "./PeriodSelector";
import { LoadingFallback } from "@/components/LoadingFallback";
import { withTimeout, isAuthError, clearStaleSession } from "@/lib/safeFetch";
import type { LeadModalView } from "./LeadDetailModal";

// ── Types — CRMLead imported from @/lib/admin/types (source de verite unique) ──
type PipelineLead = CRMLead; // Alias local pour compatibilite

// Map des séquences Kit (sequence_id → nom lisible)
export const KIT_SEQUENCE_NAMES: Record<string, string> = {
  '2624505': 'Book-a-call',
  '2626026': 'Nurturing',
};

function fmtDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fmtTime(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function fmtDateTime(d: string | null): string {
  if (!d) return "";
  return `${fmtDate(d)} ${fmtTime(d)}`;
}

// ============================================
// Design System — Couleurs coherentes
//   primary: cyan (#19B7C9) — accent, actions
//   emerald: paye, succes
//   violet: contracte, closer
//   amber: forms, warning
//   blue: calls, upcoming
//   red: no-show, echec
//   white/50: neutre, inactif
// ============================================

// ============================================
// Design System — Exact spike-launch CRM style
// bg: hsl(220,15%,8%) = #12141a
// borders: white/10 visible (pas white/6)
// icons in colored boxes
// ============================================

const BG = "bg-[hsl(220,15%,8%)]";

function avatarClasses(l: PipelineLead): { bg: string; text: string; dot?: string } {
  if (l.paid_at) return { bg: "bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-500" };
  if (l.call_outcome === "contracted") return { bg: "bg-gradient-to-br from-violet-500/30 to-violet-600/10 border-violet-500/30", text: "text-violet-400", dot: "bg-violet-500" };
  if (l.call_done || l.call_booked) return { bg: "bg-gradient-to-br from-blue-500/30 to-blue-600/10 border-blue-500/30", text: "text-blue-400", dot: "bg-blue-500" };
  if (l.contacted) return { bg: "bg-gradient-to-br from-purple-500/25 to-purple-600/10 border-purple-500/30", text: "text-purple-400" };
  if (l.status === "approuvée") return { bg: "bg-gradient-to-br from-cyan-500/25 to-cyan-600/10 border-cyan-500/25", text: "text-cyan-400" };
  return { bg: "bg-gradient-to-br from-white/10 to-white/5 border-white/10", text: "text-white/60" };
}

const Empty = () => <span className="text-white/[0.08] select-none">—</span>;

function IconBox({ children, color }: { children: React.ReactNode; color: string }) {
  const bg: Record<string, string> = {
    white: "bg-white/[0.06]", amber: "bg-amber-500/[0.12]", cyan: "bg-cyan-500/[0.12]",
    violet: "bg-violet-500/[0.12]", blue: "bg-primary/[0.12]", orange: "bg-orange-500/[0.12]",
    emerald: "bg-emerald-500/[0.12]", fuchsia: "bg-fuchsia-500/[0.12]",
  };
  return <div className={`w-5 h-5 rounded-md ${bg[color] || bg.white} flex items-center justify-center`}>{children}</div>;
}

function DateBadge({ date, color = "amber" }: { date: string | null; color?: string }) {
  if (!date) return <Empty />;
  const styles: Record<string, string> = {
    amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    violet: "bg-violet-500/15 text-violet-300 border-violet-500/25",
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border tabular-nums", styles[color] || "bg-white/5 text-white/50 border-white/10")}>
      {fmtDateTime(date)}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  // Valeurs canoniques — alignées avec CALL_OUTCOME_STYLES dans types.ts
  const cfg: Record<string, { label: string; cls: string }> = {
    vendu:                { label: "Vendu ✓",    cls: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" },
    contracte_en_attente: { label: "Contracté",  cls: "text-violet-300  bg-violet-500/20  border-violet-500/30"  },
    pas_vendu:            { label: "Pas vendu",  cls: "text-red-300     bg-red-500/20     border-red-500/30"     },
    rappel:               { label: "Rappel",     cls: "text-amber-300   bg-amber-500/20   border-amber-500/30"   },
  };
  if (!outcome || !cfg[outcome]) {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-display font-semibold border text-white/40 bg-white/[0.04] border-white/[0.10]">Call fait</span>;
  }
  const c = cfg[outcome];
  return <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-display font-bold border", c.cls)}>{c.label}</span>;
}

function ContactBadge({ method, contacted }: { method: string | null; contacted: boolean }) {
  if (!contacted) return <Empty />;
  const cfg: Record<string, { icon: typeof Phone; cls: string }> = {
    whatsapp: { icon: MessageCircle, cls: "text-emerald-400" },
    email: { icon: Mail, cls: "text-amber-400" },
    opt_in_call: { icon: PhoneCall, cls: "text-cyan-400" },
  };
  const c = cfg[method || ""] || { icon: CheckCircle2, cls: "text-violet-400" };
  const Icon = c.icon;
  return <Icon className={cn("w-4 h-4 mx-auto", c.cls)} />;
}

// ── Lead Detail Panel ──

function LeadDetail({ lead, onClose }: { lead: PipelineLead; onClose: () => void }) {
  const { toast } = useToast();
  const copy = (t: string, l: string) => { navigator.clipboard.writeText(t); toast({ title: `${l} copié` }); };
  const stage = getStage(lead);

  const steps = [
    { key: "form", label: "Form", icon: FileText, color: "amber", done: true, date: lead.created_at },
    { key: "ea", label: "EA", icon: Shield, color: "cyan", done: lead.status === "approuvée", date: lead.reviewed_at },
    { key: "setting", label: "Setting", icon: PhoneForwarded, color: "purple", done: lead.contacted, date: null },
    { key: "call", label: "Call", icon: Headphones, color: "blue", done: lead.call_done, date: null },
    { key: "paid", label: "Payé", icon: CheckCircle2, color: "emerald", done: !!lead.paid_at, date: lead.paid_at },
  ];

  return (
    <div className="h-full flex flex-col border-l border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white", getSetterColor(lead.setter_name || ""))}>
              {lead.first_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <h3 className="text-sm font-semibold">{lead.first_name || "Sans nom"}</h3>
              {lead.setter_name && (
                <span className="text-[10px] font-mono uppercase text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                  Setter: {lead.setter_name}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7"><X className="w-4 h-4" /></Button>
        </div>

        {/* Pipeline visual */}
        <div className="flex items-center justify-between px-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center border-2",
                    s.done ? `border-${s.color}-500 bg-${s.color}-500/20` : "border-muted-foreground/20 bg-background"
                  )}>
                    <Icon className={cn("w-3.5 h-3.5", s.done ? `text-${s.color}-400` : "text-muted-foreground/30")} />
                  </div>
                  <span className={cn("text-[8px] font-mono uppercase", s.done ? "text-foreground" : "text-muted-foreground/40")}>{s.label}</span>
                  {s.date && <span className="text-[8px] text-muted-foreground font-mono">{fmtDate(s.date)}</span>}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn("w-4 h-px mx-0.5 mt-[-12px]", s.done ? "bg-foreground/20" : "bg-muted-foreground/10")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Contact */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Contact</p>
          <button onClick={() => copy(lead.email, "Email")} className="flex items-center gap-2 text-xs hover:text-primary transition-colors w-full text-left">
            <Mail className={cn("w-3.5 h-3.5 shrink-0", lead.email?.endsWith('@sms.cal.com') ? "text-orange-400" : "text-muted-foreground")} />
            <span className={cn("truncate flex-1", lead.email?.endsWith('@sms.cal.com') && "text-orange-300 italic")}>{lead.email}</span>
            <Copy className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
          {lead.email?.endsWith('@sms.cal.com') && (
            <p className="text-[10px] font-display text-orange-400/80 pl-5 -mt-0.5">
              ⚠️ Email placeholder Cal.com — récupère le vrai email lors du call
            </p>
          )}
          {lead.phone && (
            <button onClick={() => copy(lead.phone, "Tel")} className="flex items-center gap-2 text-xs hover:text-primary transition-colors w-full text-left">
              <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span>{lead.phone}</span><Copy className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          )}
        </div>

        {/* Call outcome */}
        {lead.call_done && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Issue du call</p>
            <OutcomeBadge outcome={lead.call_outcome} />
            {lead.call_debrief && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 leading-relaxed">{lead.call_debrief}</p>
            )}
          </div>
        )}

        {/* Offre & Paiement */}
        {(lead.offer_amount || lead.paid_at) && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Offre & Paiement</p>
            {lead.offer_amount && (
              <div className="flex items-center gap-2 text-xs">
                <DollarSign className="w-3.5 h-3.5 text-violet-400" />
                <span>Offre: <span className="text-violet-400 font-mono">{lead.offer_amount}</span></span>
              </div>
            )}
            {lead.paid_at && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-sm font-bold text-emerald-400">{lead.paid_amount}€ payé</span>
                  <p className="text-[10px] text-muted-foreground">{fmtDateTime(lead.paid_at)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Oracle Activity */}
        {lead.user_id && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Activité Oracle</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{lead.session_count || 0}</p>
                <p className="text-[9px] text-muted-foreground font-mono uppercase">Sessions</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold">{lead.execution_count || 0}</p>
                <p className="text-[9px] text-muted-foreground font-mono uppercase">Trades</p>
              </div>
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="space-y-1 text-[10px] text-muted-foreground font-mono pt-2 border-t border-border/50">
          <p>Soumis: {fmtDateTime(lead.created_at)}</p>
          {lead.reviewed_at && <p>Approuvé: {fmtDateTime(lead.reviewed_at)}</p>}
          <p>ID: {lead.id.slice(0, 8)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main ──

interface CRMDashboardProps {
  overrideRoles?: { isAdmin: boolean; isSuperAdmin: boolean; isSetter: boolean; isCloser: boolean };
}

export default function CRMDashboard({ overrideRoles }: CRMDashboardProps = {}) {
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [setterFilter, setSetterFilter] = useState("all");
  const [prioFilter, setPrioFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [modalView, setModalView] = useState<LeadModalView>("lead");
  const [refreshing, setRefreshing] = useState(false);
  const [isSetterOnly, setIsSetterOnly] = useState(false);
  const [_isSuperAdmin, _setIsSuperAdmin] = useState(false);
  const [_isAdminRole, _setIsAdminRole] = useState(false);
  const [_isSetterRole, _setIsSetterRole] = useState(false);
  const [_isCloserRole, _setIsCloserRole] = useState(false);
  const [currentSetterName, setCurrentSetterName] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  // Map request_id → état Kit (subscribed | failed | unsubscribed) + dernier event
  const [kitEventsMap, setKitEventsMap] = useState<Record<string, {
    status: 'subscribed' | 'failed' | 'unsubscribed';
    at: string;
    sequence_id: string | null;
    started_at: string | null;
    stopped_at: string | null;
    tag_added?: boolean;
  }>>({});
  const { toast } = useToast();

  // Effective roles: overrideRoles (from RoleSwitcher) prend le dessus sur les valeurs DB
  const isSuperAdmin = overrideRoles ? overrideRoles.isSuperAdmin : _isSuperAdmin;
  const isAdminRole  = overrideRoles ? overrideRoles.isAdmin     : _isAdminRole;
  const isSetterRole = overrideRoles ? overrideRoles.isSetter    : _isSetterRole;
  const isCloserRole = overrideRoles ? overrideRoles.isCloser    : _isCloserRole;

  // Detect current user's real roles (toujours depuis DB — pas overridé)
  useEffect(() => {
    (async () => {
      try {
        const [setterRes, adminRes, superRes, closerRes] = await Promise.all([
          supabase.rpc("is_setter"),
          supabase.rpc("is_admin"),
          supabase.rpc("is_super_admin"),
          supabase.rpc("is_closer" as any),
        ]);
        const isSetter = setterRes.data === true;
        const isAdmin = adminRes.data === true;
        const superAdmin = superRes.data === true;
        const isCloser = closerRes.data === true;
        _setIsSuperAdmin(superAdmin);
        _setIsAdminRole(isAdmin);
        _setIsSetterRole(isSetter);
        _setIsCloserRole(isCloser);
        if (isSetter && !isAdmin && !superAdmin) {
          setIsSetterOnly(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name, first_name")
              .eq("user_id", user.id)
              .single();
            if (profile) setCurrentSetterName(profile.display_name || profile.first_name || null);
          }
        }
      } catch { /* admin/superadmin by default */ }
    })();
  }, []);

  const openLead = (lead: PipelineLead, view: LeadModalView = "lead") => {
    setSelectedLead(lead);
    setModalView(view);
  };

  const quickUpdate = async (e: React.MouseEvent, leadId: string, fields: Record<string, any>) => {
    e.stopPropagation();
    await supabase.from("early_access_requests").update(fields).eq("id", leadId);
    loadLeads();
  };

  const deleteLead = async (e: React.MouseEvent, lead: PipelineLead) => {
    e.stopPropagation();
    if (!confirm(`Supprimer ${lead.first_name} (${lead.email}) ? Cette action est irréversible.`)) return;
    const { error } = await supabase.from("early_access_requests").delete().eq("id", lead.id);
    if (error) { console.error("[CRM] Delete error:", error); return; }
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    if (selectedLead?.id === lead.id) setSelectedLead(null);
  };

  /**
   * Activer un lead comme membre payant (full conversion en 1 clic).
   * Fait tout :
   *   - profiles.is_client = true + status = active
   *   - user_roles : ajoute "member", retire "early_access" (clear timer)
   *   - early_access_requests : status = closed_won, paid_at si null
   *   - lead_events : log "activated_as_member"
   * L'email de bienvenue est géré côté Lovable (SMTP intégré).
   */
  const handleCloseLead = async (e: React.MouseEvent, lead: PipelineLead) => {
    e.stopPropagation();
    if (!lead.user_id) { toast({ title: "Impossible", description: "Le lead n'a pas encore de compte. Approuvez-le d'abord.", variant: "destructive" }); return; }
    if (!confirm(`Activer ${lead.first_name} (${lead.email}) comme membre actif ?\n\nCette action :\n• Ajoute le rôle "member" (accès complet)\n• Retire "early_access" (clear timer)\n• Marque le profil comme client payant\n• Archive le lead en closed_won`)) return;
    setClosingId(lead.id);
    try {
      const now = new Date().toISOString();
      const userId = lead.user_id;

      // 1) Profil : passe en client + statut actif (en cas de gel précédent)
      const profileUpdate = supabase.from("profiles")
        .update({ is_client: true, status: "active" as any } as any)
        .eq("user_id", userId);

      // 2) Role : ajoute "member" si pas déjà présent
      const memberRoleInsert = supabase.from("user_roles")
        .upsert({ user_id: userId, role: "member" as any } as any, { onConflict: "user_id,role", ignoreDuplicates: true });

      // 3) Role : retire "early_access" (libère le timer, supprime les restrictions EA)
      const earlyAccessDelete = supabase.from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "early_access" as any);

      // 4) CRM lead row
      const crmUpdate = supabase.from("early_access_requests")
        .update({
          status: "closed_won" as any,
          paid_at: lead.paid_at || now,
        } as any)
        .eq("id", lead.id);

      // 5) Event log (best-effort, ne bloque pas la conversion si fail)
      const eventLog = Promise.resolve(supabase.from("lead_events").insert({
        request_id: lead.id,
        event_type: "activated_as_member" as any,
        metadata: { paid_amount: lead.paid_amount, paid_at: lead.paid_at || now },
      } as any)).then(() => {}).catch(() => {});

      const [pRes, mRes, eaRes, cRes] = await Promise.all([profileUpdate, memberRoleInsert, earlyAccessDelete, crmUpdate]);
      await eventLog;

      // Vérif erreurs critiques
      const firstError = [pRes, mRes, eaRes, cRes].find((r: any) => r.error);
      if (firstError && (firstError as any).error) throw (firstError as any).error;

      toast({
        title: "✅ Membre activé",
        description: `${lead.first_name} a accès complet à la plateforme. Visible dans Gestion.`,
      });
      loadLeads();
    } catch (err: any) {
      toast({ title: "Erreur activation", description: err.message, variant: "destructive" });
      console.error("[ActivateMember]", err);
    } finally {
      setClosingId(null);
    }
  };

  const handleApproveLead = async (e: React.MouseEvent, lead: PipelineLead) => {
    e.stopPropagation();
    setApprovingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("approve-early-access", {
        body: { requestId: lead.id },
      });
      // Supabase wraps the real error — extract it from the response body
      if (error) {
        const detail = (data as any)?.error || error.message;
        throw new Error(detail);
      }
      const msg = (data as any)?.magic_link
        ? `Magic link généré (email échoué) — copier manuellement`
        : `${lead.first_name} approuvé — magic link envoyé`;
      toast({ title: "✅ Approuvé", description: msg });
      if ((data as any)?.magic_link) {
        console.info("[Approve] Magic link manuel:", (data as any).magic_link);
      }
      loadLeads();
    } catch (err: any) {
      toast({ title: "Erreur approbation", description: err.message, variant: "destructive" });
      console.error("[Approve]", err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const mapLead = useCallback((r: any, enrich?: any): PipelineLead => mapRowToCRMLead(r, enrich ? {
    activityMap: enrich.activityMap,
    sessionMap: enrich.sessionMap,
    execMap: enrich.execMap,
    rolesMap: enrich.rolesMap,
  } : undefined), []);

  const loadLeads = useCallback(async () => {
    try {
      const { data: requests, error } = await withTimeout(
        supabase.from("early_access_requests").select("*").order("created_at", { ascending: false }),
        12000,
      );
      if (error) {
        if (isAuthError(error)) { await clearStaleSession("crm_load_401"); return; }
        setLoading(false); return;
      }
      if (!requests) { setLoading(false); return; }

      setLeads(requests.map(r => mapLead(r)));
      setLoading(false);

      // Charge les events Kit en parallèle (non-bloquant)
      const requestIds = requests.map(r => r.id);
      if (requestIds.length > 0) {
        supabase.from("lead_events")
          .select("request_id, event_type, timestamp, metadata")
          .in("request_id", requestIds)
          .eq("source", "kit")
          .order("timestamp", { ascending: false })
          .then(({ data }) => {
            if (!data) return;
            type KitEntry = {
              status: 'subscribed' | 'failed' | 'unsubscribed';
              at: string;
              sequence_id: string | null;
              started_at: string | null;
              stopped_at: string | null;
              tag_added?: boolean;
            };
            const map: Record<string, KitEntry> = {};
            // data est trié desc → on parcourt à l'envers pour respecter la chrono
            const ordered = [...(data as any[])].reverse();
            for (const ev of ordered) {
              const reqId = ev.request_id as string;
              const seqId = (ev.metadata?.sequence_id ?? null) as string | null;
              const cur = map[reqId];
              if (ev.event_type === 'kit_sequence_subscribed') {
                map[reqId] = {
                  status: 'subscribed',
                  at: ev.timestamp,
                  sequence_id: seqId,
                  started_at: ev.timestamp,
                  stopped_at: null,
                  tag_added: cur?.tag_added,
                };
              } else if (ev.event_type === 'kit_subscribe_failed') {
                map[reqId] = {
                  status: 'failed',
                  at: ev.timestamp,
                  sequence_id: seqId ?? cur?.sequence_id ?? null,
                  started_at: cur?.started_at ?? null,
                  stopped_at: cur?.stopped_at ?? null,
                  tag_added: cur?.tag_added,
                };
              } else if (ev.event_type === 'kit_unsubscribed' || ev.event_type === 'kit_sequence_unsubscribed') {
                map[reqId] = {
                  status: 'unsubscribed',
                  at: ev.timestamp,
                  sequence_id: cur?.sequence_id ?? seqId,
                  started_at: cur?.started_at ?? null,
                  stopped_at: ev.timestamp,
                  tag_added: !!ev.metadata?.tag_added || cur?.tag_added,
                };
              }
            }
            setKitEventsMap(map);
          });
      }
      const userIds = requests.filter(r => r.user_id).map(r => r.user_id);
      if (userIds.length === 0) return;
      const [rolesRes, activityRes, sessionsRes, execsRes, videoViewsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, expires_at, early_access_type").in("user_id", userIds).eq("role", "early_access"),
        supabase.from("ea_activity_tracking").select("user_id, active_tab, last_heartbeat").in("user_id", userIds),
        supabase.from("user_sessions").select("user_id").in("user_id", userIds),
        supabase.from("user_executions").select("user_id").in("user_id", userIds),
        supabase.from("user_video_views").select("user_id").in("user_id", userIds),
      ]);
      const rolesMap: Record<string, any> = {}, activityMap: Record<string, any> = {}, sessionMap: Record<string, number> = {}, execMap: Record<string, number> = {}, videoViewMap: Record<string, number> = {};
      rolesRes.data?.forEach((r: any) => { rolesMap[r.user_id] = r; });
      activityRes.data?.forEach((a: any) => { activityMap[a.user_id] = { is_active: !!(a.last_heartbeat && (Date.now() - new Date(a.last_heartbeat).getTime()) < 60000), active_tab: a.active_tab }; });
      sessionsRes.data?.forEach((s: any) => { sessionMap[s.user_id] = (sessionMap[s.user_id] || 0) + 1; });
      execsRes.data?.forEach((e: any) => { execMap[e.user_id] = (execMap[e.user_id] || 0) + 1; });
      videoViewsRes.data?.forEach((v: any) => { videoViewMap[v.user_id] = (videoViewMap[v.user_id] || 0) + 1; });
      setLeads(requests.map(r => mapLead(r, { rolesMap, activityMap, sessionMap, execMap, videoViewMap })));
    } catch (err) {
      console.warn("[CRM] Load error:", err);
      if (isAuthError(err)) { await clearStaleSession("crm_load_catch"); return; }
      setLoading(false);
    }
  }, [mapLead]);

  useEffect(() => {
    loadLeads();
    const channel = supabase.channel("crm-v2").on("postgres_changes", { event: "INSERT", schema: "public", table: "early_access_requests" }, () => loadLeads()).on("postgres_changes", { event: "UPDATE", schema: "public", table: "early_access_requests" }, () => loadLeads()).subscribe();
    // NOTE: setInterval supprimé — cause un blackscreen exact à 10s sur localhost (crash render)
    // Le realtime channel ci-dessus gère déjà les mises à jour en temps réel.
    return () => { supabase.removeChannel(channel); };
  }, [loadLeads]);

  const manualRefresh = async () => {
    setRefreshing(true);
    await loadLeads();
    setTimeout(() => setRefreshing(false), 500);
  };

  const counts = useMemo(() => {
    const c = { form: leads.length, calls: 0, ea: 0, paid: 0, ghosts: 0 };
    leads.forEach(l => {
      if (l.status === "approuvée") c.ea++;
      if (l.call_booked || l.call_done) c.calls++;
      if (l.paid_at) c.paid++;
      if (l.status === "approuvée" && !l.contacted && (l.session_count || 0) === 0) c.ghosts++;
    });
    return c;
  }, [leads]);

  // Unique setters list for filter dropdown
  const settersList = useMemo(() => [...new Set(leads.map(l => l.setter_name).filter(Boolean))].sort() as string[], [leads]);

  const colorOrder = { red: 0, orange: 1, green: 2 };

  const filtered = useMemo(() => {
    let r = [...leads];
    // ⚠️ Pas de filtre auto setter : les setters voient le pipeline complet
    // (les leads existants n'ont pas de `setter_name` rempli, et l'équipe veut
    // un pool partagé). Le filtre manuel `setterFilter` reste disponible.
    if (search) { const q = search.toLowerCase(); r = r.filter(l => l.first_name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.includes(q)); }
    // Vue filter
    // Filtres trial — 'non_applicable' exclus implicitement (leads pending/non-approuvés)
    if (stageFilter === "a_contacter") r = r.filter(l => l.statut_trial === 'actif' && getTrialDay(l).day <= 7);
    else if (stageFilter === "expirent") r = r.filter(l => l.statut_trial === 'actif' && getTrialDay(l).day >= 5);
    else if (stageFilter === "expires") r = r.filter(l => l.statut_trial === 'expire');
    // "Demandes" = uniquement en_attente (exclut doublon + rejetée qui sont des états terminaux)
    else if (stageFilter === "pending") r = r.filter(l => l.status === 'en_attente' && !(l as any).archived_at);
    else if (stageFilter === "all") r = r.filter(l => l.status !== 'doublon' && l.status !== 'rejetée' && !(l as any).archived_at);
    else if (stageFilter === "archived") r = r.filter(l => !!(l as any).archived_at);
    else r = r.filter(l => getStage(l) === stageFilter && !(l as any).archived_at);
    // Manual filters
    if (setterFilter !== "all") r = r.filter(l => l.setter_name === setterFilter);
    if (prioFilter !== "all") r = r.filter(l => l.priorite === prioFilter);
    // Tri : spécifique uniquement pour les vues trial (à contacter / expirent / expirés)
    // Pour toutes les autres vues → ordre DB conservé : created_at DESC (plus récent en haut)
    if (["a_contacter", "expirent", "expires"].includes(stageFilter)) {
      r.sort((a, b) => {
        const aColor = colorOrder[getTrialColor(a).color] ?? 2;
        const bColor = colorOrder[getTrialColor(b).color] ?? 2;
        if (aColor !== bColor) return aColor - bColor;
        const aDay = getTrialDay(a).day;
        const bDay = getTrialDay(b).day;
        return bDay - aDay;
      });
    } else {
      // Ordre par défaut : plus récent en haut (created_at DESC)
      r.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return r;
  }, [leads, search, stageFilter, setterFilter, prioFilter, isSetterOnly, currentSetterName]);

  // ── Permissions effectives (overrideRoles ou DB) ──────────────────────────
  const canEditSetting = isSetterRole || isAdminRole || isSuperAdmin;
  const canEditCall    = isCloserRole || isAdminRole || isSuperAdmin;

  if (loading) return <LoadingFallback onRetry={loadLeads} message="Chargement du CRM..." />;

  return (
    <div className="h-full overflow-auto">
      <Tabs defaultValue="pipeline" className="h-full flex flex-col">
        {/* ── Tabs ── spike-launch style */}
        <div className="shrink-0 border-b border-white/[0.10]">
          <div className="px-3 md:px-6 flex items-center justify-between h-14 gap-2">
            <TabsList className="bg-transparent border-none gap-1 p-0 h-auto overflow-x-auto whitespace-nowrap scrollbar-hide">
              {[
                { v: "cockpit", label: "Cockpit", icon: BarChart3 },
                { v: "pipeline", label: "Pipeline", icon: Users },
                { v: "conversions", label: "Conversions", icon: Target },
                { v: "objections", label: "Objections", icon: MessageCircle },
                { v: "agenda", label: "Agenda", icon: Calendar },
              ].map(t => (
                <TabsTrigger key={t.v} value={t.v} className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-white data-[state=active]:border-blue-500/30 data-[state=active]:shadow-[0_0_12px_rgba(59,130,246,0.15)] border border-transparent rounded-lg px-3 md:px-4 py-2 text-xs font-display uppercase tracking-wider text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all shrink-0">
                  <t.icon className="w-4 h-4 mr-1.5 md:mr-2 opacity-80" /><span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex items-center gap-3">
              {leads.filter(l => l.is_online).length > 0 && (
                <span className="text-[11px] text-emerald-400 font-display flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {leads.filter(l => l.is_online).length} online
                </span>
              )}
              <button onClick={manualRefresh} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all" title="Rafraîchir">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Pipeline ── */}
        <TabsContent value="pipeline" className="mt-0 flex-1">
          {/* Search */}
          <div className="px-3 md:px-6 pt-3 md:pt-5 pb-3">
            <div className="relative md:max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, email ou telephone..."
                className="pl-10 h-10 bg-white/[0.04] border-white/[0.08] rounded-xl text-sm text-white placeholder:text-white/30 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Vues + Filters bar */}
          <div className="pb-3 flex items-center justify-between h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] mx-3 md:mx-6 mb-4 px-3 md:px-4 gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
            {/* Left: Vues + Filters */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Vues pré-configurées — funnel complet */}
              {[
                { v: "pending",     label: "Demandes",    color: "amber" },
                { v: "approved",    label: "Approuvés",   color: "cyan" },
              ].map(vue => (
                <button key={vue.v} onClick={() => setStageFilter(vue.v as StageFilter)}
                  className={cn("px-3 py-1.5 rounded-lg text-[10px] font-display font-semibold uppercase tracking-wider transition-all border",
                    stageFilter === vue.v
                      ? vue.color === "amber"
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                        : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                      : "border-transparent text-white/30 hover:text-white/60"
                  )}>
                  {vue.label}
                </button>
              ))}
              <div className="w-px h-5 bg-white/10 mx-1" />
              {[
                { v: "a_contacter", label: "À contacter" },
                { v: "expirent", label: "Expirent" },
                { v: "expires", label: "Expirés" },
                { v: "all", label: "Tous" },
                { v: "archived", label: "Archivés" },
              ].map(vue => (
                <button key={vue.v} onClick={() => setStageFilter(vue.v as StageFilter)}
                  className={cn("px-3 py-1.5 rounded-lg text-[10px] font-display font-semibold uppercase tracking-wider transition-all border",
                    stageFilter === vue.v ? "bg-white/[0.08] border-white/[0.15] text-white" : "border-transparent text-white/30 hover:text-white/60"
                  )}>
                  {vue.label}
                </button>
              ))}
              <div className="w-px h-5 bg-white/10 mx-1" />
              {/* Setter filter */}
              <Select value={setterFilter} onValueChange={setSetterFilter}>
                <SelectTrigger className="w-28 h-8 bg-white/[0.04] border-white/[0.08] rounded-lg text-xs font-display text-white/60">
                  <SelectValue placeholder="Setter" />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(220,13%,8%)] border-white/[0.10] rounded-xl shadow-2xl p-1">
                  <SelectItem value="all" className="text-white/50 font-display text-xs">Tous setters</SelectItem>
                  {settersList.map(s => <SelectItem key={s} value={s} className="font-display text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={prioFilter} onValueChange={setPrioFilter}>
                <SelectTrigger className="w-20 h-8 bg-white/[0.04] border-white/[0.08] rounded-lg text-xs font-display text-white/60">
                  <SelectValue placeholder="Prio" />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(220,13%,8%)] border-white/[0.10] rounded-xl shadow-2xl p-1">
                  <SelectItem value="all" className="text-white/50 font-display text-xs">Toutes</SelectItem>
                  <SelectItem value="P1" className="text-emerald-400 font-display text-xs font-bold">P1</SelectItem>
                  <SelectItem value="P2" className="text-amber-400 font-display text-xs font-bold">P2</SelectItem>
                  <SelectItem value="P3" className="text-red-400 font-display text-xs font-bold">P3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Right: Count */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-display text-white font-bold tabular-nums">{filtered.length}</span>
              <span className="text-white/30 text-[10px] uppercase tracking-wider">leads</span>
            </div>
          </div>

          {/* Table — spike-launch exact pattern */}
          {/* Mobile: scroll horizontal pour preserver toutes les colonnes du pipeline */}
          <div className="px-3 md:px-6 pb-6">
            <div className={`rounded-xl border border-white/[0.10] overflow-x-auto ${BG}`}>
              <Table>
                <TableHeader className={`sticky top-0 z-20 ${BG} shadow-[0_1px_0_0_rgba(255,255,255,0.08)]`}>
                  <TableRow className={`border-white/[0.08] hover:bg-transparent ${BG}`}>
                    <TableHead className="text-white/50 font-display text-[10px] uppercase tracking-widest py-3 pl-5 min-w-[160px]">Lead</TableHead>
                    <TableHead className="text-white/50 font-display text-[10px] uppercase tracking-widest py-3 text-center min-w-[110px]">Form / EA</TableHead>
                    <TableHead className="text-white/50 font-display text-[10px] uppercase tracking-widest py-3 text-center min-w-[130px]">Setting</TableHead>
                    <TableHead className="text-white/50 font-display text-[10px] uppercase tracking-widest py-3 text-center w-14">Kit</TableHead>
                    <TableHead className="text-white/50 font-display text-[10px] uppercase tracking-widest py-3 text-center min-w-[130px]">Call</TableHead>
                    <TableHead className="text-white/50 font-display text-[10px] uppercase tracking-widest py-3 text-center w-16">Trial</TableHead>
                    {isSuperAdmin && <TableHead className="w-8" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={isSuperAdmin ? 7 : 6} className="text-center py-20 text-white/30 text-sm font-display">Aucun lead</TableCell></TableRow>
                  ) : filtered.slice(0, 100).map((lead) => {
                    const sc = lead.setter_name ? getSetterColor(lead.setter_name) : null;
                    const trial = getTrialDay(lead);
                    const color = getTrialColor(lead);
                    return (
                    <TableRow
                      key={lead.id}
                      onClick={() => openLead(lead, "setting")}
                      className={cn(
                        "group cursor-pointer transition-all duration-200 border-white/[0.04]",
                        "hover:bg-white/[0.04]",
                        selectedLead?.id === lead.id && "bg-white/[0.06]"
                      )}
                    >
                      {/* LEAD — nom + setter */}
                      <TableCell className="py-3 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-display font-bold shrink-0",
                              lead.paid_at ? "bg-emerald-500 text-white" : color.color === 'red' ? "bg-red-500/20 text-red-400 border border-red-500/30" : color.color === 'orange' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            )}>
                              {(lead.first_name?.[0] || "?").toUpperCase()}
                            </div>
                            {lead.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0c0d12]" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[15px] font-display font-bold text-white">{lead.first_name || "—"}</p>
                              {lead.priorite && <span className={cn("text-[8px] font-display font-bold", lead.priorite === 'P1' ? 'text-emerald-400' : lead.priorite === 'P2' ? 'text-amber-400' : 'text-red-400')}>{lead.priorite}</span>}
                              {/* Badge SMS — email placeholder Cal.com (booking sans form, email à compléter) */}
                              {lead.email?.endsWith('@sms.cal.com') && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/40 text-[9px] font-display font-bold text-orange-300 uppercase tracking-wider"
                                  title="Booking SMS — email réel à récupérer (le client n'a pas soumis le form)"
                                >
                                  📵 SMS
                                </span>
                              )}
                            </div>
                            {lead.setter_name && sc ? (
                              <span className={`text-[10px] font-display ${sc.text}`} onClick={e => { e.stopPropagation(); openLead(lead, "setting"); }}>
                                Setter : {lead.setter_name}
                              </span>
                            ) : getStage(lead) === 'pending' ? (
                              <button
                                onClick={e => handleApproveLead(e, lead)}
                                disabled={approvingId === lead.id}
                                className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-display font-semibold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/25 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                              >
                                {approvingId === lead.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <UserCheck className="w-2.5 h-2.5" />}
                                {approvingId === lead.id ? '...' : 'Approuver'}
                              </button>
                            ) : (lead.user_id && lead.status !== 'closed_won' && lead.status !== 'doublon') ? (
                              <button
                                onClick={e => { if (!canEditCall) { e.stopPropagation(); return; } handleCloseLead(e, lead); }}
                                disabled={closingId === lead.id || !canEditCall}
                                title={!canEditCall ? "Réservé aux closers et admins — un setter ne peut pas activer un membre payant" : undefined}
                                className={cn(
                                  "mt-0.5 inline-flex items-center gap-1 text-[10px] font-display font-semibold px-2 py-0.5 rounded-md border transition-all",
                                  canEditCall
                                    ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/20 disabled:opacity-50"
                                    : "text-white/30 bg-white/5 border-white/10 cursor-not-allowed"
                                )}
                              >
                                {closingId === lead.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : !canEditCall ? <Lock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                                {closingId === lead.id ? '...' : 'Activer membre'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      {/* FORM / EA — date soumission + date approbation */}
                      <TableCell className="text-center py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-block text-[11px] font-mono font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25">
                            <span className="font-bold">{fmtDate(lead.created_at)}</span> <span className="text-amber-400/60">{fmtTime(lead.created_at)}</span>
                          </span>
                          {lead.reviewed_at && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400/80 bg-cyan-500/8 px-2 py-0.5 rounded border border-cyan-500/20">
                              <Shield className="w-2.5 h-2.5 shrink-0" />
                              <span className="font-bold">{fmtDate(lead.reviewed_at)}</span> <span className="opacity-60">{fmtTime(lead.reviewed_at)}</span>
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {/* SETTING — premier contact (méthode + date) + dernière interaction */}
                      <TableCell className="text-center py-3" onClick={e => { e.stopPropagation(); openLead(lead, "setting"); }}>
                        <div className="flex flex-col items-center gap-1">
                          {lead.contacted ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg border",
                              lead.contact_method === 'email'
                                ? "text-amber-300 bg-amber-500/10 border-amber-500/25"
                                : "text-emerald-300 bg-emerald-500/10 border-emerald-500/25"
                            )}>
                              {lead.contact_method === 'email'
                                ? <Mail className="w-3 h-3 shrink-0" />
                                : <MessageCircle className="w-3 h-3 shrink-0" />}
                              <span className="font-bold">{fmtDate(lead.contacted_at || lead.created_at)}</span>
                              <span className="opacity-50">{fmtTime(lead.contacted_at || lead.created_at)}</span>
                            </span>
                          ) : (
                            <span className="text-white/15 text-[11px]">—</span>
                          )}
                          {lead.derniere_interaction && (
                            <span className="text-[10px] font-display text-white/30 tabular-nums">
                              {formatRelativeDate(lead.derniere_interaction)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {/* KIT — cercle indicateur + Mail (4 états : jamais / Book-a-call actif / Nurturing actif / stoppé) */}
                      <TableCell className="text-center py-3">
                        {(() => {
                          const kit = kitEventsMap[lead.id];
                          // État 1 : jamais démarré → cercle gris foncé statique
                          if (!kit) {
                            return (
                              <span
                                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.03] border border-white/[0.06]"
                                title="Aucune séquence email"
                              >
                                <Mail className="w-3.5 h-3.5 text-white/20" />
                              </span>
                            );
                          }
                          const seqId = kit.sequence_id ?? "";
                          const seqName = KIT_SEQUENCE_NAMES[seqId] ?? "Séquence Kit";
                          const isActive = kit.status === 'subscribed';
                          const isStopped = kit.status === 'unsubscribed';
                          const isFailed = kit.status === 'failed';

                          // Détermine la couleur selon état
                          let ringClass = "bg-white/[0.04] border-white/10";
                          let iconClass = "text-white/40";
                          let pulseClass = "";
                          let tooltip = `${seqName} — Terminée`;

                          if (isActive) {
                            if (seqId === '2624505') {
                              // État 2 : Book-a-call actif → orange pulsant
                              ringClass = "bg-orange-500/15 border-orange-500/40 shadow-[0_0_12px_rgba(251,146,60,0.35)]";
                              iconClass = "text-orange-400";
                            } else if (seqId === '2626026') {
                              // État 3 : Nurturing actif → bleu pulsant
                              ringClass = "bg-sky-500/15 border-sky-500/40 shadow-[0_0_12px_rgba(56,189,248,0.35)]";
                              iconClass = "text-sky-400";
                            } else {
                              ringClass = "bg-emerald-500/15 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.35)]";
                              iconClass = "text-emerald-400";
                            }
                            pulseClass = "animate-pulse";
                            tooltip = `Séquence active — ${seqName}`;
                          } else if (isFailed) {
                            ringClass = "bg-red-500/10 border-red-500/30";
                            iconClass = "text-red-400/80";
                            tooltip = `${seqName} — Échec inscription`;
                          } else if (isStopped) {
                            // État 4 : stoppé → gris statique
                            tooltip = `Séquence terminée — ${seqName}`;
                          }

                          return (
                            <span
                              className={cn(
                                "inline-flex items-center justify-center w-7 h-7 rounded-full border transition-all",
                                ringClass,
                                pulseClass
                              )}
                              title={tooltip}
                            >
                              <Mail className={cn("w-3.5 h-3.5", iconClass)} />
                            </span>
                          );
                        })()}
                      </TableCell>
                      {/* CALL — date+h colorée selon outcome (valeurs canoniques) */}
                      <TableCell className="text-center py-3" onClick={e => { e.stopPropagation(); openLead(lead, "call"); }}>
                        {lead.call_no_show ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/30">
                            <X className="w-3 h-3" /> {lead.call_scheduled_at ? <><span className="font-bold">{fmtDate(lead.call_scheduled_at)}</span> <span className="opacity-60">{fmtTime(lead.call_scheduled_at)}</span></> : 'No-show'}
                          </span>
                        ) : (lead.call_outcome === 'vendu' || lead.paid_at) ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> {lead.call_scheduled_at ? <><span className="font-bold">{fmtDate(lead.call_scheduled_at)}</span> <span className="opacity-60">{fmtTime(lead.call_scheduled_at)}</span></> : 'Vendu'}
                          </span>
                        ) : lead.call_outcome === 'contracte_en_attente' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-violet-300 bg-violet-500/10 px-2.5 py-1 rounded-lg border border-violet-500/30">
                            <Clock className="w-3 h-3" /> {lead.call_scheduled_at ? <><span className="font-bold">{fmtDate(lead.call_scheduled_at)}</span> <span className="opacity-60">{fmtTime(lead.call_scheduled_at)}</span></> : 'Contracté'}
                          </span>
                        ) : lead.call_outcome === 'rappel' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                            <Clock className="w-3 h-3" /> {lead.call_scheduled_at ? <><span className="font-bold">{fmtDate(lead.call_scheduled_at)}</span> <span className="opacity-60">{fmtTime(lead.call_scheduled_at)}</span></> : 'Rappel'}
                          </span>
                        ) : lead.call_outcome === 'pas_vendu' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/30">
                            <X className="w-3 h-3" /> {lead.call_scheduled_at ? <><span className="font-bold">{fmtDate(lead.call_scheduled_at)}</span> <span className="opacity-60">{fmtTime(lead.call_scheduled_at)}</span></> : 'Pas vendu'}
                          </span>
                        ) : lead.call_booked && lead.call_scheduled_at ? (() => {
                          // Call passé depuis > 30 min sans outcome ni rapport → À reporter
                          const isOverdue = new Date(lead.call_scheduled_at).getTime() < Date.now() - 30 * 60 * 1000;
                          return isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 animate-pulse">
                              <Clock className="w-3 h-3" /> <span className="font-bold">{fmtDate(lead.call_scheduled_at)}</span>
                              <span className="ml-0.5 text-[9px] font-display uppercase tracking-wider text-amber-400/80">à reporter</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/25">
                              <Calendar className="w-3 h-3" /> <span className="font-bold">{fmtDate(lead.call_scheduled_at)}</span> <span className="opacity-60">{fmtTime(lead.call_scheduled_at)}</span>
                            </span>
                          );
                        })() : <span className="text-white/15">—</span>}
                      </TableCell>
                      {/* TRIAL — J + remaining (ou "En attente" si pas encore approuvé) */}
                      <TableCell className="text-center py-3">
                        {lead.status === 'approuvée' ? (
                          <div className="text-center">
                            <span className={cn("text-xs font-display font-bold",
                              trial.expired ? "text-red-400" : trial.day >= 5 ? "text-amber-400" : "text-cyan-400"
                            )}>J{trial.day}</span>
                            <p className={cn("text-[8px] font-display", trial.expired ? "text-red-400/60" : "text-white/25")}>{trial.expired ? 'expiré' : `${trial.remaining}j`}</p>
                          </div>
                        ) : (
                          <span className="text-[9px] font-display text-white/20 uppercase tracking-wider">attente</span>
                        )}
                      </TableCell>
                      {/* DELETE (superadmin) */}
                      {isSuperAdmin && (
                        <TableCell className="py-2.5 pr-2">
                          <button onClick={(e) => deleteLead(e, lead)} className="p-1 rounded text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Full-screen modal */}
          {selectedLead && (
            <LeadDetailModal
              lead={selectedLead}
              onClose={() => setSelectedLead(null)}
              onLeadUpdated={loadLeads}
              initialView={modalView}
              canEditSetting={canEditSetting}
              canEditCall={canEditCall}
            />
          )}
        </TabsContent>

        {/* Agenda Tab — Full implementation */}
        <TabsContent value="agenda" className="flex-1 mt-0">
          <AgendaTab />
        </TabsContent>

        {/* Cockpit Tab */}
        <TabsContent value="cockpit" className="flex-1 mt-0 overflow-auto">
          <CockpitTab leads={leads} />
        </TabsContent>

        {/* Conversions Tab */}
        <TabsContent value="conversions" className="flex-1 mt-0 overflow-auto">
          <ConversionsTab leads={leads} />
        </TabsContent>

        {/* Placeholders */}
        {["objections"].map(tab => (
          <TabsContent key={tab} value={tab} className="flex-1 flex items-center justify-center mt-0">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-base font-medium capitalize">{tab}</p>
              <p className="text-xs opacity-60">Bientôt disponible</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
