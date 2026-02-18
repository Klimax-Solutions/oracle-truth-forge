import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database, User, ArrowRight, TrendingUp, BarChart3, Clock, Target, AlertTriangle, CheckSquare, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OraclePage } from "./OraclePage";
import { SetupPerso } from "./SetupPerso";
import { usePersonalTrades } from "@/hooks/usePersonalTrades";
import { useDataGenerale } from "@/hooks/useDataGenerale";
import { useSidebarRoles } from "./DashboardSidebar";

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
  analyzedTradeNumbers?: number[];
  onAnalysisToggle?: (tradeNumber: number, checked: boolean) => void;
  ebaucheComplete?: boolean;
}

type ActiveView = "overview" | "oracle" | "perso";

export const SetupPage = ({ trades, initialFilters, analyzedTradeNumbers, onAnalysisToggle, ebaucheComplete }: SetupPageProps) => {
  // If initialFilters are provided, go directly to Oracle view
  const [activeView, setActiveView] = useState<ActiveView>(
    initialFilters && Object.values(initialFilters).some((arr: any) => arr?.length > 0) 
      ? "oracle" 
      : "overview"
  );
  const { trades: personalTrades } = usePersonalTrades();
  const { isAdmin, isSuperAdmin } = useSidebarRoles();
  const showDataGenerale = isAdmin || isSuperAdmin;
  const { dataGenerale, stats: dgStats, loading: dgLoading } = useDataGenerale(trades, showDataGenerale);

  // Update view when initialFilters change (e.g., from Timing Analysis navigation)
  useEffect(() => {
    if (initialFilters && Object.values(initialFilters).some((arr: any) => arr?.length > 0)) {
      setActiveView("oracle");
    }
  }, [initialFilters]);

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

  // Calculate personal harvest stats (from user_executions, not personal trades)
  const [executionStats, setExecutionStats] = useState({ totalTrades: 0, totalRR: 0, winRate: 0, avgRR: 0 });

  useEffect(() => {
    const fetchExecutionStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_executions")
        .select("rr, result")
        .eq("user_id", user.id);
      if (data) {
        const total = data.length;
        const totalRR = data.reduce((sum: number, t: any) => sum + (t.rr || 0), 0);
        const wins = data.filter((t: any) => t.result === "Win").length;
        setExecutionStats({
          totalTrades: total,
          totalRR,
          winRate: total > 0 ? (wins / total) * 100 : 0,
          avgRR: total > 0 ? totalRR / total : 0,
        });
      }
    };
    fetchExecutionStats();
  }, []);

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

        {/* Warning banner for first 15 trades */}
        {!ebaucheComplete && (
          <div className="mx-4 md:mx-6 mt-4 p-4 border border-amber-500/40 bg-amber-500/10 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">⚠️ Récolte obligatoire des 15 premières datas</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                   Les 15 premières datas doivent être <strong className="text-foreground">récoltées manuellement</strong> à l'aide de l'outil de saisie. 
                   Appuyez-vous <strong className="text-foreground">uniquement sur la date du trade</strong>, sans regarder le modèle d'entrée exact.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                   Une fois la data saisie, <strong className="text-foreground">cochez la case correspondante</strong> pour confirmer que le trade a été récolté, analysé et compris.
                   Votre progression avancera uniquement lorsque la data est saisie et la case cochée.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs font-mono text-muted-foreground">
                    {analyzedTradeNumbers?.filter(n => n >= 1 && n <= 15).length || 0}/15 datas récoltées, analysées et comprises
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <OraclePage trades={trades} initialFilters={initialFilters} analyzedTradeNumbers={analyzedTradeNumbers} onAnalysisToggle={onAnalysisToggle} />
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
        <div className="flex-1 overflow-auto">
          <SetupPerso />
        </div>
      </div>
    );
  }

  // Overview with clickable cards
  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">Setup</h1>
          <p className="text-sm text-muted-foreground">Gérez vos données Oracle et vos trades personnels</p>
        </div>

        <div className="grid gap-4 md:gap-6">
          {/* Oracle Card */}
          <div 
            onClick={() => setActiveView("oracle")}
            className={cn(
              "group cursor-pointer",
              "border border-border rounded-lg bg-card p-4 md:p-6",
              "hover:border-primary/50 hover:bg-card/80 transition-all duration-200"
            )}
          >
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg bg-primary/10">
                  <Database className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-semibold text-foreground">Oracle</h2>
                  <p className="text-xs md:text-sm text-muted-foreground">Base de données de référence</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>

            {/* Oracle Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-3 md:mt-4">
              <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="text-[10px] md:text-xs font-mono uppercase">Trades</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-foreground">{oracleStats.totalTrades}</p>
              </div>
              <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="text-[10px] md:text-xs font-mono uppercase">RR Total</span>
                </div>
                <p className={cn(
                  "text-lg md:text-xl font-bold",
                  oracleStats.totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {oracleStats.totalRR >= 0 ? "+" : ""}{oracleStats.totalRR.toFixed(1)}
                </p>
              </div>
              <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Target className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="text-[10px] md:text-xs font-mono uppercase">Win Rate</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-foreground">{oracleStats.winRate.toFixed(0)}%</p>
              </div>
              <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="text-[10px] md:text-xs font-mono uppercase">RR Moyen</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-foreground">{oracleStats.avgRR.toFixed(2)}</p>
              </div>
            </div>

            {/* Progress bar for Oracle */}
            <div className="mt-4">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min((oracleStats.totalTrades / 300) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {oracleStats.totalTrades >= 300 
                  ? "🎉 Base de données Oracle complète !"
                  : `${oracleStats.totalTrades} trades référencés`}
              </p>
            </div>

            {/* Separator + Personal harvest stats */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">Récolte personnelle</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span className="text-[10px] md:text-xs font-mono uppercase">Trades</span>
                  </div>
                  <p className="text-lg md:text-xl font-bold text-foreground">{executionStats.totalTrades}</p>
                </div>
                <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span className="text-[10px] md:text-xs font-mono uppercase">RR Total</span>
                  </div>
                  <p className={cn(
                    "text-lg md:text-xl font-bold",
                    executionStats.totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {executionStats.totalRR >= 0 ? "+" : ""}{executionStats.totalRR.toFixed(1)}
                  </p>
                </div>
                <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Target className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span className="text-[10px] md:text-xs font-mono uppercase">Win Rate</span>
                  </div>
                  <p className="text-lg md:text-xl font-bold text-foreground">{executionStats.winRate.toFixed(0)}%</p>
                </div>
                <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span className="text-[10px] md:text-xs font-mono uppercase">RR Moyen</span>
                  </div>
                  <p className="text-lg md:text-xl font-bold text-foreground">{executionStats.avgRR.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Data Générale Card — Admin/Super Admin only */}
          {showDataGenerale && (
            <div className="border border-primary/30 rounded-lg bg-primary/5 p-4 md:p-6">
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-2 md:p-3 rounded-lg bg-primary/10">
                    <Globe className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-semibold text-foreground">Data Générale — Setup Indices US</h2>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Oracle 314 trades + trades complémentaires récoltés par les membres
                    </p>
                  </div>
                </div>
              </div>

              {dgLoading ? (
                <p className="text-xs text-muted-foreground">Chargement...</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-3 md:mt-4">
                    <div className="text-center p-2 md:p-3 bg-card rounded-md border border-primary/20">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        <span className="text-[10px] md:text-xs font-mono uppercase">Total Data</span>
                      </div>
                      <p className="text-lg md:text-xl font-bold text-foreground">{dgStats.total}</p>
                    </div>
                    <div className="text-center p-2 md:p-3 bg-card rounded-md border border-primary/20">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        <span className="text-[10px] md:text-xs font-mono uppercase">RR Total</span>
                      </div>
                      <p className={cn("text-lg md:text-xl font-bold", dgStats.totalRR >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {dgStats.totalRR >= 0 ? "+" : ""}{dgStats.totalRR.toFixed(1)}
                      </p>
                    </div>
                    <div className="text-center p-2 md:p-3 bg-card rounded-md border border-primary/20">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Target className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        <span className="text-[10px] md:text-xs font-mono uppercase">Win Rate</span>
                      </div>
                      <p className="text-lg md:text-xl font-bold text-foreground">{dgStats.winRate.toFixed(0)}%</p>
                    </div>
                    <div className="text-center p-2 md:p-3 bg-card rounded-md border border-primary/20">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        <span className="text-[10px] md:text-xs font-mono uppercase">RR Moyen</span>
                      </div>
                      <p className="text-lg md:text-xl font-bold text-foreground">{dgStats.avgRR.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="px-2 py-0.5 bg-primary/10 rounded text-primary">{dgStats.oracleCount} Oracle</span>
                    <span>+</span>
                    <span className="px-2 py-0.5 bg-emerald-500/10 rounded text-emerald-500">{dgStats.complementCount} complémentaires</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Setup Perso Card */}
          <div 
            onClick={() => setActiveView("perso")}
            className={cn(
              "group cursor-pointer",
              "border border-border rounded-lg bg-card p-4 md:p-6",
              "hover:border-primary/50 hover:bg-card/80 transition-all duration-200"
            )}
          >
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-3 rounded-lg bg-emerald-500/10">
                  <User className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-semibold text-foreground">Setup Perso</h2>
                  <p className="text-xs md:text-sm text-muted-foreground">Vos trades personnels</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </div>

            {/* Perso Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-3 md:mt-4">
              <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="text-[10px] md:text-xs font-mono uppercase">Trades</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-foreground">{persoStats.totalTrades}</p>
              </div>
              <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="text-[10px] md:text-xs font-mono uppercase">RR Total</span>
                </div>
                <p className={cn(
                  "text-lg md:text-xl font-bold",
                  persoStats.totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {persoStats.totalRR >= 0 ? "+" : ""}{persoStats.totalRR.toFixed(1)}
                </p>
              </div>
              <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Target className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="text-[10px] md:text-xs font-mono uppercase">Win Rate</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-foreground">{persoStats.winRate.toFixed(0)}%</p>
              </div>
              <div className="text-center p-2 md:p-3 bg-muted/50 rounded-md">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span className="text-[10px] md:text-xs font-mono uppercase">Objectif</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-foreground">{persoStats.totalTrades}/300</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 md:mt-4">
              <div className="h-1.5 md:h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${persoStats.progress}%` }}
                />
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-2 text-center">
                {persoStats.progress < 100 
                  ? `${300 - persoStats.totalTrades} trades restants`
                  : "🎉 Objectif atteint !"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
