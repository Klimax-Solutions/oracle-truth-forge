// ============================================
// CRM Dashboard — Pipeline spike-launch style
// Reads from early_access_requests + profiles + user_roles
// Branch: crm-integration
// ============================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Search, Users, Phone, Mail, Copy, CheckCircle2,
  Circle, Clock, ArrowUpDown, Eye, PhoneCall, CreditCard,
  X, Calendar, BarChart3, ChevronDown, ChevronRight,
  MessageCircle, Timer, Wifi, UserCheck, PhoneForwarded,
  ClipboardCheck, Target, Send, Lock, Unlock, DollarSign,
  FileText, Headphones, Gift, Shield,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ──

interface PipelineLead {
  id: string;
  first_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  user_id: string | null;
  contacted: boolean;
  contact_method: string | null;
  form_submitted: boolean;
  call_booked: boolean;
  call_done: boolean;
  is_online?: boolean;
  active_tab?: string | null;
  session_count?: number;
  execution_count?: number;
  expires_at?: string | null;
  early_access_type?: string | null;
}

type StageFilter = "all" | "pending" | "approved" | "contacted" | "call_booked" | "call_done";
type SortField = "date" | "name";

// ── Helpers ──

function getStage(lead: PipelineLead): StageFilter {
  if (lead.call_done) return "call_done";
  if (lead.call_booked) return "call_booked";
  if (lead.contacted) return "contacted";
  if (lead.status === "approuvée") return "approved";
  return "pending";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) +
    " " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function shortDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function expiresLabel(d: string | null): string | null {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return "Expiré";
  const h = Math.floor(ms / 3600000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

// ── Checkmark cell ──

function Check({ done, color = "emerald" }: { done: boolean; color?: string }) {
  if (!done) return <span className="text-muted-foreground/20">—</span>;
  const cls = color === "emerald" ? "text-emerald-500" :
    color === "blue" ? "text-blue-500" :
    color === "orange" ? "text-orange-500" :
    color === "purple" ? "text-purple-500" :
    color === "yellow" ? "text-yellow-500" : "text-emerald-500";
  return <CheckCircle2 className={cn("w-4 h-4", cls)} />;
}

// ── Counter badge (top bar) ──

function CounterBadge({ count, label, color, active, onClick }: {
  count: number; label: string; color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono uppercase tracking-wider transition-all",
        active ? `${color} border-current/30 font-bold` : "text-muted-foreground border-border/50 hover:border-border"
      )}
    >
      <span className="font-bold">{count}</span>
      <span>{label}</span>
    </button>
  );
}

// ── Lead Detail Panel (right side) ──

