// ============================================
// Gestion Panel V2 — All-in-one product management
// Tabs: Utilisateurs, Vérifications, Suivi, Sécurité
// Own data fetching, premium UI, no dependency on AdminVerification
// Branch: crm-integration
// ============================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Clock, ClipboardList, AlertTriangle, Loader2, Shield,
  Search, ChevronDown, ChevronUp, CheckCircle, XCircle, TrendingUp,
  BarChart3, Eye, RefreshCw, UserCheck, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ──
interface GestionUser {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  status: string;
  created_at: string;
  cycles: { id: string; cycle_number: number; cycle_name: string; status: string; completed_trades: number; total_rr: number }[];
  totalTrades: number;
  totalRR: number;
  sessionCount: number;
  isOnline: boolean;
}

interface VerificationItem {
  id: string;
  user_id: string;
  userName: string;
  cycle_name: string;
  cycle_number: number;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  completedTrades: number;
  totalRR: number;
}

interface FollowupUser {
  user_id: string;
  display_name: string;
  entries: { day_number: number; contact_date: string; message_sent: boolean; call_done: boolean; is_blocked: boolean; correct_actions: boolean; notes: string | null }[];
}

interface SecurityAlert {
  id: string;
  user_id: string;
  userName: string;
  alert_type: string;
  device_info: string | null;
  resolved: boolean;
  created_at: string;
}

// ── Tabs ──
const TABS = [
  { id: "users" as const, label: "Utilisateurs", icon: Users },
  { id: "verifications" as const, label: "Verifications", icon: Clock },
  { id: "followup" as const, label: "Suivi", icon: ClipboardList },
  { id: "security" as const, label: "Securite", icon: AlertTriangle },
];
type TabId = typeof TABS[number]["id"];

