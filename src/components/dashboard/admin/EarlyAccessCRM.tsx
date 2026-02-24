import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, User, Phone, Mail, Clock, LogIn, Activity, Database, Circle,
  CalendarDays, Hash, KeyRound, Send, MousePointerClick, Monitor, Search,
  Filter, X, CheckSquare, MessageCircle, PhoneCall, FileText, Eye,
  ArrowUpDown, Timer, Copy, Users, Wifi, WifiOff, UserX,
  CheckCircle2, PhoneForwarded, CreditCard, ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EALeadNotes } from "./EALeadNotes";

const TAB_LABELS: Record<string, string> = {
  execution: "Exécution d'Oracle",
  setup: "Setup",
  "data-analysis": "Data Analysis",
  videos: "Vidéo Setup",
  successes: "Chat",
  results: "Résultats",
};

const CONTACT_METHODS = [
  { value: "opt_in_call", label: "Opt-in Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
];

export interface EACrmMember {
  user_id: string;
  request_id: string;
  first_name: string;
  email: string;
  phone: string;
  display_name: string | null;
  early_access_type: string | null;
  expires_at: string | null;
  request_created_at: string;
  approved_at: string | null;
  session_count: number;
  first_login: string | null;
  last_login: string | null;
  execution_count: number;
  is_online: boolean;
  active_tab: string | null;
  button_clicks: Record<string, number>;
  contacted: boolean;
  contact_method: string | null;
  form_submitted: boolean;
  call_booked: boolean;
  call_done: boolean;
}

type FilterKey = "connection" | "type" | "status" | "expiration";
type DashboardFilter = "all" | "online" | "offline" | "never" | "contacted";

// ── Live countdown for a single member ──
const LiveTimer = ({ expiresAt }: { expiresAt: string | null }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!expiresAt) return <span className="text-muted-foreground">—</span>;

  const end = new Date(expiresAt).getTime();
  const diff = end - now;

  if (diff <= 0) {
    return <span className="text-destructive font-mono text-[10px]">EXPIRÉ</span>;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <span className={cn("font-mono text-[10px] font-bold", diff < 3600_000 ? "text-destructive" : "text-amber-500")}>
      {days > 0 && `${days}j `}{pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
};

// ── Copy button ──
const CopyBtn = ({ text }: { text: string }) => {
  const { toast } = useToast();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        toast({ title: "Copié !" });
      }}
      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      <Copy className="w-3 h-3" />
    </button>
  );
};