function LeadDetail({ lead, onClose }: { lead: PipelineLead; onClose: () => void }) {
  const { toast } = useToast();
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copié` });
  };
  const exp = expiresLabel(lead.expires_at);

  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      <div className="shrink-0 p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{lead.first_name || "Sans nom"}</h3>
          <p className="text-[11px] text-muted-foreground font-mono">{lead.email}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          {lead.is_online && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-mono uppercase bg-emerald-500/10 px-2 py-0.5 rounded">
              <Wifi className="w-3 h-3" /> Online
            </span>
          )}
          {lead.early_access_type && (
            <span className="text-[10px] font-mono uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {lead.early_access_type}
            </span>
          )}
          {exp && (
            <span className={cn("text-[10px] font-mono uppercase px-2 py-0.5 rounded",
              exp === "Expiré" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"
            )}>
              <Timer className="w-3 h-3 inline mr-1" />{exp}
            </span>
          )}
        </div>

        {/* Contact */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Contact</p>
          <button onClick={() => copy(lead.email, "Email")} className="flex items-center gap-2 text-xs hover:text-primary transition-colors w-full text-left">
            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate flex-1">{lead.email}</span>
            <Copy className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
          {lead.phone && (
            <button onClick={() => copy(lead.phone, "Tel")} className="flex items-center gap-2 text-xs hover:text-primary transition-colors w-full text-left">
              <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>{lead.phone}</span>
              <Copy className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          )}
        </div>

        {/* Pipeline timeline */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Pipeline</p>
          <div className="space-y-0">
            {[
              { done: true, label: "Formulaire soumis", date: lead.created_at, icon: FileText },
              { done: lead.status === "approuvée", label: "EA approuvé", date: lead.reviewed_at, icon: Shield },
              { done: lead.contacted, label: "Contacté", date: null, icon: PhoneForwarded },
              { done: lead.call_booked, label: "Call booké", date: null, icon: Headphones },
              { done: lead.call_done, label: "Call effectué", date: null, icon: ClipboardCheck },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                  step.done ? "border-primary bg-primary" : "border-muted-foreground/20 bg-background"
                )}>
                  {step.done && <step.icon className="w-2.5 h-2.5 text-primary-foreground" />}
                </div>
                <div className="flex-1">
                  <span className={cn("text-xs", step.done ? "text-foreground" : "text-muted-foreground/40")}>{step.label}</span>
                </div>
                {step.date && <span className="text-[10px] text-muted-foreground font-mono">{shortDate(step.date)}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Oracle Activity */}
        {lead.user_id && (
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Activité Oracle</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold">{lead.session_count || 0}</p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Sessions</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold">{lead.execution_count || 0}</p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Trades</p>
              </div>
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="space-y-1 text-[10px] text-muted-foreground font-mono">
          <p>Soumis : {formatDate(lead.created_at)}</p>
          {lead.reviewed_at && <p>Approuvé : {formatDate(lead.reviewed_at)}</p>}
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
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);

  // ── Load ──

  // Map raw request to PipelineLead (with optional enrichment)
  const mapLead = useCallback((r: any, enrich?: { rolesMap: Record<string, any>; activityMap: Record<string, any>; sessionMap: Record<string, number>; execMap: Record<string, number> }): PipelineLead => ({
    id: r.id, first_name: r.first_name || "", email: r.email || "", phone: r.phone || "",
    status: r.status || "en_attente", created_at: r.created_at, reviewed_at: r.reviewed_at,
    user_id: r.user_id, contacted: r.contacted || false, contact_method: r.contact_method,
    form_submitted: r.form_submitted || false, call_booked: r.call_booked || false, call_done: r.call_done || false,
    is_online: enrich && r.user_id ? enrich.activityMap[r.user_id]?.is_active || false : false,
    active_tab: enrich && r.user_id ? enrich.activityMap[r.user_id]?.active_tab : null,
    session_count: enrich && r.user_id ? enrich.sessionMap[r.user_id] || 0 : 0,
    execution_count: enrich && r.user_id ? enrich.execMap[r.user_id] || 0 : 0,
    expires_at: enrich && r.user_id ? enrich.rolesMap[r.user_id]?.expires_at : null,
    early_access_type: enrich && r.user_id ? enrich.rolesMap[r.user_id]?.early_access_type : null,
  }), []);

  const loadLeads = useCallback(async () => {
    try {
      // 1. Single query — show leads INSTANTLY
      const { data: requests, error } = await supabase
        .from("early_access_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !requests) { setLoading(false); return; }

      // Render immediately with basic data (no enrichment)
      setLeads(requests.map(r => mapLead(r)));
      setLoading(false);

      // 2. Enrich in background (non-blocking, updates leads when ready)
      const userIds = requests.filter(r => r.user_id).map(r => r.user_id);
      if (userIds.length === 0) return;

      const [rolesRes, activityRes, sessionsRes, execsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, expires_at, early_access_type").in("user_id", userIds).eq("role", "early_access"),
        supabase.from("ea_activity_tracking").select("user_id, is_active, active_tab, last_heartbeat").in("user_id", userIds),
        supabase.from("user_sessions").select("user_id").in("user_id", userIds),
        supabase.from("user_executions").select("user_id").in("user_id", userIds),
      ]);

      const rolesMap: Record<string, any> = {};
      const activityMap: Record<string, any> = {};
      const sessionMap: Record<string, number> = {};
      const execMap: Record<string, number> = {};

      rolesRes.data?.forEach((r: any) => { rolesMap[r.user_id] = r; });
      activityRes.data?.forEach((a: any) => {
        const online = a.is_active && a.last_heartbeat && (Date.now() - new Date(a.last_heartbeat).getTime()) < 60000;
        activityMap[a.user_id] = { is_active: online, active_tab: a.active_tab };
      });
      sessionsRes.data?.forEach((s: any) => { sessionMap[s.user_id] = (sessionMap[s.user_id] || 0) + 1; });
      execsRes.data?.forEach((e: any) => { execMap[e.user_id] = (execMap[e.user_id] || 0) + 1; });

      // Re-render with enriched data
      setLeads(requests.map(r => mapLead(r, { rolesMap, activityMap, sessionMap, execMap })));
    } catch (err) {
      console.warn("[CRM] Load error:", err);
      setLoading(false);
    }
  }, [mapLead]);

  useEffect(() => {
    loadLeads();
    const channel = supabase.channel("crm-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "early_access_requests" }, () => loadLeads())
      .subscribe();
    const interval = setInterval(loadLeads, 30000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [loadLeads]);

  // ── Counts ──

  const counts = useMemo(() => {
    const c = { form: 0, approved: 0, contacted: 0, call: 0, done: 0 };
    leads.forEach(l => {
      c.form++;
      if (l.status === "approuvée") c.approved++;
      if (l.contacted) c.contacted++;
      if (l.call_booked) c.call++;
      if (l.call_done) c.done++;
    });
    return c;
  }, [leads]);

  // ── Filter + Sort ──

  const filtered = useMemo(() => {
    let result = [...leads];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l => l.first_name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.includes(q));
    }
    if (stageFilter !== "all") result = result.filter(l => getStage(l) === stageFilter);
    result.sort((a, b) => {
      const cmp = sortField === "name"
        ? a.first_name.localeCompare(b.first_name)
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [leads, search, stageFilter, sortField, sortAsc]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="h-full overflow-auto">

      {/* ══ TOP NAV (Cockpit | Pipeline | Conversions | Objections | Agenda) ══ */}
      <Tabs defaultValue="pipeline" className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border bg-card">
          <div className="px-6 flex items-center justify-between h-12">
            <TabsList className="bg-transparent border-none gap-1 p-0 h-auto">
              {[
                { v: "cockpit", label: "Cockpit", icon: BarChart3 },
                { v: "pipeline", label: "Pipeline", icon: Users },
                { v: "conversions", label: "Conversions", icon: Target },
                { v: "objections", label: "Objections", icon: MessageCircle },
                { v: "agenda", label: "Agenda", icon: Calendar },
              ].map(tab => (
                <TabsTrigger
                  key={tab.v}
                  value={tab.v}
                  className={cn(
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                    "rounded-lg px-3 py-1.5 text-xs font-mono uppercase tracking-wider",
                    "text-muted-foreground"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5 mr-1.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {leads.filter(l => l.is_online).length > 0 && (
                <span className="flex items-center gap-1 text-emerald-500 font-mono">
                  <Wifi className="w-3 h-3" /> {leads.filter(l => l.is_online).length} online
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ══ PIPELINE TAB ══ */}
        <TabsContent value="pipeline" className="mt-0">

          {/* Search bar */}
          <div className="shrink-0 px-6 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par nom, email ou téléphone..."
                  className="pl-9 h-9 text-sm" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filters + Counters row */}
          <div className="shrink-0 px-6 py-2.5 border-b border-border/50 flex items-center justify-between flex-wrap gap-2">
            {/* Left: filters */}
            <div className="flex items-center gap-2">
              <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as StageFilter)}>
                <SelectTrigger className="h-8 w-[160px] text-xs font-mono uppercase">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les leads</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvés</SelectItem>
                  <SelectItem value="contacted">Contactés</SelectItem>
                  <SelectItem value="call_booked">Call booké</SelectItem>
                  <SelectItem value="call_done">Call fait</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Right: counters */}
            <div className="flex items-center gap-1.5">
              <CounterBadge count={counts.form} label="FORMS" color="text-red-500" active={stageFilter === "all"} onClick={() => setStageFilter("all")} />
              <CounterBadge count={counts.call} label="CALLS" color="text-yellow-500" active={stageFilter === "call_booked"} onClick={() => setStageFilter("call_booked")} />
              <CounterBadge count={counts.approved} label="EA" color="text-blue-500" active={stageFilter === "approved"} onClick={() => setStageFilter("approved")} />
              <CounterBadge count={counts.done} label="DONE" color="text-emerald-500" active={stageFilter === "call_done"} onClick={() => setStageFilter("call_done")} />
              <span className="text-xs font-mono text-muted-foreground ml-2">
                <span className="font-bold">{leads.length}</span> TOTAL
              </span>
            </div>
          </div>

          {/* Table + Detail split */}
          <div className="flex">
            {/* Table */}
            <div className="flex-1">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider w-6"></TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => { setSortField("name"); setSortAsc(sortField === "name" ? !sortAsc : true); }}>
                      <div className="flex items-center gap-1"><Users className="w-3 h-3" /> Lead</div>
                    </TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-center">
                      <div className="flex items-center justify-center gap-1"><FileText className="w-3 h-3 text-orange-400" /> Form</div>
                    </TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-center">
                      <div className="flex items-center justify-center gap-1"><Shield className="w-3 h-3 text-blue-400" /> EA</div>
                    </TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-center">
                      <div className="flex items-center justify-center gap-1"><PhoneForwarded className="w-3 h-3 text-purple-400" /> Contact</div>
                    </TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-center">
                      <div className="flex items-center justify-center gap-1"><Headphones className="w-3 h-3 text-yellow-400" /> Call</div>
                    </TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-center">
                      <div className="flex items-center justify-center gap-1"><Send className="w-3 h-3 text-muted-foreground" /> Mail</div>
                    </TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-center">
                      <div className="flex items-center justify-center gap-1"><Unlock className="w-3 h-3 text-muted-foreground" /> Accès</div>
                    </TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-center">
                      <div className="flex items-center justify-center gap-1"><ClipboardCheck className="w-3 h-3 text-emerald-400" /> Done</div>
                    </TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => { setSortField("date"); setSortAsc(sortField === "date" ? !sortAsc : false); }}>
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-16 text-muted-foreground">
                        Aucun lead trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.slice(0, 100).map(lead => (
                      <TableRow
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={cn(
                          "cursor-pointer transition-colors border-border/30 group",
                          selectedLead?.id === lead.id ? "bg-primary/5" : "hover:bg-accent/50"
                        )}
                      >
                        {/* Online dot */}
                        <TableCell className="px-2 py-2">
                          {lead.is_online ? (
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          ) : lead.user_id ? (
                            <div className="w-2 h-2 rounded-full bg-muted-foreground/15" />
                          ) : <div className="w-2" />}
                        </TableCell>

                        {/* Lead name + email */}
                        <TableCell className="py-2">
                          <div>
                            <p className="text-sm font-medium truncate max-w-[160px]">{lead.first_name || "—"}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{lead.email}</p>
                          </div>
                        </TableCell>

                        {/* Form */}
                        <TableCell className="text-center py-2"><Check done={true} color="orange" /></TableCell>

                        {/* EA approved */}
                        <TableCell className="text-center py-2"><Check done={lead.status === "approuvée"} color="blue" /></TableCell>

                        {/* Contacted */}
                        <TableCell className="text-center py-2"><Check done={lead.contacted} color="purple" /></TableCell>

                        {/* Call booked */}
                        <TableCell className="text-center py-2"><Check done={lead.call_booked} color="yellow" /></TableCell>

                        {/* Mail (contact_method includes email) */}
                        <TableCell className="text-center py-2"><Check done={lead.contact_method === "email"} /></TableCell>

                        {/* Access (has user_id = account created) */}
                        <TableCell className="text-center py-2"><Check done={!!lead.user_id} color="blue" /></TableCell>

                        {/* Done */}
                        <TableCell className="text-center py-2"><Check done={lead.call_done} color="emerald" /></TableCell>

                        {/* Date */}
                        <TableCell className="py-2">
                          <span className="text-[11px] text-muted-foreground font-mono">{shortDate(lead.created_at)}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Detail panel */}
            {selectedLead && (
              <div className="hidden lg:block w-80 xl:w-96 shrink-0 overflow-hidden">
                <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} />
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══ COCKPIT TAB (placeholder) ══ */}
        <TabsContent value="cockpit" className="flex-1 flex items-center justify-center mt-0">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Cockpit</p>
            <p className="text-xs opacity-60">Revenue, conversions, activité — bientôt</p>
          </div>
        </TabsContent>

        {/* ══ CONVERSIONS TAB (placeholder) ══ */}
        <TabsContent value="conversions" className="flex-1 flex items-center justify-center mt-0">
          <div className="text-center text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Conversions</p>
            <p className="text-xs opacity-60">Funnel analysis, attribution — bientôt</p>
          </div>
        </TabsContent>

        {/* ══ OBJECTIONS TAB (placeholder) ══ */}
        <TabsContent value="objections" className="flex-1 flex items-center justify-center mt-0">
          <div className="text-center text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Objections</p>
            <p className="text-xs opacity-60">Notes de calls, objections fréquentes — bientôt</p>
          </div>
        </TabsContent>

        {/* ══ AGENDA TAB (placeholder) ══ */}
        <TabsContent value="agenda" className="flex-1 flex items-center justify-center mt-0">
          <div className="text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Agenda</p>
            <p className="text-xs opacity-60">Bookings Cal.com — bientôt connecté</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
