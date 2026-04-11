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
  Send, UserCheck, Sparkles, UserX,
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
import { getSetterColor } from "@/lib/admin/setterColors";
import AgendaTab from "./AgendaTab";
import CockpitTab from "./CockpitTab";
import ConversionsTab from "./ConversionsTab";
import PeriodSelector, { type PeriodMode } from "./PeriodSelector";
import type { LeadModalView } from "./LeadDetailModal";

// ── Types — CRMLead imported from @/lib/admin/types (source de verite unique) ──
type PipelineLead = CRMLead; // Alias local pour compatibilite

function fmtDate(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fmtDateTime(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return `${fmtDate(d)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
  const cfg: Record<string, { label: string; cls: string }> = {
    contracted: { label: "Contracte ✓", cls: "text-violet-300 bg-violet-500/20 border-violet-500/30" },
    closing_in_progress: { label: "En cours", cls: "text-amber-300 bg-amber-500/20 border-amber-500/30" },
    not_closed: { label: "Non close", cls: "text-red-300 bg-red-500/20 border-red-500/30" },
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
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white", avatarColor(lead))}>
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
            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="truncate flex-1">{lead.email}</span><Copy className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
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

export default function CRMDashboard() {
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [setterFilter, setSetterFilter] = useState("all");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [modalView, setModalView] = useState<LeadModalView>("lead");
  const [isSetterOnly, setIsSetterOnly] = useState(false);
  const [currentSetterName, setCurrentSetterName] = useState<string | null>(null);

  // Detect if current user is a setter (not admin/superadmin) → auto-filter
  useEffect(() => {
    (async () => {
      try {
        const [setterRes, adminRes, superRes] = await Promise.all([
          supabase.rpc("is_setter"),
          supabase.rpc("is_admin"),
          supabase.rpc("is_super_admin"),
        ]);
        const isSetter = setterRes.data === true;
        const isAdmin = adminRes.data === true;
        const isSuperAdmin = superRes.data === true;
        if (isSetter && !isAdmin && !isSuperAdmin) {
          setIsSetterOnly(true);
          // Get setter's display name for filtering
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name, first_name")
              .eq("user_id", user.id)
              .single();
            if (profile) {
              setCurrentSetterName(profile.display_name || profile.first_name || null);
            }
          }
        }
      } catch { /* admin/superadmin by default */ }
    })();
  }, []);

  const openLead = (lead: PipelineLead, view: LeadModalView = "lead") => {
    setSelectedLead(lead);
    setModalView(view);
  };

  const mapLead = useCallback((r: any, enrich?: any): PipelineLead => mapRowToCRMLead(r, enrich ? {
    activityMap: enrich.activityMap,
    sessionMap: enrich.sessionMap,
    execMap: enrich.execMap,
    rolesMap: enrich.rolesMap,
  } : undefined), []);

  const loadLeads = useCallback(async () => {
    try {
      const { data: requests, error } = await supabase
        .from("early_access_requests").select("*").order("created_at", { ascending: false });
      if (error || !requests) { setLoading(false); return; }

      setLeads(requests.map(r => mapLead(r)));
      setLoading(false);

      // Enrich in background
      const userIds = requests.filter(r => r.user_id).map(r => r.user_id);
      if (userIds.length === 0) return;
      const [rolesRes, activityRes, sessionsRes, execsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, expires_at, early_access_type").in("user_id", userIds).eq("role", "early_access"),
        supabase.from("ea_activity_tracking").select("user_id, is_active, active_tab, last_heartbeat").in("user_id", userIds),
        supabase.from("user_sessions").select("user_id").in("user_id", userIds),
        supabase.from("user_executions").select("user_id").in("user_id", userIds),
      ]);
      const rolesMap: Record<string, any> = {}, activityMap: Record<string, any> = {}, sessionMap: Record<string, number> = {}, execMap: Record<string, number> = {};
      rolesRes.data?.forEach((r: any) => { rolesMap[r.user_id] = r; });
      activityRes.data?.forEach((a: any) => { activityMap[a.user_id] = { is_active: a.is_active && a.last_heartbeat && (Date.now() - new Date(a.last_heartbeat).getTime()) < 60000, active_tab: a.active_tab }; });
      sessionsRes.data?.forEach((s: any) => { sessionMap[s.user_id] = (sessionMap[s.user_id] || 0) + 1; });
      execsRes.data?.forEach((e: any) => { execMap[e.user_id] = (execMap[e.user_id] || 0) + 1; });
      setLeads(requests.map(r => mapLead(r, { rolesMap, activityMap, sessionMap, execMap })));
    } catch (err) { console.warn("[CRM] Load error:", err); setLoading(false); }
  }, [mapLead]);

  useEffect(() => {
    loadLeads();
    const channel = supabase.channel("crm-v2").on("postgres_changes", { event: "INSERT", schema: "public", table: "early_access_requests" }, () => loadLeads()).on("postgres_changes", { event: "UPDATE", schema: "public", table: "early_access_requests" }, () => loadLeads()).subscribe();
    const interval = setInterval(loadLeads, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [loadLeads]);

  const counts = useMemo(() => {
    const c = { form: leads.length, calls: 0, ea: 0, paid: 0 };
    leads.forEach(l => {
      if (l.status === "approuvée") c.ea++;
      if (l.call_booked || l.call_done) c.calls++;
      if (l.paid_at) c.paid++;
    });
    return c;
  }, [leads]);

  // Unique setters list for filter dropdown
  const settersList = useMemo(() => [...new Set(leads.map(l => l.setter_name).filter(Boolean))].sort() as string[], [leads]);

  const filtered = useMemo(() => {
    let r = [...leads];
    // Setter auto-filter: setter only sees their own leads
    if (isSetterOnly && currentSetterName) r = r.filter(l => l.setter_name === currentSetterName);
    if (search) { const q = search.toLowerCase(); r = r.filter(l => l.first_name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.includes(q)); }
    if (stageFilter !== "all") r = r.filter(l => getStage(l) === stageFilter);
    if (setterFilter !== "all") r = r.filter(l => l.setter_name === setterFilter);
    r.sort((a, b) => sortAsc ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime() : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return r;
  }, [leads, search, stageFilter, setterFilter, sortAsc, isSetterOnly, currentSetterName]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
    </div>
  );

  return (
    <div className="h-full overflow-auto">
      <Tabs defaultValue="pipeline" className="h-full flex flex-col">
        {/* ── Tabs ── spike-launch style */}
        <div className="shrink-0 border-b border-white/[0.10]">
          <div className="px-6 flex items-center justify-between h-14">
            <TabsList className="bg-transparent border-none gap-1 p-0 h-auto">
              {[
                { v: "cockpit", label: "Cockpit", icon: BarChart3 },
                { v: "pipeline", label: "Pipeline", icon: Users },
                { v: "conversions", label: "Conversions", icon: Target },
                { v: "objections", label: "Objections", icon: MessageCircle },
                { v: "agenda", label: "Agenda", icon: Calendar },
              ].map(t => (
                <TabsTrigger key={t.v} value={t.v} className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-white data-[state=active]:border-blue-500/30 data-[state=active]:shadow-[0_0_12px_rgba(59,130,246,0.15)] border border-transparent rounded-lg px-4 py-2 text-xs font-display uppercase tracking-wider text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all">
                  <t.icon className="w-4 h-4 mr-2 opacity-80" />{t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {leads.filter(l => l.is_online).length > 0 && (
              <span className="text-[11px] text-emerald-400 font-display flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {leads.filter(l => l.is_online).length} online
              </span>
            )}
          </div>
        </div>

        {/* ── Pipeline ── */}
        <TabsContent value="pipeline" className="mt-0 flex-1">
          {/* Search */}
          <div className="px-6 pt-5 pb-3">
            <div className="relative max-w-lg">
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

          {/* Filters + KPIs bar — spike-launch exact layout */}
          <div className="px-6 pb-3 flex items-center justify-between h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] mx-6 mb-4 px-4">
            {/* Left: Filters */}
            <div className="flex items-center gap-3">
              <Select value={stageFilter} onValueChange={v => setStageFilter(v as StageFilter)}>
                <SelectTrigger className="w-44 h-9 bg-white/[0.04] border-white/[0.08] rounded-xl text-white/80 text-sm font-display tracking-wide hover:bg-white/[0.06] hover:border-white/[0.12] transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(220,13%,8%)] border-white/[0.10] rounded-xl shadow-2xl backdrop-blur-xl p-1">
                  <SelectItem value="all" className="text-white/70 font-display text-sm">Tous les leads</SelectItem>
                  <SelectItem value="pending" className="text-white/50 font-display text-sm">En attente</SelectItem>
                  <SelectItem value="approved" className="text-cyan-400/80 font-display text-sm">EA Approuve</SelectItem>
                  <SelectItem value="contacted" className="text-purple-400/80 font-display text-sm">Contacte</SelectItem>
                  <SelectItem value="call_booked" className="text-blue-400/80 font-display text-sm">Calls</SelectItem>
                  <SelectItem value="call_done" className="text-blue-400/80 font-display text-sm">Call fait</SelectItem>
                  <SelectItem value="paid" className="text-emerald-400/80 font-display text-sm">Paye</SelectItem>
                </SelectContent>
              </Select>

              {/* Setter filter */}
              {settersList.length > 0 && (() => {
                const activeColor = setterFilter !== 'all' ? getSetterColor(setterFilter) : null;
                return (
                  <Select value={setterFilter} onValueChange={setSetterFilter}>
                    <SelectTrigger className={cn("w-44 h-9 rounded-xl text-sm font-display tracking-wide transition-all",
                      activeColor
                        ? `${activeColor.filterGradient} ${activeColor.border} ${activeColor.text} shadow-lg ${activeColor.shadow}`
                        : "bg-white/[0.04] border-white/[0.08] text-white/80 hover:bg-white/[0.06] hover:border-white/[0.12]"
                    )}>
                      <Users className={cn("w-3.5 h-3.5 mr-2", activeColor ? activeColor.icon : "text-white/40")} />
                      <SelectValue placeholder="Tous setters" />
                    </SelectTrigger>
                    <SelectContent className="bg-[hsl(220,13%,8%)] border-white/[0.10] rounded-xl shadow-2xl backdrop-blur-xl p-1">
                      <SelectItem value="all" className="text-white/70 font-display text-sm">Tous setters</SelectItem>
                      {settersList.map(s => {
                        const sc = getSetterColor(s);
                        return <SelectItem key={s} value={s} className={`${sc.text} font-display text-sm`}>{s}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>

            {/* Right: KPIs */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-base font-display text-amber-400">{counts.form}</span>
                <span className="text-amber-400/60 text-[10px] font-medium uppercase">Forms</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-base font-display text-blue-400">{counts.calls}</span>
                <span className="text-blue-400/60 text-[10px] font-medium uppercase">Calls</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-base font-display text-emerald-400">{counts.paid}</span>
                <span className="text-emerald-400/60 text-[10px] font-medium uppercase">Paye</span>
              </div>
              <div className="w-px h-6 bg-white/10 mx-1" />
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-display text-white font-bold tabular-nums">{leads.length}</span>
                <span className="text-white/30 text-[10px] uppercase tracking-wider">total</span>
              </div>
            </div>
          </div>

          {/* Table — spike-launch exact pattern */}
          <div className="px-6 pb-6">
            <div className={`rounded-xl border border-white/[0.10] overflow-hidden ${BG}`}>
              <Table>
                <TableHeader className={`sticky top-0 z-20 ${BG} shadow-[0_1px_0_0_rgba(255,255,255,0.08)]`}>
                  <TableRow className={`border-white/[0.08] hover:bg-transparent ${BG}`}>
                    <TableHead className="text-white/70 font-display text-xs uppercase tracking-wider min-w-[180px] py-4 pl-5">
                      <div className="flex items-center gap-2">
                        <IconBox color="white"><Users className="w-3 h-3 text-white/50" /></IconBox>
                        <span>LEAD</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white/80 font-display text-sm uppercase tracking-wider py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <IconBox color="amber"><Target className="w-3 h-3 text-amber-400/80" /></IconBox>
                        <span>FORM</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white/80 font-display text-sm uppercase tracking-wider py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <IconBox color="cyan"><Shield className="w-3 h-3 text-cyan-400/80" /></IconBox>
                        <span>EA</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white/80 font-display text-sm uppercase tracking-wider py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <IconBox color="violet"><Phone className="w-3 h-3 text-violet-400/80" /></IconBox>
                        <span>CONTACT</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white/80 font-display text-sm uppercase tracking-wider py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <IconBox color="blue"><Calendar className="w-3 h-3 text-primary/80" /></IconBox>
                        <span>CALL</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white/80 font-display text-sm uppercase tracking-wider py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <IconBox color="orange"><Mail className="w-3 h-3 text-orange-400/80" /></IconBox>
                        <span>MAIL</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white/80 font-display text-sm uppercase tracking-wider py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <IconBox color="violet"><DollarSign className="w-3 h-3 text-violet-400/80" /></IconBox>
                        <span>OFFRE</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white/80 font-display text-sm uppercase tracking-wider py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <IconBox color="fuchsia"><Lock className="w-3 h-3 text-fuchsia-400/80" /></IconBox>
                        <span>ACCES</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white/80 font-display text-sm uppercase tracking-wider py-4 text-center cursor-pointer hover:text-white transition-colors" onClick={() => setSortAsc(!sortAsc)}>
                      <div className="flex items-center justify-center gap-1.5">
                        <IconBox color="emerald"><CreditCard className="w-3 h-3 text-emerald-400/80" /></IconBox>
                        <span>PAYE {sortAsc ? "↑" : "↓"}</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white/80 font-display text-sm uppercase tracking-wider py-4 cursor-pointer hover:text-white transition-colors" onClick={() => setSortAsc(!sortAsc)}>
                      <div className="flex items-center gap-1.5">
                        <IconBox color="white"><Calendar className="w-3 h-3 text-white/40" /></IconBox>
                        <span>DATE</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-20 text-white/30 text-sm">Aucun lead</TableCell></TableRow>
                  ) : filtered.slice(0, 100).map((lead, idx) => {
                    const sc = lead.setter_name ? getSetterColor(lead.setter_name) : null;
                    const av = avatarClasses(lead);
                    return (
                    <TableRow
                      key={lead.id}
                      onClick={() => openLead(lead, "lead")}
                      className={cn(
                        "group cursor-pointer transition-all duration-200 border-white/[0.04] hover:bg-white/[0.04]",
                        selectedLead?.id === lead.id && "bg-white/[0.06]"
                      )}
                    >
                      {/* LEAD → fiche lead */}
                      <TableCell className="py-3 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-200 shadow-lg", av.bg)}>
                              <span className={cn("font-display text-base font-bold", av.text)}>
                                {(lead.first_name?.[0] || "?").toUpperCase()}
                              </span>
                            </div>
                            {av.dot && <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[hsl(220,15%,8%)] shadow-lg", av.dot)} />}
                            {lead.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[hsl(220,15%,8%)] animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" />}
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-white font-display text-[15px] font-semibold group-hover:text-white transition-colors">{lead.first_name || "—"}</p>
                            {lead.setter_name && sc && (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-display ${sc.text} ${sc.bg} ${sc.border} border px-2 py-0.5 rounded-md w-fit cursor-pointer hover:opacity-80 transition-opacity`}
                                onClick={e => { e.stopPropagation(); openLead(lead, "setting"); }}
                              >
                                Setter : {lead.setter_name} <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {/* FORM → fiche lead */}
                      <TableCell className="text-center py-3"><DateBadge date={lead.created_at} color="amber" /></TableCell>
                      {/* EA → fiche lead */}
                      <TableCell className="text-center py-3">
                        {lead.status === "approuvée" ? <DateBadge date={lead.reviewed_at} color="cyan" /> : <Empty />}
                      </TableCell>
                      {/* CONTACT → fiche setting (date + icon like spike-launch) */}
                      <TableCell className="text-center py-3" onClick={e => { e.stopPropagation(); openLead(lead, "setting"); }}>
                        {lead.contacted && lead.contact_method ? (
                          <div className="inline-flex items-center gap-1.5">
                            {lead.contact_method === "whatsapp" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/25">
                                <CheckCircle2 className="w-3 h-3" /> {fmtDate(lead.created_at)}
                              </span>
                            ) : lead.contact_method === "email" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/25">
                                <Mail className="w-3 h-3" /> {fmtDate(lead.created_at)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/25">
                                <Phone className="w-3 h-3" /> SET
                              </span>
                            )}
                          </div>
                        ) : lead.contacted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/25">
                            <CheckCircle2 className="w-3 h-3" /> SET
                          </span>
                        ) : <Empty />}
                      </TableCell>
                      {/* CALL → fiche call (avec date+heure+code couleur) */}
                      <TableCell className="text-center py-3" onClick={e => { e.stopPropagation(); openLead(lead, "call"); }}>
                        {lead.call_no_show ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-display font-semibold text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border-2 border-dashed border-red-500/40">
                            <UserX className="w-3 h-3" /> No-show
                          </span>
                        ) : lead.call_outcome === "contracted" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-violet-300 bg-violet-500/15 px-2.5 py-1 rounded-lg border border-violet-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            {lead.call_scheduled_at ? fmtDateTime(lead.call_scheduled_at) : "Close"}
                          </span>
                        ) : lead.call_outcome === "closing_in_progress" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            {lead.call_scheduled_at ? fmtDateTime(lead.call_scheduled_at) : "En cours"}
                          </span>
                        ) : lead.call_outcome === "not_closed" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-red-300 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/25">
                            <X className="w-3 h-3" />
                            {lead.call_scheduled_at ? fmtDateTime(lead.call_scheduled_at) : "Non close"}
                          </span>
                        ) : lead.call_rescheduled_at ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-pink-300 bg-pink-500/10 px-2.5 py-1 rounded-lg border border-dashed border-pink-500/30">
                            {fmtDateTime(lead.call_scheduled_at)} ANNULE
                          </span>
                        ) : lead.call_booked && lead.call_scheduled_at ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/25">
                            <Clock className="w-3 h-3 text-blue-400" />
                            {fmtDateTime(lead.call_scheduled_at)}
                          </span>
                        ) : lead.call_booked ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <span className="text-[10px] font-display text-blue-300">A venir</span>
                          </div>
                        ) : <Empty />}
                      </TableCell>
                      {/* MAIL → fiche lead */}
                      <TableCell className="text-center py-3">
                        {lead.contact_method === "email" ? <Mail className="w-4 h-4 text-amber-400 mx-auto" /> : <Empty />}
                      </TableCell>
                      {/* OFFRE → fiche call */}
                      <TableCell className="text-center py-3" onClick={e => { e.stopPropagation(); openLead(lead, "call"); }}>
                        {lead.offer_amount ? (
                          <span className="text-sm font-display font-semibold text-violet-300 bg-violet-500/15 px-2.5 py-1 rounded-lg border border-violet-500/25">{lead.offer_amount}</span>
                        ) : <Empty />}
                      </TableCell>
                      {/* ACCES → fiche call */}
                      <TableCell className="text-center py-3" onClick={e => { e.stopPropagation(); openLead(lead, "call"); }}>
                        {lead.checkout_unlocked ? <Unlock className="w-4 h-4 text-emerald-400 mx-auto" /> : lead.offer_amount ? <Lock className="w-4 h-4 text-white/15 mx-auto" /> : <Empty />}
                      </TableCell>
                      {/* PAYE → fiche lead */}
                      <TableCell className="text-center py-3">
                        {lead.paid_at ? (
                          <span className="text-base font-display font-bold text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]">{lead.paid_amount}€</span>
                        ) : <Empty />}
                      </TableCell>
                      {/* DATE */}
                      <TableCell className="py-3"><span className="text-[11px] text-white/30 font-mono tabular-nums">{fmtDate(lead.created_at)}</span></TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Full-screen modal */}
          {selectedLead && (
            <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} onLeadUpdated={loadLeads} initialView={modalView} />
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
