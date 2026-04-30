import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Circle,
  Target,
  TrendingUp,
  Lock,
  Clock,
  Send,
  AlertCircle,
  Play,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  XCircle,
  Shield,
  Eye,
  PauseCircle,
} from "lucide-react";
import { deriveOracleCycleWindows } from "@/lib/oracle-cycle-windows";
import { TradeRulesDoc } from "./admin/TradeRulesDoc";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DailyQuestCard } from "./DailyQuestCard";
import { QuestData } from "@/hooks/useQuestData";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { CumulativeEvolution } from "./CumulativeEvolution";
import { ResultsPage } from "./ResultsPage";
import { ImageLightbox } from "./ImageLightbox";
import { SignedImageCard } from "./SignedImageCard";
import { useEarlyAccessSettings } from "@/hooks/useEarlyAccessSettings";
import { useEaFeaturedTrade, type EaFeaturedTrade } from "@/hooks/useEaFeaturedTrade";
import { VerificationRequiredPopup } from "./VerificationRequiredPopup";
import { CycleProgressBar } from "./CycleProgressBar";

interface Trade {
  id: string;
  trade_number: number;
  rr: number;
  direction: string;
  trade_date: string;
  entry_time: string | null;
}

interface OracleExecutionProps {
  trades: Trade[];
  dataGeneraleTrades?: Trade[];
  onNavigateToVideos?: () => void;
  onNavigateToSetup?: () => void;
  onNavigateToRecolte?: () => void;
  onNavigateToAnalysis?: () => void;
  questData?: QuestData;
  isStaff?: boolean;
}

interface Cycle {
  id: string;
  cycle_number: number;
  name: string;
  trade_start: number;
  trade_end: number;
  total_trades: number;
  phase: number;
  description: string | null;
}

interface UserCycle {
  id: string;
  user_id: string;
  cycle_id: string;
  // Décision design : 'in_review' et 'on_hold' vivent uniquement sur verification_requests.status.
  // user_cycles ne passe jamais à ces statuts — ils sont listés ici à titre défensif uniquement.
  status: 'locked' | 'in_progress' | 'pending_review' | 'validated' | 'rejected' | 'in_review' | 'on_hold';
  completed_trades: number;
  total_rr: number;
  started_at: string | null;
  completed_at: string | null;
  verified_at: string | null;
  admin_feedback: string | null;
}

interface UserExecution {
  id: string;
  trade_number: number;
  rr: number | null;
  trade_date?: string;
  direction?: string;
  direction_structure?: string | null;
  entry_time?: string | null;
  exit_time?: string | null;
  setup_type?: string | null;
  entry_model?: string | null;
  entry_timing?: string | null;
  screenshot_url?: string | null;
  screenshot_entry_url?: string | null;
  notes?: string | null;
}

interface CycleWithProgress extends Cycle {
  userCycle: UserCycle | null;
  currentTrades: Trade[];
  userExecutions: UserExecution[];
  currentRR: number;
  userRR: number;
  progress: number;
}

