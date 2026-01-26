import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, Circle, Target, TrendingUp } from "lucide-react";

interface Trade {
  id: string;
  trade_number: number;
  rr: number;
}

interface OracleExecutionProps {
  trades: Trade[];
}

interface Cycle {
  id: number;
  name: string;
  target: number;
  startTrade: number;
  endTrade: number;
}

const CYCLES: Cycle[] = [
  { id: 1, name: "Cycle 1", target: 25, startTrade: 1, endTrade: 25 },
  { id: 2, name: "Cycle 2", target: 25, startTrade: 26, endTrade: 50 },
  { id: 3, name: "Cycle 3", target: 25, startTrade: 51, endTrade: 75 },
  { id: 4, name: "Cycle 4", target: 25, startTrade: 76, endTrade: 100 },
  { id: 5, name: "Cycle 5", target: 50, startTrade: 101, endTrade: 150 },
  { id: 6, name: "Cycle 6", target: 50, startTrade: 151, endTrade: 200 },
  { id: 7, name: "Cycle 7", target: 50, startTrade: 201, endTrade: 250 },
  { id: 8, name: "Cycle 8", target: 64, startTrade: 251, endTrade: 314 },
];

export const OracleExecution = ({ trades }: OracleExecutionProps) => {
  const cycleStats = useMemo(() => {
    return CYCLES.map(cycle => {
      const cycleTrades = trades.filter(
        t => t.trade_number >= cycle.startTrade && t.trade_number <= cycle.endTrade
      );
      const completedTrades = cycleTrades.length;
      const totalRR = cycleTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
      const progress = Math.min((completedTrades / cycle.target) * 100, 100);
      const isComplete = completedTrades >= cycle.target;
      
      return {
        ...cycle,
        completedTrades,
        totalRR,
        progress,
        isComplete,
      };
    });
  }, [trades]);

  const totalProgress = trades.length;
  const totalTarget = 314;
  const overallProgress = (totalProgress / totalTarget) * 100;
  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const completedCycles = cycleStats.filter(c => c.isComplete).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground mb-1">Exécution d'Oracle</h2>
        <p className="text-sm text-muted-foreground font-mono">Progression des 8 cycles vers les 314 trades</p>
      </div>

      <div className="flex-1 p-6 overflow-auto space-y-8">
        {/* Overview stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-emerald-500/30 p-5 bg-emerald-500/10 rounded-md">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Progression Totale
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalProgress}</p>
            <p className="text-sm text-muted-foreground">/ 314 trades</p>
            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <div className="border border-border p-5 bg-card rounded-md">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                Cycles Complétés
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">{completedCycles}</p>
            <p className="text-sm text-muted-foreground">/ 8 cycles</p>
          </div>

          <div className="border border-border p-5 bg-card rounded-md">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                RR Cumulé
              </span>
            </div>
            <p className="text-3xl font-bold text-emerald-400">+{totalRR.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">≈ +{(totalRR * 1000).toLocaleString("fr-FR")} €</p>
          </div>

          <div className="border border-border p-5 bg-card rounded-md">
            <div className="flex items-center gap-2 mb-3">
              <Circle className="w-4 h-4 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                RR Moyen
              </span>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {trades.length > 0 ? (totalRR / trades.length).toFixed(2) : "0"}
            </p>
            <p className="text-sm text-muted-foreground">par trade</p>
          </div>
        </div>

        {/* Cycles Phase 1 (4x25) */}
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
            {cycleStats.slice(0, 4).map((cycle) => (
              <div 
                key={cycle.id}
                className={cn(
                  "p-4 border rounded-md transition-all",
                  cycle.isComplete 
                    ? "bg-emerald-500/20 border-emerald-500/30" 
                    : cycle.completedTrades > 0
                    ? "bg-accent border-border"
                    : "bg-card border-border"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-mono uppercase text-muted-foreground">{cycle.name}</span>
                  {cycle.isComplete && (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold text-foreground">{cycle.completedTrades}</span>
                  <span className="text-sm text-muted-foreground">/ {cycle.target}</span>
                </div>
                
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      cycle.isComplete ? "bg-emerald-500" : "bg-foreground"
                    )}
                    style={{ width: `${cycle.progress}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Trades {cycle.startTrade}-{cycle.endTrade}
                  </span>
                  <span className={cn(
                    "font-mono",
                    cycle.totalRR > 0 ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    +{cycle.totalRR.toFixed(1)} RR
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cycles Phase 2 (4x50/64) */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Phase 2 — 214 Trades
            </h3>
            <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-md">
              3 cycles × 50 + 1 cycle × 64 trades
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {cycleStats.slice(4, 8).map((cycle) => (
              <div 
                key={cycle.id}
                className={cn(
                  "p-4 border rounded-md transition-all",
                  cycle.isComplete 
                    ? "bg-emerald-500/20 border-emerald-500/30" 
                    : cycle.completedTrades > 0
                    ? "bg-accent border-border"
                    : "bg-card border-border"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-mono uppercase text-muted-foreground">{cycle.name}</span>
                  {cycle.isComplete && (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold text-foreground">{cycle.completedTrades}</span>
                  <span className="text-sm text-muted-foreground">/ {cycle.target}</span>
                </div>
                
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      cycle.isComplete ? "bg-emerald-500" : "bg-foreground"
                    )}
                    style={{ width: `${cycle.progress}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Trades {cycle.startTrade}-{cycle.endTrade}
                  </span>
                  <span className={cn(
                    "font-mono",
                    cycle.totalRR > 0 ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    +{cycle.totalRR.toFixed(1)} RR
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="border border-border p-6 bg-card rounded-md">
          <h3 className="text-sm font-mono uppercase tracking-wider text-muted-foreground mb-4">
            Récapitulatif des Cycles
          </h3>
          <div className="space-y-2">
            {cycleStats.map((cycle) => (
              <div 
                key={cycle.id}
                className="flex items-center gap-4 py-2 border-b border-border last:border-0"
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  cycle.isComplete 
                    ? "bg-emerald-500/20 text-emerald-400" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {cycle.id}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{cycle.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {cycle.completedTrades}/{cycle.target} trades
                    </span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                    <div 
                      className={cn(
                        "h-full rounded-full",
                        cycle.isComplete ? "bg-emerald-500" : "bg-foreground/50"
                      )}
                      style={{ width: `${cycle.progress}%` }}
                    />
                  </div>
                </div>
                <span className={cn(
                  "text-sm font-mono w-20 text-right",
                  cycle.totalRR > 0 ? "text-emerald-400" : "text-muted-foreground"
                )}>
                  +{cycle.totalRR.toFixed(1)} RR
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