// ── Pipeline Step ──
const PipelineStep = ({ label, done, date, isLast }: { label: string; done: boolean; date?: string | null; isLast?: boolean }) => (
  <div className="flex flex-col items-center flex-1 relative">
    <div className={cn(
      "w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors z-10",
      done
        ? "bg-amber-500/20 border-amber-500 text-amber-500"
        : "bg-muted/50 border-border text-muted-foreground"
    )}>
      <CheckCircle2 className="w-4 h-4" />
    </div>
    <span className={cn("text-[9px] font-mono mt-1 text-center", done ? "text-foreground font-semibold" : "text-muted-foreground")}>{label}</span>
    {done && date && (
      <span className="text-[8px] font-mono text-amber-500">{new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} {new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
    )}
    {!isLast && (
      <div className={cn("absolute top-4 left-[calc(50%+16px)] w-[calc(100%-32px)] h-0.5", done ? "bg-amber-500/50" : "bg-border")} />
    )}
  </div>
);

// ── Dashboard Stats ──
const DashboardStats = ({
  members,
  activeDashFilter,
  onFilterChange,
}: {
  members: EACrmMember[];
  activeDashFilter: DashboardFilter;
  onFilterChange: (f: DashboardFilter) => void;
}) => {
  const online = members.filter(m => m.is_online);
  const offline = members.filter(m => !m.is_online && m.session_count > 0);
  const never = members.filter(m => m.session_count === 0);
  const contacted = members.filter(m => m.contacted);
  const todayApproved = members.filter(m => {
    if (!m.approved_at) return false;
    const d = new Date(m.approved_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const cards: { key: DashboardFilter; label: string; count: number; icon: React.ReactNode; color: string; activeColor: string }[] = [
    { key: "all", label: "Pipeline", count: members.length, icon: <Users className="w-4 h-4" />, color: "text-primary", activeColor: "border-primary bg-primary/5" },
    { key: "online", label: "En ligne", count: online.length, icon: <Wifi className="w-4 h-4" />, color: "text-emerald-500", activeColor: "border-emerald-500 bg-emerald-500/5" },
    { key: "offline", label: "Hors ligne", count: offline.length, icon: <WifiOff className="w-4 h-4" />, color: "text-muted-foreground", activeColor: "border-muted-foreground bg-muted/10" },
    { key: "never", label: "Jamais connecté", count: never.length, icon: <UserX className="w-4 h-4" />, color: "text-destructive", activeColor: "border-destructive bg-destructive/5" },
    { key: "contacted", label: "Contactés", count: contacted.length, icon: <PhoneForwarded className="w-4 h-4" />, color: "text-blue-500", activeColor: "border-blue-500 bg-blue-500/5" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <button
            key={c.key}
            onClick={() => onFilterChange(activeDashFilter === c.key ? "all" : c.key)}
            className={cn(
              "border rounded-lg p-3 text-left transition-all",
              activeDashFilter === c.key ? c.activeColor + " border-2" : "border-border bg-card hover:bg-muted/30"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={c.color}>{c.icon}</span>
              <span className="text-[10px] font-mono uppercase text-muted-foreground">{c.label}</span>
            </div>
            <p className={cn("text-2xl font-bold", c.color)}>{c.count}</p>
          </button>
        ))}
      </div>

      {/* Today's entries */}
      {todayApproved.length > 0 && (
        <div className="border border-border rounded-lg p-3 bg-card">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Acceptés aujourd'hui ({todayApproved.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {todayApproved.map(m => (
              <span key={m.user_id} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {m.first_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const EarlyAccessCRM = () => {
  const [members, setMembers] = useState<EACrmMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<EACrmMember | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [dashFilter, setDashFilter] = useState<DashboardFilter>("all");
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    connection: "all",
    type: "all",
    status: "all",
    expiration: "all",
  });
  const { toast } = useToast();
  const selectedMemberRef = useRef<EACrmMember | null>(null);

  useEffect(() => {
    selectedMemberRef.current = selectedMember;
  }, [selectedMember]);

  const fetchCrmData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    const [{ data: approvedRequests }, { data: eaRoles }, { data: profiles }, { data: sessions }, { data: executions }, { data: activityTracking }] = await Promise.all([
      supabase.from("early_access_requests" as any).select("*").eq("status", "approuvée").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, early_access_type, expires_at" as any).eq("role", "early_access"),
      supabase.from("profiles").select("user_id, display_name, first_name"),
      supabase.from("user_sessions").select("user_id, created_at, updated_at"),
      supabase.from("user_executions").select("user_id"),
      supabase.from("ea_activity_tracking" as any).select("*"),
    ]);

    if (!approvedRequests || approvedRequests.length === 0) {
      setMembers([]);
      if (!isRefresh) setLoading(false);
      return;
    }

    // Build maps for fast lookup
    const eaRolesByUserId = new Map<string, any>();
    for (const r of (eaRoles as any[] || [])) {
      eaRolesByUserId.set(r.user_id, r);
    }

    // Build email -> user_id map from auth profiles + ea roles
    const emailToUserId = new Map<string, string>();
    for (const p of (profiles as any[] || [])) {
      // We only care about users who currently have the early_access role
      if (eaRolesByUserId.has(p.user_id)) {
        // Try to find email from requests themselves
        const matchingReq = (approvedRequests as any[]).find(
          (r: any) => {
            const profileName = (p.first_name || p.display_name || "").toLowerCase().trim();
            const reqName = (r.first_name || "").toLowerCase().trim();
            return profileName === reqName;
          }
        );
        if (matchingReq) {
          emailToUserId.set(matchingReq.email.toLowerCase().trim(), p.user_id);
        }
      }
    }

    // Deduplicate: keep only 1 request per email (the most recent approved one)
    const seenEmails = new Set<string>();
    const seenUserIds = new Set<string>();
    const membersList: EACrmMember[] = [];

    for (const req of approvedRequests as any[]) {
      const emailKey = (req.email || "").toLowerCase().trim();
      if (seenEmails.has(emailKey)) continue;
      seenEmails.add(emailKey);

      // Try to match to a user with early_access role
      let matchedUserId = emailToUserId.get(emailKey) || null;

      // If no match by email-name, try unmatched EA roles
      if (!matchedUserId) {
        for (const [uid] of eaRolesByUserId) {
          if (!seenUserIds.has(uid) && !Array.from(emailToUserId.values()).includes(uid)) {
            const profile = (profiles as any[])?.find((p: any) => p.user_id === uid);
            const profileName = (profile?.first_name || profile?.display_name || "").toLowerCase().trim();
            const reqName = (req.first_name || "").toLowerCase().trim();
            if (profileName === reqName) {
              matchedUserId = uid;
              break;
            }
          }
        }
      }

      // CRITICAL: Only include members who STILL have the early_access role
      if (matchedUserId && !eaRolesByUserId.has(matchedUserId)) continue;
      if (matchedUserId) {
        if (seenUserIds.has(matchedUserId)) continue;
        seenUserIds.add(matchedUserId);
      } else {
        // No matching user with EA role -> skip (user lost EA or was never matched)
        continue;
      }

      const userRole = eaRolesByUserId.get(matchedUserId);
      const userSessions = (sessions as any[])?.filter((s: any) => s.user_id === matchedUserId) || [];
      const userExecCount = (executions as any[])?.filter((e: any) => e.user_id === matchedUserId).length || 0;
      const userActivity = (activityTracking as any[])?.find((a: any) => a.user_id === matchedUserId);
      const lastHeartbeat = userActivity?.last_heartbeat ? new Date(userActivity.last_heartbeat).getTime() : 0;
      const isOnline = lastHeartbeat > Date.now() - 60_000;

      const firstLogin = userSessions.length > 0
        ? new Date(Math.min(...userSessions.map((s: any) => new Date(s.created_at).getTime()))).toISOString()
        : null;
      const lastLogin = userSessions.length > 0
        ? new Date(Math.max(...userSessions.map((s: any) => new Date(s.updated_at).getTime()))).toISOString()
        : null;

      membersList.push({
        user_id: matchedUserId,
        request_id: req.id,
        first_name: req.first_name,
        email: req.email,
        phone: req.phone,
        display_name: (profiles as any[])?.find((p: any) => p.user_id === matchedUserId)?.display_name || null,
        early_access_type: userRole?.early_access_type || "precall",
        expires_at: userRole?.expires_at || null,
        request_created_at: req.created_at,
        approved_at: req.reviewed_at,
        session_count: userSessions.length,
        first_login: firstLogin,
        last_login: lastLogin,
        execution_count: userExecCount,
        is_online: isOnline,
        active_tab: isOnline ? (userActivity?.active_tab || null) : null,
        button_clicks: userActivity?.button_clicks || {},
        contacted: req.contacted || false,
        contact_method: req.contact_method || null,
        form_submitted: req.form_submitted || false,
        call_booked: req.call_booked || false,
        call_done: req.call_done || false,
      });
    }

    setMembers(membersList);

    const currentSelected = selectedMemberRef.current;
    if (currentSelected) {
      const updated = membersList.find(m => m.request_id === currentSelected.request_id);
      if (updated) setSelectedMember(updated);
      else setSelectedMember(null);
    }

    if (!isRefresh) setLoading(false);
  }, []);

  useEffect(() => {
    fetchCrmData(false);
    const interval = setInterval(() => fetchCrmData(true), 15000);
    return () => clearInterval(interval);
  }, [fetchCrmData]);

  const updateRequestField = async (requestId: string, field: string, value: any) => {
    await supabase
      .from("early_access_requests" as any)
      .update({ [field]: value } as any)
      .eq("id", requestId);

    // Auto-transition: if call_done is checked, switch to postcall
    if (field === "call_done" && value === true) {
      const member = members.find(m => m.request_id === requestId);
      if (member && member.early_access_type === "precall") {
        await supabase.from("user_roles")
          .update({ early_access_type: "postcall" } as any)
          .eq("user_id", member.user_id)
          .eq("role", "early_access" as any);
      }
    }

    setMembers(prev => prev.map(m =>
      m.request_id === requestId ? {
        ...m,
        [field]: value,
        ...(field === "call_done" && value === true ? { early_access_type: "postcall" } : {}),
      } : m
    ));
    if (selectedMember?.request_id === requestId) {
      setSelectedMember(prev => prev ? {
        ...prev,
        [field]: value,
        ...(field === "call_done" && value === true ? { early_access_type: "postcall" } : {}),
      } : null);
    }
  };

  const handleResetPassword = async (member: EACrmMember) => {
    setResetting(member.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("approve-early-access", {
        body: { action: "reset_password", userId: member.user_id },
      });
      if (error) throw error;
      toast({ title: "Mot de passe réinitialisé", description: data?.message });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setResetting(null);
  };

  const handleResendLink = async (member: EACrmMember) => {
    setResending(member.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("approve-early-access", {
        body: { action: "resend_magic_link", email: member.email },
      });
      if (error) throw error;
      if (data?.magic_link) {
        await navigator.clipboard.writeText(data.magic_link);
        toast({ title: "Lien copié", description: "Lien copié dans le presse-papier." });
      } else {
        toast({ title: "Email envoyé", description: data?.message });
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setResending(null);
  };

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  const filtered = useMemo(() => {
    let list = members;

    // Dashboard filter (from stat cards)
    if (dashFilter === "online") list = list.filter(m => m.is_online);
    else if (dashFilter === "offline") list = list.filter(m => !m.is_online && m.session_count > 0);
    else if (dashFilter === "never") list = list.filter(m => m.session_count === 0);
    else if (dashFilter === "contacted") list = list.filter(m => m.contacted);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => m.first_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.phone.includes(q));
    }
    if (filters.connection !== "all") {
      if (filters.connection === "never") list = list.filter(m => m.session_count === 0);
      if (filters.connection === "connected") list = list.filter(m => m.session_count > 0);
    }
    if (filters.type !== "all") {
      list = list.filter(m => m.early_access_type === filters.type);
    }
    if (filters.status !== "all") {
      if (filters.status === "online") list = list.filter(m => m.is_online);
      if (filters.status === "offline") list = list.filter(m => !m.is_online);
    }
    if (filters.expiration !== "all") {
      const now = Date.now();
      if (filters.expiration === "expired") list = list.filter(m => m.expires_at && new Date(m.expires_at).getTime() <= now);
      if (filters.expiration === "active") list = list.filter(m => !m.expires_at || new Date(m.expires_at).getTime() > now);
    }

    list = [...list].sort((a, b) => {
      const dateA = new Date(a.request_created_at).getTime();
      const dateB = new Date(b.request_created_at).getTime();
      return sortAsc ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [members, searchQuery, filters, sortAsc, dashFilter]);

  // ── Helpers for pipeline ──
  const getConnectionStatus = (m: EACrmMember) => {
    if (m.is_online) return "online";
    if (m.session_count === 0) return "never";
    return "offline";
  };

  const getStatusBadge = (m: EACrmMember) => {
    const s = getConnectionStatus(m);
    if (s === "online") return { label: "En ligne", cls: "bg-emerald-500/20 text-emerald-500" };
    if (s === "never") return { label: "Jamais connecté", cls: "bg-destructive/20 text-destructive" };
    return { label: "Hors ligne", cls: "bg-muted text-muted-foreground" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ DASHBOARD ═══ */}
      <DashboardStats members={members} activeDashFilter={dashFilter} onFilterChange={setDashFilter} />

      {/* ═══ CRM HEADER ═══ */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          CRM Early Access ({filtered.length}{filtered.length !== members.length ? ` / ${members.length}` : ""})
        </h3>
        {dashFilter !== "all" && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setDashFilter("all")}>
            <X className="w-3 h-3" /> Réinitialiser filtre
          </Button>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="h-7 pl-8 text-xs"
          />
        </div>
        <select value={filters.connection} onChange={e => setFilters(p => ({ ...p, connection: e.target.value }))} className="h-7 text-[10px] rounded border border-input bg-background px-2 font-mono">
          <option value="all">Connexion: Tous</option>
          <option value="never">Jamais connecté</option>
          <option value="connected">Connecté</option>
        </select>
        <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))} className="h-7 text-[10px] rounded border border-input bg-background px-2 font-mono">
          <option value="all">Type: Tous</option>
          <option value="precall">Pré-call</option>
          <option value="postcall">Post-call</option>
        </select>
        <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className="h-7 text-[10px] rounded border border-input bg-background px-2 font-mono">
          <option value="all">Statut: Tous</option>
          <option value="online">En ligne</option>
          <option value="offline">Hors ligne</option>
        </select>
        <select value={filters.expiration} onChange={e => setFilters(p => ({ ...p, expiration: e.target.value }))} className="h-7 text-[10px] rounded border border-input bg-background px-2 font-mono">
          <option value="all">Expiration: Tous</option>
          <option value="active">Actif</option>
          <option value="expired">Expiré</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setSortAsc(p => !p)}>
                    Nom / Date
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Timer</th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Type</th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Statut</th>
                <th className="text-left px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Onglet actif</th>
                <th className="text-center px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Data</th>
                <th className="text-center px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Contacté</th>
                <th className="text-center px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Formulaire</th>
                <th className="text-center px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Call réservé</th>
                <th className="text-center px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Call fait</th>
                <th className="text-right px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Aucun membre trouvé</td></tr>
              ) : filtered.map(m => (
                <tr
                  key={m.user_id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedMember(m)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-3 h-3 text-primary" />
                        </div>
                        <Circle className={cn("w-2 h-2 absolute -bottom-0 -right-0", m.is_online ? "text-emerald-500 fill-emerald-500" : "text-muted-foreground/40 fill-muted-foreground/20")} />
                      </div>
                      <div>
                        <span className="font-medium text-foreground block">{m.first_name}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{fmtDate(m.request_created_at)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <LiveTimer expiresAt={m.expires_at} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full", m.early_access_type === "precall" ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500")}>
                      {m.early_access_type === "precall" ? "Pré" : "Post"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-full", m.is_online ? "bg-emerald-500/20 text-emerald-500" : m.session_count === 0 ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground")}>
                      {m.is_online ? "En ligne" : m.session_count === 0 ? "Jamais" : "Hors ligne"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {m.is_online && m.active_tab ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                        {TAB_LABELS[m.active_tab] || m.active_tab}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold">
                    <span className={m.execution_count > 0 ? "text-emerald-500" : "text-muted-foreground"}>{m.execution_count}</span>
                  </td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={m.contacted} onCheckedChange={(v) => updateRequestField(m.request_id, "contacted", !!v)} className="mx-auto" />
                  </td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={m.form_submitted} onCheckedChange={(v) => updateRequestField(m.request_id, "form_submitted", !!v)} className="mx-auto" />
                  </td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={m.call_booked} onCheckedChange={(v) => updateRequestField(m.request_id, "call_booked", !!v)} className="mx-auto" />
                  </td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={m.call_done} onCheckedChange={(v) => updateRequestField(m.request_id, "call_done", !!v)} className="mx-auto" />
                  </td>
                  <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setSelectedMember(m)}>
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Profile Detail Popup ═══ */}
      {selectedMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMember(null)}>
          <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="h-1 bg-gradient-to-r from-primary via-amber-500 to-primary" />
            
            {/* ── Header ── */}
            <div className="p-5 pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                      {selectedMember.first_name.charAt(0).toUpperCase()}
                    </div>
                    <Circle className={cn("w-3 h-3 absolute -bottom-0.5 -right-0.5", selectedMember.is_online ? "text-emerald-500 fill-emerald-500" : "text-muted-foreground/40 fill-muted-foreground/20")} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">{selectedMember.first_name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      <span>{selectedMember.email}</span>
                      <CopyBtn text={selectedMember.email} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{selectedMember.phone}</span>
                      <CopyBtn text={selectedMember.phone} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const badge = getStatusBadge(selectedMember);
                    return <span className={cn("text-[10px] font-mono px-2 py-1 rounded-full", badge.cls)}>{badge.label}</span>;
                  })()}
                  <button onClick={() => setSelectedMember(null)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Pipeline Timeline ── */}
            <div className="px-5 pb-3">
              <div className="flex items-start">
                <PipelineStep
                  label="Approbation"
                  done={!!selectedMember.approved_at}
                  date={selectedMember.approved_at}
                />
                <PipelineStep
                  label="Setting"
                  done={selectedMember.contacted}
                />
                <PipelineStep
                  label="Connexion"
                  done={selectedMember.session_count > 0}
                  date={selectedMember.first_login}
                />
                {/* Conditional last step */}
                {selectedMember.call_done ? (
                  <PipelineStep label="Payé" done={false} isLast />
                ) : selectedMember.call_booked ? (
                  <PipelineStep label="Call fait" done={selectedMember.call_done} isLast />
                ) : selectedMember.form_submitted ? (
                  <PipelineStep label="Call" done={selectedMember.call_booked} isLast />
                ) : (
                  <PipelineStep label="Formulaire" done={selectedMember.form_submitted} isLast />
                )}
              </div>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Chronologie */}
              <Section title="Chronologie" icon={<CalendarDays className="w-3.5 h-3.5" />}>
                <Info icon={<CalendarDays className="w-3 h-3" />} label="Soumission" value={fmt(selectedMember.request_created_at)} />
                <Info icon={<CalendarDays className="w-3 h-3" />} label="Approbation" value={fmt(selectedMember.approved_at)} />
                <Info icon={<Clock className="w-3 h-3 text-amber-500" />} label="Expiration" value={fmt(selectedMember.expires_at)} />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground"><Timer className="w-3 h-3" /></span>
                  <span className="text-muted-foreground">Temps restant :</span>
                  <LiveTimer expiresAt={selectedMember.expires_at} />
                </div>
              </Section>

              {/* Activité */}
              <Section title="Activité" icon={<Activity className="w-3.5 h-3.5" />}>
                <Info icon={<LogIn className="w-3 h-3" />} label="1ère connexion" value={fmt(selectedMember.first_login)} />
                <Info icon={<LogIn className="w-3 h-3" />} label="Dernière" value={fmt(selectedMember.last_login)} />
                <Info icon={<Hash className="w-3 h-3" />} label="Sessions" value={String(selectedMember.session_count)} />
                <Info icon={<Database className="w-3 h-3" />} label="Data récoltée" value={String(selectedMember.execution_count)} highlight={selectedMember.execution_count > 0} />
                {selectedMember.is_online && selectedMember.active_tab && (
                  <Info icon={<Monitor className="w-3 h-3" />} label="Onglet actif" value={TAB_LABELS[selectedMember.active_tab] || selectedMember.active_tab} />
                )}
              </Section>

              {/* Clics boutons */}
              <Section title="Clics boutons" icon={<MousePointerClick className="w-3.5 h-3.5" />}>
                {Object.entries(selectedMember.button_clicks).length > 0 ? (
                  Object.entries(selectedMember.button_clicks).map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-semibold text-primary">{count as number}×</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic">Aucun clic</p>
                )}
              </Section>

              {/* Contact Tracking */}
              <Section title="Suivi contact" icon={<MessageCircle className="w-3.5 h-3.5" />}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedMember.contacted} onCheckedChange={v => updateRequestField(selectedMember.request_id, "contacted", !!v)} />
                    <span className="text-xs text-foreground">Contacté</span>
                    {selectedMember.contacted && (
                      <select
                        value={selectedMember.contact_method || ""}
                        onChange={e => updateRequestField(selectedMember.request_id, "contact_method", e.target.value || null)}
                        className="h-6 text-[10px] rounded border border-input bg-background px-1.5 font-mono ml-auto"
                      >
                        <option value="">Méthode...</option>
                        {CONTACT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedMember.form_submitted} onCheckedChange={v => updateRequestField(selectedMember.request_id, "form_submitted", !!v)} />
                    <span className="text-xs text-foreground">Formulaire soumis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedMember.call_booked} onCheckedChange={v => updateRequestField(selectedMember.request_id, "call_booked", !!v)} />
                    <span className="text-xs text-foreground">Call réservé</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedMember.call_done} onCheckedChange={v => updateRequestField(selectedMember.request_id, "call_done", !!v)} />
                    <span className="text-xs text-foreground">Call effectué</span>
                  </div>
                </div>
              </Section>

              {/* Notes */}
              <EALeadNotes requestId={selectedMember.request_id} />

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1 text-[10px] h-7" onClick={() => handleResendLink(selectedMember)} disabled={resending === selectedMember.user_id}>
                  {resending === selectedMember.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Renvoyer le lien
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1 text-[10px] h-7" onClick={() => handleResetPassword(selectedMember)} disabled={resetting === selectedMember.user_id}>
                  {resetting === selectedMember.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                  Reset MDP
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold flex items-center gap-1.5">{icon}{title}</p>
    {children}
  </div>
);

const Info = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) => (
  <div className="flex items-center gap-1.5 text-xs">
    <span className="text-muted-foreground">{icon}</span>
    <span className="text-muted-foreground">{label} :</span>
    <span className={cn("text-foreground", highlight && "text-emerald-500 font-semibold")}>{value}</span>
  </div>
);