export const OracleExecution = ({ trades, dataGeneraleTrades, onNavigateToVideos, onNavigateToSetup, onNavigateToRecolte, onNavigateToAnalysis, questData, isStaff = false }: OracleExecutionProps) => {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [userCycles, setUserCycles] = useState<UserCycle[]>([]);
  const [userExecutions, setUserExecutions] = useState<UserExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCycle, setExpandedCycle] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ref immédiat pour bloquer les double-clics avant le re-render React
  const submittingRef = useRef(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [globalStats, setGlobalStats] = useState<{ totalData: number; totalRR: number; avgRR: number; totalUsers: number } | null>(null);
  const [requestedCycleIds, setRequestedCycleIds] = useState<Set<string>>(new Set());
  const [verificationAttempts, setVerificationAttempts] = useState<Record<string, number>>({});
  const [verificationDismissed, setVerificationDismissed] = useState(false);
  const [verificationRequestDates, setVerificationRequestDates] = useState<Record<string, string>>({});
  const [retractingCycleId, setRetractingCycleId] = useState<string | null>(null);
  // Statut VR actif par cycle (source de vérité pour les états admin intermédiaires)
  // Décision design : ces états (in_review, on_hold) vivent sur verification_requests, PAS sur user_cycles.
  const [vrStatusByCycle, setVrStatusByCycle] = useState<Record<string, 'pending' | 'in_review' | 'on_hold'>>({});
  // Notes admin par trade, groupées par cycle_id — affichées côté user (P4)
  const [adminTradeNotesByCycle, setAdminTradeNotesByCycle] = useState<Record<string, Array<{
    execution_id: string;
    trade_number: number;
    is_valid: boolean | null;
    note: string | null;
  }>>>({});
  const { toast } = useToast();
  const { isEarlyAccess, expiresAt, earlyAccessType } = useEarlyAccess();
  const { settings: eaSettings } = useEarlyAccessSettings();
  const { featured: eaFeaturedTrade } = useEaFeaturedTrade();

  // Fetch cycles, user cycles, and user executions
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Fetch cycles
        const { data: cyclesData } = await supabase
          .from("cycles")
          .select("*")
          .order("cycle_number", { ascending: true });

        if (cyclesData) {
          setCycles(cyclesData as Cycle[]);
        }

        // Initialize user cycles if needed
        await supabase.rpc("initialize_user_cycles", { p_user_id: user.id });

        // Fetch user cycles
        const { data: userCyclesData } = await supabase
          .from("user_cycles")
          .select("*")
          .eq("user_id", user.id);

        if (userCyclesData) {
          setUserCycles(userCyclesData as UserCycle[]);
        }

        // Fetch existing verification requests for this user (with id for trade notes lookup)
        const { data: verificationRequestsData } = await supabase
          .from("verification_requests")
          .select("id, cycle_id, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (verificationRequestsData) {
          // Statuts "actifs" : la VR n'est pas encore tranchée (approved/rejected/cancelled)
          const activeStatuses = ["pending", "in_review", "on_hold"];

          const requestedIds = new Set(
            verificationRequestsData
              .filter((request: any) => activeStatuses.includes(request.status))
              .map((request: any) => request.cycle_id)
          );
          setRequestedCycleIds(requestedIds);

          // Store the date of the most recent active request per cycle
          const dates: Record<string, string> = {};
          verificationRequestsData
            .filter((r: any) => activeStatuses.includes(r.status))
            .forEach((r: any) => { if (!dates[r.cycle_id]) dates[r.cycle_id] = r.created_at; });
          setVerificationRequestDates(dates);

          // Statut VR actif par cycle (pour différencier pending / in_review / on_hold côté UX)
          const vrStatus: Record<string, 'pending' | 'in_review' | 'on_hold'> = {};
          verificationRequestsData
            .filter((r: any) => activeStatuses.includes(r.status))
            .forEach((r: any) => {
              if (!vrStatus[r.cycle_id]) {
                vrStatus[r.cycle_id] = r.status as 'pending' | 'in_review' | 'on_hold';
              }
            });
          setVrStatusByCycle(vrStatus);

          // Count attempts per cycle
          const attempts: Record<string, number> = {};
          verificationRequestsData.forEach((request: any) => {
            attempts[request.cycle_id] = (attempts[request.cycle_id] || 0) + 1;
          });
          setVerificationAttempts(attempts);

          // Fetch admin_trade_notes for the most recent reviewed VR per cycle (P4 — user voit les notes)
          // On prend la VR la plus récente avec statut approved ou rejected (déjà triées par created_at desc)
          const vrByCycle: Record<string, string> = {}; // cycle_id → vr_id
          for (const vr of verificationRequestsData) {
            if ((vr.status === "approved" || vr.status === "rejected") && !vrByCycle[vr.cycle_id]) {
              vrByCycle[vr.cycle_id] = vr.id;
            }
          }
          const vrIds = Object.values(vrByCycle);
          if (vrIds.length > 0) {
            const { data: notesData } = await supabase
              .from("admin_trade_notes")
              .select("execution_id, is_valid, note, verification_request_id")
              .in("verification_request_id", vrIds);

            if (notesData && notesData.length > 0) {
              // Map vr_id → cycle_id (inverse de vrByCycle)
              const vrToCycle: Record<string, string> = Object.fromEntries(
                Object.entries(vrByCycle).map(([cycleId, vrId]) => [vrId, cycleId])
              );
              // Groupe les notes par cycle_id + enrichit avec trade_number depuis userExecutions
              const execById: Record<string, number> = {};
              if (userExecsData) {
                for (const e of userExecsData) {
                  execById[(e as any).id] = (e as any).trade_number;
                }
              }
              const notesByCycle: Record<string, Array<{
                execution_id: string;
                trade_number: number;
                is_valid: boolean | null;
                note: string | null;
              }>> = {};
              for (const n of notesData) {
                const cycleId = vrToCycle[(n as any).verification_request_id];
                if (!cycleId) continue;
                if (!notesByCycle[cycleId]) notesByCycle[cycleId] = [];
                notesByCycle[cycleId].push({
                  execution_id: (n as any).execution_id,
                  trade_number: execById[(n as any).execution_id] ?? 0,
                  is_valid: (n as any).is_valid,
                  note: (n as any).note,
                });
              }
              // Trier par trade_number dans chaque cycle
              for (const cycleId in notesByCycle) {
                notesByCycle[cycleId].sort((a, b) => a.trade_number - b.trade_number);
              }
              setAdminTradeNotesByCycle(notesByCycle);
            }
          }
        } else {
          setRequestedCycleIds(new Set());
        }

        // Fetch user executions for progress tracking
        const { data: userExecsData } = await supabase
          .from("user_executions")
          .select("id, trade_number, rr, trade_date, direction, direction_structure, entry_time, exit_time, setup_type, entry_model, entry_timing, screenshot_url, screenshot_entry_url, notes")
          .eq("user_id", user.id)
          .order("trade_number", { ascending: true });

        if (userExecsData) {
          setUserExecutions(userExecsData as UserExecution[]);
        }

        setLoading(false);

        // Check admin status and fetch global stats (secondary — non-blocking)
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const hasAdmin = roles?.some(r => r.role === "admin" || r.role === "super_admin");
        setIsAdmin(!!hasAdmin);

        if (hasAdmin) {
          // Fetch all user_executions across all users for global overview
          const { data: allExecs } = await supabase
            .from("user_executions")
            .select("user_id, rr");

          if (allExecs) {
            const uniqueUsers = new Set(allExecs.map(e => e.user_id));
            const totalData = allExecs.length + trades.length; // user executions + oracle trades
            const totalRR = allExecs.reduce((s, e) => s + (e.rr || 0), 0) + trades.reduce((s, t) => s + (t.rr || 0), 0);
            setGlobalStats({
              totalData,
              totalRR,
              avgRR: totalData > 0 ? totalRR / totalData : 0,
              totalUsers: uniqueUsers.size,
            });
          }
        }
      } catch (err) {
        console.warn("[OracleExecution] fetch error:", err);
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to user_executions changes for real-time progress updates
    const channel = supabase
      .channel('user_executions_progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_executions' }, async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data } = await supabase
          .from("user_executions")
          .select("id, trade_number, rr, trade_date, direction, direction_structure, entry_time, exit_time, setup_type, entry_model, entry_timing, screenshot_url, screenshot_entry_url, notes")
          .eq("user_id", user.id)
          .order("trade_number", { ascending: true });

        if (data) {
          setUserExecutions(data as UserExecution[]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Combine cycles with user progress (using user_executions for progress)
  const cyclesWithProgress: CycleWithProgress[] = useMemo(() => {
    return cycles.map(cycle => {
      const userCycle = userCycles.find(uc => uc.cycle_id === cycle.id) || null;
      // Oracle trades (for reference)
      const currentTrades = trades.filter(
        t => t.trade_number >= cycle.trade_start && t.trade_number <= cycle.trade_end
      );
      const currentRR = currentTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
      
      // User executions (for progress tracking)
      const cycleUserExecutions = userExecutions.filter(
        e => e.trade_number >= cycle.trade_start && e.trade_number <= cycle.trade_end
      );
      const userRR = cycleUserExecutions.reduce((sum, e) => sum + (e.rr || 0), 0);
      // Progress is based on user executions, not Oracle trades
      const progress = Math.min((cycleUserExecutions.length / cycle.total_trades) * 100, 100);

      return {
        ...cycle,
        userCycle,
        currentTrades,
        userExecutions: cycleUserExecutions,
        currentRR,
        userRR,
        progress,
      };
    });
  }, [cycles, userCycles, userExecutions, trades]);

  // Separate ébauche from main cycles
  const ebauche = cyclesWithProgress.find(c => c.cycle_number === 0);
  const phase1Cycles = cyclesWithProgress.filter(c => c.phase === 1);
  const phase2Cycles = cyclesWithProgress.filter(c => c.phase === 2);

  // Calculate totals based on user executions
  const totalUserTrades = userExecutions.length;
  const totalUserRR = userExecutions.reduce((sum, e) => sum + (e.rr || 0), 0);
  const completedCycles = cyclesWithProgress.filter(
    c => c.userCycle?.status === 'validated'
  ).length;
  const averageUserRR = totalUserTrades > 0 ? totalUserRR / totalUserTrades : 0;

  // Get current active cycle
  const currentCycle = cyclesWithProgress.find(
    c => c.userCycle?.status === 'in_progress' || c.userCycle?.status === 'rejected'
  );

  // Request verification - now based on user executions count
  const handleRequestVerification = async (cycleData: CycleWithProgress) => {
    if (!cycleData.userCycle) return;

    // ── COUCHE 1 : guard React state (vérifications déjà connues) ──
    if (requestedCycleIds.has(cycleData.id)) {
      toast({ title: "Déjà envoyé", description: "Ta demande de vérification est déjà en attente pour ce cycle." });
      return;
    }

    // ── COUCHE 2 : guard ref immédiat (bloque avant re-render React) ──
    if (submittingRef.current) return;
    submittingRef.current = true;
    // For ebauche (cycle 0), check trade analyses instead of user executions
    if (cycleData.cycle_number === 0) {
      const analyzedCount = questData?.ebaucheTradesAnalyzed || 0;
      if (analyzedCount < cycleData.total_trades) {
        toast({
          title: "Analyse incomplète",
          description: `Vous devez analyser et cocher les ${cycleData.total_trades} trades avant de demander la vérification. (${analyzedCount}/${cycleData.total_trades})`,
          variant: "destructive",
        });
        return;
      }
    } else {
      // For other cycles, check user_executions
      const isComplete = cycleData.userExecutions.length >= cycleData.total_trades;
      if (!isComplete) {
        toast({
          title: "Cycle incomplet",
          description: `Vous devez saisir ${cycleData.total_trades} trades dans "Saisie des Trades" avant de demander la vérification. (${cycleData.userExecutions.length}/${cycleData.total_trades})`,
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // ── COUCHE 3 : vérification DB — existe déjà une pending ? ──
      const { data: existing } = await supabase
        .from("verification_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("cycle_id", cycleData.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        // Mettre à jour l'état local pour refléter la réalité DB
        setRequestedCycleIds(prev => new Set([...prev, cycleData.id]));
        toast({ title: "Déjà en attente", description: "Ta demande est déjà enregistrée. L'équipe va la traiter." });
        return;
      }

      // Créer la demande (la contrainte unique DB bloque toute race condition résiduelle)
      const { error: requestError } = await supabase
        .from("verification_requests")
        .insert({
          user_id: user.id,
          cycle_id: cycleData.id,
          user_cycle_id: cycleData.userCycle.id,
          status: "pending",
        });

      if (requestError) {
        // Code 23505 = violation contrainte unique → doublon intercepté par la DB
        if (requestError.code === "23505") {
          setRequestedCycleIds(prev => new Set([...prev, cycleData.id]));
          toast({ title: "Déjà en attente", description: "Ta demande est déjà enregistrée. L'équipe va la traiter." });
          return;
        }
        throw requestError;
      }

      // Dès qu'une demande existe, on masque le pop-up obligatoire
      setRequestedCycleIds((prev) => {
        const next = new Set(prev);
        next.add(cycleData.id);
        return next;
      });

      // P6 — AUCUN AUTO-VALIDATE : tout cycle passe par un admin, sans exception
      // Le RPC check_cycle_accuracy_and_auto_validate est appelé en lecture seule
      // pour obtenir l'accuracy affichée dans le toast, mais ne change plus aucun statut.

      // Calcul de l'accuracy (informatif uniquement — cycles 1+)
      let accuracyValue = 0;
      if (cycleData.cycle_number > 0) {
        const { data: accuracy } = await supabase.rpc(
          "check_cycle_accuracy_and_auto_validate",
          {
            p_user_id: user.id,
            p_cycle_id: cycleData.id,
            p_user_cycle_id: cycleData.userCycle.id,
          }
        );
        accuracyValue = Number(accuracy) || 0;
      }

      // Toujours passer en pending_review — l'admin valide manuellement (P6)
      const isEbauche = cycleData.cycle_number === 0;
      const { error: updateError } = await supabase
        .from("user_cycles")
        .update({
          status: "pending_review",
          completed_at: new Date().toISOString(),
          completed_trades: isEbauche
            ? cycleData.currentTrades.length
            : cycleData.userExecutions.length,
          total_rr: isEbauche ? cycleData.currentRR : cycleData.userRR,
        })
        .eq("id", cycleData.userCycle.id);

      if (updateError) throw updateError;

      // Refresh user cycles
      const { data: updatedUserCycles } = await supabase
        .from("user_cycles")
        .select("*")
        .eq("user_id", user.id);
      if (updatedUserCycles) {
        setUserCycles(updatedUserCycles as UserCycle[]);
      }

      if (isEbauche) {
        toast({
          title: "✅ Demande envoyée !",
          description: "Ta demande est enregistrée. L'équipe Oracle va examiner tes trades et te donner un retour détaillé.",
        });
      } else {
        toast({
          title: "✅ Demande envoyée !",
          description: accuracyValue > 0
            ? `Précision estimée : ${accuracyValue.toFixed(1)}% — Un administrateur va valider ton cycle.`
            : "Un administrateur va valider ton cycle.",
        });
      }
    } catch (error) {
      console.error("Error requesting verification:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi de la demande.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  // Rétracter une demande de vérification pending (atomique via RPC)
  const handleRetractVerification = async (cycleId: string) => {
    if (retractingCycleId) return; // une rétractation à la fois
    setRetractingCycleId(cycleId);
    try {
      const { error } = await supabase.rpc("retract_verification_request" as any, {
        p_cycle_id: cycleId,
      });
      if (error) throw error;

      // Mise à jour locale : on retire le cycle des demandes en attente
      setRequestedCycleIds((prev) => {
        const next = new Set(prev);
        next.delete(cycleId);
        return next;
      });
      setVerificationRequestDates((prev) => {
        const next = { ...prev };
        delete next[cycleId];
        return next;
      });

      // Rafraîchir user_cycles pour refléter le retour en in_progress côté UI
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: updatedUserCycles } = await supabase
          .from("user_cycles")
          .select("*")
          .eq("user_id", user.id);
        if (updatedUserCycles) setUserCycles(updatedUserCycles as UserCycle[]);
      }

      toast({
        title: "Demande retirée",
        description: "Ta demande de vérification a été annulée. Tu peux en soumettre une nouvelle quand tu es prêt.",
      });
    } catch (error) {
      console.error("Error retracting verification:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'annuler la demande. Réessaie dans un instant.",
        variant: "destructive",
      });
    } finally {
      setRetractingCycleId(null);
    }
  };

  // Get status icon — basé sur user_cycles.status (progression) et non sur VR status
  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'locked':       return <Lock className="w-4 h-4 text-muted-foreground" />;
      case 'in_progress':  return <Clock className="w-4 h-4 text-blue-400" />;
      case 'pending_review': return <Send className="w-4 h-4 text-orange-400" />;
      case 'in_review':    return <Eye className="w-4 h-4 text-sky-400" />;
      case 'on_hold':      return <PauseCircle className="w-4 h-4 text-purple-400" />;
      case 'validated':    return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'rejected':     return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:             return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Get status label — labels français, cohérents côté user
  const getStatusLabel = (status: string | undefined) => {
    switch (status) {
      case 'locked':         return 'Verrouillé';
      case 'in_progress':    return 'En cours';
      case 'pending_review': return 'En attente';
      case 'in_review':      return 'Review en cours';
      case 'on_hold':        return 'En pause';
      case 'validated':      return 'Validé';
      case 'rejected':       return 'À corriger';
      default:               return 'Verrouillé';
    }
  };

  // Get VR status label (pour les badges dans l'UI)
  const getVrStatusLabel = (vrStatus: 'pending' | 'in_review' | 'on_hold' | undefined) => {
    switch (vrStatus) {
      case 'pending':   return 'Vérification en attente';
      case 'in_review': return 'Review en cours';
      case 'on_hold':   return 'Review suspendue';
      default:          return 'Vérification en attente';
    }
  };

  // Get cycle card styles
  const getCycleStyles = (status: string | undefined) => {
    switch (status) {
      case 'locked':
        return "bg-card border-border opacity-60";
      case 'in_progress':
        return "bg-blue-500/10 border-blue-500/40";
      case 'pending_review':
        return "bg-orange-500/10 border-orange-500/40";
      case 'in_review':
        return "bg-sky-500/10 border-sky-500/40";
      case 'on_hold':
        return "bg-purple-500/10 border-purple-500/40";
      case 'validated':
        return "bg-emerald-500/10 border-emerald-500/40";
      case 'rejected':
        return "bg-red-500/10 border-red-500/40";
      default:
        return "bg-card border-border";
    }
  };


  // Determine if verification popup should show
  const verificationPopupData = useMemo(() => {
    if (loading || isStaff || verificationDismissed) return null;
    // Check ébauche: complete + still in_progress + no existing request
    if (
      ebauche &&
      ebauche.userCycle?.status === 'in_progress' &&
      questData?.ebaucheComplete &&
      !requestedCycleIds.has(ebauche.id)
    ) {
      return {
        cycleName: "Phase d'ébauche",
        cycleNumber: 0,
        progress: questData.ebaucheTradesAnalyzed,
        total: ebauche.total_trades,
        handler: () => handleRequestVerification(ebauche),
      };
    }
    // Check active cycle: complete + still in_progress + no existing request
    if (
      currentCycle &&
      currentCycle.userCycle?.status === 'in_progress' &&
      currentCycle.userExecutions.length >= currentCycle.total_trades &&
      !requestedCycleIds.has(currentCycle.id)
    ) {
      return {
        cycleName: currentCycle.name,
        cycleNumber: currentCycle.cycle_number,
        progress: currentCycle.userExecutions.length,
        total: currentCycle.total_trades,
        handler: () => handleRequestVerification(currentCycle),
      };
    }
    return null;
  }, [loading, isStaff, verificationDismissed, ebauche, currentCycle, requestedCycleIds, questData?.ebaucheComplete, questData?.ebaucheTradesAnalyzed]);

  // ── Time helper ──────────────────────────────────────────────────────────────
  const formatTimeSince = (dateStr: string): string => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} heure${hours > 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `${days} jour${days > 1 ? 's' : ''}`;
  };

  // ── Panel 1 — vidéos ─────────────────────────────────────────────────────────
  const videosWatched = questData?.viewedVideos ?? 0;
  const videosTotal = questData?.totalVideos ?? 0;
  const allVideosWatched = questData?.allVideosWatched ?? false;
  const panel1CTAText = videosWatched === 0 ? "Démarrer" : allVideosWatched ? "Revoir les vidéos" : "Reprendre";
  const panel1Description = videosWatched === 0
    ? "Commence par les vidéos du Setup Oracle : introduction et méthodologie de récolte."
    : allVideosWatched
    ? "Tu as regardé toutes les vidéos. Retourne les revoir à tout moment."
    : `Tu as regardé ${videosWatched} vidéo${videosWatched > 1 ? 's' : ''} sur ${videosTotal}. Continue où tu en étais.`;

  // ── Panel 2 — récolte ────────────────────────────────────────────────────────
  const hasPendingVerif = requestedCycleIds.size > 0;
  const cycleProgressDone = currentCycle?.userExecutions.length ?? 0;
  const cycleProgressTotal = currentCycle?.total_trades ?? 0;
  const cycleProgressPct = cycleProgressTotal > 0 ? (cycleProgressDone / cycleProgressTotal) * 100 : 0;
  const panel2Description = hasPendingVerif
    ? "Ta récolte est complète. La vérification par nos experts est en cours."
    : cycleProgressDone === 0
    ? "Applique la méthodologie. Chaque trade récolté fait émerger les patterns gagnants."
    : cycleProgressPct >= 80
    ? `Tu y es presque ! ${cycleProgressDone}/${cycleProgressTotal} trades saisis sur le ${currentCycle?.name}.`
    : `${cycleProgressDone}/${cycleProgressTotal} trades saisis. Reprends où tu en étais.`;
  const panel2CycleLabel = currentCycle
    ? currentCycle.cycle_number === 0
      ? "de l'Ébauche"
      : `du ${currentCycle.name}`
    : "";
  const panel2CTAText = hasPendingVerif
    ? "Voir mon avancement"
    : `Saisir ma data ${panel2CycleLabel}`.trim();

  // ── Panel 3 — vérification ───────────────────────────────────────────────────
  const pendingCycleId = [...requestedCycleIds][0];
  const pendingVerifDate = pendingCycleId ? verificationRequestDates[pendingCycleId] : null;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Verification Required Popup */}
      {verificationPopupData && (
        <VerificationRequiredPopup
          open={true}
          onClose={() => setVerificationDismissed(true)}
          cycleName={verificationPopupData.cycleName}
          cycleNumber={verificationPopupData.cycleNumber}
          progress={verificationPopupData.progress}
          total={verificationPopupData.total}
          submitting={submitting}
          onRequestVerification={verificationPopupData.handler}
        />
      )}
      {/* Header AVE — visible uniquement pour les membres (non-EA) */}
      {!isEarlyAccess && <div className="px-6 md:px-10 pt-8 md:pt-12 pb-10 md:pb-16 border-b border-border">
        <div className="max-w-6xl mx-auto space-y-10 md:space-y-14">

          {/* Title block */}
          <div className="text-center md:text-left space-y-3 max-w-2xl md:max-w-none">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
              Exécution d'Oracle
            </h2>
            <p className="text-sm md:text-lg text-muted-foreground">
              Suivre le protocole <span className="text-foreground font-semibold">AVE</span> <span className="opacity-60">(apprentissage, vérification, exécution)</span>
            </p>
          </div>

          {/* 3 cards — premium AVE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-7">

            {/* 1 — Apprentissage */}
            <div className="group relative bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] hover:border-white/[0.18] rounded-2xl p-7 md:p-8 flex flex-col gap-6 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_20px_40px_-20px_rgba(255,255,255,0.08)]">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="relative flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.12] flex items-center justify-center shrink-0">
                  <span className="font-bold text-xl text-foreground">1</span>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">Apprentissage</p>
                  <h3 className="text-xl md:text-2xl font-bold text-foreground leading-tight">Regarde les vidéos</h3>
                </div>
              </div>
              {/* Progress indicator */}
              {videosTotal > 0 && (
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/40 rounded-full transition-all duration-500"
                      style={{ width: `${videosTotal > 0 ? (videosWatched / videosTotal) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">
                    {videosWatched}/{videosTotal}
                  </span>
                </div>
              )}
              <p className="relative text-sm text-muted-foreground/80 leading-relaxed flex-1 min-h-[60px]">
                {panel1Description}
              </p>
              <button
                onClick={() => onNavigateToVideos?.()}
                className="relative w-full h-12 rounded-xl bg-white text-black text-sm font-bold tracking-wide hover:bg-white/90 hover:shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition-all inline-flex items-center justify-center gap-2 group/btn"
              >
                {panel1CTAText}
                <span className="transition-transform group-hover/btn:translate-x-1">→</span>
              </button>
            </div>

            {/* 2 — Vérification (primary focus) */}
            <div className={cn(
              "group relative rounded-2xl p-7 md:p-8 flex flex-col gap-6 transition-all duration-300 hover:translate-y-[-2px]",
              hasPendingVerif
                ? "bg-gradient-to-br from-orange-500/[0.08] to-orange-500/[0.02] border border-orange-500/30 hover:border-orange-500/50 shadow-[0_8px_32px_-12px_rgba(249,115,22,0.15)] hover:shadow-[0_20px_48px_-16px_rgba(249,115,22,0.3)]"
                : "bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] border border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_8px_32px_-12px_rgba(16,185,129,0.15)] hover:shadow-[0_20px_48px_-16px_rgba(16,185,129,0.3)]"
            )}>
              <div className={cn(
                "absolute inset-0 rounded-2xl bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
                hasPendingVerif ? "from-orange-500/[0.04]" : "from-emerald-500/[0.04]"
              )} />
              <div className="relative flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl border flex items-center justify-center shrink-0",
                  hasPendingVerif
                    ? "bg-orange-500/15 border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
                    : "bg-emerald-500/15 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                )}>
                  <span className={cn("font-bold text-xl", hasPendingVerif ? "text-orange-400" : "text-emerald-400")}>2</span>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className={cn("text-[10px] font-mono uppercase tracking-[0.2em] mb-1", hasPendingVerif ? "text-orange-400/60" : "text-emerald-400/60")}>Vérification</p>
                  <h3 className="text-xl md:text-2xl font-bold text-foreground leading-tight">Récolte ta data</h3>
                </div>
              </div>
              {/* Cycle progress bar */}
              {!hasPendingVerif && cycleProgressTotal > 0 && (
                <div className="relative flex items-center gap-2">
                  <div className="flex-1 h-1 bg-emerald-500/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/60 rounded-full transition-all duration-500"
                      style={{ width: `${cycleProgressPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/50 shrink-0">
                    {cycleProgressDone}/{cycleProgressTotal}
                  </span>
                </div>
              )}
              <p className="relative text-sm text-muted-foreground/90 leading-relaxed flex-1 min-h-[60px]">
                {panel2Description}
              </p>
              <button
                onClick={() => (onNavigateToRecolte ?? onNavigateToSetup)?.()}
                className={cn(
                  "relative w-full h-12 rounded-xl text-white text-sm font-bold tracking-wide transition-all inline-flex items-center justify-center gap-2 group/btn",
                  hasPendingVerif
                    ? "bg-orange-500 hover:bg-orange-400 shadow-[0_8px_24px_rgba(249,115,22,0.25)] hover:shadow-[0_12px_32px_rgba(249,115,22,0.4)]"
                    : "bg-emerald-500 hover:bg-emerald-400 shadow-[0_8px_24px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_32px_rgba(16,185,129,0.4)]"
                )}
              >
                {panel2CTAText}
                <span className="transition-transform group-hover/btn:translate-x-1">→</span>
              </button>
            </div>

            {/* 3 — Exécution / statut vérification */}
            <div className={cn(
              "relative rounded-2xl p-7 md:p-8 flex flex-col gap-6 transition-all duration-300",
              pendingVerifDate
                ? "bg-gradient-to-br from-blue-500/[0.06] to-blue-500/[0.01] border border-blue-500/20"
                : "bg-gradient-to-br from-white/[0.02] to-transparent border border-dashed border-white/[0.08] opacity-70"
            )}>
              <div className="relative flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  pendingVerifDate
                    ? "bg-blue-500/10 border border-blue-500/30"
                    : "bg-white/[0.02] border border-white/[0.06]"
                )}>
                  <span className={cn("font-bold text-xl", pendingVerifDate ? "text-blue-400" : "text-muted-foreground/60")}>3</span>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className={cn("text-[10px] font-mono uppercase tracking-[0.2em] mb-1", pendingVerifDate ? "text-blue-400/60" : "text-muted-foreground/40")}>Exécution</p>
                  <h3 className={cn("text-xl md:text-2xl font-bold leading-tight", pendingVerifDate ? "text-foreground" : "text-muted-foreground")}>La finalité</h3>
                </div>
              </div>
              <p className={cn("relative text-sm leading-relaxed flex-1 min-h-[60px]", pendingVerifDate ? "text-muted-foreground/90" : "text-muted-foreground/60")}>
                {pendingVerifDate
                  ? `Validation demandée il y a ${formatTimeSince(pendingVerifDate)}. Nos experts sont en train de corriger ton cycle.`
                  : currentCycle
                  ? `Termine le ${currentCycle.name} (${cycleProgressDone}/${cycleProgressTotal} trades) pour soumettre ta vérification.`
                  : "Exécute en temps réel les patterns identifiés. Capitalise sur ce qui fonctionne, élimine ce qui ne fonctionne pas."}
              </p>
              {pendingVerifDate ? (
                <div className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-blue-400/60 border border-blue-500/20 bg-blue-500/[0.04]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  En cours de vérification
                </div>
              ) : (
                <div className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground/30 border border-dashed border-white/[0.06]">
                  ↳ Coming soon
                </div>
              )}
            </div>

          </div>
        </div>
      </div>}

      <div className="flex-1 p-4 md:p-6 overflow-auto space-y-6 md:space-y-8">
      {/* Early Access: Key Stats + Cumulative Evolution + Results */}
        {isEarlyAccess && (
          <>
            {/* Side-by-side: Last data preview (left) + Quests (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Last Data Preview */}
              <LastDataPreviewCard
                lastExecution={trades.length > 0 ? {
                  id: trades[trades.length - 1].id,
                  trade_number: trades[trades.length - 1].trade_number,
                  rr: trades[trades.length - 1].rr,
                  trade_date: trades[trades.length - 1].trade_date,
                  direction: trades[trades.length - 1].direction,
                  entry_time: trades[trades.length - 1].entry_time,
                } as UserExecution : undefined}
                totalUserTrades={trades.length}
                currentCycleName="Early Access"
                totalUserRR={trades.reduce((s, t) => s + (t.rr || 0), 0)}
                averageUserRR={trades.length > 0 ? trades.reduce((s, t) => s + (t.rr || 0), 0) / trades.length : 0}
                completedCycles={0}
                onContinueHarvest={() => {
                  const harvestBtn = eaSettings.find(s => s.button_key === "continuer_ma_recolte");
                  const url = harvestBtn?.button_url || "https://app.fxreplay.com/en-US/auth/testing/dashboard";
                  import("@/hooks/useEaActivityTracking").then(m => m.trackEaButtonClick("continuer_ma_recolte"));
                  window.open(url, "_blank");
                }}
                eaSettings={eaSettings}
                featuredTrade={eaFeaturedTrade}
              />

              {/* Right: Quests / Next Steps */}
              <div className="border border-border rounded-md bg-card p-4 space-y-4">
                <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  Prochaines Étapes
                </h3>
                {questData && !questData.loading && (
                  <DailyQuestCard
                    questData={questData}
                    onNavigateToVideos={() => onNavigateToVideos?.()}
                    onNavigateToSetup={() => onNavigateToSetup?.()}
                    isEarlyAccess={isEarlyAccess}
                    earlyAccessType={earlyAccessType}
                    expiresAt={expiresAt}
                    eaSettings={eaSettings}
                  />
                )}
              </div>
            </div>

            {/* Données Clés — Data Générale */}
            <EarlyAccessKeyStats trades={dataGeneraleTrades || trades} />

            {/* Cumulative Evolution — Data Générale */}
            <div className="border border-border rounded-md p-4 md:p-5 bg-card">
              <CumulativeEvolution trades={dataGeneraleTrades || trades} />
            </div>
          </>
        )}

        {/* Non-Early Access: Last Data Preview + Daily Quest side by side */}
        {!isEarlyAccess && (
          <>
            {/* Side-by-side: Last data preview (left) + Daily Quest (right) — always visible */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Last Data Preview with stats */}
              <LastDataPreviewCard
                lastExecution={userExecutions[userExecutions.length - 1]}
                totalUserTrades={totalUserTrades}
                currentCycleName={currentCycle?.name || "—"}
                totalUserRR={totalUserRR}
                averageUserRR={averageUserRR}
                completedCycles={completedCycles}
                onContinueHarvest={() => {
                  window.open("https://app.fxreplay.com/en-US/auth/testing/dashboard", "_blank");
                  (onNavigateToRecolte ?? onNavigateToSetup)?.();
                }}
              />

              {/* Right: Daily Quest */}
              {questData && !questData.loading ? (
                <div className="border border-border rounded-md bg-card overflow-hidden">
                  <DailyQuestCard
                    questData={questData}
                    onNavigateToVideos={() => onNavigateToVideos?.()}
                    onNavigateToSetup={() => onNavigateToSetup?.()}
                    onRequestVerification={
                      (() => {
                        // Ebauche verification
                        if (ebauche && ebauche.userCycle?.status === 'in_progress' && questData.ebaucheComplete) {
                          return () => handleRequestVerification(ebauche);
                        }
                        // Active cycle verification
                        if (currentCycle && currentCycle.userCycle?.status === 'in_progress' && currentCycle.userExecutions.length >= currentCycle.total_trades) {
                          return () => handleRequestVerification(currentCycle);
                        }
                        return undefined;
                      })()
                    }
                    currentCycleData={currentCycle ? {
                      name: currentCycle.name,
                      progress: currentCycle.userExecutions.length,
                      total: currentCycle.total_trades,
                      isComplete: currentCycle.userExecutions.length >= currentCycle.total_trades,
                    } : undefined}
                  />
                </div>
              ) : (
                <div className="border border-border rounded-md bg-card p-4 flex items-center justify-center text-sm text-muted-foreground">
                  Chargement des quêtes...
                </div>
              )}
            </div>

            {/* Données Clés - aggregate stats for non-EA users */}
            {userExecutions.length > 0 && (
              <div className="border border-border rounded-md p-4 md:p-5 bg-card">
                <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-3">
                  Données Clés
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  <div className="text-center p-2 border border-border rounded-md">
                    <p className="text-[8px] text-muted-foreground font-mono uppercase">Data récoltées</p>
                    <p className="text-lg font-bold text-foreground">{totalUserTrades}</p>
                  </div>
                  <div className="text-center p-2 border border-border rounded-md">
                    <p className="text-[8px] text-muted-foreground font-mono uppercase">Cycle</p>
                    <p className="text-sm font-bold text-foreground truncate">{currentCycle?.name || "—"}</p>
                  </div>
                  <div className="text-center p-2 border border-emerald-500/30 rounded-md bg-emerald-500/5">
                    <p className="text-[8px] text-muted-foreground font-mono uppercase">RR Cumulé</p>
                    <p className={cn("text-lg font-bold", totalUserRR >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {totalUserRR >= 0 ? "+" : ""}{totalUserRR.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-center p-2 border border-border rounded-md">
                    <p className="text-[8px] text-muted-foreground font-mono uppercase">RR Moyen</p>
                    <p className="text-lg font-bold text-foreground">{averageUserRR.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Ébauche Section — hidden once validated */}
            {ebauche && ebauche.userCycle?.status !== 'validated' && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                    Phase Initiale — Ébauche
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-md">
                    15 trades + vidéos explicatives
                  </span>
                </div>
                
                <div 
                  className={cn(
                    "p-5 border rounded-md transition-all cursor-pointer",
                    getCycleStyles(ebauche.userCycle?.status)
                  )}
                  onClick={() => setExpandedCycle(expandedCycle === 0 ? null : 0)}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                        <Play className="w-4 h-4 md:w-5 md:h-5 text-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-foreground text-sm md:text-base">Ébauche</h4>
                        <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                          Première découverte du setup Oracle
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 md:gap-4">
                      <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md md:bg-transparent md:px-0 md:py-0">
                        <span className="text-xs md:text-sm font-mono text-foreground">
                          {questData?.ebaucheTradesAnalyzed || 0}/{ebauche.total_trades}
                        </span>
                        <span className="text-[10px] text-muted-foreground hidden md:inline">analysés</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 md:bg-transparent md:px-0 md:py-0">
                        {getStatusIcon(ebauche.userCycle?.status)}
                        <span className="text-[10px] md:text-xs text-muted-foreground">
                          {getStatusLabel(ebauche.userCycle?.status)}
                        </span>
                      </div>
                      <div className="hidden md:block">
                        {expandedCycle === 0 ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>
                  
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all bg-blue-500" style={{ width: `${Math.min(((questData?.ebaucheTradesAnalyzed || 0) / ebauche.total_trades) * 100, 100)}%` }} />
                  </div>

                  {expandedCycle === 0 && (
                    <div className="mt-4 pt-4 border-t border-border space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Regardez les vidéos explicatives du setup Oracle puis cochez chaque trade analysé et compris.
                      </p>
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onNavigateToVideos?.(); }}>
                          <Play className="w-4 h-4 mr-2" /> Voir les vidéos
                        </Button>
                        {requestedCycleIds.has(ebauche.id) || ebauche.userCycle?.status === 'pending_review' ? (
                          <div className="flex items-center gap-2">
                            {(() => {
                              const vrs = vrStatusByCycle[ebauche.id] ?? 'pending';
                              const isPending = vrs === 'pending';
                              const badgeColor = isPending
                                ? "bg-amber-500/10 border-amber-500/25"
                                : vrs === 'in_review'
                                ? "bg-sky-500/10 border-sky-500/25"
                                : "bg-purple-500/10 border-purple-500/25";
                              const iconColor = isPending ? "text-amber-400" : vrs === 'in_review' ? "text-sky-400" : "text-purple-400";
                              const textColor = isPending ? "text-amber-300" : vrs === 'in_review' ? "text-sky-300" : "text-purple-300";
                              const subColor = isPending ? "text-amber-400/60" : vrs === 'in_review' ? "text-sky-400/60" : "text-purple-400/60";
                              const Icon = isPending ? Clock : vrs === 'in_review' ? Eye : PauseCircle;
                              return (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${badgeColor}`}>
                                  <Icon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
                                  <div>
                                    <span className={`text-xs font-medium ${textColor}`}>{getVrStatusLabel(vrs)}</span>
                                    {verificationRequestDates[ebauche.id] && (
                                      <span className={`block text-[10px] ${subColor} font-mono`}>
                                        Envoyée le {new Date(verificationRequestDates[ebauche.id]).toLocaleDateString("fr-FR")}
                                      </span>
                                    )}
                                    {!isPending && (
                                      <span className={`block text-[10px] ${subColor} font-mono`}>
                                        Retrait impossible — attends le verdict
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                            {vrStatusByCycle[ebauche.id] === 'pending' || !vrStatusByCycle[ebauche.id] ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleRetractVerification(ebauche.id); }}
                                disabled={retractingCycleId === ebauche.id}
                                className="text-xs text-muted-foreground hover:text-destructive h-auto px-2 py-1"
                              >
                                {retractingCycleId === ebauche.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Retirer"}
                              </Button>
                            ) : null}
                          </div>
                        ) : ebauche.userCycle?.status === 'in_progress' ? (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleRequestVerification(ebauche); }}
                            disabled={(questData?.ebaucheTradesAnalyzed || 0) < ebauche.total_trades || submitting || submittingRef.current}>
                            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            Demander la vérification
                          </Button>
                        ) : null}
                      </div>
                      {ebauche.userCycle?.status === 'rejected' && ebauche.userCycle.admin_feedback && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
                          <p className="text-xs font-mono uppercase text-red-400 mb-1">Feedback</p>
                          <p className="text-sm text-foreground">{ebauche.userCycle.admin_feedback}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Summary Table - hidden for Early Access */}
        {!isEarlyAccess && (
          <div className="border border-border p-4 md:p-6 bg-transparent rounded-md overflow-x-auto">
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
              Récapitulatif des Cycles
            </h3>
            <div className="space-y-2">
              {cyclesWithProgress.map((cycle) => {
                const isEbauche = cycle.cycle_number === 0;
                const ebaucheAnalyzed = questData?.ebaucheTradesAnalyzed || 0;
                const displayCount = isEbauche ? ebaucheAnalyzed : cycle.userExecutions.length;
                const displayLabel = isEbauche ? "analysés" : "saisis";
                const displayProgress = isEbauche 
                  ? Math.min((ebaucheAnalyzed / cycle.total_trades) * 100, 100)
                  : cycle.progress;
                const cycleTradeNotes = adminTradeNotesByCycle[cycle.id] ?? [];
                const hasFeedback = (cycle.userCycle?.admin_feedback || cycleTradeNotes.length > 0) &&
                  (cycle.userCycle?.status === 'validated' || cycle.userCycle?.status === 'rejected');
                const isExpanded = expandedCycle === cycle.cycle_number;

                return (
                  <div key={cycle.id}>
                    <div 
                      className={cn(
                        "flex items-center gap-4 py-2 border-b border-border last:border-0",
                        hasFeedback && "cursor-pointer hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors"
                      )}
                      onClick={() => hasFeedback && setExpandedCycle(isExpanded ? null : cycle.cycle_number)}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                          cycle.userCycle?.status === 'validated'
                            ? "bg-emerald-500/20 text-emerald-400"
                            : cycle.userCycle?.status === 'in_progress'
                            ? "bg-blue-500/20 text-blue-400"
                            : cycle.userCycle?.status === 'pending_review'
                            ? "bg-orange-500/20 text-orange-400"
                            : cycle.userCycle?.status === 'in_review'
                            ? "bg-sky-500/20 text-sky-400"
                            : cycle.userCycle?.status === 'on_hold'
                            ? "bg-purple-500/20 text-purple-400"
                            : cycle.userCycle?.status === 'rejected'
                            ? "bg-red-500/20 text-red-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {cycle.cycle_number}
                        </div>
                        {isEbauche && (
                          <span className="text-[8px] font-medium leading-none text-muted-foreground/60 tracking-wide">
                            Ébauche
                          </span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground">{cycle.name}</span>
                            {hasFeedback && (
                              <ChevronDown className={cn(
                                "w-3.5 h-3.5 text-muted-foreground transition-transform",
                                isExpanded && "rotate-180"
                              )} />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(cycle.userCycle?.status)}
                            <span className="text-xs text-muted-foreground">
                              {displayCount}/{cycle.total_trades} {displayLabel}
                            </span>
                          </div>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              cycle.userCycle?.status === 'validated'     ? "bg-emerald-500"
                              : cycle.userCycle?.status === 'in_progress'  ? "bg-blue-500"
                              : cycle.userCycle?.status === 'pending_review' ? "bg-orange-500"
                              : cycle.userCycle?.status === 'in_review'   ? "bg-sky-500"
                              : cycle.userCycle?.status === 'on_hold'     ? "bg-purple-500"
                              : cycle.userCycle?.status === 'rejected'    ? "bg-red-500"
                              : "bg-foreground/30"
                            )}
                            style={{ width: `${displayProgress}%` }}
                          />
                        </div>
                      </div>
                      {isEbauche ? (
                        <span className="text-sm font-mono w-20 text-right text-foreground">
                          {ebaucheAnalyzed}/{cycle.total_trades}
                        </span>
                      ) : (
                        <span className={cn(
                          "text-sm font-mono w-20 text-right",
                          cycle.userRR > 0 ? "text-emerald-400" 
                          : cycle.userRR < 0 ? "text-red-400"
                          : "text-muted-foreground"
                        )}>
                          {cycle.userRR >= 0 ? "+" : ""}{cycle.userRR.toFixed(1)} RR
                        </span>
                      )}
                    </div>
                    
                    {/* Verification request button / status */}
                    {!isEbauche && cycle.userExecutions.length >= cycle.total_trades && (
                      <div className="ml-10 mt-2 mb-1">
                        {requestedCycleIds.has(cycle.id) || cycle.userCycle?.status === 'pending_review' ? (
                          // ── Demande active — badge adapté au statut VR + retrait conditionnel ──
                          <div className="flex items-center gap-2">
                            {(() => {
                              const vrs = vrStatusByCycle[cycle.id] ?? 'pending';
                              const isPending = vrs === 'pending';
                              const badgeColor = isPending
                                ? "bg-amber-500/10 border-amber-500/25"
                                : vrs === 'in_review'
                                ? "bg-sky-500/10 border-sky-500/25"
                                : "bg-purple-500/10 border-purple-500/25";
                              const iconColor = isPending ? "text-amber-400" : vrs === 'in_review' ? "text-sky-400" : "text-purple-400";
                              const textColor = isPending ? "text-amber-300" : vrs === 'in_review' ? "text-sky-300" : "text-purple-300";
                              const subColor  = isPending ? "text-amber-400/60" : vrs === 'in_review' ? "text-sky-400/60" : "text-purple-400/60";
                              const Icon = isPending ? Clock : vrs === 'in_review' ? Eye : PauseCircle;
                              return (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border w-fit ${badgeColor}`}>
                                  <Icon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
                                  <div>
                                    <span className={`text-xs font-medium ${textColor}`}>{getVrStatusLabel(vrs)}</span>
                                    {verificationRequestDates[cycle.id] && (
                                      <span className={`block text-[10px] ${subColor} font-mono`}>
                                        Envoyée le {new Date(verificationRequestDates[cycle.id]).toLocaleDateString("fr-FR")}
                                      </span>
                                    )}
                                    {!isPending && (
                                      <span className={`block text-[10px] ${subColor} font-mono`}>
                                        Retrait impossible — attends le verdict
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                            {vrStatusByCycle[cycle.id] === 'pending' || !vrStatusByCycle[cycle.id] ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleRetractVerification(cycle.id); }}
                                disabled={retractingCycleId === cycle.id}
                                className="text-xs text-muted-foreground hover:text-destructive h-auto px-2 py-1"
                              >
                                {retractingCycleId === cycle.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Retirer"}
                              </Button>
                            ) : null}
                          </div>
                        ) : (cycle.userCycle?.status === 'in_progress' || cycle.userCycle?.status === 'rejected') ? (
                          // ── Peut envoyer une demande ──
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleRequestVerification(cycle); }}
                            disabled={submitting || submittingRef.current}
                            className="gap-1.5"
                          >
                            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Demander ma vérification
                          </Button>
                        ) : null}
                      </div>
                    )}

                    {/* Expandable report */}
                    {isExpanded && hasFeedback && (
                      <div className={cn(
                        "ml-10 mt-1 mb-3 p-3 rounded-md border text-sm space-y-2",
                        cycle.userCycle?.status === 'validated'
                          ? "bg-emerald-500/5 border-emerald-500/30"
                          : "bg-red-500/5 border-red-500/30"
                      )}>
                        <p className="text-[10px] font-mono uppercase text-muted-foreground">
                          Rapport de vérification
                        </p>

                        {/* Notes admin trade par trade (P4) */}
                        {cycleTradeNotes.length > 0 && (
                          <div className="space-y-1.5">
                            {cycleTradeNotes.map((n) => (
                              <div key={n.execution_id} className={cn(
                                "flex items-start gap-2 rounded px-2 py-1.5 text-xs",
                                n.is_valid === true
                                  ? "bg-emerald-500/10"
                                  : n.is_valid === false
                                  ? "bg-red-500/10"
                                  : "bg-muted/30"
                              )}>
                                {n.is_valid === true
                                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                  : n.is_valid === false
                                  ? <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                                  : <Circle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                }
                                <div className="flex-1 min-w-0">
                                  <span className="font-mono font-bold text-foreground">
                                    Trade #{n.trade_number}
                                  </span>
                                  {n.note && (
                                    <span className="ml-1.5 text-muted-foreground">— {n.note}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Commentaire global admin (admin_feedback) */}
                        {cycle.userCycle?.admin_feedback && (() => {
                          const commentLine = cycle.userCycle!.admin_feedback!
                            .split("\n")
                            .find(l => l.startsWith("Commentaire"));
                          return commentLine
                            ? <p className="text-xs text-muted-foreground italic border-t border-border/50 pt-2">{commentLine}</p>
                            : null;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rules doc — collapsible, visible par tous */}
        <TradeRulesSection trades={trades} />

        {/* Results section at bottom - Early Access only */}
        {isEarlyAccess && (
          <div className="border border-border rounded-md bg-card overflow-hidden">
            <div className="p-4 md:p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  Résultats les plus récents
                </h3>
              </div>
            </div>
            <EarlyAccessResultsPreview />
          </div>
        )}
      </div>
    </div>
  );
};

// ── TradeRulesSection — collapsible doc des règles de saisie ─────────────────
function TradeRulesSection({ trades }: { trades: { trade_number: number; trade_date: string }[] }) {
  const [open, setOpen] = useState(false);
  const windows = useMemo(() => deriveOracleCycleWindows(trades), [trades]);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-transparent hover:bg-white/[.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-muted-foreground/50" />
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Règles de saisie des trades
          </span>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 text-muted-foreground/40 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border">
          <TradeRulesDoc oracleCycleWindows={windows} />
        </div>
      )}
    </div>
  );
}

// Cycle Card Component
interface CycleCardProps {
  cycle: CycleWithProgress;
  expanded: boolean;
  onToggle: () => void;
  onRequestVerification: () => void;
  submitting: boolean;
  getStatusIcon: (status: string | undefined) => React.ReactNode;
  getStatusLabel: (status: string | undefined) => string;
  getCycleStyles: (status: string | undefined) => string;
}

const CycleCard = ({
  cycle,
  expanded,
  onToggle,
  onRequestVerification,
  submitting,
  getStatusIcon,
  getStatusLabel,
  getCycleStyles,
}: CycleCardProps) => {
  const isLocked = cycle.userCycle?.status === 'locked';
  
  return (
    <div 
      className={cn(
        "p-4 border rounded-md transition-all",
        getCycleStyles(cycle.userCycle?.status),
        !isLocked && "cursor-pointer hover:border-muted-foreground/30"
      )}
      onClick={() => !isLocked && onToggle()}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-mono uppercase text-muted-foreground">
          {cycle.name}
        </span>
        {getStatusIcon(cycle.userCycle?.status)}
      </div>
      
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-2xl font-bold text-foreground">
          {cycle.userExecutions.length}
        </span>
        <span className="text-sm text-muted-foreground">/ {cycle.total_trades}</span>
      </div>
      
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
        <div 
          className={cn(
            "h-full rounded-full transition-all",
            cycle.userCycle?.status === 'validated' ? "bg-emerald-500" 
            : cycle.userCycle?.status === 'in_progress' ? "bg-blue-500"
            : cycle.userCycle?.status === 'pending_review' ? "bg-orange-500"
            : cycle.userCycle?.status === 'rejected' ? "bg-red-500"
            : "bg-foreground/30"
          )}
          style={{ width: `${cycle.progress}%` }}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {isLocked ? (
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3" /> Verrouillé
            </span>
          ) : (
            `Trades ${cycle.trade_start}-${cycle.trade_end}`
          )}
        </span>
        <span className={cn(
          "font-mono",
          cycle.userRR > 0 ? "text-emerald-400" 
          : cycle.userRR < 0 ? "text-red-400"
          : "text-muted-foreground"
        )}>
          {isLocked ? "— RR" : `${cycle.userRR >= 0 ? "+" : ""}${cycle.userRR.toFixed(1)} RR`}
        </span>
      </div>

      {expanded && !isLocked && (
        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Statut</span>
            <span className="flex items-center gap-1">
              {getStatusIcon(cycle.userCycle?.status)}
              {getStatusLabel(cycle.userCycle?.status)}
            </span>
          </div>
          
          {(cycle.userCycle?.status === 'in_progress' || cycle.userCycle?.status === 'rejected') && (
            <Button
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onRequestVerification();
              }}
              disabled={cycle.userExecutions.length < cycle.total_trades || submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {cycle.userExecutions.length < cycle.total_trades 
                ? `${cycle.total_trades - cycle.userExecutions.length} trades restants`
                : "Demander la vérification"
              }
            </Button>
          )}
          
          {cycle.userCycle?.status === 'pending_review' && (
            <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded text-xs text-orange-400">
              En attente de vérification par l'administrateur
            </div>
          )}
          
          {cycle.userCycle?.status === 'rejected' && cycle.userCycle.admin_feedback && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded space-y-1">
              <p className="text-xs font-mono uppercase text-red-400 mb-1">Rapport</p>
              {cycle.userCycle.admin_feedback.split("\n").filter(Boolean).map((line, i) => {
                if (line.startsWith("•")) {
                  return (
                    <div key={i} className="flex items-start gap-1.5 pl-1">
                      <XCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[10px] text-foreground">{line.replace("• ", "")}</span>
                    </div>
                  );
                }
                return <p key={i} className="text-[10px] text-foreground">{line}</p>;
              })}
            </div>
          )}
          
          {cycle.userCycle?.status === 'validated' && cycle.userCycle.admin_feedback && (
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded space-y-1">
              <p className="text-xs font-mono uppercase text-emerald-400 mb-1">Rapport</p>
              {cycle.userCycle.admin_feedback.split("\n").filter(Boolean).map((line, i) => {
                if (line.startsWith("•")) {
                  return (
                    <div key={i} className="flex items-start gap-1.5 pl-1">
                      <XCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[10px] text-foreground">{line.replace("• ", "")}</span>
                    </div>
                  );
                }
                return <p key={i} className="text-[10px] text-foreground">{line}</p>;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Données Clés for Early Access (embedded in OracleExecution) ───
const EarlyAccessKeyStats = ({ trades }: { trades: { rr: number; direction?: string; trade_number: number }[] }) => {
  const stats = useMemo(() => {
    const allRR = trades.map(t => t.rr || 0);
    const totalRR = allRR.reduce((a, b) => a + b, 0);
    const avgRR = allRR.length > 0 ? totalRR / allRR.length : 0;
    const maxRR = Math.max(...allRR, 0);
    const minRR = Math.min(...allRR, 0);
    const winRate = allRR.length > 0 ? (allRR.filter(rr => rr > 0).length / allRR.length) * 100 : 0;
    const longTrades = trades.filter(t => (t as any).direction === "Long");
    const shortTrades = trades.filter(t => (t as any).direction === "Short");
    const longRR = longTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
    const shortRR = shortTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
    return { totalRR, avgRR, maxRR, minRR, winRate, longCount: longTrades.length, shortCount: shortTrades.length, longRR, shortRR };
  }, [trades]);

  return (
    <div className="border border-border rounded-md p-4 md:p-5 bg-card">
      <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-3">
        Données Clés
      </p>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
        <div className="text-center p-2 border border-emerald-500/30 rounded-md bg-emerald-500/5">
          <p className="text-[8px] text-muted-foreground font-mono uppercase">RR Total</p>
          <p className="text-lg font-bold text-emerald-500">{stats.totalRR >= 0 ? "+" : ""}{stats.totalRR.toFixed(0)}</p>
        </div>
        <div className="text-center p-2 border border-border rounded-md">
          <p className="text-[8px] text-muted-foreground font-mono uppercase">Moy. RR</p>
          <p className="text-lg font-bold text-foreground">{stats.avgRR.toFixed(2)}</p>
        </div>
        <div className="text-center p-2 border border-border rounded-md">
          <p className="text-[8px] text-muted-foreground font-mono uppercase">Win Rate</p>
          <p className="text-lg font-bold text-foreground">{stats.winRate.toFixed(0)}%</p>
        </div>
        <div className="text-center p-2 border border-border rounded-md">
          <p className="text-[8px] text-muted-foreground font-mono uppercase">Meilleur</p>
          <p className="text-lg font-bold text-emerald-500">+{stats.maxRR.toFixed(1)}</p>
        </div>
        <div className="text-center p-2 border border-border rounded-md">
          <p className="text-[8px] text-muted-foreground font-mono uppercase">Pire</p>
          <p className="text-lg font-bold text-red-500">{stats.minRR.toFixed(1)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="flex items-center justify-between p-2 border border-emerald-500/20 rounded-md bg-emerald-500/5">
          <span className="text-[9px] font-mono text-emerald-400 uppercase">Long</span>
          <span className="text-xs font-mono font-bold text-emerald-500">
            {stats.longCount}t · {stats.longRR >= 0 ? "+" : ""}{stats.longRR.toFixed(1)} RR
          </span>
        </div>
        <div className="flex items-center justify-between p-2 border border-red-500/20 rounded-md bg-red-500/5">
          <span className="text-[9px] font-mono text-red-400 uppercase">Short</span>
          <span className="text-xs font-mono font-bold text-red-500">
            {stats.shortCount}t · {stats.shortRR >= 0 ? "+" : ""}{stats.shortRR.toFixed(1)} RR
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Results Preview for Early Access (inline in OracleExecution) ───
const EarlyAccessResultsPreview = () => {
  const [results, setResults] = useState<{ id: string; title: string | null; image_path: string }[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      const { data } = await supabase
        .from("results")
        .select("id, title, image_path")
        .order("created_at", { ascending: false })
        .limit(6);
      
      if (data) {
        setResults(data);
        const paths = data.map(r => r.image_path).filter(Boolean);
        if (paths.length > 0) {
          const { data: signed } = await supabase.storage
            .from("result-screenshots")
            .createSignedUrls(paths, 3600);
          if (signed) {
            const urlMap: Record<string, string> = {};
            signed.forEach((s: any) => {
              if (s.signedUrl) urlMap[s.path] = s.signedUrl;
            });
            setSignedUrls(urlMap);
          }
        }
      }
    };
    fetchResults();
  }, []);

  if (results.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Aucun résultat disponible pour le moment.
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
        {results.map((result) => {
          const url = signedUrls[result.image_path];
          return (
            <button
              key={result.id}
              onClick={() => url && setLightboxUrl(url)}
              className="border border-border rounded-md overflow-hidden bg-card hover:border-foreground/30 transition-all"
            >
              <div className="aspect-video bg-muted relative">
                {url ? (
                  <img src={url} alt={result.title || "Résultat"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-4 h-4 border border-foreground border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {result.title && (
                <div className="p-2">
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{result.title}</p>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="Résultat" open={!!lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  );
};

// ─── Last Data Preview Card ───
interface EASetting {
  button_key: string;
  button_label: string;
  button_url: string;
}

interface LastDataPreviewCardProps {
  lastExecution?: UserExecution;
  totalUserTrades: number;
  currentCycleName: string;
  totalUserRR: number;
  averageUserRR: number;
  completedCycles: number;
  onContinueHarvest: () => void;
  eaSettings?: EASetting[];
  featuredTrade?: EaFeaturedTrade | null;
}

const LastDataPreviewCard = ({
  lastExecution,
  totalUserTrades,
  currentCycleName,
  totalUserRR,
  averageUserRR,
  completedCycles,
  onContinueHarvest,
  eaSettings,
  featuredTrade,
}: LastDataPreviewCardProps) => {
  const [activeScreen, setActiveScreen] = useState<"m15" | "m5">("m15");
  const [ftSignedUrl, setFtSignedUrl] = useState<string | null>(null);

  // Video bonus button removed - content is now integrated in VideoSetup

  // Load signed URL for featured trade screenshot
  useEffect(() => {
    const loadFtUrl = async () => {
      if (featuredTrade?.content_type === "screenshot" && featuredTrade?.image_path) {
        const { data } = await supabase.storage.from("trade-screenshots").createSignedUrl(featuredTrade.image_path, 3600);
        if (data) setFtSignedUrl(data.signedUrl);
      }
    };
    loadFtUrl();
  }, [featuredTrade]);

  // Use featured trade data if available, fallback to lastExecution
  const displayDirection = featuredTrade?.direction || lastExecution?.direction;
  const displayDate = featuredTrade?.trade_date || lastExecution?.trade_date;
  const displayRR = featuredTrade?.rr ?? lastExecution?.rr;
  const displayEntryTime = featuredTrade?.entry_time || lastExecution?.entry_time;
  const hasFeatured = !!featuredTrade;

  if (!lastExecution && !featuredTrade) {
    return (
      <div className="border border-border rounded-md bg-card p-4 flex items-center justify-center text-sm text-muted-foreground">
        Aucune data récoltée pour le moment.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
          Dernière data récoltée
        </h3>
      </div>

      {/* Trade-specific metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {displayDirection && (
          <div className="flex items-center gap-2 p-2 border border-border rounded-md">
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-mono font-bold",
              displayDirection === "Long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            )}>
              {displayDirection === "Long" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {displayDirection}
            </div>
          </div>
        )}
        {displayDate && (
          <div className="p-2 border border-border rounded-md">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">Date</p>
            <p className="text-sm font-mono font-semibold text-foreground">
              {new Date(displayDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        )}
        {displayRR !== null && displayRR !== undefined && (
          <div className="p-2 border border-border rounded-md">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">RR</p>
            <p className={cn("text-lg font-mono font-bold", (displayRR || 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
              {(displayRR || 0) >= 0 ? "+" : ""}{(displayRR || 0).toFixed(1)}
            </p>
          </div>
        )}
        {displayEntryTime && (
          <div className="p-2 border border-border rounded-md">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">Entrée</p>
            <p className="text-sm font-mono font-semibold text-foreground">{displayEntryTime}</p>
          </div>
        )}
      </div>

      {/* Featured content: screenshot or video */}
      {hasFeatured && featuredTrade?.content_type === "video" && featuredTrade?.video_url ? (
        <div className="rounded-md overflow-hidden border border-border aspect-video">
          <iframe
            src={featuredTrade.video_url}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            title="Vidéo de trade"
          />
        </div>
      ) : hasFeatured && featuredTrade?.content_type === "screenshot" && ftSignedUrl ? (
        <div className="rounded-md overflow-hidden border border-border">
          <img src={ftSignedUrl} alt="Trade screenshot" className="w-full h-auto" />
        </div>
      ) : !hasFeatured && (lastExecution?.screenshot_url || lastExecution?.screenshot_entry_url) ? (
        <div>
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => setActiveScreen("m15")}
              className={cn("px-2 py-0.5 text-[10px] font-mono rounded transition-colors", activeScreen === "m15" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Contexte
            </button>
            <button
              onClick={() => setActiveScreen("m5")}
              className={cn("px-2 py-0.5 text-[10px] font-mono rounded transition-colors", activeScreen === "m5" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Entrée
            </button>
          </div>
          <div className="rounded-md overflow-hidden border border-border">
            <SignedImageCard
              storagePath={activeScreen === "m15" ? lastExecution.screenshot_url || null : lastExecution.screenshot_entry_url || null}
              alt={`Trade ${activeScreen === "m15" ? "Contexte" : "Entrée"}`}
              label={activeScreen === "m15" ? "Contexte" : "Entrée"}
              fillContainer
            />
          </div>
        </div>
      ) : null}

      {/* Continue button */}
      <Button size="sm" className="w-full gap-2" onClick={onContinueHarvest}>
        <ExternalLink className="w-3.5 h-3.5" />
        Continuer ma récolte
      </Button>
    </div>
  );
};