// ── KPI Card ──
function KPI({ label, value, color = "primary", icon: Icon }: { label: string; value: number | string; color?: string; icon: React.ElementType }) {
  const colors: Record<string, string> = {
    primary: "text-primary bg-primary/10 border-primary/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center", colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── Main ──
export default function GestionPanel() {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabId>("users");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Data
  const [users, setUsers] = useState<GestionUser[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [followups, setFollowups] = useState<FollowupUser[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // ── Load all data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Profiles + roles + sessions + activity
      const [profilesRes, cyclesRes, userCyclesRes, executionsRes, sessionsRes, activityRes, vrsRes, followupsRes, alertsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, first_name, status, created_at"),
        supabase.from("cycles").select("id, cycle_number, name").order("cycle_number"),
        supabase.from("user_cycles").select("id, user_id, cycle_id, status, completed_trades, total_rr"),
        supabase.from("user_executions").select("user_id"),
        supabase.from("user_sessions").select("user_id"),
        supabase.from("ea_activity_tracking").select("user_id, last_heartbeat"),
        supabase.from("verification_requests").select("*").order("requested_at", { ascending: false }),
        supabase.from("user_followups").select("*").order("day_number"),
        supabase.from("security_alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }),
      ]);

      const profiles = profilesRes.data || [];
      const cycles = cyclesRes.data || [];
      const userCycles = userCyclesRes.data || [];
      const executions = executionsRes.data || [];
      const sessions = sessionsRes.data || [];
      const activity = activityRes.data || [];
      const vrs = vrsRes.data || [];
      const fus = followupsRes.data || [];
      const als = alertsRes.data || [];

      const cycleMap = Object.fromEntries(cycles.map(c => [c.id, c]));
      const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));

      // Session counts
      const sessionCounts: Record<string, number> = {};
      sessions.forEach(s => { sessionCounts[s.user_id] = (sessionCounts[s.user_id] || 0) + 1; });

      // Execution counts
      const execCounts: Record<string, number> = {};
      executions.forEach(e => { execCounts[e.user_id] = (execCounts[e.user_id] || 0) + 1; });

      // Online map
      const onlineMap: Record<string, boolean> = {};
      activity.forEach(a => {
        onlineMap[a.user_id] = !!(a.last_heartbeat && (Date.now() - new Date(a.last_heartbeat).getTime()) < 60000);
      });

      // ── Build users ──
      const usersData: GestionUser[] = profiles
        .filter(p => p.status === "active")
        .map(p => {
          const ucs = userCycles.filter(uc => uc.user_id === p.user_id);
          return {
            user_id: p.user_id,
            display_name: p.display_name,
            first_name: p.first_name,
            status: p.status,
            created_at: p.created_at,
            cycles: ucs.map(uc => {
              const c = cycleMap[uc.cycle_id];
              return {
                id: uc.id,
                cycle_number: c?.cycle_number || 0,
                cycle_name: c?.name || "?",
                status: uc.status,
                completed_trades: uc.completed_trades || 0,
                total_rr: uc.total_rr || 0,
              };
            }).sort((a, b) => a.cycle_number - b.cycle_number),
            totalTrades: execCounts[p.user_id] || 0,
            totalRR: ucs.reduce((sum, uc) => sum + (uc.total_rr || 0), 0),
            sessionCount: sessionCounts[p.user_id] || 0,
            isOnline: onlineMap[p.user_id] || false,
          };
        })
        .sort((a, b) => b.totalTrades - a.totalTrades);

      setUsers(usersData);

      // ── Build verifications ──
      const vrsData: VerificationItem[] = vrs.map(vr => {
        const p = profileMap[vr.user_id];
        const uc = userCycles.find(u => u.id === vr.user_cycle_id);
        const c = uc ? cycleMap[uc.cycle_id] : null;
        return {
          id: vr.id,
          user_id: vr.user_id,
          userName: p?.display_name || p?.first_name || "?",
          cycle_name: c?.name || "?",
          cycle_number: c?.cycle_number || 0,
          status: vr.status,
          requested_at: vr.requested_at,
          reviewed_at: vr.reviewed_at,
          completedTrades: uc?.completed_trades || 0,
          totalRR: uc?.total_rr || 0,
        };
      });
      setVerifications(vrsData);

      // ── Build followups ──
      const fuMap: Record<string, FollowupUser> = {};
      fus.forEach(f => {
        if (!fuMap[f.user_id]) {
          const p = profileMap[f.user_id];
          fuMap[f.user_id] = { user_id: f.user_id, display_name: p?.display_name || p?.first_name || "?", entries: [] };
        }
        fuMap[f.user_id].entries.push({
          day_number: f.day_number,
          contact_date: f.contact_date,
          message_sent: f.message_sent || false,
          call_done: f.call_done || false,
          is_blocked: f.is_blocked || false,
          correct_actions: f.correct_actions || false,
          notes: f.notes,
        });
      });
      setFollowups(Object.values(fuMap));

      // ── Build alerts ──
      const alertsData: SecurityAlert[] = als.map(a => {
        const p = profileMap[a.user_id];
        return { ...a, userName: p?.display_name || p?.first_name || a.user_id.slice(0, 8) };
      });
      setAlerts(alertsData);

    } catch (err) {
      console.error("[Gestion] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtered data ──
  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      (u.display_name || "").toLowerCase().includes(q) ||
      (u.first_name || "").toLowerCase().includes(q) ||
      u.user_id.includes(q)
    );
  }, [users, search]);

  const filteredVerifications = useMemo(() => {
    if (!search) return verifications;
    const q = search.toLowerCase();
    return verifications.filter(v => v.userName.toLowerCase().includes(q) || v.cycle_name.toLowerCase().includes(q));
  }, [verifications, search]);

  // ── KPI values ──
  const kpis = useMemo(() => ({
    totalUsers: users.length,
    online: users.filter(u => u.isOnline).length,
    pendingVerif: verifications.filter(v => v.status === "pending").length,
    unresolvedAlerts: alerts.length,
    totalTrades: users.reduce((s, u) => s + u.totalTrades, 0),
    avgRR: users.length > 0 ? +(users.reduce((s, u) => s + u.totalRR, 0) / users.length).toFixed(1) : 0,
  }), [users, verifications, alerts]);

  // ── Resolve alert ──
  const resolveAlert = async (alertId: string, userId: string, unfreeze: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("security_alerts").update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", alertId);
    if (unfreeze) {
      await supabase.from("profiles").update({ status: "active", frozen_at: null, frozen_by: null, status_reason: null }).eq("user_id", userId);
      await supabase.from("user_sessions").delete().eq("user_id", userId);
    }
    toast({ title: "Alerte resolue" });
    loadData();
  };

  // ── Cycle status badge ──
  const cycleBadge = (status: string) => {
    const cfg: Record<string, { cls: string; label: string }> = {
      validated: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", label: "Valide" },
      in_progress: { cls: "bg-blue-500/15 text-blue-400 border-blue-500/25", label: "En cours" },
      pending_review: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/25", label: "A verifier" },
      rejected: { cls: "bg-red-500/15 text-red-400 border-red-500/25", label: "Rejete" },
      locked: { cls: "bg-white/5 text-white/30 border-white/10", label: "Verrouille" },
    };
    const c = cfg[status] || cfg.locked;
    return <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-mono uppercase border", c.cls)}>{c.label}</span>;
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Header + KPIs ── */}
      <div className="shrink-0 border-b border-border px-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Gestion Produit</h2>
              <p className="text-xs text-muted-foreground">Pilotage utilisateurs, cycles, suivi, securite</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={loadData} className="text-muted-foreground">
            <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-6 gap-3">
          <KPI label="Utilisateurs" value={kpis.totalUsers} icon={Users} color="primary" />
          <KPI label="En ligne" value={kpis.online} icon={TrendingUp} color="emerald" />
          <KPI label="A verifier" value={kpis.pendingVerif} icon={Clock} color="amber" />
          <KPI label="Alertes" value={kpis.unresolvedAlerts} icon={AlertTriangle} color="red" />
          <KPI label="Trades total" value={kpis.totalTrades} icon={BarChart3} color="blue" />
          <KPI label="RR moyen" value={kpis.avgRR} icon={TrendingUp} color="violet" />
        </div>

        {/* Tabs + Search */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  tab === t.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.id === "verifications" && kpis.pendingVerif > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-mono">{kpis.pendingVerif}</span>
                )}
                {t.id === "security" && kpis.unresolvedAlerts > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-mono">{kpis.unresolvedAlerts}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-6">

        {/* ── UTILISATEURS ── */}
        {tab === "users" && (
          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Aucun utilisateur actif</p>
              </div>
            ) : filteredUsers.map(u => (
              <div key={u.user_id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-accent/50 transition-colors"
                >
                  {/* Avatar */}
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0",
                    u.isOnline ? "bg-emerald-500" : u.totalTrades > 0 ? "bg-blue-500" : "bg-muted-foreground/30"
                  )}>
                    {(u.display_name || u.first_name || "?")[0]?.toUpperCase()}
                  </div>

                  {/* Name + status */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{u.display_name || u.first_name || "Sans nom"}</span>
                      {u.isOnline && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{u.cycles.filter(c => c.status === "validated").length}/{u.cycles.length} cycles</span>
                      <span>{u.totalTrades} trades</span>
                      <span>RR: {u.totalRR.toFixed(1)}</span>
                      <span>{u.sessionCount} sessions</span>
                    </div>
                  </div>

                  {/* Cycle badges */}
                  <div className="flex gap-1 shrink-0">
                    {u.cycles.slice(0, 4).map(c => cycleBadge(c.status))}
                  </div>

                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expandedUser === u.user_id && "rotate-180")} />
                </button>

                {/* Expanded details */}
                {expandedUser === u.user_id && (
                  <div className="px-5 pb-4 pt-1 border-t border-border space-y-3">
                    {u.cycles.map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{c.cycle_name}</span>
                            {cycleBadge(c.status)}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {c.completed_trades}/20 trades | RR: {c.total_rr.toFixed(1)}
                          </p>
                        </div>
                        {/* Progress bar */}
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all",
                              c.status === "validated" ? "bg-emerald-400" :
                              c.status === "rejected" ? "bg-red-400" :
                              c.status === "pending_review" ? "bg-amber-400" : "bg-blue-400"
                            )}
                            style={{ width: `${(c.completed_trades / 20) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {u.cycles.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">Aucun cycle commence</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── VERIFICATIONS ── */}
        {tab === "verifications" && (
          <div className="space-y-3">
            {/* Pending first */}
            {filteredVerifications.filter(v => v.status === "pending").length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> En attente de review ({filteredVerifications.filter(v => v.status === "pending").length})
                </h3>
                {filteredVerifications.filter(v => v.status === "pending").map(v => (
                  <div key={v.id} className="bg-card border border-amber-500/20 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                      <span className="text-sm font-bold text-amber-400">{v.userName[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{v.userName}</p>
                      <p className="text-[11px] text-muted-foreground">{v.cycle_name} — {v.completedTrades} trades, RR: {v.totalRR.toFixed(1)}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{fmtDate(v.requested_at)}</span>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => toast({ title: "Ouvrir dans Verif. Admin pour review detaillee" })}>
                      <Eye className="w-3 h-3 mr-1" /> Review
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Processed */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Historique</h3>
              {filteredVerifications.filter(v => v.status !== "pending").map(v => (
                <div key={v.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center",
                    v.status === "approved" ? "bg-emerald-500/15" : "bg-red-500/15"
                  )}>
                    {v.status === "approved"
                      ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                      : <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{v.userName} — {v.cycle_name}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">{v.reviewed_at ? fmtDate(v.reviewed_at) : ""}</span>
                  {cycleBadge(v.status === "approved" ? "validated" : "rejected")}
                </div>
              ))}
              {filteredVerifications.filter(v => v.status !== "pending").length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun historique</p>
              )}
            </div>
          </div>
        )}

        {/* ── SUIVI ── */}
        {tab === "followup" && (
          <div className="space-y-3">
            {followups.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Aucun suivi en cours</p>
              </div>
            ) : followups.map(fu => (
              <div key={fu.user_id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-3 border-b border-border">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">{fu.display_name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">{fu.entries.length} jours de suivi</span>
                </div>
                <div className="p-4 grid grid-cols-7 gap-2">
                  {fu.entries.sort((a, b) => a.day_number - b.day_number).map(e => (
                    <div key={e.day_number} className={cn(
                      "rounded-lg p-2 text-center text-[10px] border",
                      e.is_blocked ? "bg-red-500/10 border-red-500/20" :
                      e.correct_actions && e.message_sent ? "bg-emerald-500/10 border-emerald-500/20" :
                      "bg-accent/30 border-border"
                    )}>
                      <p className="font-bold text-xs">J{e.day_number}</p>
                      <div className="flex justify-center gap-1 mt-1">
                        {e.message_sent && <span title="Message envoye">💬</span>}
                        {e.call_done && <span title="Call fait">📞</span>}
                        {e.is_blocked && <span title="Bloque">🚫</span>}
                        {e.correct_actions && <span title="Actions correctes">✅</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SECURITE ── */}
        {tab === "security" && (
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400/30" />
                <p className="text-muted-foreground">Aucune alerte en cours</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Tout est normal</p>
              </div>
            ) : alerts.map(a => (
              <div key={a.id} className="bg-card border border-red-500/20 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{a.userName}</p>
                  <p className="text-[11px] text-muted-foreground">{a.alert_type.replace(/_/g, " ")}</p>
                  {a.device_info && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{a.device_info}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{fmtDate(a.created_at)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolveAlert(a.id, a.user_id, false)} className="text-xs">
                    Resoudre
                  </Button>
                  <Button size="sm" onClick={() => resolveAlert(a.id, a.user_id, true)} className="text-xs bg-emerald-600 hover:bg-emerald-700">
                    Resoudre + Degeler
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
