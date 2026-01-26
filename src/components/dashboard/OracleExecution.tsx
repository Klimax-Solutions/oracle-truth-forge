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
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

interface CycleWithProgress extends Cycle {
  userCycle: UserCycle | null;
  currentTrades: Trade[];
  currentRR: number;
  progress: number;
}

export const OracleExecution = ({ trades }: OracleExecutionProps) => {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [userCycles, setUserCycles] = useState<UserCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCycle, setExpandedCycle] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Fetch cycles and user cycles
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

      setLoading(false);
    };

    fetchData();
  }, []);

  // Combine cycles with user progress
  const cyclesWithProgress: CycleWithProgress[] = useMemo(() => {
    return cycles.map(cycle => {
      const userCycle = userCycles.find(uc => uc.cycle_id === cycle.id) || null;
      const currentTrades = trades.filter(
        t => t.trade_number >= cycle.trade_start && t.trade_number <= cycle.trade_end
      );
      const currentRR = currentTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
      const progress = Math.min((currentTrades.length / cycle.total_trades) * 100, 100);

      return {
        ...cycle,
        userCycle,
        currentTrades,
        currentRR,
        progress,
      };
    });
  }, [cycles, userCycles, trades]);

  // Separate ébauche from main cycles
  const ebauche = cyclesWithProgress.find(c => c.cycle_number === 0);
  const phase1Cycles = cyclesWithProgress.filter(c => c.phase === 1);
  const phase2Cycles = cyclesWithProgress.filter(c => c.phase === 2);

  // Calculate totals
  const totalTrades = trades.length;
  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const completedCycles = cyclesWithProgress.filter(
    c => c.userCycle?.status === 'validated'
  ).length;
  const averageRR = totalTrades > 0 ? totalRR / totalTrades : 0;

  // Get current active cycle
  const currentCycle = cyclesWithProgress.find(
    c => c.userCycle?.status === 'in_progress' || c.userCycle?.status === 'rejected'
  );

  // Request verification
  const handleRequestVerification = async (cycleData: CycleWithProgress) => {
    if (!cycleData.userCycle) return;
    
    const isComplete = cycleData.currentTrades.length >= cycleData.total_trades;
    if (!isComplete) {
      toast({
        title: "Cycle incomplet",
        description: `Vous devez compléter les ${cycleData.total_trades} trades avant de demander la vérification.`,
        variant: "destructive",
      });
      return;
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

      // Update user cycle status
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

      // Refresh user cycles
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
        return "bg-card border-border/40 opacity-60";
      case 'in_progress': 
        return "bg-blue-500/10 border-blue-500/40";
      case 'pending_review': 
        return "bg-orange-500/10 border-orange-500/40";
      case 'validated': 
        return "bg-emerald-500/10 border-emerald-500/40";
      case 'rejected': 
        return "bg-red-500/10 border-red-500/40";
      default: 
        return "bg-card border-border/40";
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
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground mb-1">Exécution d'Oracle</h2>
        <p className="text-sm text-muted-foreground font-mono">
          Progression des 8 cycles vers les 314 trades
        </p>
      </div>

      <div className="flex-1 p-6 overflow-auto space-y-8">
        {/* Overview stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-emerald-500/40 p-5 bg-transparent rounded-md">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Progression Totale
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalTrades}</p>
            <p className="text-sm text-muted-foreground">/ 314 trades</p>
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(totalTrades / 314) * 100}%` }}
              />
            </div>
          </div>

          <div className="border border-border/40 p-5 bg-transparent rounded-md">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Cycles Validés
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">{completedCycles}</p>
            <p className="text-sm text-muted-foreground">/ 8 cycles</p>
          </div>

          <div className="border border-border/40 p-5 bg-transparent rounded-md">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                RR Cumulé
              </span>
            </div>
            <p className={cn(
              "text-3xl font-bold",
              totalRR >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {totalRR >= 0 ? "+" : ""}{totalRR.toFixed(1)}
            </p>
            <p className="text-sm text-muted-foreground">
              ≈ {totalRR >= 0 ? "+" : ""}{(totalRR * 1000).toLocaleString("fr-FR")} €
            </p>
          </div>

          <div className="border border-border/40 p-5 bg-transparent rounded-md">
            <div className="flex items-center gap-2 mb-3">
              <Circle className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                RR Moyen
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {averageRR.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">par trade</p>
          </div>
        </div>

        {/* Ébauche Section */}
        {ebauche && (
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    ebauche.userCycle?.status === 'validated' 
                      ? "bg-emerald-500/20" 
                      : "bg-muted"
                  )}>
                    <Play className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Ébauche</h4>
                    <p className="text-xs text-muted-foreground">
                      Première découverte du setup Oracle
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-mono text-foreground">
                      {ebauche.currentTrades.length} / {ebauche.total_trades}
                    </p>
                    <p className={cn(
                      "text-xs font-mono",
                      ebauche.currentRR >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {ebauche.currentRR >= 0 ? "+" : ""}{ebauche.currentRR.toFixed(1)} RR
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(ebauche.userCycle?.status)}
                    <span className="text-xs text-muted-foreground">
                      {getStatusLabel(ebauche.userCycle?.status)}
                    </span>
                  </div>
                  {expandedCycle === 0 ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    ebauche.userCycle?.status === 'validated' ? "bg-emerald-500" : "bg-blue-500"
                  )}
                  style={{ width: `${ebauche.progress}%` }}
                />
              </div>

              {expandedCycle === 0 && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Regardez les 4 vidéos explicatives du setup Oracle puis complétez les 15 premiers trades.
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to videos tab (handled by parent)
                      }}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Voir les vidéos
                    </Button>
                    
                    {ebauche.userCycle?.status === 'in_progress' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestVerification(ebauche);
                        }}
                        disabled={ebauche.currentTrades.length < ebauche.total_trades || submitting}
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
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

        {/* Phase 1 Cycles */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Phase 1 — 100 Trades
            </h3>
            <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-md">
              4 cycles × 25 trades
            </span>
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            {phase1Cycles.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                expanded={expandedCycle === cycle.cycle_number}
                onToggle={() => setExpandedCycle(
                  expandedCycle === cycle.cycle_number ? null : cycle.cycle_number
                )}
                onRequestVerification={() => handleRequestVerification(cycle)}
                submitting={submitting}
                getStatusIcon={getStatusIcon}
                getStatusLabel={getStatusLabel}
                getCycleStyles={getCycleStyles}
              />
            ))}
          </div>
        </div>

        {/* Phase 2 Cycles */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Phase 2 — 199 Trades
            </h3>
            <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-md">
              3 cycles × 50 + 1 cycle × 49 trades
            </span>
          </div>
          
          <div className="grid grid-cols-4 gap-3">
            {phase2Cycles.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                expanded={expandedCycle === cycle.cycle_number}
                onToggle={() => setExpandedCycle(
                  expandedCycle === cycle.cycle_number ? null : cycle.cycle_number
                )}
                onRequestVerification={() => handleRequestVerification(cycle)}
                submitting={submitting}
                getStatusIcon={getStatusIcon}
                getStatusLabel={getStatusLabel}
                getCycleStyles={getCycleStyles}
              />
            ))}
          </div>
        </div>

        {/* Current Cycle Detail */}
        {currentCycle && expandedCycle === currentCycle.cycle_number && (
          <div className="border border-border p-6 bg-card rounded-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                📋 {currentCycle.name} — Trades {currentCycle.trade_start}-{currentCycle.trade_end}
              </h3>
              <span className="text-sm text-muted-foreground">
                {currentCycle.currentTrades.length} / {currentCycle.total_trades} complétés
              </span>
            </div>
            
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-auto">
              {Array.from({ length: currentCycle.total_trades }, (_, i) => {
                const tradeNumber = currentCycle.trade_start + i;
                const trade = currentCycle.currentTrades.find(t => t.trade_number === tradeNumber);
                const isCompleted = !!trade;
                
                return (
                  <div
                    key={tradeNumber}
                    className={cn(
                      "p-2 border rounded text-center text-xs font-mono",
                      isCompleted 
                        ? trade.rr >= 0 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-muted/30 border-border/40 text-muted-foreground"
                    )}
                  >
                    <div className="font-bold">#{tradeNumber}</div>
                    {isCompleted ? (
                      <div>{trade.rr >= 0 ? "+" : ""}{trade.rr?.toFixed(1)} RR</div>
                    ) : (
                      <div>—</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary Table */}
        <div className="border border-border/40 p-6 bg-transparent rounded-md">
          <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
            Récapitulatif des Cycles
          </h3>
          <div className="space-y-2">
            {cyclesWithProgress.map((cycle) => (
              <div 
                key={cycle.id}
                className="flex items-center gap-4 py-2 border-b border-border/40 last:border-0"
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
                  {cycle.cycle_number === 0 ? "É" : cycle.cycle_number}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{cycle.name}</span>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(cycle.userCycle?.status)}
                      <span className="text-xs text-muted-foreground">
                        {cycle.currentTrades.length}/{cycle.total_trades} trades
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
                      style={{ width: `${cycle.progress}%` }}
                    />
                  </div>
                </div>
                <span className={cn(
                  "text-sm font-mono w-20 text-right",
                  cycle.currentRR > 0 ? "text-emerald-400" 
                  : cycle.currentRR < 0 ? "text-red-400"
                  : "text-muted-foreground"
                )}>
                  {cycle.currentRR >= 0 ? "+" : ""}{cycle.currentRR.toFixed(1)} RR
                </span>
              </div>
            ))}
          </div>
        </div>
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
        !isLocked && "cursor-pointer hover:border-foreground/30"
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
          {cycle.currentTrades.length}
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
          cycle.currentRR > 0 ? "text-emerald-400" 
          : cycle.currentRR < 0 ? "text-red-400"
          : "text-muted-foreground"
        )}>
          {isLocked ? "— RR" : `${cycle.currentRR >= 0 ? "+" : ""}${cycle.currentRR.toFixed(1)} RR`}
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
              disabled={cycle.currentTrades.length < cycle.total_trades || submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {cycle.currentTrades.length < cycle.total_trades 
                ? `${cycle.total_trades - cycle.currentTrades.length} trades restants`
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
