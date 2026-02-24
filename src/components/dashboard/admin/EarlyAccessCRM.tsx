import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, User, Phone, Mail, Clock, LogIn, Activity, Database, Circle,
  CalendarDays, Hash, KeyRound, Send, MousePointerClick, Monitor, Search,
  Filter, X, CheckSquare, MessageCircle, PhoneCall, FileText, Eye,
  ArrowUpDown, Timer,
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

export const EarlyAccessCRM = () => {
  const [members, setMembers] = useState<EACrmMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<EACrmMember | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(false); // false = newest first
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    connection: "all",
    type: "all",
    status: "all",
    expiration: "all",
  });
  const { toast } = useToast();
  const selectedMemberRef = useRef<EACrmMember | null>(null);

  // Keep ref in sync
  useEffect(() => {
    selectedMemberRef.current = selectedMember;
  }, [selectedMember]);

  const fetchCrmData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    const { data: approvedRequests } = await supabase
      .from("early_access_requests" as any)
      .select("*")
      .eq("status", "approuvée")
      .order("created_at", { ascending: false });

    if (!approvedRequests || approvedRequests.length === 0) {
      setMembers([]);
      if (!isRefresh) setLoading(false);
      return;
    }

    const [{ data: eaRoles }, { data: profiles }, { data: sessions }, { data: executions }, { data: activityTracking }] = await Promise.all([
      supabase.from("user_roles").select("user_id, early_access_type, expires_at" as any).eq("role", "early_access"),
      supabase.from("profiles").select("user_id, display_name, first_name"),
      supabase.from("user_sessions").select("user_id, created_at, updated_at"),
      supabase.from("user_executions").select("user_id"),
      supabase.from("ea_activity_tracking" as any).select("*"),
    ]);

    const membersList: EACrmMember[] = [];

    for (const req of approvedRequests as any[]) {
      let matchedUserId: string | null = null;
      let matchedProfile: any = null;

      for (const r of (eaRoles as any[]) || []) {
        const profile = (profiles as any[])?.find((p: any) => p.user_id === r.user_id);
        if (profile) {
          const profileName = (profile.first_name || profile.display_name || "").toLowerCase().trim();
          const reqName = (req.first_name || "").toLowerCase().trim();
          if (profileName === reqName) {
            matchedUserId = r.user_id;
            matchedProfile = profile;
            break;
          }
        }
      }

      if (!matchedUserId) {
        for (const r of (eaRoles as any[]) || []) {
          if (!membersList.some((m) => m.user_id === r.user_id)) {
            matchedUserId = r.user_id;
            matchedProfile = (profiles as any[])?.find((p: any) => p.user_id === r.user_id);
            break;
          }
        }
      }

      const userRole = (eaRoles as any[])?.find((r: any) => r.user_id === matchedUserId);
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
        user_id: matchedUserId || req.id,
        request_id: req.id,
        first_name: req.first_name,
        email: req.email,
        phone: req.phone,
        display_name: matchedProfile?.display_name || null,
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

    // Update selected member if popup is open (preserve popup state)
    const currentSelected = selectedMemberRef.current;
    if (currentSelected) {
      const updated = membersList.find(m => m.request_id === currentSelected.request_id);
      if (updated) {
        setSelectedMember(updated);
      }
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

    setMembers(prev => prev.map(m =>
      m.request_id === requestId ? { ...m, [field]: value } : m
    ));
    if (selectedMember?.request_id === requestId) {
      setSelectedMember(prev => prev ? { ...prev, [field]: value } : null);
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

    // Sort by date
    list = [...list].sort((a, b) => {
      const dateA = new Date(a.request_created_at).getTime();
      const dateB = new Date(b.request_created_at).getTime();
      return sortAsc ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [members, searchQuery, filters, sortAsc]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          CRM Early Access ({members.length})
        </h3>
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
                    <Checkbox
                      checked={m.contacted}
                      onCheckedChange={(v) => updateRequestField(m.request_id, "contacted", !!v)}
                      className="mx-auto"
                    />
                  </td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={m.form_submitted}
                      onCheckedChange={(v) => updateRequestField(m.request_id, "form_submitted", !!v)}
                      className="mx-auto"
                    />
                  </td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={m.call_booked}
                      onCheckedChange={(v) => updateRequestField(m.request_id, "call_booked", !!v)}
                      className="mx-auto"
                    />
                  </td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={m.call_done}
                      onCheckedChange={(v) => updateRequestField(m.request_id, "call_done", !!v)}
                      className="mx-auto"
                    />
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

      {/* Profile Detail Popup */}
      {selectedMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMember(null)}>
          <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="h-1 bg-gradient-to-r from-primary via-amber-500 to-primary" />
            
            {/* Header */}
            <div className="p-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <Circle className={cn("w-3 h-3 absolute -bottom-0.5 -right-0.5", selectedMember.is_online ? "text-emerald-500 fill-emerald-500" : "text-muted-foreground/40 fill-muted-foreground/20")} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{selectedMember.first_name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full", selectedMember.early_access_type === "precall" ? "bg-amber-500/20 text-amber-500" : "bg-emerald-500/20 text-emerald-500")}>
                      {selectedMember.early_access_type === "precall" ? "Pré-call" : "Post-call"}
                    </span>
                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-full", selectedMember.is_online ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground")}>
                      {selectedMember.is_online ? "● En ligne" : "○ Hors ligne"}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedMember(null)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Coordonnées */}
              <Section title="Coordonnées" icon={<Mail className="w-3.5 h-3.5" />}>
                <Info icon={<Mail className="w-3 h-3" />} label="Email" value={selectedMember.email} />
                <Info icon={<Phone className="w-3 h-3" />} label="Téléphone" value={selectedMember.phone} />
              </Section>

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
