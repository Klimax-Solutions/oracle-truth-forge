import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Users,
  TrendingUp,
  Loader2,
  ChevronDown,
  ChevronUp,
  Shield,
  Lock,
  Play,
  AlertTriangle,
  Award,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Image as ImageIcon,
  ClipboardList,
  MessageSquare,
  Save,
  Crown,
  Ghost,
  Flame,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserFollowupTab } from "./admin/UserFollowupTab";
import { UserHistoryTab } from "./admin/UserHistoryTab";
import { AdminUserDataViewer } from "./admin/AdminUserDataViewer";
import { AdminTradeNotesViewer } from "./admin/AdminTradeNotesViewer";
import { RoleManagement } from "./admin/RoleManagement";
import { EarlyAccessRequestsTab } from "./admin/EarlyAccessRequestsTab";
import { QuestStepManager } from "./admin/QuestStepManager";
import { ScreenshotLink } from "./ScreenshotLink";
import { TradeNavigationLightbox, type TradeScreenshotItem, type OracleMatch } from "./TradeNavigationLightbox";
import { useSidebarRoles } from "./DashboardSidebar";


// Oracle trade from the master database
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

interface VerificationRequest {
  id: string;
  user_id: string;
  cycle_id: string;
  user_cycle_id: string;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  admin_comments: string | null;
}

interface UserCycle {
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

interface Cycle {
  id: string;
  cycle_number: number;
  name: string;
  trade_start: number;
  trade_end: number;
  total_trades: number;
  phase: number;
}

interface Trade {
  id: string;
  trade_number: number;
  rr: number;
  direction: string;
  trade_date: string;
  user_id: string;
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

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
}

interface ExecutionComparison {
  execution: UserExecution;
  oracleTrade: OracleTrade | null;
  status: 'match' | 'warning' | 'error' | 'no-match';
  timeDiffHours: number | null;
}

interface PendingRequest extends VerificationRequest {
  cycle: Cycle | null;
  userCycle: UserCycle | null;
  executions: UserExecution[];
  comparisons: ExecutionComparison[];
  userName: string;
  attemptNumber: number;
}

interface PlatformUser {
  id: string;
  displayName: string;
  email?: string | null;
  created_at: string;
  currentCycle: Cycle | null;
  userCycles: UserCycle[];
  totalTrades: number;
  totalRR: number;
  status: "active" | "pending" | "completed";
  profileStatus: "active" | "pending" | "frozen" | "banned";
  executions: UserExecution[];
  // Enrichissements
  roles: string[]; // ['member','early_access',...]
  hasCycles: boolean; // false = fantôme
  lastSeenAt: string | null;
  fakeScore: number; // 0=réel, 100=très probable fake
  fakeLevel: "real" | "low" | "medium" | "high";
}

interface PendingAccount {
  id: string;
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  created_at: string;
  email?: string;
}

export const AdminVerification = () => {
  const { isSuperAdmin } = useSidebarRoles();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [oracleTrades, setOracleTrades] = useState<OracleTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [dataViewerUserId, setDataViewerUserId] = useState<string | null>(null);
  const [dataViewerUserName, setDataViewerUserName] = useState("");
  const [tradeNotes, setTradeNotes] = useState<Record<string, string>>({});
  const [tradeValidity, setTradeValidity] = useState<Record<string, boolean>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [processingApproval, setProcessingApproval] = useState<string | null>(null);
  const [securityAlerts, setSecurityAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [galleryItems, setGalleryItems] = useState<TradeScreenshotItem[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryScreen, setGalleryScreen] = useState<"m15" | "m5">("m15");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryRequestId, setGalleryRequestId] = useState<string | null>(null);
  // Search states
  const [userSearch, setUserSearch] = useState("");
  const [verificationSearch, setVerificationSearch] = useState("");
  const [verificationAssigneeFilter, setVerificationAssigneeFilter] = useState<string>("all");
  // Users panel filters
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userInitFilter, setUserInitFilter] = useState<string>("all"); // all | initialized | ghost
  const [userActivityFilter, setUserActivityFilter] = useState<string>("all"); // all | with_trades | no_trades
  const [userFakeFilter, setUserFakeFilter] = useState<string>("all"); // all | real | suspicious | fake
  const [userCycleFilter, setUserCycleFilter] = useState<string>("all"); // all | 0..8
  const [userSortBy, setUserSortBy] = useState<string>("smart"); // smart | recent | name | trades | cycle
  const [historySearch, setHistorySearch] = useState("");
  // Assignment states
  const [assigningRequest, setAssigningRequest] = useState<string | null>(null);
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [notesViewerRequestId, setNotesViewerRequestId] = useState<string | null>(null);
  const [notesViewerExecs, setNotesViewerExecs] = useState<{ id: string; trade_number: number; direction: string; trade_date: string }[]>([]);
  const { toast } = useToast();

  const openGallery = (executions: UserExecution[], execIndex: number, screen: "m15" | "m5", requestId?: string) => {
    const items: TradeScreenshotItem[] = executions.map((e) => ({
      tradeNumber: e.trade_number,
      tradeDate: e.trade_date,
      direction: e.direction,
      directionStructure: e.direction_structure,
      entryTime: e.entry_time,
      exitTime: e.exit_time,
      rr: e.rr,
      setupType: e.setup_type,
      entryModel: e.entry_model,
      entryTiming: e.entry_timing,
      entryTimeframe: e.entry_timeframe,
      notes: e.notes,
      screenshotM15: e.screenshot_url,
      screenshotM5: e.screenshot_entry_url,
      executionId: e.id,
    }));
    setGalleryItems(items);
    setGalleryIndex(execIndex);
    setGalleryScreen(screen);
    setGalleryOpen(true);
    setGalleryRequestId(requestId || null);
  };

