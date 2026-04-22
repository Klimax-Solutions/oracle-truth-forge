// ============================================
// Gestion Panel V2.1 — 3 tabs, fiche user complète
// Tabs: Utilisateurs (all-in-one), Vérifications (queue + history), Alertes
// Branch: crm-integration
// ============================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Clock, AlertTriangle, Loader2, Shield,
  Search, ChevronDown, CheckCircle, XCircle, TrendingUp,
  BarChart3, RefreshCw,
  Lock, Play, ArrowUpRight, ArrowDownRight,
  MessageSquare, Save, User, Crown, ShieldCheck,
  Snowflake, Ban, UserX, Award, UserPlus, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSidebarRoles } from "../DashboardSidebar";
import { AdminUserDataViewer } from "./AdminUserDataViewer";
import { AdminTradeNotesViewer } from "./AdminTradeNotesViewer";
import { TradeNavigationLightbox, type TradeScreenshotItem } from "../TradeNavigationLightbox";

// ── Types ──

interface OracleTrade {
  id: string;
  trade_number: number;
  trade_date: string;
  entry_time: string | null;
  direction: string;
  rr: number | null;
  screenshot_m15_m5?: string | null;
  screenshot_m1?: string | null;
}

interface UserExecution {
  id: string;
  trade_number: number;
  trade_date: string;
  direction: string;
  entry_time: string | null;
  exit_time: string | null;
  exit_date: string | null;
  rr: number | null;
  result: string | null;
  setup_type: string | null;
  entry_model: string | null;
  direction_structure: string | null;
  entry_timing: string | null;
  entry_timeframe: string | null;
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  notes: string | null;
  screenshot_url: string | null;
  screenshot_entry_url: string | null;
  user_id: string;
}

interface Cycle {
  id: string;
  cycle_number: number;
  name: string;
  trade_start: number;
  trade_end: number;
  total_trades: number;
  phase: number;
}

interface UserCycleData {
  id: string;
  user_id: string;
  cycle_id: string;
  status: string;
  completed_trades: number;
  total_rr: number;
  completed_at: string | null;
  admin_feedback: string | null;
  started_at: string | null;
}

interface ExecutionComparison {
  execution: UserExecution;
  oracleTrade: OracleTrade | null;
  status: "match" | "warning" | "error" | "no-match";
  timeDiffHours: number | null;
}

interface FollowupEntry {
  day_number: number;
  contact_date: string;
  message_sent: boolean;
  call_done: boolean;
  is_blocked: boolean;
  correct_actions: boolean;
  notes: string | null;
}

interface EaInfo {
  expiresAt: string | null;    // null = timer not started
  earlyAccessType: string | null; // "precall" | "postcall"
  timerStatus: "not_started" | "active" | "expired";
  remainingLabel: string | null; // "23h restantes" or "Expiré il y a 3j"
}

interface PlatformUser {
  id: string;
  displayName: string;
  firstName: string | null;
  created_at: string;
  currentCycle: Cycle | null;
  userCycles: UserCycleData[];
  totalTrades: number;
  totalRR: number;
  userStatus: "active" | "pending" | "completed";
  profileStatus: "active" | "frozen" | "banned";
  statusReason: string | null;
  isClient: boolean;
  executions: UserExecution[];
  sessionCount: number;
  isOnline: boolean;
  roles: string[];               // all app_role values
  teamRoles: string[];            // super_admin, admin, setter
  hasEarlyAccess: boolean;        // row exists in user_roles
  eaInfo: EaInfo | null;          // null if no EA role
  isInstitute: boolean;           // has 'institute' role
  followups: FollowupEntry[];
}

interface PendingRequest {
  id: string;
  user_id: string;
  cycle_id: string;
  user_cycle_id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  admin_comments: string | null;
  assigned_to?: string | null;
  cycle: Cycle | null;
  userCycle: UserCycleData | null;
  executions: UserExecution[];
  comparisons: ExecutionComparison[];
  userName: string;
  attemptNumber: number;
}

