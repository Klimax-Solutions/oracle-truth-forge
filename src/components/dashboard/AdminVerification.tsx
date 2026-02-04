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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ScreenshotLink } from "./ScreenshotLink";

// Oracle trade from the master database
interface OracleTrade {
  id: string;
  trade_number: number;
  trade_date: string;
  entry_time: string | null;
  direction: string;
  rr: number | null;
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
  rr: number | null;
  result: string | null;
  setup_type: string | null;
  entry_model: string | null;
  direction_structure: string | null;
  entry_timing: string | null;
  screenshot_url: string | null;
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
}

interface PlatformUser {
  id: string;
  displayName: string;
  created_at: string;
  currentCycle: Cycle | null;
  userCycles: UserCycle[];
  totalTrades: number;
  totalRR: number;
  status: "active" | "pending" | "completed";
  executions: UserExecution[];
}

export const AdminVerification = () => {
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
  const { toast } = useToast();

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
      .select("id, trade_number, trade_date, entry_time, direction, rr")
      .order("trade_number", { ascending: true });
    
    const oracleTrades = (oracleData || []) as OracleTrade[];
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

      return {
        ...request,
        cycle: cycle as Cycle | null,
        userCycle: userCycle as UserCycle | null,
        executions,
        comparisons,
        userName: profile?.display_name || `Utilisateur ${request.user_id.slice(0, 8)}`,
      };
    });

    setRequests(enrichedRequests);
    setLoading(false);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    
    // Fetch profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*");
    
    // Get all user_cycles to find unique users
    const { data: allUserCycles, error: userCyclesError } = await supabase
      .from("user_cycles")
      .select("*")
      .order("created_at", { ascending: true });

    if (userCyclesError) {
      console.error("Error fetching user cycles:", userCyclesError);
      setLoadingUsers(false);
      return;
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(allUserCycles?.map(uc => uc.user_id) || [])];

    // Fetch user_executions for all users (les trades saisis par les utilisateurs)
    const { data: allExecutions } = await supabase
      .from("user_executions")
      .select("*")
      .order("trade_number", { ascending: true });

    // Create user objects
    const platformUsers: PlatformUser[] = uniqueUserIds.map(userId => {
      const userCycles = allUserCycles?.filter(uc => uc.user_id === userId) || [];
      const userExecutions = (allExecutions?.filter(e => e.user_id === userId) || []) as UserExecution[];
      const profile = profilesData?.find(p => p.user_id === userId);
      
      // Find current active cycle (in_progress or pending_review)
      const activeCycle = userCycles.find(uc => 
        uc.status === "in_progress" || uc.status === "pending_review"
      );
      
      const currentCycleData = activeCycle 
        ? cycles.find(c => c.id === activeCycle.cycle_id) 
        : null;
      
      // Calculate total RR from user executions
      const totalRR = userExecutions.reduce((sum, e) => sum + (e.rr || 0), 0);
      
      // Determine status
      const hasPending = userCycles.some(uc => uc.status === "pending_review");
      const allValidated = userCycles.every(uc => uc.status === "validated");
      
      let status: "active" | "pending" | "completed" = "active";
      if (hasPending) status = "pending";
      if (allValidated && userCycles.length === cycles.length) status = "completed";

      return {
        id: userId,
        displayName: profile?.display_name || `Utilisateur ${userId.slice(0, 8)}`,
        created_at: userCycles[0]?.created_at || new Date().toISOString(),
        currentCycle: currentCycleData || null,
        userCycles: userCycles as UserCycle[],
        totalTrades: userExecutions.length,
        totalRR,
        status,
        executions: userExecutions,
      };
    });

    setUsers(platformUsers);
    setLoadingUsers(false);
  };

  useEffect(() => {
    const init = async () => {
      await fetchCycles();
      await fetchRequests();
      await fetchUsers();
    };
    init();
  }, []);

  const handleApprove = async (request: PendingRequest) => {
    if (!request.userCycle || !request.cycle) return;
    
    setProcessing(request.id);
    const feedbackText = feedback[request.id] || "";

    try {
      // Update verification request
      const { error: requestError } = await supabase
        .from("verification_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
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
          admin_feedback: feedbackText,
        })
        .eq("id", request.userCycle.id);

      if (cycleError) throw cycleError;

      // Unlock next cycle
      await supabase.rpc("unlock_next_cycle", {
        p_user_id: request.user_id,
        p_current_cycle_number: request.cycle.cycle_number,
      });

      toast({
        title: "Cycle validé !",
        description: `Le ${request.cycle.name} a été validé avec succès. Le cycle suivant est maintenant débloqué.`,
      });

      // Refresh data
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
      // Update verification request
      const { error: requestError } = await supabase
        .from("verification_requests")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          admin_comments: feedbackText,
        })
        .eq("id", request.id);

      if (requestError) throw requestError;

      // Update user cycle
      const { error: cycleError } = await supabase
        .from("user_cycles")
        .update({
          status: "rejected",
          admin_feedback: feedbackText,
        })
        .eq("id", request.userCycle.id);

      if (cycleError) throw cycleError;

      toast({
        title: "Cycle refusé",
        description: `Le ${request.cycle.name} a été refusé. L'utilisateur a été notifié.`,
      });

      // Refresh data
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
            <TabsTrigger value="verifications" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Vérifications</span> ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="followup" className="gap-1.5 text-xs md:text-sm px-2 md:px-3">
              <ClipboardList className="w-3.5 h-3.5 md:w-4 md:h-4" />
              Suivi
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
                {/* Stats Summary - responsive grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">
                  <div className="p-3 md:p-4 bg-card border border-border rounded-md">
                    <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
                      Total
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-foreground">{users.length}</p>
                  </div>
                  <div className="p-3 md:p-4 bg-card border border-border rounded-md">
                    <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
                      En Attente
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-orange-400">
                      {users.filter(u => u.status === "pending").length}
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-card border border-border rounded-md">
                    <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
                      Actifs
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-blue-400">
                      {users.filter(u => u.status === "active").length}
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-card border border-border rounded-md">
                    <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
                      Diplômés
                    </p>
                    <p className="text-xl md:text-2xl font-bold text-emerald-400">
                      {users.filter(u => u.status === "completed").length}
                    </p>
                  </div>
                </div>

                {/* Users List */}
                {users.map((user) => {
                  const isExpanded = expandedUser === user.id;
                  const progress = getUserProgressPercentage(user);

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
                            <div className="min-w-0">
                              <h4 className="font-semibold text-foreground text-xs md:text-sm truncate">
                                {user.displayName}
                              </h4>
                              <div className="flex items-center gap-1 md:gap-2 mt-0.5">
                                <p className="text-[10px] md:text-xs text-muted-foreground font-mono truncate">
                                  {user.currentCycle?.name || "—"}
                                </p>
                                {user.status === "pending" && (
                                  <span className="px-1 py-0.5 text-[8px] md:text-[10px] font-mono uppercase bg-orange-500/20 text-orange-400 rounded flex-shrink-0">
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
                              </p>
                              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5 md:gap-2">
                              {cycles.map((cycle) => {
                                const userCycle = user.userCycles.find(uc => uc.cycle_id === cycle.id);
                                const status = userCycle?.status || "locked";

                                return (
                                  <div
                                    key={cycle.id}
                                    className={cn(
                                      "p-3 border rounded-md text-center",
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
                                      <TableHead className="h-8 text-[10px] font-mono">Entrée</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Sortie</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Setup</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Modèle</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono text-right">RR</TableHead>
                                      <TableHead className="h-8 text-[10px] font-mono">Screenshot</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {user.executions.map((exec) => (
                                      <TableRow key={exec.id} className="hover:bg-muted/30">
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
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {exec.entry_time || "—"}
                                        </TableCell>
                                        <TableCell className="py-1.5 text-xs font-mono text-muted-foreground">
                                          {exec.exit_time || "—"}
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
                                        <TableCell className="py-1.5 text-right">
                                          <span className={cn(
                                            "font-mono font-bold text-xs",
                                            (exec.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                                          )}>
                                            {(exec.rr || 0) >= 0 ? "+" : ""}{(exec.rr || 0).toFixed(1)}
                                          </span>
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                          <ScreenshotLink
                                            storagePath={exec.screenshot_url}
                                            alt={`Trade #${exec.trade_number}`}
                                            showExternalIcon
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}

                          {/* User Info */}
                          <div className="pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                <div className="flex items-center gap-2 mb-4 md:mb-6">
                  <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
                  <span className="text-xs md:text-sm font-mono uppercase tracking-wider text-muted-foreground">
                    {requests.length} demande{requests.length > 1 ? "s" : ""} en attente
                  </span>
                </div>

                {requests.map((request) => {
                  const stats = calculateStats(request.executions);
                  const isExpanded = expandedRequest === request.id;
                  const isProcessing = processing === request.id;

                  return (
                    <div
                      key={request.id}
                      className="border border-orange-500/40 bg-orange-500/5 rounded-md overflow-hidden"
                    >
                      {/* Request Header - Mobile */}
                      <div 
                        className="p-3 md:hidden cursor-pointer hover:bg-orange-500/10 transition-colors"
                        onClick={() => setExpandedRequest(isExpanded ? null : request.id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-orange-400" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-foreground text-xs truncate">
                                {request.userName}
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
                        onClick={() => setExpandedRequest(isExpanded ? null : request.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">
                                {request.userName} — {request.cycle?.name || "Cycle inconnu"}
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
                            </div>
                          </div>

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

                          {/* Comparison Summary - Compact on mobile */}
                          <div className="flex flex-wrap items-center gap-2 md:gap-4 p-2.5 md:p-3 bg-muted/30 rounded-md">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-emerald-500" />
                              <span className="text-[10px] md:text-xs font-mono">
                                {request.comparisons.filter(c => c.status === 'match').length} OK
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-orange-500" />
                              <span className="text-[10px] md:text-xs font-mono">
                                {request.comparisons.filter(c => c.status === 'warning').length} &gt;5h
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500" />
                              <span className="text-[10px] md:text-xs font-mono">
                                {request.comparisons.filter(c => c.status === 'error' || c.status === 'no-match').length} Err
                              </span>
                            </div>
                          </div>

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
                                      comp.status === 'match' && "bg-emerald-500/10 border-emerald-500/50",
                                      comp.status === 'warning' && "bg-orange-500/10 border-orange-500/50",
                                      comp.status === 'error' && "bg-red-500/10 border-red-500/50",
                                      comp.status === 'no-match' && "bg-red-500/10 border-red-500/50"
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-2">
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
                                    {exec.screenshot_url && (
                                      <div className="mt-1.5">
                                        <ScreenshotLink
                                          storagePath={exec.screenshot_url}
                                          alt={`Trade #${exec.trade_number}`}
                                          showExternalIcon
                                        />
                                      </div>
                                    )}
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
                            <div className="border border-border rounded-md overflow-hidden max-h-64 overflow-y-auto">
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
                                    <TableHead className="h-8 text-[10px] font-mono text-right">RR</TableHead>
                                    <TableHead className="h-8 text-[10px] font-mono">Screenshot</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {request.comparisons.map((comp) => {
                                    const exec = comp.execution;
                                    const oracle = comp.oracleTrade;
                                    
                                    return (
                                      <TableRow 
                                        key={exec.id} 
                                        className={cn(
                                          "hover:bg-muted/30",
                                          comp.status === 'match' && "bg-emerald-500/10 border-l-2 border-l-emerald-500",
                                          comp.status === 'warning' && "bg-orange-500/10 border-l-2 border-l-orange-500",
                                          comp.status === 'error' && "bg-red-500/10 border-l-2 border-l-red-500",
                                          comp.status === 'no-match' && "bg-red-500/10 border-l-2 border-l-red-500"
                                        )}
                                      >
                                        <TableCell className="py-1.5">
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
                                        <TableCell className="py-1.5 text-right">
                                          <span className={cn(
                                            "font-mono font-bold text-xs",
                                            (exec.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                                          )}>
                                            {(exec.rr || 0) >= 0 ? "+" : ""}{(exec.rr || 0).toFixed(1)}
                                          </span>
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                          <ScreenshotLink
                                            storagePath={exec.screenshot_url}
                                            alt={`Trade #${exec.trade_number}`}
                                            showExternalIcon
                                          />
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {/* Feedback */}
                          <div>
                            <label className="text-[10px] md:text-xs font-mono uppercase text-muted-foreground mb-1.5 md:mb-2 block">
                              Feedback (optionnel pour validation, requis pour refus)
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
        </Tabs>
      </div>
    </div>
  );
};