  const fetchPendingAccounts = async () => {
    setLoadingPending(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, first_name, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    
    if (data) {
      setPendingAccounts(data as PendingAccount[]);
    }
    setLoadingPending(false);
  };

  const handleApproveAccount = async (userId: string) => {
    setProcessingApproval(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "active" })
      .eq("user_id", userId);
    
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Compte approuvé", description: "L'utilisateur peut maintenant se connecter." });
      fetchPendingAccounts();
      fetchUsers();
    }
    setProcessingApproval(null);
  };

  const handleRejectAccount = async (userId: string) => {
    setProcessingApproval(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ status: "banned", status_reason: "Inscription refusée par l'administrateur" })
      .eq("user_id", userId);
    
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Compte refusé", description: "L'inscription a été rejetée." });
      fetchPendingAccounts();
    }
    setProcessingApproval(null);
  };
  const fetchSecurityAlerts = async () => {
    setLoadingAlerts(true);
    const { data } = await supabase
      .from("security_alerts")
      .select("*")
      .eq("resolved", false)
      .order("created_at", { ascending: false });
    
    if (data) setSecurityAlerts(data);
    setLoadingAlerts(false);
  };

  const handleResolveAlert = async (alertId: string, userId: string, unfreeze: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("security_alerts")
      .update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq("id", alertId);

    if (unfreeze) {
      // Unfreeze the user and clear their extra sessions (keep only 2)
      await supabase
        .from("profiles")
        .update({ status: "active", frozen_at: null, frozen_by: null, status_reason: null })
        .eq("user_id", userId);
      
      // Delete all sessions for this user so they re-register on next login
      await supabase
        .from("user_sessions")
        .delete()
        .eq("user_id", userId);
    }

    toast({ title: "Alerte résolue" });
    fetchSecurityAlerts();
    fetchUsers();
  };

  const fetchCycles = async () => {
    const { data } = await supabase
      .from("cycles")
      .select("*")
      .order("cycle_number", { ascending: true });
    
    if (data) {
      setCycles(data as Cycle[]);
    }
    return data || [];
  };

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*");
    
    if (data) {
      setProfiles(data as Profile[]);
    }
    return data || [];
  };

  const fetchRequests = async () => {
    setLoading(true);
    
    const cyclesData = await fetchCycles();
    const profilesData = await fetchProfiles();
    
    // Fetch all pending verification requests
    const { data: requestsData, error: requestsError } = await supabase
      .from("verification_requests")
      .select("*")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    // Fetch ALL verification requests (all statuses) to count attempts per user+cycle
    const { data: allRequestsData } = await supabase
      .from("verification_requests")
      .select("user_id, cycle_id")
      .order("requested_at", { ascending: true });

    if (requestsError) {
      console.error("Error fetching requests:", requestsError);
      setLoading(false);
      return;
    }

    if (!requestsData || requestsData.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Fetch user cycles
    const userCycleIds = requestsData.map(r => r.user_cycle_id);
    const { data: userCyclesData } = await supabase
      .from("user_cycles")
      .select("*")
      .in("id", userCycleIds);

    // Fetch all user_executions for the users (trades saisis par les utilisateurs)
    const userIds = [...new Set(requestsData.map(r => r.user_id))];
    const { data: executionsData } = await supabase
      .from("user_executions")
      .select("*")
      .in("user_id", userIds)
      .order("trade_number", { ascending: true });

    // Fetch Oracle trades for comparison (the master reference)
    const { data: oracleData } = await supabase
      .from("trades")
      .select("id, trade_number, trade_date, entry_time, direction, rr, screenshot_m15_m5, screenshot_m1")
      .order("trade_number", { ascending: true });
    
    const oracleTrades = (oracleData || []) as (OracleTrade & { screenshot_m15_m5?: string | null; screenshot_m1?: string | null })[];
    setOracleTrades(oracleTrades);

    // Helper function to compare execution with Oracle trade
    const compareExecution = (exec: UserExecution): ExecutionComparison => {
      const oracleTrade = oracleTrades.find(t => t.trade_number === exec.trade_number);
      
      if (!oracleTrade) {
        return { execution: exec, oracleTrade: null, status: 'no-match', timeDiffHours: null };
      }

      // Compare date and time
      const userDateTime = new Date(`${exec.trade_date}T${exec.entry_time || '00:00'}:00`);
      const oracleDateTime = new Date(`${oracleTrade.trade_date}T${oracleTrade.entry_time || '00:00'}:00`);
      
      const timeDiffMs = Math.abs(userDateTime.getTime() - oracleDateTime.getTime());
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      // Determine status based on time difference
      let status: 'match' | 'warning' | 'error';
      if (timeDiffHours <= 5) {
        status = 'match';
      } else if (timeDiffHours <= 24) {
        status = 'warning';
      } else {
        status = 'error';
      }

      return { execution: exec, oracleTrade, status, timeDiffHours };
    };

    // Count attempts per user+cycle
    const attemptCounts: Record<string, number> = {};
    (allRequestsData || []).forEach((r: any) => {
      const key = `${r.user_id}_${r.cycle_id}`;
      attemptCounts[key] = (attemptCounts[key] || 0) + 1;
    });

    // Combine data with comparisons
    const enrichedRequests: PendingRequest[] = requestsData.map(request => {
      const userCycle = userCyclesData?.find(uc => uc.id === request.user_cycle_id) || null;
      const cycle = cyclesData?.find(c => c.id === request.cycle_id) || null;
      const profile = profilesData?.find(p => p.user_id === request.user_id);
      
      // Filter executions for this user within the cycle's trade range
      const executions = (executionsData?.filter(e => 
        e.user_id === request.user_id && 
        cycle && 
        e.trade_number >= cycle.trade_start && 
        e.trade_number <= cycle.trade_end
      ) || []) as UserExecution[];

      // Create comparisons for each execution
      const comparisons = executions.map(exec => compareExecution(exec));

      const attemptKey = `${request.user_id}_${request.cycle_id}`;

      return {
        ...request,
        cycle: cycle as Cycle | null,
        userCycle: userCycle as UserCycle | null,
        executions,
        comparisons,
        userName: profile?.display_name || `Utilisateur ${request.user_id.slice(0, 8)}`,
        attemptNumber: attemptCounts[attemptKey] || 1,
      };
    });

    setRequests(enrichedRequests);
    setLoading(false);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);

    // Source de vérité = profiles (227 users)
    const [profilesRes, userCyclesRes, executionsRes, rolesRes, sessionsRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_cycles").select("*").order("created_at", { ascending: true }),
      supabase.from("user_executions").select("*").order("trade_number", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_sessions").select("user_id, updated_at").order("updated_at", { ascending: false }),
    ]);

    const profilesData = profilesRes.data || [];
    const allUserCycles = userCyclesRes.data || [];
    const allExecutions = executionsRes.data || [];
    const allRoles = rolesRes.data || [];
    const allSessions = sessionsRes.data || [];

    // Map: user_id -> dernière session
    const lastSeenMap = new Map<string, string>();
    allSessions.forEach(s => {
      if (!lastSeenMap.has(s.user_id)) lastSeenMap.set(s.user_id, s.updated_at);
    });

    const now = Date.now();

    const platformUsers: PlatformUser[] = profilesData.map(profile => {
      const userId = profile.user_id;
      const userCycles = allUserCycles.filter(uc => uc.user_id === userId);
      const userExecutions = allExecutions.filter(e => e.user_id === userId) as UserExecution[];
      const userRoles = allRoles.filter(r => r.user_id === userId).map(r => r.role);
      const lastSeenAt = lastSeenMap.get(userId) || null;

      const activeCycle = userCycles.find(uc =>
        uc.status === "in_progress" || uc.status === "pending_review"
      );
      const currentCycleData = activeCycle ? cycles.find(c => c.id === activeCycle.cycle_id) : null;

      const totalRR = userExecutions.reduce((sum, e) => sum + (e.rr || 0), 0);

      const hasPending = userCycles.some(uc => uc.status === "pending_review");
      const allValidated = userCycles.every(uc => uc.status === "validated");

      let status: "active" | "pending" | "completed" = "active";
      if (hasPending) status = "pending";
      if (allValidated && userCycles.length === cycles.length && userCycles.length > 0) status = "completed";

      // ----- Score Fake combiné (0 = réel, 100 = très probable fake) -----
      let fakeScore = 0;
      const ageDays = (now - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const lastSeenDays = lastSeenAt
        ? (now - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      if (!lastSeenAt) fakeScore += 40; // jamais connecté
      else if (lastSeenDays > 30) fakeScore += 20;

      if (userExecutions.length === 0) fakeScore += 25;
      if (userCycles.length === 0) fakeScore += 15; // fantôme
      if (profile.status === "pending" && ageDays > 7) fakeScore += 15;
      if (userRoles.length === 0) fakeScore += 10;
      if (ageDays < 1 && !lastSeenAt) fakeScore = Math.min(fakeScore, 30); // trop tôt pour juger

      let fakeLevel: "real" | "low" | "medium" | "high" = "real";
      if (fakeScore >= 70) fakeLevel = "high";
      else if (fakeScore >= 45) fakeLevel = "medium";
      else if (fakeScore >= 25) fakeLevel = "low";

      return {
        id: userId,
        displayName: profile.display_name || profile.first_name || `Utilisateur ${userId.slice(0, 8)}`,
        created_at: profile.created_at,
        currentCycle: currentCycleData || null,
        userCycles: userCycles as UserCycle[],
        totalTrades: userExecutions.length,
        totalRR,
        status,
        profileStatus: profile.status as PlatformUser["profileStatus"],
        executions: userExecutions,
        roles: userRoles,
        hasCycles: userCycles.length > 0,
        lastSeenAt,
        fakeScore,
        fakeLevel,
      };
    });

    // Tri : actifs récents d'abord, fakes en bas
    platformUsers.sort((a, b) => {
      if (a.fakeLevel !== b.fakeLevel) {
        const order = { real: 0, low: 1, medium: 2, high: 3 };
        return order[a.fakeLevel] - order[b.fakeLevel];
      }
      const aSeen = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const bSeen = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return bSeen - aSeen;
    });

    setUsers(platformUsers);
    setLoadingUsers(false);
  };

  // Fetch admin/super_admin profiles for assignment
  const fetchAdminProfiles = async () => {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "super_admin"]);
    
    if (adminRoles) {
      const adminIds = [...new Set(adminRoles.map(r => r.user_id))];
      const { data: adminProfilesData } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", adminIds);
      if (adminProfilesData) setAdminProfiles(adminProfilesData as Profile[]);
    }
  };

  // Assign admin to verification request
  const handleAssignAdmin = async (requestId: string, adminUserId: string) => {
    const { error } = await supabase
      .from("verification_requests")
      .update({ assigned_to: adminUserId })
      .eq("id", requestId);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Assigné", description: "L'administrateur a été assigné à cette vérification." });
      setAssigningRequest(null);
      fetchRequests();
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchCycles();
      await fetchRequests();
      await fetchUsers();
      await fetchPendingAccounts();
      await fetchSecurityAlerts();
      await fetchAdminProfiles();
    };
    init();
  }, []);

  const handleApprove = async (request: PendingRequest) => {
    if (!request.userCycle || !request.cycle) return;
    
    setProcessing(request.id);
    const feedbackText = feedback[request.id] || "";

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Gather per-trade notes for the report
      const tradeReport = request.executions.map(exec => {
        const key = `${request.id}_${exec.id}`;
        const isValid = tradeValidity[key] !== false;
        const note = tradeNotes[key] || "";
        return { trade_number: exec.trade_number, is_valid: isValid, note };
      });

      const rejectedTrades = tradeReport.filter(t => !t.is_valid);
      const validatedTrades = tradeReport.filter(t => t.is_valid);

      // Build report message
      let reportMessage = `✅ ${request.cycle.name} validé !\n`;
      reportMessage += `${validatedTrades.length} trade(s) validé(s), ${rejectedTrades.length} trade(s) refusé(s).\n`;
      if (rejectedTrades.length > 0) {
        reportMessage += "\nTrades refusés :\n";
        rejectedTrades.forEach(t => {
          reportMessage += `• Trade #${t.trade_number}${t.note ? ` — ${t.note}` : ""}\n`;
        });
      }
      if (feedbackText) {
        reportMessage += `\nCommentaire : ${feedbackText}`;
      }

      // Update verification request with reviewer info
      const { error: requestError } = await supabase
        .from("verification_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_comments: feedbackText,
        })
        .eq("id", request.id);

      if (requestError) throw requestError;

      // Update user cycle
      const { error: cycleError } = await supabase
        .from("user_cycles")
        .update({
          status: "validated",
          verified_at: new Date().toISOString(),
          admin_feedback: reportMessage,
        })
        .eq("id", request.userCycle.id);

      if (cycleError) throw cycleError;

      // Unlock next cycle
      await supabase.rpc("unlock_next_cycle", {
        p_user_id: request.user_id,
        p_current_cycle_number: request.cycle.cycle_number,
      });

      // Complementary trades are computed virtually by useDataGenerale
      const addedMsg = "";

      // Send notification to user
      await supabase.from("user_notifications").insert({
        user_id: request.user_id,
        sender_id: user.id,
        type: "cycle_validated",
        message: reportMessage,
      });

      toast({
        title: "Cycle validé !",
        description: `Le ${request.cycle.name} a été validé avec succès. Le cycle suivant est maintenant débloqué.${addedMsg}`,
      });

      fetchRequests();
      fetchUsers();
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la validation.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: PendingRequest) => {
    if (!request.userCycle || !request.cycle) return;
    
    const feedbackText = feedback[request.id];
    if (!feedbackText?.trim()) {
      toast({
        title: "Feedback requis",
        description: "Veuillez fournir un feedback pour expliquer le refus.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(request.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Gather per-trade notes for the report
      const tradeReport = request.executions.map(exec => {
        const key = `${request.id}_${exec.id}`;
        const isValid = tradeValidity[key] !== false;
        const note = tradeNotes[key] || "";
        return { trade_number: exec.trade_number, is_valid: isValid, note };
      });

      const rejectedTrades = tradeReport.filter(t => !t.is_valid);
      const validatedTrades = tradeReport.filter(t => t.is_valid);

      // Build report message
      let reportMessage = `❌ ${request.cycle.name} refusé.\n`;
      reportMessage += `${validatedTrades.length} trade(s) validé(s), ${rejectedTrades.length} trade(s) refusé(s).\n`;
      if (rejectedTrades.length > 0) {
        reportMessage += "\nTrades refusés :\n";
        rejectedTrades.forEach(t => {
          reportMessage += `• Trade #${t.trade_number}${t.note ? ` — ${t.note}` : ""}\n`;
        });
      }
      reportMessage += `\nCommentaire : ${feedbackText}`;

      // Update verification request with reviewer info
      const { error: requestError } = await supabase
        .from("verification_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_comments: feedbackText,
        })
        .eq("id", request.id);

      if (requestError) throw requestError;

      // Update user cycle - set to rejected so user can re-harvest
      const { error: cycleError } = await supabase
        .from("user_cycles")
        .update({
          status: "rejected",
          admin_feedback: reportMessage,
        })
        .eq("id", request.userCycle.id);

      if (cycleError) throw cycleError;

      // Send notification to user
      await supabase.from("user_notifications").insert({
        user_id: request.user_id,
        sender_id: user.id,
        type: "cycle_rejected",
        message: reportMessage,
      });

      toast({
        title: "Cycle refusé",
        description: `Le ${request.cycle.name} a été refusé. L'utilisateur a été notifié.`,
      });

      fetchRequests();
      fetchUsers();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du refus.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const calculateStats = (executions: UserExecution[]) => {
    const totalRR = executions.reduce((sum, e) => sum + (e.rr || 0), 0);
    const wins = executions.filter(e => (e.rr || 0) > 0).length;
    const winRate = executions.length > 0 ? (wins / executions.length) * 100 : 0;
    const avgRR = executions.length > 0 ? totalRR / executions.length : 0;
    
    return { totalRR, winRate, avgRR, wins, losses: executions.length - wins };
  };

  // Load existing trade notes for a request
  const loadTradeNotes = async (requestId: string) => {
    const { data } = await supabase
      .from("admin_trade_notes")
      .select("*")
      .eq("verification_request_id", requestId);

    if (data) {
      const notes: Record<string, string> = {};
      const validity: Record<string, boolean> = {};
      data.forEach((n: any) => {
        const key = `${requestId}_${n.execution_id}`;
        notes[key] = n.note || "";
        validity[key] = n.is_valid !== false;
      });
      setTradeNotes(prev => ({ ...prev, ...notes }));
      setTradeValidity(prev => ({ ...prev, ...validity }));
    }
  };

  // Save a per-trade note
  const saveTradeNote = async (requestId: string, executionId: string, note: string, isValid: boolean, supplementaryNote?: string) => {
    const key = `${requestId}_${executionId}`;
    setSavingNote(key);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const upsertData: any = {
        verification_request_id: requestId,
        execution_id: executionId,
        admin_id: user.id,
        note,
        is_valid: isValid,
      };
      if (supplementaryNote !== undefined) {
        upsertData.supplementary_note = supplementaryNote;
      }

      const { error } = await supabase
        .from("admin_trade_notes")
        .upsert(upsertData, { onConflict: "verification_request_id,execution_id" });

      if (error) throw error;
    } catch (error) {
      console.error("Error saving trade note:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la note.",
        variant: "destructive",
      });
    } finally {
      setSavingNote(null);
    }
  };

  // Toggle trade validity
  const toggleTradeValidity = (requestId: string, executionId: string) => {
    const key = `${requestId}_${executionId}`;
    const newValidity = !(tradeValidity[key] !== false);
    setTradeValidity(prev => ({ ...prev, [key]: newValidity }));
    const note = tradeNotes[key] || "";
    saveTradeNote(requestId, executionId, note, newValidity);
  };

  // Calculate accuracy for a request based on comparisons
  const getAccuracyPercent = (comparisons: ExecutionComparison[]) => {
    if (comparisons.length === 0) return 0;
    const matchCount = comparisons.filter(c => c.status === 'match').length;
    return (matchCount / comparisons.length) * 100;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "locked": return <Lock className="w-3.5 h-3.5 text-muted-foreground" />;
      case "in_progress": return <Play className="w-3.5 h-3.5 text-blue-400" />;
      case "pending_review": return <Clock className="w-3.5 h-3.5 text-orange-400" />;
      case "validated": return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case "rejected": return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "locked": return "Verrouillé";
      case "in_progress": return "En cours";
      case "pending_review": return "En attente";
      case "validated": return "Validé";
      case "rejected": return "Refusé";
      default: return status;
    }
  };
  const handleCycleStatusChangeDirectly = async (
    userId: string,
    cycle: Cycle,
    userCycle: UserCycle | undefined,
    targetStatus: string
  ) => {
    if (!userCycle) {
      toast({ title: "Erreur", description: "Cycle non initialisé.", variant: "destructive" });
      return;
    }
    try {
      const updateData: any = { status: targetStatus };
      if (targetStatus === "validated") {
        updateData.verified_at = new Date().toISOString();
        updateData.completed_at = new Date().toISOString();
      }
      if (targetStatus === "rejected" || targetStatus === "locked" || targetStatus === "in_progress") {
        updateData.verified_at = null;
        updateData.completed_at = null;
      }
      if (targetStatus === "in_progress" && !userCycle.started_at) {
        updateData.started_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("user_cycles")
        .update(updateData)
        .eq("id", userCycle.id);
      if (error) throw error;

      if (targetStatus === "validated" || targetStatus === "rejected") {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from("verification_requests")
          .update({
            status: targetStatus === "validated" ? "approved" : "rejected",
            reviewed_at: new Date().toISOString(),
            reviewed_by: user?.id,
          })
          .eq("user_cycle_id", userCycle.id)
          .eq("status", "pending");

        if (targetStatus === "validated") {
          await supabase.rpc("unlock_next_cycle", {
            p_user_id: userId,
            p_current_cycle_number: cycle.cycle_number,
          });
        }
      }

      toast({ title: "Statut modifié", description: `${cycle.name} → ${getStatusLabel(targetStatus)}` });
      fetchUsers();
      fetchRequests();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message || "Impossible de modifier le statut.", variant: "destructive" });
    }
  };

  const CYCLE_STATUSES = ["locked", "in_progress", "pending_review", "validated", "rejected"] as const;

  const handleCycleStatusChange = async (
    userId: string,
    cycle: Cycle,
    userCycle: UserCycle | undefined,
    currentStatus: string
  ) => {
    // Cycle through statuses: locked → in_progress → pending_review → validated → rejected → locked
    const currentIdx = CYCLE_STATUSES.indexOf(currentStatus as any);
    const nextIdx = (currentIdx + 1) % CYCLE_STATUSES.length;
    const newStatus = CYCLE_STATUSES[nextIdx];

    if (!userCycle) {
      toast({
        title: "Erreur",
        description: "Ce cycle n'est pas encore initialisé pour cet utilisateur.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "validated") {
        updateData.verified_at = new Date().toISOString();
        updateData.completed_at = new Date().toISOString();
      }
      if (newStatus === "in_progress" && !userCycle.started_at) {
        updateData.started_at = new Date().toISOString();
      }
      if (newStatus === "rejected" || newStatus === "locked" || newStatus === "in_progress") {
        updateData.verified_at = null;
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from("user_cycles")
        .update(updateData)
        .eq("id", userCycle.id);

      if (error) throw error;

      // Also update the corresponding verification_request if exists
      if (newStatus === "validated" || newStatus === "rejected") {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from("verification_requests")
          .update({
            status: newStatus === "validated" ? "approved" : "rejected",
            reviewed_at: new Date().toISOString(),
            reviewed_by: user?.id,
          })
          .eq("user_cycle_id", userCycle.id)
          .eq("status", "pending");
      }

      toast({
        title: "Statut modifié",
        description: `${cycle.name} → ${getStatusLabel(newStatus)}`,
      });

      fetchUsers();
      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le statut.",
        variant: "destructive",
      });
    }
  };

  const getUserProgressPercentage = (user: PlatformUser) => {
    const validatedCycles = user.userCycles.filter(uc => uc.status === "validated").length;
    return (validatedCycles / cycles.length) * 100;
  };

  if (loading && loadingUsers) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center gap-2 md:gap-3 mb-1">
          <Shield className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          <h2 className="text-lg md:text-xl font-semibold text-foreground">
            Panel Administrateur
          </h2>
        </div>
        <p className="text-xs md:text-sm text-muted-foreground font-mono">
          Gestion des utilisateurs et vérification des cycles Oracle
        </p>
      </div>

      <div className="flex-1 p-4 md:p-6 overflow-hidden">
        <Tabs defaultValue="users" className="h-full flex flex-col">
          <TabsList className="mb-4 self-start flex-wrap gap-1 h-auto">
            <TabsTrigger value="users" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Utilisateurs</span> ({users.length})
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Crown className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Gestion des Rôles</span>
            </TabsTrigger>
            <TabsTrigger value="approvals" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Shield className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Approbations</span>
            </TabsTrigger>
            <TabsTrigger value="ea-requests" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
              <span className="hidden sm:inline">Demandes EA</span>
            </TabsTrigger>
            <TabsTrigger value="verifications" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Vérifications</span> ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="followup" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <ClipboardList className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Suivi
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Historique
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Alertes Sécurité</span>
            </TabsTrigger>
            <TabsTrigger value="quests" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Gestion Quêtes</span>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="flex-1 overflow-auto mt-0">
            {loadingUsers ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Aucun utilisateur
                </h3>
                <p className="text-sm text-muted-foreground">
                  Aucun utilisateur n'est inscrit sur la plateforme.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Stats Summary - 6 cartes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 mb-4">
                  <div className="p-3 bg-card border border-border rounded-md">
                    <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Total</p>
                    <p className="text-xl font-bold text-foreground">{users.length}</p>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-md">
                    <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Connectés</p>
                    <p className="text-xl font-bold text-blue-400">{users.filter(u => u.lastSeenAt).length}</p>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-md">
                    <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Avec Trades</p>
                    <p className="text-xl font-bold text-emerald-400">{users.filter(u => u.totalTrades > 0).length}</p>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-md">
                    <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Fantômes</p>
                    <p className="text-xl font-bold text-purple-400">{users.filter(u => !u.hasCycles).length}</p>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-md">
                    <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Suspects</p>
                    <p className="text-xl font-bold text-orange-400">{users.filter(u => u.fakeLevel === "medium").length}</p>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-md">
                    <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Probables Fakes</p>
                    <p className="text-xl font-bold text-red-400">{users.filter(u => u.fakeLevel === "high").length}</p>
                  </div>
                </div>

                {/* Filtres */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-card border border-border rounded-md">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono uppercase">
                    <Filter className="w-3.5 h-3.5" /> Filtres
                  </div>
                  <Input
                    placeholder="Rechercher nom..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="h-8 text-xs w-44"
                  />
                  <Select value={userStatusFilter} onValueChange={setUserStatusFilter}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Statut" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="frozen">Frozen</SelectItem>
                      <SelectItem value="banned">Banned</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Rôle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous rôles</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="early_access">Early Access</SelectItem>
                      <SelectItem value="institute">Institut</SelectItem>
                      <SelectItem value="setter">Setter</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="none">Sans rôle</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userInitFilter} onValueChange={setUserInitFilter}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Initialisation" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous (init/non)</SelectItem>
                      <SelectItem value="initialized">Initialisés</SelectItem>
                      <SelectItem value="ghost">Fantômes</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userActivityFilter} onValueChange={setUserActivityFilter}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Activité" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toute activité</SelectItem>
                      <SelectItem value="with_trades">Avec trades</SelectItem>
                      <SelectItem value="no_trades">Sans trades</SelectItem>
                      <SelectItem value="seen_7d">Vu &lt; 7j</SelectItem>
                      <SelectItem value="seen_30d">Vu &lt; 30j</SelectItem>
                      <SelectItem value="never_seen">Jamais connecté</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userCycleFilter} onValueChange={setUserCycleFilter}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Cycle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous cycles</SelectItem>
                      {cycles.map(c => (
                        <SelectItem key={c.id} value={String(c.cycle_number)}>
                          {c.cycle_number === 0 ? "Ébauche" : `Cycle ${c.cycle_number}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={userFakeFilter} onValueChange={setUserFakeFilter}>
                    <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Fake score" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="real">Réels uniquement</SelectItem>
                      <SelectItem value="suspicious">Suspects (medium)</SelectItem>
                      <SelectItem value="fake">Probables fakes</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userSortBy} onValueChange={setUserSortBy}>
                    <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Tri" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smart">Tri intelligent</SelectItem>
                      <SelectItem value="recent">Dernière connexion</SelectItem>
                      <SelectItem value="name">Nom (A-Z)</SelectItem>
                      <SelectItem value="trades">Plus de trades</SelectItem>
                      <SelectItem value="cycle">Cycle atteint</SelectItem>
                      <SelectItem value="created">Date d'inscription</SelectItem>
                    </SelectContent>
                  </Select>
                  {(userStatusFilter !== "all" || userRoleFilter !== "all" || userInitFilter !== "all" || userActivityFilter !== "all" || userCycleFilter !== "all" || userFakeFilter !== "all" || userSearch) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setUserSearch("");
                        setUserStatusFilter("all");
                        setUserRoleFilter("all");
                        setUserInitFilter("all");
                        setUserActivityFilter("all");
                        setUserCycleFilter("all");
                        setUserFakeFilter("all");
                      }}
                    >
                      Réinitialiser
                    </Button>
                  )}
                </div>

                {/* Users List avec filtrage + tri */}
                {(() => {
                  const nowMs = Date.now();
                  const filtered = users.filter(u => {
                    if (userSearch && !u.displayName.toLowerCase().includes(userSearch.toLowerCase())) return false;
                    if (userStatusFilter !== "all" && u.profileStatus !== userStatusFilter) return false;
                    if (userRoleFilter === "none") {
                      if (u.roles.length > 0) return false;
                    } else if (userRoleFilter !== "all") {
                      if (!u.roles.includes(userRoleFilter)) return false;
                    }
                    if (userInitFilter === "initialized" && !u.hasCycles) return false;
                    if (userInitFilter === "ghost" && u.hasCycles) return false;
                    if (userActivityFilter === "with_trades" && u.totalTrades === 0) return false;
                    if (userActivityFilter === "no_trades" && u.totalTrades > 0) return false;
                    if (userActivityFilter === "never_seen" && u.lastSeenAt) return false;
                    if (userActivityFilter === "seen_7d") {
                      if (!u.lastSeenAt) return false;
                      if ((nowMs - new Date(u.lastSeenAt).getTime()) > 7 * 86400000) return false;
                    }
                    if (userActivityFilter === "seen_30d") {
                      if (!u.lastSeenAt) return false;
                      if ((nowMs - new Date(u.lastSeenAt).getTime()) > 30 * 86400000) return false;
                    }
                    if (userCycleFilter !== "all") {
                      const targetNum = parseInt(userCycleFilter, 10);
                      const cur = u.currentCycle?.cycle_number ?? -1;
                      if (cur !== targetNum) return false;
                    }
                    if (userFakeFilter === "real" && u.fakeLevel !== "real") return false;
                    if (userFakeFilter === "suspicious" && u.fakeLevel !== "medium") return false;
                    if (userFakeFilter === "fake" && u.fakeLevel !== "high") return false;
                    return true;
                  });

                  const sorted = [...filtered].sort((a, b) => {
                    if (userSortBy === "name") return a.displayName.localeCompare(b.displayName);
                    if (userSortBy === "trades") return b.totalTrades - a.totalTrades;
                    if (userSortBy === "cycle") return (b.currentCycle?.cycle_number ?? -1) - (a.currentCycle?.cycle_number ?? -1);
                    if (userSortBy === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    if (userSortBy === "recent") {
                      const aT = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
                      const bT = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
                      return bT - aT;
                    }
                    return 0; // smart : déjà trié dans fetchUsers
                  });

                  const formatLastSeen = (iso: string | null) => {
                    if (!iso) return "Jamais";
                    const diff = (nowMs - new Date(iso).getTime()) / 1000;
                    if (diff < 60) return "À l'instant";
                    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
                    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
                    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}j`;
                    if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mois`;
                    return `${Math.floor(diff / (86400 * 365))}an+`;
                  };

                  if (sorted.length === 0) {
                    return (
                      <div className="text-center py-12 text-sm text-muted-foreground font-mono">
                        Aucun utilisateur ne correspond aux filtres ({users.length} au total)
                      </div>
                    );
                  }

                  return (
                    <>
                      <p className="text-xs text-muted-foreground font-mono">
                        {sorted.length} / {users.length} utilisateurs
                      </p>
                      {sorted.map((user) => {
                  const isExpanded = expandedUser === user.id;
                  const progress = getUserProgressPercentage(user);
                  const lastSeenLabel = formatLastSeen(user.lastSeenAt);
                  const primaryRole = user.roles.includes("super_admin") ? "super_admin"
                    : user.roles.includes("admin") ? "admin"
                    : user.roles.includes("setter") ? "setter"
                    : user.roles.includes("early_access") ? "early_access"
                    : user.roles.includes("institute") ? "institute"
                    : user.roles[0] || "none";
                  const roleBadgeClass: Record<string, string> = {
                    super_admin: "bg-amber-500/20 text-amber-400 border-amber-500/40",
                    admin: "bg-blue-500/20 text-blue-400 border-blue-500/40",
                    setter: "bg-pink-500/20 text-pink-400 border-pink-500/40",
                    early_access: "bg-purple-500/20 text-purple-400 border-purple-500/40",
                    institute: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
                    member: "bg-slate-500/20 text-slate-400 border-slate-500/40",
                    none: "bg-muted text-muted-foreground border-border",
                  };

                  return (
                    <div
                      key={user.id}
                      className={cn(
                        "border rounded-md overflow-hidden transition-colors",
                        user.status === "pending" 
                          ? "border-orange-500/40 bg-orange-500/5" 
                          : user.status === "completed"
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-border bg-card"
                      )}
                    >
                      {/* User Header */}
                      <div 
                        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 md:gap-4 min-w-0">
                            <div className={cn(
                              "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0",
                              user.status === "pending" 
                                ? "bg-orange-500/20" 
                                : user.status === "completed"
                                  ? "bg-emerald-500/20"
                                  : "bg-primary/20"
                            )}>
                              {user.status === "completed" ? (
                                <Award className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                              ) : (
                                <User className={cn(
                                  "w-4 h-4 md:w-5 md:h-5",
                                  user.status === "pending" ? "text-orange-400" : "text-primary"
                                )} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-foreground text-xs md:text-sm truncate">
                                  {user.displayName}
                                </h4>
                                <span className={cn(
                                  "px-1.5 py-0.5 text-[9px] font-mono uppercase rounded border",
                                  roleBadgeClass[primaryRole]
                                )}>
                                  {primaryRole === "none" ? "sans rôle" : primaryRole.replace("_", " ")}
                                </span>
                                {user.profileStatus !== "active" && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">
                                    {user.profileStatus}
                                  </span>
                                )}
                                {!user.hasCycles && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center gap-1">
                                    <Ghost className="w-2.5 h-2.5" /> Fantôme
                                  </span>
                                )}
                                {user.fakeLevel === "high" && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
                                    <Flame className="w-2.5 h-2.5" /> Fake {user.fakeScore}
                                  </span>
                                )}
                                {user.fakeLevel === "medium" && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">
                                    Suspect {user.fakeScore}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-[10px] md:text-xs text-muted-foreground font-mono truncate">
                                  {user.currentCycle?.name || (user.hasCycles ? "—" : "Cycles non initialisés")}
                                </p>
                                <span className="text-[9px] text-muted-foreground font-mono">·</span>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  Vu: <span className={cn(
                                    !user.lastSeenAt && "text-red-400",
                                    user.lastSeenAt && "text-foreground"
                                  )}>{lastSeenLabel}</span>
                                </p>
                                {user.status === "pending" && (
                                  <span className="px-1 py-0.5 text-[8px] font-mono uppercase bg-orange-500/20 text-orange-400 rounded">
                                    Vérif
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 md:gap-6 flex-shrink-0">
                            {/* Progress - hidden on mobile */}
                            <div className="text-right hidden sm:block">
                              <p className="text-xs md:text-sm font-bold text-foreground">
                                {progress.toFixed(0)}%
                              </p>
                              <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono">
                                Prog.
                              </p>
                            </div>

                            {/* Total RR */}
                            <div className="text-right min-w-[50px] md:min-w-[80px]">
                              <p className={cn(
                                "text-xs md:text-sm font-bold",
                                user.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                              )}>
                                {user.totalRR >= 0 ? "+" : ""}{user.totalRR.toFixed(1)}
                              </p>
                              <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono">
                                {user.totalTrades}t
                              </p>
                            </div>

                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              user.status === "completed" ? "bg-emerald-500" : "bg-primary"
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Expanded Content - Cycle Grid + Trades Detail */}
                      {isExpanded && (
                          <div className="border-t border-border/50 p-3 md:p-4 space-y-4 md:space-y-6">
                            {/* Cycle Grid - responsive */}
                            <div>
                              <p className="text-[10px] md:text-xs font-mono uppercase text-muted-foreground mb-2 md:mb-3">
                                Détail des cycles
                                <span className="ml-2 text-[9px] text-primary">(cliquer pour modifier)</span>
                              </p>
                              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5 md:gap-2">
                              {cycles.map((cycle) => {
                                const userCycle = user.userCycles.find(uc => uc.cycle_id === cycle.id);
                                const status = userCycle?.status || "locked";

                                return (
                                  <div
                                    key={cycle.id}
                                    className={cn(
                                      "p-3 border rounded-md text-center relative group",
                                      status === "locked" && "bg-muted/30 border-border/50 opacity-50",
                                      status === "in_progress" && "bg-blue-500/10 border-blue-500/40",
                                      status === "pending_review" && "bg-orange-500/10 border-orange-500/40",
                                      status === "validated" && "bg-emerald-500/10 border-emerald-500/40",
                                      status === "rejected" && "bg-red-500/10 border-red-500/40"
                                    )}
                                  >
                                    <div className="flex items-center justify-center mb-1">
                                      {getStatusIcon(status)}
                                    </div>
                                    <p className="text-[10px] font-mono font-bold text-foreground">
                                      {cycle.cycle_number === 0 ? "Éb." : `C${cycle.cycle_number}`}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">
                                      {getStatusLabel(status)}
                                    </p>
                                    {userCycle && userCycle.total_rr !== null && (
                                      <p className={cn(
                                        "text-[10px] font-mono mt-1",
                                        (userCycle.total_rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                                      )}>
                                        {(userCycle.total_rr || 0) >= 0 ? "+" : ""}{(userCycle.total_rr || 0).toFixed(0)}
                                      </p>
                                    )}
                                    {/* Buttons to validate/reject - only for non-locked cycles with a userCycle */}
                                    {userCycle && status !== "locked" && (
                                      <div className="flex gap-0.5 mt-1.5 justify-center">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className={cn(
                                                "p-0.5 rounded transition-colors",
                                                status === "validated"
                                                  ? "bg-emerald-500/30 text-emerald-400"
                                                  : "hover:bg-emerald-500/20 text-muted-foreground hover:text-emerald-400"
                                              )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (status !== "validated") {
                                                  handleCycleStatusChangeDirectly(user.id, cycle, userCycle, "validated");
                                                }
                                              }}
                                              disabled={status === "validated"}
                                            >
                                              <CheckCircle className="w-3 h-3" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-[10px]">Valider ce cycle</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className={cn(
                                                "p-0.5 rounded transition-colors",
                                                status === "rejected"
                                                  ? "bg-red-500/30 text-red-400"
                                                  : "hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
                                              )}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (status !== "rejected") {
                                                  handleCycleStatusChangeDirectly(user.id, cycle, userCycle, "rejected");
                                                }
                                              }}
                                              disabled={status === "rejected"}
                                            >
                                              <XCircle className="w-3 h-3" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-[10px]">Refuser ce cycle</TooltipContent>
                                        </Tooltip>
                                      </div>
                                    )}
                                    {/* View past corrections for validated/rejected cycles */}
                                    {userCycle && (status === "validated" || status === "rejected") && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className="mt-1 p-0.5 rounded text-primary hover:text-primary/80 transition-colors"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              // Find verification request for this user_cycle
                                              const { data: vr } = await supabase
                                                .from("verification_requests")
                                                .select("id")
                                                .eq("user_cycle_id", userCycle.id)
                                                .order("created_at", { ascending: false })
                                                .limit(1)
                                                .maybeSingle();
                                              if (vr) {
                                                // Load the executions for this cycle
                                                const cycleExecs = user.executions.filter(
                                                  ex => ex.trade_number >= cycle.trade_start && ex.trade_number <= cycle.trade_end
                                                );
                                                setNotesViewerRequestId(vr.id);
                                                setNotesViewerExecs(cycleExecs.map(ex => ({
                                                  id: ex.id,
                                                  trade_number: ex.trade_number,
                                                  direction: ex.direction,
                                                  trade_date: ex.trade_date,
                                                })));
                                              } else {
                                                toast({ title: "Aucune correction trouvée", description: "Aucune demande de vérification n'a été trouvée pour ce cycle." });
                                              }
                                            }}
                                          >
                                            <MessageSquare className="w-3 h-3" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-[10px]">Voir les corrections</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Trades Detail Table */}
                          {user.executions.length > 0 && (
                            <div>
                              <p className="text-xs font-mono uppercase text-muted-foreground mb-3">
                                Trades saisis ({user.executions.length})
                              </p>
                              <div className="border border-border rounded-md overflow-hidden max-h-64 overflow-y-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/50">
                                      <TableHead className="h-8 text-[10px] font-mono">#</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Date</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Dir</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Structure</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Entrée</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Sortie</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Date Sortie</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Setup</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Modèle</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Timing</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">TF</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono text-right">RR</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Notes</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Screens</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {user.executions.map((exec) => (
                                      <TableRow key={exec.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => {
                                        const idx = user.executions.findIndex(e => e.id === exec.id);
                                        openGallery(user.executions, idx >= 0 ? idx : 0, exec.screenshot_url ? "m15" : "m5");
                                      }}>
                                        <TableCell className="py-1.5 text-xs font-mono font-bold">
                                          {exec.trade_number}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {new Date(exec.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                          <div className={cn(
                                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono",
                                            exec.direction === "Long" 
                                              ? "bg-emerald-500/20 text-emerald-400"
                                              : "bg-red-500/20 text-red-400"
                                          )}>
                                            {exec.direction === "Long" ? (
                                              <ArrowUpRight className="w-3 h-3" />
                                            ) : (
                                              <ArrowDownRight className="w-3 h-3" />
                                            )}
                                            {exec.direction}
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                                          {exec.direction_structure || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {exec.entry_time || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {exec.exit_time || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {exec.exit_date ? new Date(exec.exit_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                          {exec.setup_type && (
                                            <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-mono rounded">
                                              {exec.setup_type}
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                                          {exec.entry_model || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                                          {exec.entry_timing || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                                          {exec.entry_timeframe || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-right">
                                          <span className={cn(
                                            "font-mono font-bold text-xs",
                                            (exec.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                                          )}>
                                            {(exec.rr || 0) >= 0 ? "+" : ""}{(exec.rr || 0).toFixed(1)}
                                          </span>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground max-w-[120px] truncate" title={exec.notes || ""}>
                                          {exec.notes || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                          <div className="inline-flex items-center gap-1.5">
                                            {exec.screenshot_url && (
                                              <button
                                                className="text-[9px] font-mono text-primary hover:text-primary/80 hover:underline"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const idx = user.executions.findIndex(ex => ex.id === exec.id);
                                                  openGallery(user.executions, idx >= 0 ? idx : 0, "m15");
                                                }}
                                              >
                                                M15
                                              </button>
                                            )}
                                            {exec.screenshot_entry_url && (
                                              <button
                                                className="text-[9px] font-mono text-primary hover:text-primary/80 hover:underline"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const idx = user.executions.findIndex(ex => ex.id === exec.id);
                                                  openGallery(user.executions, idx >= 0 ? idx : 0, "m5");
                                                }}
                                              >
                                                M5
                                              </button>
                                            )}
                                            {!exec.screenshot_url && !exec.screenshot_entry_url && (
                                              <span className="text-[9px] font-mono text-muted-foreground">—</span>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}

                          {/* User Info */}
                          <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span className="font-mono">
                                Inscrit le {new Date(user.created_at).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </span>
                              <span className="font-mono">
                                ID: {user.id.slice(0, 8)}...
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDataViewerUserId(user.id);
                                setDataViewerUserName(user.displayName);
                              }}
                            >
                              <ClipboardList className="w-4 h-4" />
                              Voir toutes les données
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                    </>
                  );
                })()}
              </div>
            )}
          </TabsContent>

          {/* Approvals Tab */}
          <TabsContent value="approvals" className="flex-1 overflow-auto mt-0">
            {loadingPending ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <CheckCircle className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Aucun compte en attente
                </h3>
                <p className="text-sm text-muted-foreground">
                  Tous les comptes ont été traités.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 md:p-4 bg-card border border-border rounded-md mb-4">
                  <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
                    En attente d'approbation
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-foreground">
                    {pendingAccounts.length}
                  </p>
                </div>
                {pendingAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-4 bg-card border border-border rounded-md flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">
                          {account.first_name || account.display_name || "Sans nom"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        ID: {account.user_id.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Inscrit le {new Date(account.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveAccount(account.user_id)}
                        disabled={processingApproval === account.user_id}
                        className="gap-1.5"
                      >
                        {processingApproval === account.user_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejectAccount(account.user_id)}
                        disabled={processingApproval === account.user_id}
                        className="gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Refuser
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* EA Requests Tab */}
          <TabsContent value="ea-requests" className="flex-1 overflow-auto mt-0">
            <EarlyAccessRequestsTab />
          </TabsContent>

          {/* Verifications Tab */}
          <TabsContent value="verifications" className="flex-1 overflow-auto mt-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Aucune demande en attente
                </h3>
                <p className="text-sm text-muted-foreground">
                  Toutes les demandes de vérification ont été traitées.
                </p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 md:mb-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
                    <span className="text-xs md:text-sm font-mono uppercase tracking-wider text-muted-foreground">
                      {requests.length} demande{requests.length > 1 ? "s" : ""} en attente
                    </span>
                  </div>
                  <Input
                    placeholder="Rechercher..."
                    value={verificationSearch}
                    onChange={(e) => setVerificationSearch(e.target.value)}
                    className="max-w-xs h-8 text-sm"
                  />
                  {/* Assignee filter */}
                  <select
                    value={verificationAssigneeFilter}
                    onChange={(e) => setVerificationAssigneeFilter(e.target.value)}
                    className="h-8 text-xs font-mono bg-card border border-border rounded-md px-2 text-foreground max-w-[200px]"
                  >
                    <option value="all">Tous les vérificateurs</option>
                    <option value="unassigned">Non assignés</option>
                    {adminProfiles.map(a => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.display_name || "Admin"}
                      </option>
                    ))}
                  </select>
                </div>

                {requests
                  .filter(r => !verificationSearch || r.userName.toLowerCase().includes(verificationSearch.toLowerCase()))
                  .filter(r => {
                    if (verificationAssigneeFilter === "all") return true;
                    if (verificationAssigneeFilter === "unassigned") return !(r as any).assigned_to;
                    return (r as any).assigned_to === verificationAssigneeFilter;
                  })
                  .map((request) => {
                  const stats = calculateStats(request.executions);
                  const isExpanded = expandedRequest === request.id;
                  const isProcessing = processing === request.id;
                  const assignedAdmin = adminProfiles.find(p => p.user_id === (request as any).assigned_to);

                  return (
                    <div
                      key={request.id}
                      className="border border-orange-500/40 bg-orange-500/5 rounded-md overflow-hidden"
                    >
                      {/* Request Header - Mobile */}
                      <div 
                        className="p-3 md:hidden cursor-pointer hover:bg-orange-500/10 transition-colors"
                        onClick={() => {
                          const newId = isExpanded ? null : request.id;
                          setExpandedRequest(newId);
                          if (newId) loadTradeNotes(newId);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-orange-400" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-foreground text-xs truncate flex items-center gap-1 flex-wrap">
                                {request.userName}
                                {request.attemptNumber > 1 && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono flex-shrink-0">
                                    ×{request.attemptNumber}
                                  </span>
                                )}
                                {request.cycle?.cycle_number === 0 && (() => {
                                  const realSaisies = request.executions.filter(e => e.trade_number >= 1 && e.trade_number <= 15).length;
                                  if (realSaisies < 15) {
                                    return (
                                      <span
                                        className="text-[9px] px-1 py-0.5 rounded bg-destructive/20 text-destructive font-mono flex items-center gap-0.5 flex-shrink-0"
                                        title={`Seules ${realSaisies}/15 datas ont été réellement saisies dans user_executions. Les autres ont été cochées sans saisie réelle.`}
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        {realSaisies}/15
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </h4>
                              <p className="text-[10px] text-muted-foreground font-mono truncate">
                                {request.cycle?.name || "Cycle inconnu"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className={cn(
                                "text-sm font-bold",
                                stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                              )}>
                                {stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(1)}
                              </p>
                              <p className="text-[9px] text-muted-foreground">
                                {request.executions.length}t
                              </p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground font-mono">
                          {new Date(request.requested_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      {/* Request Header - Desktop */}
                      <div 
                        className="hidden md:block p-4 cursor-pointer hover:bg-orange-500/10 transition-colors"
                        onClick={() => {
                          const newId = isExpanded ? null : request.id;
                          setExpandedRequest(newId);
                          if (newId) loadTradeNotes(newId);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground flex items-center gap-2 flex-wrap">
                                {request.userName} — {request.cycle?.name || "Cycle inconnu"}
                                {request.attemptNumber > 1 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono">
                                    {request.attemptNumber}ème demande
                                  </span>
                                )}
                                {request.cycle?.cycle_number === 0 && (() => {
                                  const realSaisies = request.executions.filter(e => e.trade_number >= 1 && e.trade_number <= 15).length;
                                  if (realSaisies < 15) {
                                    return (
                                      <span
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-mono flex items-center gap-1"
                                        title={`Seules ${realSaisies}/15 datas ont été réellement saisies. Les ${15 - realSaisies} autres ont été cochées sans saisie réelle dans user_executions.`}
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                        Saisie réelle : {realSaisies}/15
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </h4>
                              <p className="text-xs text-muted-foreground font-mono">
                                Demandé le {new Date(request.requested_at).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              {/* Assigned admin */}
                              {assignedAdmin ? (
                                <p className="text-[10px] text-primary font-mono mt-0.5">
                                  Assigné à: {assignedAdmin.display_name || "Admin"}
                                </p>
                              ) : (
                                <button
                                  className="text-[10px] text-muted-foreground hover:text-primary font-mono mt-0.5 underline"
                                  onClick={(e) => { e.stopPropagation(); setAssigningRequest(assigningRequest === request.id ? null : request.id); }}
                                >
                                  + Assigner un vérificateur
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Assignment dropdown */}
                          {assigningRequest === request.id && (
                            <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {adminProfiles.map(admin => (
                                <Button
                                  key={admin.user_id}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] gap-1"
                                  onClick={() => handleAssignAdmin(request.id, admin.user_id)}
                                >
                                  <User className="w-3 h-3" />
                                  {admin.display_name || "Admin"}
                                </Button>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className={cn(
                                "text-lg font-bold",
                                stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                              )}>
                                {stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(1)} RR
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {request.executions.length} trades saisis
                              </p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-orange-500/20 p-3 md:p-4 space-y-3 md:space-y-4">
                          {/* Stats Grid - Mobile 2x2, Desktop 4 cols */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                            <div className="p-2.5 md:p-3 bg-card border border-border/40 rounded-md">
                              <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
                                Total RR
                              </p>
                              <p className={cn(
                                "text-lg md:text-xl font-bold",
                                stats.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                              )}>
                                {stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(1)}
                              </p>
                            </div>
                            <div className="p-2.5 md:p-3 bg-card border border-border/40 rounded-md">
                              <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
                                Win Rate
                              </p>
                              <p className="text-lg md:text-xl font-bold text-foreground">
                                {stats.winRate.toFixed(0)}%
                              </p>
                            </div>
                            <div className="p-2.5 md:p-3 bg-card border border-border/40 rounded-md">
                              <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
                                RR Moyen
                              </p>
                              <p className="text-lg md:text-xl font-bold text-foreground">
                                {stats.avgRR.toFixed(2)}
                              </p>
                            </div>
                            <div className="p-2.5 md:p-3 bg-card border border-border/40 rounded-md">
                              <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
                                W/L
                              </p>
                              <p className="text-lg md:text-xl font-bold text-foreground">
                                {stats.wins}/{stats.losses}
                              </p>
                            </div>
                          </div>

                          {/* Comparison Summary with Accuracy */}
                          {(() => {
                            const accuracy = getAccuracyPercent(request.comparisons);
                            const isAutoEligible = accuracy >= 90;
                            return (
                              <div className={cn(
                                "flex flex-wrap items-center gap-2 md:gap-4 p-2.5 md:p-3 rounded-md",
                                isAutoEligible ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-muted/30"
                              )}>
                                <div className="flex items-center gap-1.5 mr-2">
                                  <span className={cn(
                                    "text-sm md:text-base font-bold font-mono",
                                    isAutoEligible ? "text-emerald-400" : accuracy >= 70 ? "text-orange-400" : "text-red-400"
                                  )}>
                                    {accuracy.toFixed(0)}%
                                  </span>
                                  <span className="text-[10px] md:text-xs text-muted-foreground">précision</span>
                                  {isAutoEligible && (
                                    <span className="text-[9px] md:text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-mono">
                                      AUTO-ÉLIGIBLE
                                    </span>
                                  )}
                                </div>
                                <div className="w-px h-4 bg-border" />
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-emerald-500" />
                                  <span className="text-[10px] md:text-xs font-mono">
                                    {request.comparisons.filter(c => {
                                      const key = `${request.id}_${c.execution.id}`;
                                      return tradeValidity[key] === true;
                                    }).length} Validés
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500" />
                                  <span className="text-[10px] md:text-xs font-mono">
                                    {request.comparisons.filter(c => {
                                      const key = `${request.id}_${c.execution.id}`;
                                      return tradeValidity[key] === false;
                                    }).length} Refusés
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-muted-foreground/30" />
                                  <span className="text-[10px] md:text-xs font-mono">
                                    {request.comparisons.filter(c => {
                                      const key = `${request.id}_${c.execution.id}`;
                                      return tradeValidity[key] === undefined;
                                    }).length} Non corrigés
                                  </span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Trades Detail - Mobile Card View */}
                          <div className="md:hidden">
                            <p className="text-[10px] font-mono uppercase text-muted-foreground mb-2">
                              Comparaison ({request.cycle?.trade_start}-{request.cycle?.trade_end})
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {request.comparisons.map((comp) => {
                                const exec = comp.execution;
                                const oracle = comp.oracleTrade;
                                
                                return (
                                   <div 
                                    key={exec.id} 
                                    className={cn(
                                      "p-2.5 rounded-md border",
                                      exec.trade_number <= 15 && comp.status === 'match' && "bg-emerald-500/10 border-emerald-500/50",
                                      exec.trade_number <= 15 && comp.status === 'warning' && "bg-orange-500/10 border-orange-500/50",
                                      exec.trade_number <= 15 && comp.status === 'error' && "bg-red-500/10 border-red-500/50",
                                      exec.trade_number <= 15 && comp.status === 'no-match' && "bg-red-500/10 border-red-500/50",
                                      exec.trade_number > 15 && "border-border"
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-2">
                                       {exec.trade_number <= 15 ? (
                                        <div className={cn(
                                          "w-4 h-4 rounded-full flex items-center justify-center",
                                          comp.status === 'match' && "bg-emerald-500",
                                          comp.status === 'warning' && "bg-orange-500",
                                          comp.status === 'error' && "bg-red-500",
                                          comp.status === 'no-match' && "bg-red-500"
                                        )}>
                                          {comp.status === 'match' ? (
                                            <CheckCircle className="w-2.5 h-2.5 text-white" />
                                          ) : comp.status === 'warning' ? (
                                            <AlertTriangle className="w-2.5 h-2.5 text-white" />
                                          ) : (
                                            <XCircle className="w-2.5 h-2.5 text-white" />
                                          )}
                                        </div>
                                       ) : (
                                        <div className="w-4 h-4" />
                                       )}
                                        <span className="text-xs font-mono font-bold">#{exec.trade_number}</span>
                                        <div className={cn(
                                          "w-4 h-4 rounded flex items-center justify-center",
                                          exec.direction === "Long" 
                                            ? "bg-emerald-500/20"
                                            : "bg-red-500/20"
                                        )}>
                                          {exec.direction === "Long" ? (
                                            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                                          ) : (
                                            <ArrowDownRight className="w-3 h-3 text-red-400" />
                                          )}
                                        </div>
                                      </div>
                                      <span className={cn(
                                        "font-mono font-bold text-xs",
                                        (exec.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                                      )}>
                                        {(exec.rr || 0) >= 0 ? "+" : ""}{(exec.rr || 0).toFixed(1)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                                      <span>
                                        User: {new Date(exec.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} {exec.entry_time || "—"}
                                      </span>
                                      <span>
                                        Oracle: {oracle ? `${new Date(oracle.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} ${oracle.entry_time || "—"}` : "—"}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      {exec.screenshot_url && (
                                        <button
                                          onClick={() => {
                                            const execs = request.executions;
                                            const idx = execs.findIndex(e => e.id === exec.id);
                                            openGallery(execs, idx >= 0 ? idx : 0, "m15", request.id);
                                          }}
                                          className="inline-flex items-center gap-1 text-primary hover:text-primary/80 cursor-pointer text-[10px] font-mono"
                                        >
                                          <ImageIcon className="w-3.5 h-3.5" />
                                          <span>Contexte</span>
                                        </button>
                                      )}
                                      {exec.screenshot_entry_url && (
                                        <button
                                          onClick={() => {
                                            const execs = request.executions;
                                            const idx = execs.findIndex(e => e.id === exec.id);
                                            openGallery(execs, idx >= 0 ? idx : 0, "m5", request.id);
                                          }}
                                          className="inline-flex items-center gap-1 text-primary hover:text-primary/80 cursor-pointer text-[10px] font-mono"
                                        >
                                          <ImageIcon className="w-3.5 h-3.5" />
                                          <span>Entrée</span>
                                        </button>
                                      )}
                                    </div>
                                    {/* Per-trade note + validation - Mobile */}
                                    <div className="mt-2 space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant={tradeValidity[`${request.id}_${exec.id}`] !== false ? "outline" : "destructive"}
                                          size="sm"
                                          className="h-6 text-[9px] px-2"
                                          onClick={(e) => { e.stopPropagation(); toggleTradeValidity(request.id, exec.id); }}
                                        >
                                          {tradeValidity[`${request.id}_${exec.id}`] !== false ? "✓ Validé" : "✗ Invalidé"}
                                        </Button>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Input
                                          value={tradeNotes[`${request.id}_${exec.id}`] || ""}
                                          onChange={(e) => setTradeNotes(prev => ({ ...prev, [`${request.id}_${exec.id}`]: e.target.value }))}
                                          placeholder="Note..."
                                          className="h-6 text-[9px] bg-card"
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 flex-shrink-0"
                                          disabled={savingNote === `${request.id}_${exec.id}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            saveTradeNote(request.id, exec.id, tradeNotes[`${request.id}_${exec.id}`] || "", tradeValidity[`${request.id}_${exec.id}`] !== false);
                                          }}
                                        >
                                          {savingNote === `${request.id}_${exec.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Trades Detail Table - Desktop */}
                          <div className="hidden md:block">
                            <p className="text-xs font-mono uppercase text-muted-foreground mb-2">
                              Comparaison Oracle ({request.cycle?.trade_start}-{request.cycle?.trade_end})
                            </p>
                            <div className="border border-border rounded-md overflow-hidden max-h-[500px] overflow-y-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead className="h-8 text-[10px] font-mono w-8">St</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">#</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Date User</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Date Oracle</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Heure User</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Heure Oracle</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Dir</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Structure</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Setup</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Modèle</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Timing</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono text-right">RR</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Screens</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono w-8">Validé</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Notes Admin</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {request.comparisons.map((comp) => {
                                    const exec = comp.execution;
                                    const oracle = comp.oracleTrade;
                                    const noteKey = `${request.id}_${exec.id}`;
                                    const isValid = tradeValidity[noteKey] !== false;
                                    const hasBeenReviewed = tradeValidity[noteKey] !== undefined;
                                    
                                    return (
                                      <TableRow 
                                        key={exec.id} 
                                        className={cn(
                                          "hover:bg-muted/30 cursor-pointer",
                                          // Validation-based row coloring (takes priority)
                                          hasBeenReviewed && isValid && "bg-emerald-500/10 border-l-2 border-l-emerald-500",
                                          hasBeenReviewed && !isValid && "bg-red-500/10 border-l-2 border-l-red-500",
                                          // Oracle match coloring (only for trades ≤15 when not yet reviewed)
                                          !hasBeenReviewed && exec.trade_number <= 15 && comp.status === 'match' && "bg-emerald-500/5 border-l-2 border-l-emerald-500/40",
                                          !hasBeenReviewed && exec.trade_number <= 15 && comp.status === 'warning' && "bg-orange-500/5 border-l-2 border-l-orange-500/40",
                                          !hasBeenReviewed && exec.trade_number <= 15 && (comp.status === 'error' || comp.status === 'no-match') && "bg-red-500/5 border-l-2 border-l-red-500/40"
                                        )}
                                        onClick={() => {
                                          const execs = request.executions;
                                          const idx = execs.findIndex(e => e.id === exec.id);
                                          openGallery(execs, idx >= 0 ? idx : 0, exec.screenshot_url ? "m15" : "m5", request.id);
                                        }}
                                      >
                                        <TableCell className="py-1.5">
                                          {exec.trade_number <= 15 ? (
                                            <Tooltip>
                                              <TooltipTrigger>
                                                <div className={cn(
                                                  "w-5 h-5 rounded-full flex items-center justify-center",
                                                  comp.status === 'match' && "bg-emerald-500",
                                                  comp.status === 'warning' && "bg-orange-500",
                                                  comp.status === 'error' && "bg-red-500",
                                                  comp.status === 'no-match' && "bg-red-500"
                                                )}>
                                                  {comp.status === 'match' ? (
                                                    <CheckCircle className="w-3 h-3 text-white" />
                                                  ) : comp.status === 'warning' ? (
                                                    <AlertTriangle className="w-3 h-3 text-white" />
                                                  ) : (
                                                    <XCircle className="w-3 h-3 text-white" />
                                                  )}
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                {comp.status === 'match' && "Correspondance parfaite (≤5h)"}
                                                {comp.status === 'warning' && `Décalage de ${comp.timeDiffHours?.toFixed(1)}h`}
                                                {comp.status === 'error' && `Écart important: ${comp.timeDiffHours?.toFixed(0)}h`}
                                                {comp.status === 'no-match' && "Trade Oracle non trouvé"}
                                              </TooltipContent>
                                            </Tooltip>
                                          ) : (
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-muted">
                                              <span className="text-[8px] font-mono text-muted-foreground">—</span>
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono font-bold">
                                          {exec.trade_number}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {new Date(exec.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {oracle ? new Date(oracle.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {exec.entry_time || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {oracle?.entry_time || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                          <div className={cn(
                                            "inline-flex items-center justify-center w-5 h-5 rounded",
                                            exec.direction === "Long" 
                                              ? "bg-emerald-500/20 text-emerald-400"
                                              : "bg-red-500/20 text-red-400"
                                          )}>
                                            {exec.direction === "Long" ? (
                                              <ArrowUpRight className="w-3 h-3" />
                                            ) : (
                                              <ArrowDownRight className="w-3 h-3" />
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                                          {exec.direction_structure || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                          {exec.setup_type && (
                                            <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-mono rounded">
                                              {exec.setup_type}
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                                          {exec.entry_model || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-[10px] font-mono text-muted-foreground">
                                          {exec.entry_timing || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-right">
                                          <span className={cn(
                                            "font-mono font-bold text-xs",
                                            (exec.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                                          )}>
                                            {(exec.rr || 0) >= 0 ? "+" : ""}{(exec.rr || 0).toFixed(1)}
                                          </span>
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                          <div className="inline-flex items-center gap-1.5">
                                            {exec.screenshot_url && (
                                              <button
                                                className="text-[9px] font-mono text-primary hover:text-primary/80 hover:underline"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const execs = request.executions;
                                                  const idx = execs.findIndex(ex => ex.id === exec.id);
                                                  openGallery(execs, idx >= 0 ? idx : 0, "m15", request.id);
                                                }}
                                              >
                                                M15
                                              </button>
                                            )}
                                            {exec.screenshot_entry_url && (
                                              <button
                                                className="text-[9px] font-mono text-primary hover:text-primary/80 hover:underline"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const execs = request.executions;
                                                  const idx = execs.findIndex(ex => ex.id === exec.id);
                                                  openGallery(execs, idx >= 0 ? idx : 0, "m5", request.id);
                                                }}
                                              >
                                                M5
                                              </button>
                                            )}
                                            {!exec.screenshot_url && !exec.screenshot_entry_url && (
                                              <span className="text-[9px] font-mono text-muted-foreground">—</span>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-1.5 text-center">
                                          {hasBeenReviewed ? (
                                            isValid ? (
                                              <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                                            ) : (
                                              <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                                            )
                                          ) : (
                                            <span className="text-[9px] font-mono text-muted-foreground">—</span>
                                          )}
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[9px] font-mono gap-1 px-2"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setNotesViewerRequestId(request.id);
                                              setNotesViewerExecs(request.executions.map(ex => ({
                                                id: ex.id,
                                                trade_number: ex.trade_number,
                                                direction: ex.direction,
                                                trade_date: ex.trade_date,
                                              })));
                                            }}
                                          >
                                            <MessageSquare className="w-3 h-3" />
                                            {tradeNotes[noteKey] ? "Voir notes" : "—"}
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {/* View All Data Button */}
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDataViewerUserId(request.user_id);
                                setDataViewerUserName(request.userName);
                              }}
                            >
                              <ClipboardList className="w-4 h-4" />
                              Voir toutes les données
                            </Button>
                          </div>

                          {/* Correction Report + Feedback */}
                          <div className="space-y-3">
                            {/* Bilan de correction button */}
                            {(() => {
                              const allReviewed = request.comparisons.every(c => {
                                const key = `${request.id}_${c.execution.id}`;
                                return tradeValidity[key] !== undefined;
                              });
                              const validatedCount = request.comparisons.filter(c => tradeValidity[`${request.id}_${c.execution.id}`] === true).length;
                              const rejectedCount = request.comparisons.filter(c => tradeValidity[`${request.id}_${c.execution.id}`] === false).length;
                              
                              return allReviewed ? (
                                <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-xs font-mono font-semibold text-foreground">
                                        ✅ Tous les trades ont été corrigés
                                      </p>
                                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                        {validatedCount} validé(s) · {rejectedCount} refusé(s)
                                      </p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1.5 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNotesViewerRequestId(request.id);
                                        setNotesViewerExecs(request.executions.map(ex => ({
                                          id: ex.id,
                                          trade_number: ex.trade_number,
                                          direction: ex.direction,
                                          trade_date: ex.trade_date,
                                        })));
                                      }}
                                    >
                                      <ClipboardList className="w-3.5 h-3.5" />
                                      Bilan de correction
                                    </Button>
                                  </div>
                                </div>
                              ) : null;
                            })()}

                            {/* Feedback */}
                            <div>
                              <label className="text-[10px] md:text-xs font-mono uppercase text-muted-foreground mb-1.5 md:mb-2 block">
                                Feedback (requis pour validation et refus)
                              </label>
                              <Textarea
                                value={feedback[request.id] || ""}
                                onChange={(e) => setFeedback(prev => ({
                                  ...prev,
                                  [request.id]: e.target.value,
                                }))}
                                placeholder="Laissez un commentaire..."
                                className="resize-none bg-card border-border/40 text-sm"
                                rows={2}
                              />
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                            <Button
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-9 md:h-10 text-xs md:text-sm"
                              onClick={() => handleApprove(request)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                              )}
                              Valider
                            </Button>
                            <Button
                              variant="destructive"
                              className="flex-1 h-9 md:h-10 text-xs md:text-sm"
                              onClick={() => handleReject(request)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 animate-spin" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2" />
                              )}
                              Refuser
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Followup Tab */}
          <TabsContent value="followup" className="flex-1 overflow-auto mt-0">
            <UserFollowupTab />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-1 overflow-auto mt-0">
            <UserHistoryTab />
          </TabsContent>

          {/* Security Alerts Tab */}
          <TabsContent value="security" className="flex-1 overflow-auto mt-0">
            {loadingAlerts ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : securityAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <CheckCircle className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Aucune alerte
                </h3>
                <p className="text-sm text-muted-foreground">
                  Aucune alerte de sécurité en cours.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {securityAlerts.map((alert) => {
                  const alertProfile = profiles.find(p => p.user_id === alert.user_id);
                  return (
                    <div
                      key={alert.id}
                      className="p-4 bg-card border border-destructive/30 rounded-md"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">
                            3ème appareil détecté — {alertProfile?.display_name || alert.user_id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(alert.created_at).toLocaleDateString("fr-FR", {
                              day: "numeric", month: "long", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                          {alert.device_info && (
                            <p className="text-xs text-muted-foreground mt-2 font-mono break-all">
                              {alert.device_info}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleResolveAlert(alert.id, alert.user_id, true)}
                          className="gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Débloquer le compte
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveAlert(alert.id, alert.user_id, false)}
                          className="gap-1.5"
                        >
                          Ignorer l'alerte
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Roles Tab - embedded RoleManagement */}
          <TabsContent value="roles" className="flex-1 overflow-auto mt-0">
            <RoleManagement />
          </TabsContent>

          {/* Quest Management Tab */}
          <TabsContent value="quests" className="flex-1 overflow-auto mt-0">
            <QuestStepManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* User Data Viewer */}
      <AdminUserDataViewer
        userId={dataViewerUserId}
        userName={dataViewerUserName}
        open={!!dataViewerUserId}
        onOpenChange={(open) => {
          if (!open) setDataViewerUserId(null);
        }}
      />

      {/* Trade Navigation Lightbox */}
      <TradeNavigationLightbox
        items={galleryItems}
        initialIndex={galleryIndex}
        initialScreenshot={galleryScreen}
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        oracleTrades={oracleTrades.map(o => ({
          tradeNumber: o.trade_number,
          tradeDate: o.trade_date,
          direction: o.direction,
          entryTime: o.entry_time,
          rr: o.rr,
          screenshotM15: o.screenshot_m15_m5 || null,
          screenshotM5: o.screenshot_m1 || null,
        }))}
        isSuperAdmin={isSuperAdmin}
        onValidate={galleryRequestId ? async (executionId, isValid, note) => {
          const key = `${galleryRequestId}_${executionId}`;
          setTradeValidity(prev => ({ ...prev, [key]: isValid }));
          setTradeNotes(prev => ({ ...prev, [key]: note }));
          saveTradeNote(galleryRequestId!, executionId, note, isValid);

          // Send per-trade notification to the student
          const request = requests.find(r => r.id === galleryRequestId);
          if (request) {
            const exec = request.executions.find(e => e.id === executionId);
            const tradeNum = exec?.trade_number || "?";
            const { data: { user } } = await supabase.auth.getUser();
            const notifMessage = isValid
              ? `✅ Trade #${tradeNum} validé${note ? ` — ${note}` : ""}`
              : `❌ Trade #${tradeNum} refusé${note ? ` — ${note}` : ""}`;
            await supabase.from("user_notifications").insert({
              user_id: request.user_id,
              sender_id: user?.id || null,
              type: isValid ? "trade_validated" : "trade_rejected",
              message: notifMessage,
            });
          }
        } : undefined}
        onSupplementaryNote={galleryRequestId ? (executionId, note) => {
          saveTradeNote(galleryRequestId!, executionId, tradeNotes[`${galleryRequestId}_${executionId}`] || "", tradeValidity[`${galleryRequestId}_${executionId}`] !== false, note);
        } : undefined}
        validationState={galleryRequestId ? Object.fromEntries(
          Object.entries(tradeValidity)
            .filter(([k]) => k.startsWith(`${galleryRequestId}_`))
            .map(([k, v]) => {
              const execId = k.replace(`${galleryRequestId}_`, "");
              return [execId, { isValid: v, note: tradeNotes[k] || "" }];
            })
        ) : undefined}
        savingValidation={savingNote ? savingNote.replace(`${galleryRequestId}_`, "") : null}
      />

      {/* Admin Trade Notes Viewer */}
      <AdminTradeNotesViewer
        open={!!notesViewerRequestId}
        onOpenChange={(open) => { if (!open) setNotesViewerRequestId(null); }}
        requestId={notesViewerRequestId || ""}
        executions={notesViewerExecs}
        onNotesUpdated={() => {
          if (notesViewerRequestId) loadTradeNotes(notesViewerRequestId);
        }}
      />
    </div>
  );
};
