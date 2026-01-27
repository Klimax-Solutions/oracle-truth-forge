import { useState } from "react";
import { Database, User, ArrowRight, TrendingUp, BarChart3, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OraclePage } from "./OraclePage";
import { SetupPerso } from "./SetupPerso";
import { usePersonalTrades } from "@/hooks/usePersonalTrades";

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure: string;
  entry_time: string;
  exit_time: string;
  trade_duration: string;
  rr: number;
  stop_loss_size: string;
  setup_type: string;
  entry_timing: string;
  entry_model: string;
  target_timing: string;
  speculation_hl_valid: boolean;
  target_hl_valid: boolean;
  news_day: boolean;
  news_label: string;
  screenshot_m15_m5: string | null;
  screenshot_m1: string | null;
}

interface SetupPageProps {
  trades: Trade[];
  initialFilters?: any;
}

type ActiveView = "overview" | "oracle" | "perso";

export const SetupPage = ({ trades, initialFilters }: SetupPageProps) => {
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const { trades: personalTrades } = usePersonalTrades();

  // Calculate Oracle stats
  const oracleStats = {
    totalTrades: trades.length,
    totalRR: trades.reduce((sum, t) => sum + (t.rr || 0), 0),
    winRate: trades.length > 0 
      ? (trades.filter(t => (t.rr || 0) > 0).length / trades.length * 100) 
      : 0,
    avgRR: trades.length > 0 
      ? trades.reduce((sum, t) => sum + (t.rr || 0), 0) / trades.length 
      : 0,
  };

  // Calculate Perso stats
  const persoStats = {
    totalTrades: personalTrades.length,
    totalRR: personalTrades.reduce((sum, t) => sum + (t.rr || 0), 0),
    winRate: personalTrades.length > 0 
      ? (personalTrades.filter(t => (t.rr || 0) > 0).length / personalTrades.length * 100) 
      : 0,
    avgRR: personalTrades.length > 0 
      ? personalTrades.reduce((sum, t) => sum + (t.rr || 0), 0) / personalTrades.length 
      : 0,
    progress: Math.min((personalTrades.length / 300) * 100, 100),
  };

  // Render the selected view
  if (activeView === "oracle") {
    return (
      <div className="h-full flex flex-col">
        {/* Back button header */}
        <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setActiveView("overview")}
            className="gap-2 text-sm"
          >
            ← Retour
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Oracle</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <OraclePage trades={trades} initialFilters={initialFilters} />
        </div>
      </div>
    );
  }

  if (activeView === "perso") {
    return (
      <div className="h-full flex flex-col">
        {/* Back button header */}
        <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setActiveView("overview")}
            className="gap-2 text-sm"
          >
            ← Retour
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">Setup Perso</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <SetupPerso />
        </div>
      </div>
    );
  }

  // Overview with clickable cards
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Setup</h1>
          <p className="text-muted-foreground">Gérez vos données Oracle et vos trades personnels</p>
        </div>

        <div className="grid gap-6">
          {/* Oracle Card */}
          <div 
            onClick={() => setActiveView("oracle")}
            className={cn(
              "group cursor-pointer",
              "border border-border rounded-lg bg-card p-6",
              "hover:border-primary/50 hover:bg-card/80 transition-all duration-200"
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Database className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Oracle</h2>
                  <p className="text-sm text-muted-foreground">Base de données de référence & Saisie des trades</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>

            {/* Oracle Stats */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono uppercase">Trades</span>
                </div>
                <p className="text-xl font-bold text-foreground">{oracleStats.totalTrades}</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono uppercase">RR Total</span>
                </div>
                <p className={cn(
                  "text-xl font-bold",
                  oracleStats.totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {oracleStats.totalRR >= 0 ? "+" : ""}{oracleStats.totalRR.toFixed(1)}
                </p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono uppercase">Win Rate</span>
                </div>
                <p className="text-xl font-bold text-foreground">{oracleStats.winRate.toFixed(0)}%</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono uppercase">RR Moyen</span>
                </div>
                <p className="text-xl font-bold text-foreground">{oracleStats.avgRR.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Setup Perso Card */}
          <div 
            onClick={() => setActiveView("perso")}
            className={cn(
              "group cursor-pointer",
              "border border-border rounded-lg bg-card p-6",
              "hover:border-primary/50 hover:bg-card/80 transition-all duration-200"
            )}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <User className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Setup Perso</h2>
                  <p className="text-sm text-muted-foreground">Vos trades personnels avec variables personnalisées</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </div>

            {/* Perso Stats */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono uppercase">Trades</span>
                </div>
                <p className="text-xl font-bold text-foreground">{persoStats.totalTrades}</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono uppercase">RR Total</span>
                </div>
                <p className={cn(
                  "text-xl font-bold",
                  persoStats.totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {persoStats.totalRR >= 0 ? "+" : ""}{persoStats.totalRR.toFixed(1)}
                </p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono uppercase">Win Rate</span>
                </div>
                <p className="text-xl font-bold text-foreground">{persoStats.winRate.toFixed(0)}%</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono uppercase">Objectif</span>
                </div>
                <p className="text-xl font-bold text-foreground">{persoStats.totalTrades}/300</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${persoStats.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {persoStats.progress < 100 
                  ? `${300 - persoStats.totalTrades} trades restants pour un feedback significatif`
                  : "🎉 Objectif atteint !"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