interface ProcessedRequest {
  id: string;
  userName: string;
  cycleName: string;
  status: string;
  reviewed_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
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

// ── Tabs (3 only) ──
const TABS = [
  { id: "users" as const, label: "Utilisateurs", icon: Users },
  { id: "verifications" as const, label: "Vérifications", icon: Clock },
  { id: "alerts" as const, label: "Alertes", icon: AlertTriangle },
];
type TabId = (typeof TABS)[number]["id"];

// ── Helpers ──

function calculateStats(executions: UserExecution[]) {
  const totalRR = executions.reduce((sum, e) => sum + (e.rr || 0), 0);
  const wins = executions.filter((e) => (e.rr || 0) > 0).length;
  const winRate = executions.length > 0 ? (wins / executions.length) * 100 : 0;
  const avgRR = executions.length > 0 ? totalRR / executions.length : 0;
  return { totalRR, winRate, avgRR, wins, losses: executions.length - wins };
}

function getAccuracyPercent(comparisons: ExecutionComparison[]) {
  if (comparisons.length === 0) return 0;
  return (comparisons.filter((c) => c.status === "match").length / comparisons.length) * 100;
}

function compareExecution(exec: UserExecution, oracleTrades: OracleTrade[]): ExecutionComparison {
  const oracleTrade = oracleTrades.find((t) => t.trade_number === exec.trade_number);
  if (!oracleTrade) return { execution: exec, oracleTrade: null, status: "no-match", timeDiffHours: null };
  const userDt = new Date(`${exec.trade_date}T${exec.entry_time || "00:00"}:00`);
  const oracleDt = new Date(`${oracleTrade.trade_date}T${oracleTrade.entry_time || "00:00"}:00`);
  const diffH = Math.abs(userDt.getTime() - oracleDt.getTime()) / 3600000;
  const status = diffH <= 5 ? "match" : diffH <= 24 ? "warning" : "error";
  return { execution: exec, oracleTrade, status, timeDiffHours: diffH };
}

function getStatusIcon(status: string) {
  switch (status) {
    case "locked": return <Lock className="w-3.5 h-3.5 text-muted-foreground" />;
    case "in_progress": return <Play className="w-3.5 h-3.5 text-blue-400" />;
    case "pending_review": return <Clock className="w-3.5 h-3.5 text-orange-400" />;
    case "validated": return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    case "rejected": return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    default: return null;
  }
}

function getStatusLabel(status: string) {
  const m: Record<string, string> = { locked: "Verrouillé", in_progress: "En cours", pending_review: "En attente", validated: "Validé", rejected: "Refusé" };
  return m[status] || status;
}

function getRoleIcon(role: string) {
  switch (role) {
    case "super_admin": return <Crown className="w-3 h-3" />;
    case "admin": return <ShieldCheck className="w-3 h-3" />;
    case "early_access": return <Shield className="w-3 h-3" />;
    case "institute": return <Award className="w-3 h-3" />;
    case "setter": return <UserPlus className="w-3 h-3" />;
    default: return <User className="w-3 h-3" />;
  }
}

function getRoleLabel(role: string) {
  const m: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", early_access: "Early Access", institute: "Institut", setter: "Setter", member: "Membre" };
  return m[role] || role;
}

function getRoleBadgeCls(role: string) {
  switch (role) {
    case "super_admin": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
    case "admin": return "bg-violet-500/10 text-violet-400 border-violet-500/30";
    case "early_access": return "bg-primary/10 text-primary border-primary/30";
    case "institute": return "bg-blue-500/10 text-blue-500 border-blue-500/30";
    case "setter": return "bg-pink-500/10 text-pink-500 border-pink-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const fmtDateLong = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Design system (matching CRM) ──
const BG = "bg-[hsl(220,15%,8%)]";
const Empty = () => <span className="text-white/[0.08] select-none">—</span>;

function IconBox({ children, color }: { children: React.ReactNode; color: string }) {
  const bg: Record<string, string> = {
    white: "bg-white/[0.06]", amber: "bg-amber-500/[0.12]", cyan: "bg-cyan-500/[0.12]",
    violet: "bg-violet-500/[0.12]", blue: "bg-primary/[0.12]", orange: "bg-orange-500/[0.12]",
    emerald: "bg-emerald-500/[0.12]", red: "bg-red-500/[0.12]", pink: "bg-pink-500/[0.12]",
  };
  return <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", bg[color] || bg.white)}>{children}</div>;
}

function KpiPill({ value, label, color }: { value: number | string; label: string; color: string }) {
  const styles: Record<string, string> = {
    primary: "bg-primary/10 border-primary/20 text-primary",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    red: "bg-red-500/10 border-red-500/20 text-red-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-400",
    white: "bg-white/[0.04] border-white/[0.08] text-white",
  };
  return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border", styles[color] || styles.white)}>
      <span className="text-base font-bold tabular-nums">{value}</span>
      <span className="text-[10px] font-medium uppercase opacity-60">{label}</span>
    </div>
  );
}

// ============================================
// ── Main Component ──
// ============================================

export default function GestionPanel() {
  const { toast } = useToast();
  const { isSuperAdmin } = useSidebarRoles();
  const [tab, setTab] = useState<TabId>("users");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Data
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [oracleTrades, setOracleTrades] = useState<OracleTrade[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [processedRequests, setProcessedRequests] = useState<ProcessedRequest[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);

  // UI state
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [tradeNotes, setTradeNotes] = useState<Record<string, string>>({});
  const [tradeValidity, setTradeValidity] = useState<Record<string, boolean>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [assigningRequest, setAssigningRequest] = useState<string | null>(null);
  const [verificationAssigneeFilter, setVerificationAssigneeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [userSort, setUserSort] = useState<string>("priority");
  const [activeSubTab, setActiveSubTab] = useState<Record<string, "cycles" | "trades" | "profil">>({});

  // Gallery
  const [galleryItems, setGalleryItems] = useState<TradeScreenshotItem[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryScreen, setGalleryScreen] = useState<"m15" | "m5">("m15");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryRequestId, setGalleryRequestId] = useState<string | null>(null);

  // Data viewer + Notes viewer
  const [dataViewerUserId, setDataViewerUserId] = useState<string | null>(null);
  const [dataViewerUserName, setDataViewerUserName] = useState("");
  const [notesViewerRequestId, setNotesViewerRequestId] = useState<string | null>(null);
  const [notesViewerExecs, setNotesViewerExecs] = useState<{ id: string; trade_number: number; direction: string; trade_date: string }[]>([]);

  // Action dialog (freeze/ban/unfreeze/unban/remove)
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"freeze" | "ban" | "unfreeze" | "unban" | "remove" | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionProcessing, setActionProcessing] = useState(false);

  // ── Gallery opener ──
  const openGallery = (executions: UserExecution[], execIndex: number, screen: "m15" | "m5", requestId?: string) => {
    setGalleryItems(executions.map((e) => ({
      tradeNumber: e.trade_number, tradeDate: e.trade_date, direction: e.direction,
      directionStructure: e.direction_structure, entryTime: e.entry_time, exitTime: e.exit_time,
      rr: e.rr, setupType: e.setup_type, entryModel: e.entry_model, entryTiming: e.entry_timing,
      entryTimeframe: e.entry_timeframe, notes: e.notes,
      screenshotM15: e.screenshot_url, screenshotM5: e.screenshot_entry_url, executionId: e.id,
    })));
    setGalleryIndex(execIndex);
    setGalleryScreen(screen);
    setGalleryOpen(true);
    setGalleryRequestId(requestId || null);
  };

  // ── Data fetching ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        profilesRes, cyclesRes, userCyclesRes, executionsRes, sessionsRes, activityRes,
        rolesRes, vrsRes, allVrsRes, processedVrsRes, alertsRes, oracleRes, adminRolesRes, followupsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("cycles").select("*").order("cycle_number"),
        supabase.from("user_cycles").select("*").order("created_at"),
        supabase.from("user_executions").select("*").order("trade_number"),
        supabase.from("user_sessions").select("user_id"),
        supabase.from("ea_activity_tracking").select("user_id, last_heartbeat"),
        supabase.from("user_roles").select("user_id, role, expires_at, early_access_type"),
        supabase.from("verification_requests").select("*").eq("status", "pending").order("requested_at"),
        supabase.from("verification_requests").select("user_id, cycle_id").order("requested_at"),
        supabase.from("verification_requests").select("*").neq("status", "pending").order("reviewed_at", { ascending: false }).limit(50),
        supabase.from("security_alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }),
        supabase.from("trades").select("id, trade_number, trade_date, entry_time, direction, rr, screenshot_m15_m5, screenshot_m1").order("trade_number"),
        supabase.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
        supabase.from("user_followups").select("*").order("day_number"),
      ]);

      const profiles = (profilesRes.data || []) as any[];
      const cyclesData = (cyclesRes.data || []) as Cycle[];
      const userCycles = (userCyclesRes.data || []) as UserCycleData[];
      const allExecutions = (executionsRes.data || []) as UserExecution[];
      const sessions = sessionsRes.data || [];
      const activity = activityRes.data || [];
      const allRoles = rolesRes.data || [];
      const pendingVrs = vrsRes.data || [];
      const allVrs = allVrsRes.data || [];
      const processedVrs = processedVrsRes.data || [];
      const alertsData = alertsRes.data || [];
      const oracleData = (oracleRes.data || []) as OracleTrade[];
      const adminRoles = adminRolesRes.data || [];
      const followupsData = followupsRes.data || [];

      setCycles(cyclesData);
      setOracleTrades(oracleData);

      const profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p]));

      // Counts
      const sessionCounts: Record<string, number> = {};
      sessions.forEach((s: any) => { sessionCounts[s.user_id] = (sessionCounts[s.user_id] || 0) + 1; });
      const onlineMap: Record<string, boolean> = {};
      activity.forEach((a: any) => { onlineMap[a.user_id] = !!(a.last_heartbeat && Date.now() - new Date(a.last_heartbeat).getTime() < 60000); });

      // Roles map (with EA metadata)
      const rolesMap: Record<string, string[]> = {};
      const eaMap: Record<string, { expires_at: string | null; early_access_type: string | null }> = {};
      allRoles.forEach((r: any) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
        if (r.role === "early_access") {
          eaMap[r.user_id] = { expires_at: r.expires_at || null, early_access_type: r.early_access_type || null };
        }
      });

      // Helper to compute EA timer info
      const fmtDuration = (ms: number) => {
        const d = Math.floor(ms / 86400000);
        const h = Math.floor((ms % 86400000) / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        if (d > 0) return `${d}j ${h}h`;
        if (h > 0) return `${h}h${m > 0 ? `${m}m` : ""}`;
        return `${m}m`;
      };

      const buildEaInfo = (userId: string): EaInfo | null => {
        const ea = eaMap[userId];
        if (!ea) return null;
        if (!ea.expires_at) return { expiresAt: null, earlyAccessType: ea.early_access_type, timerStatus: "not_started", remainingLabel: "Non démarré" };
        const diffMs = new Date(ea.expires_at).getTime() - Date.now();
        if (diffMs > 0) {
          return { expiresAt: ea.expires_at, earlyAccessType: ea.early_access_type, timerStatus: "active", remainingLabel: fmtDuration(diffMs) };
        } else {
          return { expiresAt: ea.expires_at, earlyAccessType: ea.early_access_type, timerStatus: "expired", remainingLabel: `Expiré il y a ${fmtDuration(Math.abs(diffMs))}` };
        }
      };

      // Followups map
      const followupsMap: Record<string, FollowupEntry[]> = {};
      followupsData.forEach((f: any) => {
        if (!followupsMap[f.user_id]) followupsMap[f.user_id] = [];
        followupsMap[f.user_id].push({ day_number: f.day_number, contact_date: f.contact_date, message_sent: f.message_sent || false, call_done: f.call_done || false, is_blocked: f.is_blocked || false, correct_actions: f.correct_actions || false, notes: f.notes });
      });

      // Build users — source: profiles (ALL users, not just those with cycles)
      // user_cycles data is optional: new users without any cycle still appear
      const uniqueUserIds = profiles.map((p: any) => p.user_id);
      const platformUsers: PlatformUser[] = uniqueUserIds.map((userId: string) => {
        const ucs = userCycles.filter((uc) => uc.user_id === userId);
        const userExecs = allExecutions.filter((e) => e.user_id === userId) as UserExecution[];
        const profile = profileMap[userId];
        const activeCycle = ucs.find((uc) => uc.status === "in_progress" || uc.status === "pending_review");
        const currentCycleData = activeCycle ? cyclesData.find((c) => c.id === activeCycle.cycle_id) : null;
        const totalRR = userExecs.reduce((sum, e) => sum + (e.rr || 0), 0);
        const hasPending = ucs.some((uc) => uc.status === "pending_review");
        // Guard: [].every() returns true — new users with no cycles must NOT show as "completed"
        const allValidated = ucs.length > 0 && ucs.every((uc) => uc.status === "validated");
        let userStatus: "active" | "pending" | "completed" = "active";
        if (hasPending) userStatus = "pending";
        if (allValidated && ucs.length === cyclesData.length) userStatus = "completed";

        return {
          id: userId,
          displayName: profile?.display_name || profile?.first_name || `User ${userId.slice(0, 8)}`,
          firstName: profile?.first_name || null,
          created_at: profile?.created_at || ucs[0]?.started_at || new Date().toISOString(),
          currentCycle: currentCycleData || null,
          userCycles: ucs,
          totalTrades: userExecs.length,
          totalRR,
          userStatus,
          profileStatus: (profile?.status as "active" | "frozen" | "banned") || "active",
          statusReason: profile?.status_reason || null,
          isClient: profile?.is_client || false,
          executions: userExecs,
          sessionCount: sessionCounts[userId] || 0,
          isOnline: onlineMap[userId] || false,
          roles: rolesMap[userId] || [],
          teamRoles: (rolesMap[userId] || []).filter((r) => ["super_admin", "admin", "setter"].includes(r)),
          hasEarlyAccess: (rolesMap[userId] || []).includes("early_access"),
          eaInfo: buildEaInfo(userId),
          isInstitute: (rolesMap[userId] || []).includes("institute"),
          followups: (followupsMap[userId] || []).sort((a, b) => a.day_number - b.day_number),
        };
      }).sort((a, b) => {
        // Priority sort: frozen/banned first, then pending verif, then EA expiring soon, then by trades
        const priorityScore = (u: PlatformUser) => {
          if (u.profileStatus === "frozen" || u.profileStatus === "banned") return 0;
          if (u.userStatus === "pending") return 1;
          if (u.eaInfo?.timerStatus === "expired") return 2;
          if (u.eaInfo?.timerStatus === "active" && u.eaInfo.expiresAt) {
            const remaining = new Date(u.eaInfo.expiresAt).getTime() - Date.now();
            if (remaining < 12 * 3600000) return 3; // < 12h
          }
          return 10;
        };
        const pa = priorityScore(a), pb = priorityScore(b);
        if (pa !== pb) return pa - pb;
        return b.totalTrades - a.totalTrades;
      });
      setUsers(platformUsers);

      // Build pending requests
      const attemptCounts: Record<string, number> = {};
      allVrs.forEach((r: any) => { const k = `${r.user_id}_${r.cycle_id}`; attemptCounts[k] = (attemptCounts[k] || 0) + 1; });

      const enrichedRequests: PendingRequest[] = pendingVrs.map((request: any) => {
        const userCycle = userCycles.find((uc) => uc.id === request.user_cycle_id) || null;
        const cycle = cyclesData.find((c) => c.id === request.cycle_id) || null;
        const profile = profileMap[request.user_id];
        const executions = allExecutions.filter((e) => e.user_id === request.user_id && cycle && e.trade_number >= cycle.trade_start && e.trade_number <= cycle.trade_end) as UserExecution[];
        const comparisons = executions.map((exec) => compareExecution(exec, oracleData));
        return { ...request, cycle, userCycle, executions, comparisons, userName: profile?.display_name || `User ${request.user_id.slice(0, 8)}`, attemptNumber: attemptCounts[`${request.user_id}_${request.cycle_id}`] || 1 };
      });
      setRequests(enrichedRequests);

      // Build processed requests
      const processed: ProcessedRequest[] = processedVrs.map((vr: any) => {
        const p = profileMap[vr.user_id];
        const c = cyclesData.find((cy) => cy.id === vr.cycle_id);
        return { id: vr.id, userName: p?.display_name || `User ${vr.user_id.slice(0, 8)}`, cycleName: c?.name || "?", status: vr.status, reviewed_at: vr.reviewed_at || vr.requested_at };
      });
      setProcessedRequests(processed);

      // Build alerts
      setAlerts(alertsData.map((a: any) => ({ ...a, userName: profileMap[a.user_id]?.display_name || a.user_id.slice(0, 8) })));

      // Admin profiles
      const adminIds = [...new Set(adminRoles.map((r: any) => r.user_id))];
      if (adminIds.length > 0) {
        const { data } = await supabase.from("profiles").select("*").in("user_id", adminIds);
        if (data) setAdminProfiles(data as Profile[]);
      }
    } catch (err) {
      console.error("[Gestion] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Trade notes ──
  const loadTradeNotes = async (requestId: string) => {
    const { data } = await supabase.from("admin_trade_notes").select("*").eq("verification_request_id", requestId);
    if (data) {
      const notes: Record<string, string> = {};
      const validity: Record<string, boolean> = {};
      data.forEach((n: any) => { const k = `${requestId}_${n.execution_id}`; notes[k] = n.note || ""; validity[k] = n.is_valid !== false; });
      setTradeNotes((prev) => ({ ...prev, ...notes }));
      setTradeValidity((prev) => ({ ...prev, ...validity }));
    }
  };

  const saveTradeNote = async (requestId: string, executionId: string, note: string, isValid: boolean, supplementaryNote?: string) => {
    const key = `${requestId}_${executionId}`;
    setSavingNote(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const d: any = { verification_request_id: requestId, execution_id: executionId, admin_id: user.id, note, is_valid: isValid };
      if (supplementaryNote !== undefined) d.supplementary_note = supplementaryNote;
      await supabase.from("admin_trade_notes").upsert(d, { onConflict: "verification_request_id,execution_id" });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
    } finally {
      setSavingNote(null);
    }
  };

  const toggleTradeValidity = (requestId: string, executionId: string) => {
    const key = `${requestId}_${executionId}`;
    const newVal = !(tradeValidity[key] !== false);
    setTradeValidity((prev) => ({ ...prev, [key]: newVal }));
    saveTradeNote(requestId, executionId, tradeNotes[key] || "", newVal);
  };

  // ── Approve / Reject ──
  const handleApprove = async (request: PendingRequest) => {
    if (!request.userCycle || !request.cycle) return;
    setProcessing(request.id);
    const fb = feedback[request.id] || "";
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const trades = request.executions.map((e) => { const k = `${request.id}_${e.id}`; return { trade_number: e.trade_number, is_valid: tradeValidity[k] !== false, note: tradeNotes[k] || "" }; });
      const rej = trades.filter((t) => !t.is_valid);
      const val = trades.filter((t) => t.is_valid);
      let msg = `✅ ${request.cycle.name} validé !\n${val.length} validé(s), ${rej.length} refusé(s).\n`;
      if (rej.length > 0) { msg += "\nTrades refusés :\n"; rej.forEach((t) => { msg += `• Trade #${t.trade_number}${t.note ? ` — ${t.note}` : ""}\n`; }); }
      if (fb) msg += `\nCommentaire : ${fb}`;
      await supabase.from("verification_requests").update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.id, admin_comments: fb }).eq("id", request.id);
      await supabase.from("user_cycles").update({ status: "validated", verified_at: new Date().toISOString(), admin_feedback: msg }).eq("id", request.userCycle.id);
      await supabase.rpc("unlock_next_cycle", { p_user_id: request.user_id, p_current_cycle_number: request.cycle.cycle_number });
      await supabase.from("user_notifications").insert({ user_id: request.user_id, sender_id: user.id, type: "cycle_validated", message: msg });
      toast({ title: "Cycle validé !", description: `${request.cycle.name} validé.` });
      loadData();
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    } finally { setProcessing(null); }
  };

  const handleReject = async (request: PendingRequest) => {
    if (!request.userCycle || !request.cycle) return;
    const fb = feedback[request.id];
    if (!fb?.trim()) { toast({ title: "Feedback requis", variant: "destructive" }); return; }
    setProcessing(request.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const trades = request.executions.map((e) => { const k = `${request.id}_${e.id}`; return { trade_number: e.trade_number, is_valid: tradeValidity[k] !== false, note: tradeNotes[k] || "" }; });
      const rej = trades.filter((t) => !t.is_valid);
      const val = trades.filter((t) => t.is_valid);
      let msg = `❌ ${request.cycle.name} refusé.\n${val.length} validé(s), ${rej.length} refusé(s).\n`;
      if (rej.length > 0) { msg += "\nTrades refusés :\n"; rej.forEach((t) => { msg += `• Trade #${t.trade_number}${t.note ? ` — ${t.note}` : ""}\n`; }); }
      msg += `\nCommentaire : ${fb}`;
      await supabase.from("verification_requests").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.id, admin_comments: fb }).eq("id", request.id);
      await supabase.from("user_cycles").update({ status: "rejected", admin_feedback: msg }).eq("id", request.userCycle.id);
      await supabase.from("user_notifications").insert({ user_id: request.user_id, sender_id: user.id, type: "cycle_rejected", message: msg });
      toast({ title: "Cycle refusé" });
      loadData();
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    } finally { setProcessing(null); }
  };

  // ── Inline cycle status change ──
  const handleCycleStatusChangeDirectly = async (userId: string, cycle: Cycle, userCycle: UserCycleData | undefined, targetStatus: string) => {
    if (!userCycle) { toast({ title: "Erreur", description: "Cycle non initialisé.", variant: "destructive" }); return; }
    try {
      const ud: any = { status: targetStatus };
      if (targetStatus === "validated") { ud.verified_at = new Date().toISOString(); ud.completed_at = new Date().toISOString(); }
      if (["rejected", "locked", "in_progress"].includes(targetStatus)) { ud.verified_at = null; ud.completed_at = null; }
      if (targetStatus === "in_progress" && !userCycle.started_at) ud.started_at = new Date().toISOString();
      await supabase.from("user_cycles").update(ud).eq("id", userCycle.id);
      if (targetStatus === "validated" || targetStatus === "rejected") {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("verification_requests").update({ status: targetStatus === "validated" ? "approved" : "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user?.id }).eq("user_cycle_id", userCycle.id).eq("status", "pending");
        if (targetStatus === "validated") await supabase.rpc("unlock_next_cycle", { p_user_id: userId, p_current_cycle_number: cycle.cycle_number });
      }
      toast({ title: `${cycle.name} → ${getStatusLabel(targetStatus)}` });
      loadData();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  // ── Assign admin ──
  const handleAssignAdmin = async (requestId: string, adminUserId: string) => {
    await supabase.from("verification_requests").update({ assigned_to: adminUserId }).eq("id", requestId);
    toast({ title: "Assigné" });
    setAssigningRequest(null);
    loadData();
  };

  // ── Resolve alert ──
  const resolveAlert = async (alertId: string, userId: string, unfreeze: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("security_alerts").update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", alertId);
    if (unfreeze) {
      await supabase.from("profiles").update({ status: "active", frozen_at: null, frozen_by: null, status_reason: null }).eq("user_id", userId);
      await supabase.from("user_sessions").delete().eq("user_id", userId);
    }
    toast({ title: "Alerte résolue" });
    loadData();
  };

  // ── User action (freeze/ban/unfreeze/unban/remove) ──
  const openActionDialog = (userId: string, action: "freeze" | "ban" | "unfreeze" | "unban" | "remove") => {
    setActionUserId(userId);
    setActionType(action);
    setActionReason("");
    setActionDialogOpen(true);
  };

  const executeAction = async () => {
    if (!actionUserId || !actionType) return;
    setActionProcessing(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    try {
      if (actionType === "freeze") {
        await supabase.from("profiles").update({ status: "frozen" as any, frozen_at: new Date().toISOString(), frozen_by: currentUser?.id, status_reason: actionReason || null }).eq("user_id", actionUserId);
        toast({ title: "Utilisateur gelé" });
      } else if (actionType === "ban") {
        await supabase.from("profiles").update({ status: "banned" as any, banned_at: new Date().toISOString(), banned_by: currentUser?.id, status_reason: actionReason || null }).eq("user_id", actionUserId);
        toast({ title: "Utilisateur banni" });
      } else if (actionType === "unfreeze" || actionType === "unban") {
        await supabase.from("profiles").update({ status: "active" as any, frozen_at: null, banned_at: null, frozen_by: null, banned_by: null, status_reason: null }).eq("user_id", actionUserId);
        toast({ title: "Utilisateur réactivé" });
      } else if (actionType === "remove") {
        for (const t of ["verification_requests", "user_followups", "user_executions", "user_personal_trades", "user_custom_variables", "user_variable_types", "user_cycles", "user_roles"]) {
          await supabase.from(t).delete().eq("user_id", actionUserId);
        }
        await supabase.from("profiles").delete().eq("user_id", actionUserId);
        toast({ title: "Utilisateur supprimé" });
      }
      setActionDialogOpen(false);
      loadData();
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    } finally { setActionProcessing(false); }
  };

  // ── Computed ──
  const getUserProgressPercentage = (u: PlatformUser) => cycles.length === 0 ? 0 : (u.userCycles.filter((uc) => uc.status === "validated").length / cycles.length) * 100;

  const filterCounts = useMemo(() => ({
    all: users.length,
    online: users.filter((u) => u.isOnline).length,
    pending: users.filter((u) => u.userStatus === "pending").length,
    ea_active: users.filter((u) => u.eaInfo?.timerStatus === "active" || u.eaInfo?.timerStatus === "not_started").length,
    ea_expired: users.filter((u) => u.eaInfo?.timerStatus === "expired").length,
    client: users.filter((u) => u.isClient).length,
    institute: users.filter((u) => u.isInstitute).length,
    frozen: users.filter((u) => u.profileStatus === "frozen").length,
    banned: users.filter((u) => u.profileStatus === "banned").length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (userFilter !== "all") {
      if (userFilter === "frozen") list = list.filter((u) => u.profileStatus === "frozen");
      else if (userFilter === "banned") list = list.filter((u) => u.profileStatus === "banned");
      else if (userFilter === "pending") list = list.filter((u) => u.userStatus === "pending");
      else if (userFilter === "online") list = list.filter((u) => u.isOnline);
      else if (userFilter === "ea_active") list = list.filter((u) => u.eaInfo?.timerStatus === "active" || u.eaInfo?.timerStatus === "not_started");
      else if (userFilter === "ea_expired") list = list.filter((u) => u.eaInfo?.timerStatus === "expired");
      else if (userFilter === "client") list = list.filter((u) => u.isClient);
      else if (userFilter === "institute") list = list.filter((u) => u.isInstitute);
      else list = list.filter((u) => u.roles.includes(userFilter));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.displayName.toLowerCase().includes(q) || (u.firstName || "").toLowerCase().includes(q) || u.id.includes(q));
    }
    // Sorting
    if (userSort !== "priority") {
      list = [...list].sort((a, b) => {
        switch (userSort) {
          case "name_asc": return a.displayName.localeCompare(b.displayName);
          case "name_desc": return b.displayName.localeCompare(a.displayName);
          case "trades_desc": return b.totalTrades - a.totalTrades;
          case "rr_desc": return b.totalRR - a.totalRR;
          case "rr_asc": return a.totalRR - b.totalRR;
          case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          default: return 0;
        }
      });
    }
    return list;
  }, [users, search, userFilter, userSort]);

  const filteredRequests = useMemo(() => {
    let r = requests;
    if (search) { const q = search.toLowerCase(); r = r.filter((v) => v.userName.toLowerCase().includes(q)); }
    if (verificationAssigneeFilter !== "all") {
      r = verificationAssigneeFilter === "unassigned" ? r.filter((v) => !v.assigned_to) : r.filter((v) => v.assigned_to === verificationAssigneeFilter);
    }
    return r;
  }, [requests, search, verificationAssigneeFilter]);

  const kpis = useMemo(() => ({
    totalUsers: users.length,
    online: users.filter((u) => u.isOnline).length,
    pendingVerif: requests.length,
    unresolvedAlerts: alerts.length,
    totalTrades: users.reduce((s, u) => s + u.totalTrades, 0),
    avgRR: users.length > 0 ? +(users.reduce((s, u) => s + u.totalRR, 0) / users.length).toFixed(1) : 0,
  }), [users, requests, alerts]);

  const actionDialogContent = useMemo(() => {
    const u = users.find((x) => x.id === actionUserId);
    const name = u?.firstName || u?.displayName || "cet utilisateur";
    const map: Record<string, { title: string; desc: string; icon: JSX.Element; btn: string; variant: "default" | "destructive" }> = {
      freeze: { title: "Geler l'utilisateur", desc: `Geler ${name} ? Il ne pourra plus accéder à l'app.`, icon: <Snowflake className="w-6 h-6 text-blue-500" />, btn: "Geler", variant: "default" },
      ban: { title: "Bannir l'utilisateur", desc: `Bannir ${name} ? Plus sévère qu'un gel.`, icon: <Ban className="w-6 h-6 text-destructive" />, btn: "Bannir", variant: "destructive" },
      unfreeze: { title: "Réactiver", desc: `Réactiver ${name} ?`, icon: <CheckCircle className="w-6 h-6 text-green-500" />, btn: "Réactiver", variant: "default" },
      unban: { title: "Réactiver", desc: `Réactiver ${name} ?`, icon: <CheckCircle className="w-6 h-6 text-green-500" />, btn: "Réactiver", variant: "default" },
      remove: { title: "Supprimer", desc: `Supprimer définitivement ${name} ? Toutes les données seront perdues.`, icon: <UserX className="w-6 h-6 text-destructive" />, btn: "Supprimer", variant: "destructive" },
    };
    return map[actionType || "freeze"];
  }, [actionType, actionUserId, users]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">

      {/* ── Header — CRM-style ── */}
      <div className="shrink-0 border-b border-white/[0.10]">
        {/* Row 1: Tabs */}
        <div className="px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all border",
                tab === t.id
                  ? "bg-primary/20 text-white border-primary/30 shadow-[0_0_12px_rgba(25,183,201,0.15)]"
                  : "border-transparent text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
              )}>
                <t.icon className="w-4 h-4 opacity-80" />
                {t.label}
                {t.id === "verifications" && kpis.pendingVerif > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-mono">{kpis.pendingVerif}</span>}
                {t.id === "alerts" && kpis.unresolvedAlerts > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-mono">{kpis.unresolvedAlerts}</span>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={loadData} className="text-white/40 hover:text-white/70 h-9 w-9 p-0"><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Row 2: Search + Filters + Sort + KPIs — CRM bar style */}
        {tab === "users" && (
          <div className="px-6 pb-4 space-y-3">
            {/* Search */}
            <div className="relative max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, prénom ou ID..."
                className="pl-10 h-10 bg-white/[0.04] border-white/[0.08] rounded-xl text-sm text-white placeholder:text-white/30 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"><XCircle className="w-3.5 h-3.5" /></button>}
            </div>

            {/* Filters + KPIs bar */}
            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-2">
              {/* Left: Filters + Sort */}
              <div className="flex items-center gap-2">
                {([
                  { key: "all", label: "Tous", count: filterCounts.all },
                  { key: "pending", label: "En vérif", count: filterCounts.pending, dot: "orange" },
                  { key: "ea_expired", label: "EA expiré", count: filterCounts.ea_expired, dot: "red" },
                  { key: "online", label: "En ligne", count: filterCounts.online, dot: "emerald" },
                  { key: "ea_active", label: "EA actif", count: filterCounts.ea_active },
                  { key: "client", label: "Clients", count: filterCounts.client },
                  { key: "frozen", label: "Gelés", count: filterCounts.frozen },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setUserFilter(userFilter === f.key ? "all" : f.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-[0.97] shrink-0",
                      userFilter === f.key
                        ? "bg-primary/20 text-white border border-primary/30 shadow-[0_0_10px_rgba(25,183,201,0.12)]"
                        : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]",
                      f.count === 0 && userFilter !== f.key && "opacity-25"
                    )}
                  >
                    {"dot" in f && f.count > 0 && userFilter !== f.key && (
                      <span className={cn("w-2 h-2 rounded-full",
                        f.dot === "orange" && "bg-orange-400 animate-pulse",
                        f.dot === "red" && "bg-red-400",
                        f.dot === "emerald" && "bg-emerald-400",
                      )} />
                    )}
                    {f.label}
                    <span className={cn("font-mono text-[11px]", userFilter === f.key ? "text-white/70" : "text-white/30")}>{f.count}</span>
                  </button>
                ))}

                <div className="w-px h-5 bg-white/10 mx-1" />

                <Select value={userSort} onValueChange={setUserSort}>
                  <SelectTrigger className="w-[140px] h-8 bg-white/[0.04] border-white/[0.08] rounded-lg text-white/70 text-xs hover:bg-white/[0.06] transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={cn("border-white/[0.10] rounded-xl shadow-2xl backdrop-blur-xl p-1", BG)}>
                    <SelectItem value="priority" className="text-white/70 text-xs">Priorité</SelectItem>
                    <SelectItem value="name_asc" className="text-white/70 text-xs">Nom A-Z</SelectItem>
                    <SelectItem value="name_desc" className="text-white/70 text-xs">Nom Z-A</SelectItem>
                    <SelectItem value="trades_desc" className="text-white/70 text-xs">Trades ↓</SelectItem>
                    <SelectItem value="rr_desc" className="text-white/70 text-xs">RR ↓</SelectItem>
                    <SelectItem value="newest" className="text-white/70 text-xs">Plus récent</SelectItem>
                    <SelectItem value="oldest" className="text-white/70 text-xs">Plus ancien</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Right: KPIs */}
              <div className="flex items-center gap-2">
                <KpiPill value={kpis.totalUsers} label="Users" color="white" />
                <KpiPill value={kpis.online} label="Online" color="emerald" />
                <KpiPill value={kpis.pendingVerif} label="Vérif" color="amber" />
                <KpiPill value={kpis.totalTrades} label="Trades" color="blue" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">

        {/* ════════════════════════════════════════════════ */}
        {/* TAB: UTILISATEURS                               */}
        {/* ════════════════════════════════════════════════ */}
        {tab === "users" && (
          <div className="px-6 pb-6">
            <div className={cn("rounded-xl border border-white/[0.10] overflow-hidden", BG)}>
            {/* Column headers — CRM style */}
            <div className={cn("flex items-center gap-4 px-5 py-3 border-b border-white/[0.08] sticky top-0 z-10", BG)}>
              <div className="w-10 shrink-0" />
              <div className="w-[180px] shrink-0 flex items-center gap-2">
                <IconBox color="white"><Users className="w-3 h-3 text-white/50" /></IconBox>
                <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Utilisateur</span>
              </div>
              <div className="w-[80px] shrink-0 text-center text-white/70 text-xs font-medium uppercase tracking-wider">Cycle</div>
              <div className="w-[70px] shrink-0 text-right text-white/70 text-xs font-medium uppercase tracking-wider">Trades</div>
              <div className="w-[80px] shrink-0 text-right flex items-center justify-end gap-1.5">
                <span className="text-white/70 text-xs font-medium uppercase tracking-wider">RR</span>
                <IconBox color="emerald"><TrendingUp className="w-3 h-3 text-emerald-400/80" /></IconBox>
              </div>
              <div className="w-[50px] shrink-0 text-right text-white/70 text-xs font-medium uppercase tracking-wider">WR</div>
              <div className="w-[90px] shrink-0 text-center flex items-center justify-center gap-1.5">
                <IconBox color="cyan"><Clock className="w-3 h-3 text-cyan-400/80" /></IconBox>
                <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Timer</span>
              </div>
              <div className="flex-1 text-center text-white/70 text-xs font-medium uppercase tracking-wider">Cycles</div>
              <div className="w-[70px] shrink-0 text-right text-white/70 text-xs font-medium uppercase tracking-wider">Prog.</div>
              <div className="w-5 shrink-0" />
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Aucun utilisateur</p></div>
            ) : filteredUsers.map((u) => {
              const isExpanded = expandedUser === u.id;
              const progress = getUserProgressPercentage(u);
              const stats = calculateStats(u.executions);
              const subTab = activeSubTab[u.id] || "cycles";

              const accentCls =
                u.profileStatus === "frozen" ? "border-l-blue-500" :
                u.profileStatus === "banned" ? "border-l-red-500" :
                u.userStatus === "pending" ? "border-l-orange-400" :
                u.eaInfo?.timerStatus === "expired" ? "border-l-red-400" :
                u.userStatus === "completed" ? "border-l-emerald-400" : "border-l-transparent";

              return (
                <div key={u.id} className={cn(
                  "border-b border-white/[0.06] border-l-[3px] transition-colors",
                  accentCls,
                  isExpanded && "bg-white/[0.03]"
                )}>
                  {/* ── Row (database style) ── */}
                  <button onClick={() => setExpandedUser(isExpanded ? null : u.id)} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/[0.04] transition-colors">
                    {/* Avatar */}
                    <div className="relative shrink-0 w-10">
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white",
                        u.profileStatus === "frozen" ? "bg-blue-500" : u.profileStatus === "banned" ? "bg-red-500" :
                        u.isOnline ? "bg-emerald-500" : u.totalTrades > 0 ? "bg-primary/80" : "bg-muted-foreground/30"
                      )}>{u.displayName[0]?.toUpperCase() || "?"}</div>
                      {u.isOnline && <span className="absolute bottom-0 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />}
                    </div>

                    {/* Name + badges */}
                    <div className="w-[180px] shrink-0 text-left min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm truncate">{u.displayName}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {u.profileStatus === "frozen" && <span className="px-1.5 py-0.5 text-[9px] font-mono bg-blue-500/15 text-blue-400 rounded leading-none">Gelé</span>}
                        {u.profileStatus === "banned" && <span className="px-1.5 py-0.5 text-[9px] font-mono bg-red-500/15 text-red-400 rounded leading-none">Banni</span>}
                        {u.userStatus === "pending" && <span className="px-1.5 py-0.5 text-[9px] font-mono bg-orange-500/15 text-orange-400 rounded leading-none animate-pulse">Vérif</span>}
                        {u.isClient && <span className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-500/10 text-emerald-400 rounded leading-none">Client</span>}
                        {u.isInstitute && <span className="px-1.5 py-0.5 text-[9px] font-mono bg-blue-500/10 text-blue-400 rounded leading-none">Institut</span>}
                        {u.teamRoles.map((r) => <span key={r} className="px-1.5 py-0.5 text-[9px] font-mono bg-violet-500/10 text-violet-400 rounded leading-none">{getRoleLabel(r)}</span>)}
                      </div>
                    </div>

                    {/* Current cycle */}
                    <div className="w-[80px] shrink-0 text-center">
                      <span className="text-xs font-mono text-muted-foreground">{u.currentCycle?.name || "—"}</span>
                    </div>

                    {/* Trades */}
                    <div className="w-[70px] shrink-0 text-right">
                      <span className="text-sm font-mono font-bold">{u.totalTrades}</span>
                    </div>

                    {/* RR Total */}
                    <div className="w-[80px] shrink-0 text-right">
                      <span className={cn("text-sm font-mono font-bold", u.totalRR >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {u.totalRR >= 0 ? "+" : ""}{u.totalRR.toFixed(1)}
                      </span>
                    </div>

                    {/* Win Rate */}
                    <div className="w-[50px] shrink-0 text-right">
                      <span className="text-sm font-mono text-muted-foreground">{stats.winRate.toFixed(0)}%</span>
                    </div>

                    {/* EA Timer */}
                    <div className="w-[90px] shrink-0 text-center">
                      {u.eaInfo?.timerStatus === "active" && (() => {
                        const diffMs = new Date(u.eaInfo!.expiresAt!).getTime() - Date.now();
                        const urgent = diffMs < 12 * 3600000;
                        const warning = diffMs < 48 * 3600000;
                        return <span className={cn("text-xs font-mono", urgent ? "text-red-400" : warning ? "text-amber-400" : "text-muted-foreground")}>⏱ {u.eaInfo!.remainingLabel}</span>;
                      })()}
                      {u.eaInfo?.timerStatus === "expired" && <span className="text-xs font-mono text-red-400">Expiré</span>}
                      {u.eaInfo?.timerStatus === "not_started" && <span className="text-xs font-mono text-muted-foreground/50">⏸</span>}
                      {!u.eaInfo && <span className="text-xs text-muted-foreground/30">—</span>}
                    </div>

                    {/* Cycle mini-grid */}
                    <div className="flex-1 flex justify-center">
                      <div className="flex gap-0.5">
                        {cycles.map((cycle) => {
                          const uc = u.userCycles.find((x) => x.cycle_id === cycle.id);
                          const st = uc?.status || "locked";
                          return (
                            <Tooltip key={cycle.id}>
                              <TooltipTrigger asChild>
                                <div className={cn("w-5 h-5 rounded flex items-center justify-center",
                                  st === "locked" && "bg-muted/20",
                                  st === "in_progress" && "bg-blue-500/25",
                                  st === "pending_review" && "bg-orange-500/25 animate-pulse",
                                  st === "validated" && "bg-emerald-500/25",
                                  st === "rejected" && "bg-red-500/25",
                                )}>
                                  {st === "validated" && <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />}
                                  {st === "rejected" && <XCircle className="w-2.5 h-2.5 text-red-400" />}
                                  {st === "pending_review" && <Clock className="w-2.5 h-2.5 text-orange-400" />}
                                  {st === "in_progress" && <Play className="w-2.5 h-2.5 text-blue-400" />}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px]">{cycle.cycle_number === 0 ? "Éb." : `C${cycle.cycle_number}`} — {getStatusLabel(st)}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="w-[70px] shrink-0 flex items-center gap-1.5 justify-end">
                      <Progress value={progress} className="h-1.5 w-10" />
                      <span className={cn("text-xs font-mono font-bold", progress === 100 ? "text-emerald-400" : "text-muted-foreground")}>{progress.toFixed(0)}%</span>
                    </div>

                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
                  </button>

                  {/* ── Expanded: sub-tabs ── */}
                  {isExpanded && (
                    <div className="border-t border-border/50 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                      {/* Sub-tab bar */}
                      <div className="flex items-center gap-1 px-4 pt-2 pb-0">
                        {([
                          { key: "cycles" as const, label: "Cycles", detail: `${u.userCycles.filter((uc) => uc.status === "validated").length}/${cycles.length}` },
                          { key: "trades" as const, label: "Trades", detail: `${u.executions.length}` },
                          { key: "profil" as const, label: "Profil & Actions" },
                        ]).map((st) => (
                          <button
                            key={st.key}
                            onClick={(e) => { e.stopPropagation(); setActiveSubTab((prev) => ({ ...prev, [u.id]: st.key })); }}
                            className={cn(
                              "px-3 py-1.5 text-[11px] font-medium rounded-t-md transition-colors border-b-2",
                              subTab === st.key
                                ? "border-b-primary text-foreground bg-accent/50"
                                : "border-b-transparent text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {st.label}
                            {"detail" in st && st.detail && <span className="ml-1 text-[9px] font-mono text-muted-foreground">{st.detail}</span>}
                          </button>
                        ))}
                      </div>

                      {/* Sub-tab content */}
                      <div className="px-4 pb-3 pt-2">

                        {/* ── Sub-tab: Cycles ── */}
                        {subTab === "cycles" && (
                          <div className="space-y-3">
                            <Progress value={progress} className="h-2" />
                            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
                              {cycles.map((cycle) => {
                                const uc = u.userCycles.find((x) => x.cycle_id === cycle.id);
                                const st2 = uc?.status || "locked";
                                return (
                                  <div key={cycle.id} className={cn("p-2 border rounded-md text-center",
                                    st2 === "locked" && "bg-muted/20 border-border/30 opacity-40",
                                    st2 === "in_progress" && "bg-blue-500/10 border-blue-500/30",
                                    st2 === "pending_review" && "bg-orange-500/10 border-orange-500/30",
                                    st2 === "validated" && "bg-emerald-500/10 border-emerald-500/30",
                                    st2 === "rejected" && "bg-red-500/10 border-red-500/30",
                                  )}>
                                    <div className="flex items-center justify-center mb-0.5">{getStatusIcon(st2)}</div>
                                    <p className="text-[9px] font-mono font-bold">{cycle.cycle_number === 0 ? "Éb." : `C${cycle.cycle_number}`}</p>
                                    {uc && uc.total_rr != null && <p className={cn("text-[9px] font-mono", (uc.total_rr || 0) >= 0 ? "text-emerald-400" : "text-red-400")}>{(uc.total_rr || 0) >= 0 ? "+" : ""}{(uc.total_rr || 0).toFixed(0)}</p>}
                                    {uc && st2 !== "locked" && (
                                      <div className="flex gap-0.5 mt-1 justify-center">
                                        <button className={cn("p-0.5 rounded", st2 === "validated" ? "bg-emerald-500/30 text-emerald-400" : "hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-400")}
                                          onClick={(e) => { e.stopPropagation(); if (st2 !== "validated") handleCycleStatusChangeDirectly(u.id, cycle, uc, "validated"); }}><CheckCircle className="w-2.5 h-2.5" /></button>
                                        <button className={cn("p-0.5 rounded", st2 === "rejected" ? "bg-red-500/30 text-red-400" : "hover:bg-red-500/20 text-muted-foreground hover:text-red-400")}
                                          onClick={(e) => { e.stopPropagation(); if (st2 !== "rejected") handleCycleStatusChangeDirectly(u.id, cycle, uc, "rejected"); }}><XCircle className="w-2.5 h-2.5" /></button>
                                      </div>
                                    )}
                                    {uc && (st2 === "validated" || st2 === "rejected") && (
                                      <button className="mt-0.5 p-0.5 rounded text-primary hover:text-primary/80" onClick={async (e) => {
                                        e.stopPropagation();
                                        const { data: vr } = await supabase.from("verification_requests").select("id").eq("user_cycle_id", uc.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
                                        if (vr) { const ce = u.executions.filter((ex) => ex.trade_number >= cycle.trade_start && ex.trade_number <= cycle.trade_end); setNotesViewerRequestId(vr.id); setNotesViewerExecs(ce.map((ex) => ({ id: ex.id, trade_number: ex.trade_number, direction: ex.direction, trade_date: ex.trade_date }))); }
                                      }}><MessageSquare className="w-2.5 h-2.5" /></button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── Sub-tab: Trades ── */}
                        {subTab === "trades" && (
                          <div className="space-y-2">
                            {u.executions.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground text-sm">Aucun trade saisi</div>
                            ) : (
                              <>
                                {/* Mini stats */}
                                <div className="flex gap-4 text-[11px] font-mono">
                                  <span>Total: <b className={cn(stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400")}>{stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(1)}RR</b></span>
                                  <span>WR: <b>{stats.winRate.toFixed(0)}%</b></span>
                                  <span>Moy: <b>{stats.avgRR.toFixed(2)}</b></span>
                                  <span>W/L: <b>{stats.wins}/{stats.losses}</b></span>
                                </div>
                                <ScrollArea className="max-h-[280px] rounded-md border border-border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/50">
                                        {["#", "Date", "Dir", "Entrée", "Setup", "RR", "Screens"].map((h) => (
                                          <TableHead key={h} className={cn("h-7 text-[9px] font-mono", h === "RR" && "text-right")}>{h}</TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {u.executions.map((exec) => (
                                        <TableRow key={exec.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { const idx = u.executions.findIndex((e) => e.id === exec.id); openGallery(u.executions, idx >= 0 ? idx : 0, exec.screenshot_url ? "m15" : "m5"); }}>
                                          <TableCell className="py-1 text-[10px] font-mono font-bold">{exec.trade_number}</TableCell>
                                          <TableCell className="py-1 text-[10px] font-mono text-muted-foreground">{fmtDate(exec.trade_date)}</TableCell>
                                          <TableCell className="py-1">
                                            <span className={cn("text-[9px] font-mono", exec.direction === "Long" ? "text-emerald-400" : "text-red-400")}>{exec.direction === "Long" ? "▲" : "▼"}</span>
                                          </TableCell>
                                          <TableCell className="py-1 text-[10px] font-mono text-muted-foreground">{exec.entry_time || "—"}</TableCell>
                                          <TableCell className="py-1 text-[10px] font-mono text-muted-foreground">{exec.setup_type || "—"}</TableCell>
                                          <TableCell className="py-1 text-right"><span className={cn("font-mono font-bold text-[10px]", (exec.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400")}>{(exec.rr || 0) >= 0 ? "+" : ""}{(exec.rr || 0).toFixed(1)}</span></TableCell>
                                          <TableCell className="py-1">
                                            <div className="flex gap-1">
                                              {exec.screenshot_url && <button className="text-[8px] font-mono text-primary hover:underline" onClick={(e) => { e.stopPropagation(); const idx = u.executions.findIndex((x) => x.id === exec.id); openGallery(u.executions, idx >= 0 ? idx : 0, "m15"); }}>M15</button>}
                                              {exec.screenshot_entry_url && <button className="text-[8px] font-mono text-primary hover:underline" onClick={(e) => { e.stopPropagation(); const idx = u.executions.findIndex((x) => x.id === exec.id); openGallery(u.executions, idx >= 0 ? idx : 0, "m5"); }}>M5</button>}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </ScrollArea>
                              </>
                            )}
                          </div>
                        )}

                        {/* ── Sub-tab: Profil & Actions ── */}
                        {subTab === "profil" && (
                          <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {/* Status + Actions */}
                            <div className="p-2.5 rounded-lg bg-accent/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono uppercase text-muted-foreground w-12">Statut</span>
                                  {u.profileStatus === "active" && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px] h-5"><CheckCircle className="w-2.5 h-2.5 mr-0.5" />Actif</Badge>}
                                  {u.profileStatus === "frozen" && <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-[9px] h-5"><Snowflake className="w-2.5 h-2.5 mr-0.5" />Gelé</Badge>}
                                  {u.profileStatus === "banned" && <Badge variant="destructive" className="text-[9px] h-5"><Ban className="w-2.5 h-2.5 mr-0.5" />Banni</Badge>}
                                  {u.statusReason && <span className="text-[9px] text-muted-foreground italic">({u.statusReason})</span>}
                                </div>
                                <div className="flex gap-1">
                                  {u.profileStatus === "active" && <>
                                    <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1 px-2" onClick={(e) => { e.stopPropagation(); openActionDialog(u.id, "freeze"); }}><Snowflake className="w-2.5 h-2.5" />Geler</Button>
                                    <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1 px-2 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); openActionDialog(u.id, "ban"); }}><Ban className="w-2.5 h-2.5" />Bannir</Button>
                                  </>}
                                  {u.profileStatus === "frozen" && <Button size="sm" className="h-6 text-[9px] gap-1 px-2 bg-emerald-600 hover:bg-emerald-700" onClick={(e) => { e.stopPropagation(); openActionDialog(u.id, "unfreeze"); }}><CheckCircle className="w-2.5 h-2.5" />Dégeler</Button>}
                                  {u.profileStatus === "banned" && <Button size="sm" className="h-6 text-[9px] gap-1 px-2 bg-emerald-600 hover:bg-emerald-700" onClick={(e) => { e.stopPropagation(); openActionDialog(u.id, "unban"); }}><CheckCircle className="w-2.5 h-2.5" />Réactiver</Button>}
                                  {isSuperAdmin && <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1 px-2 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); openActionDialog(u.id, "remove"); }}><UserX className="w-2.5 h-2.5" />Supprimer</Button>}
                                </div>
                              </div>
                              {u.teamRoles.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono uppercase text-muted-foreground w-12">Équipe</span>
                                  {u.teamRoles.map((r) => <span key={r} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border", getRoleBadgeCls(r))}>{getRoleIcon(r)}{getRoleLabel(r)}</span>)}
                                </div>
                              )}
                              {u.hasEarlyAccess && u.eaInfo && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono uppercase text-muted-foreground w-12">Accès</span>
                                  <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border",
                                    u.eaInfo.timerStatus === "active" ? "bg-primary/10 text-primary border-primary/30" :
                                    u.eaInfo.timerStatus === "expired" ? "bg-red-500/10 text-red-400 border-red-500/30" :
                                    "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  )}><Shield className="w-2.5 h-2.5" />EA {u.eaInfo.earlyAccessType && `(${u.eaInfo.earlyAccessType})`}</span>
                                  <span className={cn("text-[9px] font-mono",
                                    u.eaInfo.timerStatus === "active" ? "text-emerald-400" : u.eaInfo.timerStatus === "expired" ? "text-red-400" : "text-amber-400"
                                  )}>{u.eaInfo.remainingLabel}</span>
                                </div>
                              )}
                              {(u.isClient || u.isInstitute) && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono uppercase text-muted-foreground w-12">Tags</span>
                                  {u.isClient && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono border bg-emerald-500/10 text-emerald-400 border-emerald-500/30"><CheckCircle className="w-2.5 h-2.5" />Client</span>}
                                  {u.isInstitute && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono border bg-blue-500/10 text-blue-500 border-blue-500/30"><Award className="w-2.5 h-2.5" />Institut</span>}
                                </div>
                              )}
                            </div>

                            {/* Suivi */}
                            {u.followups.length > 0 && (
                              <div>
                                <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5">Suivi ({u.followups.length}j)</p>
                                <div className="flex gap-1 flex-wrap">
                                  {u.followups.map((f) => (
                                    <Tooltip key={f.day_number}>
                                      <TooltipTrigger>
                                        <div className={cn("w-7 h-7 rounded flex items-center justify-center text-[9px] font-mono font-bold border",
                                          f.is_blocked ? "bg-red-500/10 border-red-500/20 text-red-400" :
                                          f.correct_actions && f.message_sent ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                          f.message_sent || f.call_done ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                                          "bg-muted/20 border-border text-muted-foreground"
                                        )}>J{f.day_number}</div>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-[10px]">
                                        <p>J{f.day_number} — {fmtDate(f.contact_date)}</p>
                                        {f.message_sent && <p>💬 Message</p>}
                                        {f.call_done && <p>📞 Call</p>}
                                        {f.is_blocked && <p>🚫 Bloqué</p>}
                                        {f.correct_actions && <p>✅ OK</p>}
                                        {f.notes && <p className="text-muted-foreground">{f.notes}</p>}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-2 border-t border-border/30">
                              <span>ID: {u.id.slice(0, 8)} · {u.sessionCount} sess.{u.firstName ? ` · ${u.firstName}` : ""}</span>
                              <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1" onClick={(e) => { e.stopPropagation(); setDataViewerUserId(u.id); setDataViewerUserName(u.displayName); }}>
                                <Tag className="w-3 h-3" /> Toutes les données
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* TAB: VÉRIFICATIONS (queue + inline + history)   */}
        {/* ════════════════════════════════════════════════ */}
        {tab === "verifications" && (
          <div className="space-y-4 px-6 py-4">
            {requests.length === 0 && processedRequests.length === 0 ? (
              <div className="text-center py-16"><CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400/30" /><p className="text-muted-foreground">Aucune demande</p></div>
            ) : (
              <>
                {/* Filters */}
                {requests.length > 0 && (
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-mono uppercase text-muted-foreground">{filteredRequests.length} en attente</span>
                    <select value={verificationAssigneeFilter} onChange={(e) => setVerificationAssigneeFilter(e.target.value)} className="h-8 text-xs font-mono bg-card border border-border rounded-md px-2 text-foreground">
                      <option value="all">Tous</option><option value="unassigned">Non assignés</option>
                      {adminProfiles.map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name || "Admin"}</option>)}
                    </select>
                  </div>
                )}

                {/* Pending requests */}
                {filteredRequests.map((request) => {
                  const stats = calculateStats(request.executions);
                  const isExpanded = expandedRequest === request.id;
                  const isProcessing = processing === request.id;
                  const assignedAdmin = adminProfiles.find((p) => p.user_id === request.assigned_to);

                  return (
                    <div key={request.id} className="border border-orange-500/40 bg-orange-500/5 rounded-xl overflow-hidden">
                      <div className="p-4 cursor-pointer hover:bg-orange-500/10 transition-colors" onClick={() => { const nid = isExpanded ? null : request.id; setExpandedRequest(nid); if (nid) loadTradeNotes(nid); }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-orange-400" /></div>
                            <div>
                              <h4 className="font-semibold flex items-center gap-2">
                                {request.userName} — {request.cycle?.name || "?"}
                                {request.attemptNumber > 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono">{request.attemptNumber}ème</span>}
                              </h4>
                              <p className="text-xs text-muted-foreground font-mono">{fmtDateLong(request.requested_at)}</p>
                              {assignedAdmin ? <p className="text-[10px] text-primary font-mono mt-0.5">Assigné: {assignedAdmin.display_name}</p> : (
                                <button className="text-[10px] text-muted-foreground hover:text-primary font-mono mt-0.5 underline" onClick={(e) => { e.stopPropagation(); setAssigningRequest(assigningRequest === request.id ? null : request.id); }}>+ Assigner</button>
                              )}
                            </div>
                          </div>
                          {assigningRequest === request.id && (
                            <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {adminProfiles.map((a) => <Button key={a.user_id} variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => handleAssignAdmin(request.id, a.user_id)}><User className="w-3 h-3" />{a.display_name}</Button>)}
                            </div>
                          )}
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className={cn("text-lg font-bold", stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400")}>{stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(1)} RR</p>
                              <p className="text-xs text-muted-foreground">{request.executions.length} trades</p>
                            </div>
                            <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-orange-500/20 p-4 space-y-4">
                          {/* Stats */}
                          <div className="grid grid-cols-4 gap-3">
                            {[
                              { l: "Total RR", v: `${stats.totalRR >= 0 ? "+" : ""}${stats.totalRR.toFixed(1)}`, c: stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400" },
                              { l: "Win Rate", v: `${stats.winRate.toFixed(0)}%`, c: "" },
                              { l: "RR Moyen", v: stats.avgRR.toFixed(2), c: "" },
                              { l: "W/L", v: `${stats.wins}/${stats.losses}`, c: "" },
                            ].map((s) => (
                              <div key={s.l} className="p-3 bg-card border border-border/40 rounded-md">
                                <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">{s.l}</p>
                                <p className={cn("text-xl font-bold", s.c)}>{s.v}</p>
                              </div>
                            ))}
                          </div>

                          {/* Accuracy */}
                          {(() => {
                            const acc = getAccuracyPercent(request.comparisons);
                            const auto = acc >= 90;
                            return (
                              <div className={cn("flex flex-wrap items-center gap-4 p-3 rounded-md", auto ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-muted/30")}>
                                <span className={cn("text-base font-bold font-mono", auto ? "text-emerald-400" : acc >= 70 ? "text-orange-400" : "text-red-400")}>{acc.toFixed(0)}%</span>
                                <span className="text-xs text-muted-foreground">précision</span>
                                {auto && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-mono">AUTO-ÉLIGIBLE</span>}
                                <div className="w-px h-4 bg-border" />
                                <span className="text-xs font-mono"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" />{request.comparisons.filter((c) => tradeValidity[`${request.id}_${c.execution.id}`] === true).length} Validés</span>
                                <span className="text-xs font-mono"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1" />{request.comparisons.filter((c) => tradeValidity[`${request.id}_${c.execution.id}`] === false).length} Refusés</span>
                                <span className="text-xs font-mono"><span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/30 mr-1" />{request.comparisons.filter((c) => tradeValidity[`${request.id}_${c.execution.id}`] === undefined).length} Non corrigés</span>
                              </div>
                            );
                          })()}

                          {/* Comparison table with INLINE validation */}
                          <div>
                            <p className="text-xs font-mono uppercase text-muted-foreground mb-2">Comparaison Oracle ({request.cycle?.trade_start}-{request.cycle?.trade_end})</p>
                            <div className="border border-border rounded-md overflow-hidden max-h-[500px] overflow-y-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    {["St", "#", "Date User", "Date Oracle", "H. User", "H. Oracle", "Dir", "RR", "Screens", "Validé", "Note Admin"].map((h) => (
                                      <TableHead key={h} className={cn("h-8 text-[10px] font-mono", h === "RR" && "text-right", h === "Validé" && "w-20", h === "Note Admin" && "w-48")}>{h}</TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {request.comparisons.map((comp) => {
                                    const exec = comp.execution;
                                    const oracle = comp.oracleTrade;
                                    const nk = `${request.id}_${exec.id}`;
                                    const isValid = tradeValidity[nk] !== false;
                                    const reviewed = tradeValidity[nk] !== undefined;

                                    return (
                                      <TableRow key={exec.id} className={cn("hover:bg-muted/30",
                                        reviewed && isValid && "bg-emerald-500/10",
                                        reviewed && !isValid && "bg-red-500/10",
                                        !reviewed && exec.trade_number <= 15 && comp.status === "match" && "bg-emerald-500/5",
                                        !reviewed && exec.trade_number <= 15 && comp.status === "warning" && "bg-orange-500/5",
                                        !reviewed && exec.trade_number <= 15 && (comp.status === "error" || comp.status === "no-match") && "bg-red-500/5",
                                      )}>
                                        <TableCell className="py-1.5">
                                          {exec.trade_number <= 15 ? (
                                            <Tooltip><TooltipTrigger>
                                              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center",
                                                comp.status === "match" && "bg-emerald-500", comp.status === "warning" && "bg-orange-500",
                                                (comp.status === "error" || comp.status === "no-match") && "bg-red-500")}>
                                                {comp.status === "match" ? <CheckCircle className="w-3 h-3 text-white" /> : comp.status === "warning" ? <AlertTriangle className="w-3 h-3 text-white" /> : <XCircle className="w-3 h-3 text-white" />}
                                              </div>
                                            </TooltipTrigger><TooltipContent>
                                              {comp.status === "match" && "≤5h"}{comp.status === "warning" && `${comp.timeDiffHours?.toFixed(1)}h`}{comp.status === "error" && `${comp.timeDiffHours?.toFixed(0)}h`}{comp.status === "no-match" && "Non trouvé"}
                                            </TooltipContent></Tooltip>
                                          ) : <div className="w-5 h-5" />}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono font-bold">{exec.trade_number}</TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">{fmtDate(exec.trade_date)}</TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">{oracle ? fmtDate(oracle.trade_date) : "—"}</TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">{exec.entry_time || "—"}</TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">{oracle?.entry_time || "—"}</TableCell>
                                        <TableCell className="py-1.5">
                                          <div className={cn("inline-flex items-center justify-center w-5 h-5 rounded", exec.direction === "Long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                                            {exec.direction === "Long" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-right"><span className={cn("font-mono font-bold text-xs", (exec.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400")}>{(exec.rr || 0) >= 0 ? "+" : ""}{(exec.rr || 0).toFixed(1)}</span></TableCell>
                                        <TableCell className="py-1.5">
                                          <div className="inline-flex gap-1.5">
                                            {exec.screenshot_url && <button className="text-[9px] font-mono text-primary hover:underline" onClick={(e) => { e.stopPropagation(); const idx = request.executions.findIndex((x) => x.id === exec.id); openGallery(request.executions, idx >= 0 ? idx : 0, "m15", request.id); }}>M15</button>}
                                            {exec.screenshot_entry_url && <button className="text-[9px] font-mono text-primary hover:underline" onClick={(e) => { e.stopPropagation(); const idx = request.executions.findIndex((x) => x.id === exec.id); openGallery(request.executions, idx >= 0 ? idx : 0, "m5", request.id); }}>M5</button>}
                                          </div>
                                        </TableCell>
                                        {/* INLINE validation toggle */}
                                        <TableCell className="py-1.5">
                                          <Button variant={reviewed && !isValid ? "destructive" : "outline"} size="sm" className="h-6 text-[9px] px-2"
                                            onClick={(e) => { e.stopPropagation(); toggleTradeValidity(request.id, exec.id); }}>
                                            {reviewed ? (isValid ? "✓ Validé" : "✗ Invalidé") : "— Corriger"}
                                          </Button>
                                        </TableCell>
                                        {/* INLINE note */}
                                        <TableCell className="py-1.5">
                                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                            <Input value={tradeNotes[nk] || ""} onChange={(e) => setTradeNotes((prev) => ({ ...prev, [nk]: e.target.value }))} placeholder="Note..." className="h-6 text-[9px] bg-card w-32" />
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" disabled={savingNote === nk}
                                              onClick={() => saveTradeNote(request.id, exec.id, tradeNotes[nk] || "", tradeValidity[nk] !== false)}>
                                              {savingNote === nk ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {/* Feedback + Actions */}
                          <div className="space-y-3">
                            <Textarea value={feedback[request.id] || ""} onChange={(e) => setFeedback((prev) => ({ ...prev, [request.id]: e.target.value }))} placeholder="Feedback (requis pour refus)..." className="resize-none bg-card text-sm" rows={2} />
                            <div className="flex gap-3">
                              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-10" onClick={() => handleApprove(request)} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}Valider
                              </Button>
                              <Button variant="destructive" className="flex-1 h-10" onClick={() => handleReject(request)} disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}Refuser
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ── Processed history ── */}
                {processedRequests.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Historique ({processedRequests.length})</h3>
                    <div className="space-y-1.5">
                      {processedRequests.map((pr) => (
                        <div key={pr.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", pr.status === "approved" ? "bg-emerald-500/15" : "bg-red-500/15")}>
                            {pr.status === "approved" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0"><p className="text-sm truncate">{pr.userName} — {pr.cycleName}</p></div>
                          <span className="text-[10px] text-muted-foreground font-mono">{fmtDate(pr.reviewed_at)}</span>
                          <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-mono uppercase border",
                            pr.status === "approved" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-red-500/15 text-red-400 border-red-500/25"
                          )}>{pr.status === "approved" ? "Validé" : "Rejeté"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* TAB: ALERTES                                    */}
        {/* ════════════════════════════════════════════════ */}
        {tab === "alerts" && (
          <div className="space-y-3 px-6 py-4">
            {alerts.length === 0 ? (
              <div className="text-center py-16"><CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400/30" /><p className="text-muted-foreground">Aucune alerte</p><p className="text-xs text-muted-foreground/60 mt-1">Tout est normal</p></div>
            ) : alerts.map((a) => (
              <div key={a.id} className="bg-card border border-red-500/20 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{a.userName}</p>
                  <p className="text-[11px] text-muted-foreground">{a.alert_type.replace(/_/g, " ")}</p>
                  {a.device_info && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{a.device_info}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{fmtDate(a.created_at)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolveAlert(a.id, a.user_id, false)} className="text-xs">Résoudre</Button>
                  <Button size="sm" onClick={() => resolveAlert(a.id, a.user_id, true)} className="text-xs bg-emerald-600 hover:bg-emerald-700">Résoudre + Dégeler</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AdminUserDataViewer userId={dataViewerUserId} userName={dataViewerUserName} open={!!dataViewerUserId} onOpenChange={(o) => { if (!o) setDataViewerUserId(null); }} />

      <TradeNavigationLightbox
        items={galleryItems} initialIndex={galleryIndex} initialScreenshot={galleryScreen} open={galleryOpen} onClose={() => setGalleryOpen(false)}
        oracleTrades={oracleTrades.map((o) => ({ tradeNumber: o.trade_number, tradeDate: o.trade_date, direction: o.direction, entryTime: o.entry_time, rr: o.rr, screenshotM15: o.screenshot_m15_m5 || null, screenshotM5: o.screenshot_m1 || null }))}
        isSuperAdmin={isSuperAdmin}
        onValidate={galleryRequestId ? async (executionId, isValid, note) => {
          const k = `${galleryRequestId}_${executionId}`;
          setTradeValidity((p) => ({ ...p, [k]: isValid }));
          setTradeNotes((p) => ({ ...p, [k]: note }));
          saveTradeNote(galleryRequestId!, executionId, note, isValid);
          const req = requests.find((r) => r.id === galleryRequestId);
          if (req) {
            const exec = req.executions.find((e) => e.id === executionId);
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from("user_notifications").insert({ user_id: req.user_id, sender_id: user?.id, type: isValid ? "trade_validated" : "trade_rejected", message: `${isValid ? "✅" : "❌"} Trade #${exec?.trade_number || "?"}${note ? ` — ${note}` : ""}` });
          }
        } : undefined}
        onSupplementaryNote={galleryRequestId ? (executionId, note) => {
          saveTradeNote(galleryRequestId!, executionId, tradeNotes[`${galleryRequestId}_${executionId}`] || "", tradeValidity[`${galleryRequestId}_${executionId}`] !== false, note);
        } : undefined}
        validationState={galleryRequestId ? Object.fromEntries(
          Object.entries(tradeValidity).filter(([k]) => k.startsWith(`${galleryRequestId}_`)).map(([k, v]) => [k.replace(`${galleryRequestId}_`, ""), { isValid: v, note: tradeNotes[k] || "" }])
        ) : undefined}
        savingValidation={savingNote ? savingNote.replace(`${galleryRequestId}_`, "") : null}
      />

      <AdminTradeNotesViewer open={!!notesViewerRequestId} onOpenChange={(o) => { if (!o) setNotesViewerRequestId(null); }} requestId={notesViewerRequestId || ""} executions={notesViewerExecs} onNotesUpdated={() => { if (notesViewerRequestId) loadTradeNotes(notesViewerRequestId); }} />

      {/* Action Dialog (freeze/ban/remove/unfreeze/unban) */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {actionDialogContent?.icon}
              <div>
                <DialogTitle>{actionDialogContent?.title}</DialogTitle>
                <DialogDescription className="mt-1">{actionDialogContent?.desc}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {(actionType === "freeze" || actionType === "ban") && (
            <div className="py-2">
              <label className="text-xs font-mono uppercase text-muted-foreground mb-1 block">Raison (optionnel)</label>
              <Input value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Raison..." className="text-sm" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>Annuler</Button>
            <Button variant={actionDialogContent?.variant} onClick={executeAction} disabled={actionProcessing}>
              {actionProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {actionDialogContent?.btn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
