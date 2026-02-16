import { useEffect, useMemo, useState } from "react";
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
  ArrowDownRight
} from "lucide-react";
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
  onNavigateToVideos?: () => void;
  onNavigateToSetup?: () => void;
  questData?: QuestData;
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
  status: 'locked' | 'in_progress' | 'pending_review' | 'validated' | 'rejected';
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

export const OracleExecution = ({ trades, onNavigateToVideos, onNavigateToSetup, questData }: OracleExecutionProps) => {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [userCycles, setUserCycles] = useState<UserCycle[]>([]);
  const [userExecutions, setUserExecutions] = useState<UserExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCycle, setExpandedCycle] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { isEarlyAccess, expiresAt } = useEarlyAccess();
  const { settings: eaSettings } = useEarlyAccessSettings();

  // Fetch cycles, user cycles, and user executions
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      // Create verification request
      const { error: requestError } = await supabase
        .from("verification_requests")
        .insert({
          user_id: user.id,
          cycle_id: cycleData.id,
          user_cycle_id: cycleData.userCycle.id,
          status: "pending",
        });

      if (requestError) throw requestError;

      // For cycles 1+, check accuracy for auto-validation (90%+ = auto-approve)
      if (cycleData.cycle_number > 0) {
        const { data: accuracy, error: accError } = await supabase.rpc(
          "check_cycle_accuracy_and_auto_validate",
          {
            p_user_id: user.id,
            p_cycle_id: cycleData.id,
            p_user_cycle_id: cycleData.userCycle.id,
          }
        );

        if (accError) throw accError;

        const accuracyValue = Number(accuracy) || 0;

        // Refresh user cycles
        const { data: updatedUserCycles } = await supabase
          .from("user_cycles")
          .select("*")
          .eq("user_id", user.id);

        if (updatedUserCycles) {
          setUserCycles(updatedUserCycles as UserCycle[]);
        }

        if (accuracyValue >= 90) {
          toast({
            title: "🎉 Cycle validé automatiquement !",
            description: `Précision de ${accuracyValue.toFixed(1)}% — Le palier suivant est débloqué !`,
          });
        } else {
          // Below 90%: set to pending_review for admin
          const { error: updateError } = await supabase
            .from("user_cycles")
            .update({
              status: "pending_review",
              completed_at: new Date().toISOString(),
              completed_trades: cycleData.userExecutions.length,
              total_rr: cycleData.userRR,
            })
            .eq("id", cycleData.userCycle.id);

          if (updateError) throw updateError;

          // Re-refresh after update
          const { data: reUpdated } = await supabase
            .from("user_cycles")
            .select("*")
            .eq("user_id", user.id);
          if (reUpdated) setUserCycles(reUpdated as UserCycle[]);

          toast({
            title: "Demande envoyée !",
            description: `Précision de ${accuracyValue.toFixed(1)}% — Un administrateur doit valider votre cycle.`,
          });
        }
      } else {
        // Ébauche (cycle 0): always needs admin review
        const { error: updateError } = await supabase
          .from("user_cycles")
          .update({
            status: "pending_review",
            completed_at: new Date().toISOString(),
            completed_trades: cycleData.currentTrades.length,
            total_rr: cycleData.currentRR,
          })
          .eq("id", cycleData.userCycle.id);

        if (updateError) throw updateError;

        const { data: updatedUserCycles } = await supabase
          .from("user_cycles")
          .select("*")
          .eq("user_id", user.id);

        if (updatedUserCycles) {
          setUserCycles(updatedUserCycles as UserCycle[]);
        }

        toast({
          title: "Demande envoyée !",
          description: "Votre demande de vérification a été soumise. Vous serez notifié dès validation.",
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
    }
  };

  // Get status icon
  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'locked': return <Lock className="w-4 h-4 text-muted-foreground" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-400" />;
      case 'pending_review': return <Send className="w-4 h-4 text-orange-400" />;
      case 'validated': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'rejected': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Get status label
  const getStatusLabel = (status: string | undefined) => {
    switch (status) {
      case 'locked': return 'Verrouillé';
      case 'in_progress': return 'En cours';
      case 'pending_review': return 'En attente';
      case 'validated': return 'Validé';
      case 'rejected': return 'À corriger';
      default: return 'Verrouillé';
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
      case 'validated': 
        return "bg-emerald-500/10 border-emerald-500/40";
      case 'rejected': 
        return "bg-red-500/10 border-red-500/40";
      default: 
        return "bg-card border-border";
    }
  };

  if (loading) {
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">Exécution d'Oracle</h2>
            <p className="text-xs md:text-sm text-muted-foreground font-mono">
              Progression des 8 cycles vers les 314 trades
            </p>
          </div>
          {(() => {
            const videoBonusSetting = eaSettings.find(s => s.button_key === "video_bonus_mercure_institut");
            const videoBonusHref = videoBonusSetting?.button_url || "https://mercurefx.webflow.io/utility/connexion";
            return (
              <a
                href={videoBonusHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/50 rounded-md text-xs font-semibold text-primary hover:bg-primary/10 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Vidéos bonus — Mercure Institut
              </a>
            );
          })()}
        </div>
      </div>

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
                  window.open(url, "_blank");
                }}
                eaSettings={eaSettings}
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
                    expiresAt={expiresAt}
                    eaSettings={eaSettings}
                  />
                )}
              </div>
            </div>

            {/* Données Clés */}
            <EarlyAccessKeyStats trades={trades} />

            {/* Cumulative Evolution with Simulator */}
            <div className="border border-border rounded-md p-4 md:p-5 bg-card">
              <CumulativeEvolution trades={trades} />
            </div>
          </>
        )}

        {/* Non-Early Access: Last Data Preview + Daily Quest side by side */}
        {!isEarlyAccess && (
          <>
            {/* Side-by-side: Last data preview (left) + Daily Quest (right) */}
            {userExecutions.length > 0 && (
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
                    onNavigateToSetup?.();
                  }}
                />

                {/* Right: Daily Quest */}
                {questData && !questData.loading && (
                  <div className="border border-border rounded-md bg-card overflow-hidden">
                    <DailyQuestCard
                      questData={questData}
                      onNavigateToVideos={() => onNavigateToVideos?.()}
                      onNavigateToSetup={() => onNavigateToSetup?.()}
                      onRequestVerification={
                        ebauche && ebauche.userCycle?.status === 'in_progress'
                          ? () => handleRequestVerification(ebauche)
                          : undefined
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* If no executions yet, show daily quest full width */}
            {userExecutions.length === 0 && questData && !questData.loading && (
              <DailyQuestCard
                questData={questData}
                onNavigateToVideos={() => onNavigateToVideos?.()}
                onNavigateToSetup={() => onNavigateToSetup?.()}
                onRequestVerification={
                  ebauche && ebauche.userCycle?.status === 'in_progress'
                    ? () => handleRequestVerification(ebauche)
                    : undefined
                }
              />
            )}

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
                        {ebauche.userCycle?.status === 'in_progress' && (
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleRequestVerification(ebauche); }}
                            disabled={(questData?.ebaucheTradesAnalyzed || 0) < ebauche.total_trades || submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            Demander la vérification
                          </Button>
                        )}
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
          <div className="border border-border p-6 bg-transparent rounded-md">
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

                return (
                  <div 
                    key={cycle.id}
                    className="flex items-center gap-4 py-2 border-b border-border last:border-0"
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      cycle.userCycle?.status === 'validated'
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : cycle.userCycle?.status === 'in_progress'
                        ? "bg-blue-500/20 text-blue-400"
                        : cycle.userCycle?.status === 'pending_review'
                        ? "bg-orange-500/20 text-orange-400"
                        : cycle.userCycle?.status === 'rejected'
                        ? "bg-red-500/20 text-red-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {isEbauche ? "É" : cycle.cycle_number}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{cycle.name}</span>
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
                            cycle.userCycle?.status === 'validated' ? "bg-emerald-500" 
                            : cycle.userCycle?.status === 'in_progress' ? "bg-blue-500"
                            : cycle.userCycle?.status === 'pending_review' ? "bg-orange-500"
                            : cycle.userCycle?.status === 'rejected' ? "bg-red-500"
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
                );
              })}
            </div>
          </div>
        )}

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
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded">
              <p className="text-xs font-mono uppercase text-red-400 mb-1">Feedback</p>
              <p className="text-xs text-foreground">{cycle.userCycle.admin_feedback}</p>
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
}: LastDataPreviewCardProps) => {
  const [activeScreen, setActiveScreen] = useState<"m15" | "m5">("m15");

  // Get the URL for "Vidéo bonus Mercure Institut" from EA settings
  const videoBonusBtn = eaSettings?.find(s => s.button_key === "video_bonus_mercure_institut");
  const videoBonusUrl = videoBonusBtn?.button_url || "https://mercurefx.webflow.io/utility/connexion";

  if (!lastExecution) {
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
        <span className="text-xs font-mono text-muted-foreground">
          #{lastExecution.trade_number}
        </span>
      </div>

      {/* Trade-specific metadata ABOVE the screenshot — bigger style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="flex items-center gap-2 p-2 border border-border rounded-md">
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-mono font-bold",
            lastExecution.direction === "Long" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            {lastExecution.direction === "Long" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {lastExecution.direction}
          </div>
        </div>
        <div className="p-2 border border-border rounded-md">
          <p className="text-[8px] text-muted-foreground font-mono uppercase">Date</p>
          <p className="text-sm font-mono font-semibold text-foreground">
            {lastExecution.trade_date ? new Date(lastExecution.trade_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
          </p>
        </div>
        {lastExecution.rr !== null && lastExecution.rr !== undefined && (
          <div className="p-2 border border-border rounded-md">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">RR</p>
            <p className={cn("text-lg font-mono font-bold", (lastExecution.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
              {(lastExecution.rr || 0) >= 0 ? "+" : ""}{(lastExecution.rr || 0).toFixed(1)}
            </p>
          </div>
        )}
        {lastExecution.entry_time && (
          <div className="p-2 border border-border rounded-md">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">Entrée</p>
            <p className="text-sm font-mono font-semibold text-foreground">{lastExecution.entry_time}</p>
          </div>
        )}
        {lastExecution.setup_type && (
          <div className="p-2 border border-border rounded-md">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">Setup</p>
            <p className="text-sm font-mono font-semibold text-primary">{lastExecution.setup_type}</p>
          </div>
        )}
        {lastExecution.entry_model && (
          <div className="p-2 border border-border rounded-md">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">Modèle</p>
            <p className="text-sm font-mono font-semibold text-foreground">{lastExecution.entry_model}</p>
          </div>
        )}
      </div>

      {/* Screenshot preview - image fills the container */}
      {(lastExecution.screenshot_url || lastExecution.screenshot_entry_url) && (
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
              alt={`Trade #${lastExecution.trade_number} ${activeScreen === "m15" ? "Contexte" : "Entrée"}`}
              label={activeScreen === "m15" ? "Contexte" : "Entrée"}
              fillContainer
            />
          </div>
        </div>
      )}

      {/* Continue button - uses EA custom URL if available */}
      <Button size="sm" className="w-full gap-2" onClick={onContinueHarvest}>
        <ExternalLink className="w-3.5 h-3.5" />
        Continuer ma récolte
      </Button>
    </div>
  );
};
