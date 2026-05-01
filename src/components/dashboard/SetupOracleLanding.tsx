import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database, BarChart3, ArrowRight, TrendingUp, Target, ArrowLeft, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OracleDatabase } from "./OracleDatabase";
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

interface SetupOracleLandingProps {
  trades: Trade[];
  initialFilters?: any;
  analyzedTradeNumbers?: number[];
  onAnalysisToggle?: (tradeNumber: number, checked: boolean) => void;
  ebaucheComplete?: boolean;
  onBack?: () => void;
  onNavigateToAnalysis?: () => void;
}

type LandingView = "landing" | "explore";

function StatBadge({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-0.5 px-4 py-3 rounded-xl border transition-colors",
      highlight
        ? "bg-primary/10 border-primary/30"
        : "bg-muted/40 border-border/50",
    )}>
      <span className={cn(
        "text-lg font-bold font-mono leading-none",
        highlight ? "text-primary" : "text-foreground",
      )}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

export function SetupOracleLanding({
  trades,
  initialFilters,
  analyzedTradeNumbers,
  onAnalysisToggle,
  ebaucheComplete,
  onBack,
  onNavigateToAnalysis,
}: SetupOracleLandingProps) {
  const [view, setView] = useState<LandingView>("landing");
  const [executionCount, setExecutionCount] = useState(0);
  // §0.3b — gating Oracle DB par user_cycles.status (status-driven, jamais count-driven)
  const [unlockedCycleNumbers, setUnlockedCycleNumbers] = useState<number[]>([]);
  const { isAdmin, isSuperAdmin } = useSidebarRoles();

  // Fetch user's personal harvest count
  useEffect(() => {
    const fetchCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("user_executions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setExecutionCount(count ?? 0);
    };
    fetchCount();
  }, []);

  // §0.3b — fetch user_cycles débloqués (status != 'locked') pour gater Oracle DB
  useEffect(() => {
    const fetchUnlockedCycles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_cycles")
        .select("status, cycles(cycle_number)")
        .eq("user_id", user.id)
        .neq("status", "locked");
      if (data) {
        const nums = (data as any[])
          .map(row => row.cycles?.cycle_number)
          .filter((n): n is number => typeof n === "number");
        setUnlockedCycleNumbers(nums);
      }
    };
    fetchUnlockedCycles();

    // Realtime sub : si admin débloque un cycle, refléter immédiatement
    const channel = supabase
      .channel("setup_oracle_landing_user_cycles")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_cycles" }, () => {
        fetchUnlockedCycles();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ─── Computed stats ───────────────────────────────────────────────────
  const totalTrades = trades.length;
  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const wins = trades.filter(t => (t.rr || 0) > 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgRR = totalTrades > 0 ? totalRR / totalTrades : 0;

  // ─── Explore sub-view ─────────────────────────────────────────────────
  if (view === "explore") {
    return (
      <div className="h-full flex flex-col">
        {/* Sub-view header */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-background/80 backdrop-blur-sm">
          <button
            onClick={() => setView("landing")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Setup Oracle
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-foreground font-medium flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-primary" />
            Explorer les trades
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <OracleDatabase
            trades={trades}
            isDataGenerale={false}
            isAdmin={isAdmin || isSuperAdmin}
            unlockedCycleNumbers={(isAdmin || isSuperAdmin) ? undefined : unlockedCycleNumbers}
            onTradeUpdated={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  // ─── Landing view ─────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-8">

        {/* Back link */}
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Récolte de données
          </button>
        )}

        {/* Hero */}
        <div className="text-center space-y-3">
          {/* Icon glow */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-2xl bg-primary/30 scale-150" />
              <div className="relative w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Database className="w-8 h-8 text-primary" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Setup Oracle
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Base de données de référence — {totalTrades} trades pris exclusivement sur des configurations gagnantes.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBadge label="Trades" value={totalTrades.toString()} highlight />
          <StatBadge label="Win Rate" value={`${winRate.toFixed(0)}%`} />
          <StatBadge label="RR Total" value={`+${totalRR.toFixed(1)}`} />
          <StatBadge label="RR Moyen" value={`+${avgRR.toFixed(2)}`} />
        </div>

        {/* Personal harvest counter */}
        {executionCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
            <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Votre récolte personnelle :{" "}
              <span className="font-semibold text-emerald-400 font-mono">{executionCount}</span> trade{executionCount > 1 ? "s" : ""} récoltés
            </p>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          {/* Primary CTA — explore trades */}
          <button
            onClick={() => setView("explore")}
            className={cn(
              "group w-full flex items-center justify-between px-5 py-4 rounded-xl transition-all duration-200",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Database className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm leading-tight">Explorer les {totalTrades} trades</div>
                <div className="text-xs opacity-75 mt-0.5">Base de données Oracle complète</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Secondary CTA — data analysis */}
          <button
            onClick={onNavigateToAnalysis}
            className={cn(
              "group w-full flex items-center justify-between px-5 py-4 rounded-xl transition-all duration-200",
              "bg-card border border-border hover:border-primary/40",
              "hover:bg-primary/5 hover:shadow-md",
              "focus:outline-none focus:ring-2 focus:ring-primary/30",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-sm text-foreground leading-tight">Analyser avec Data Analysis</div>
                <div className="text-xs text-muted-foreground mt-0.5">Win rate, RR, patterns, filtres avancés</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* Info note */}
        <p className="text-center text-[11px] text-muted-foreground/60 leading-relaxed">
          Pour analyser le Setup Oracle avec les 83 trades complémentaires (Setup Indices US),{" "}
          utilisez <span className="text-muted-foreground">Data Analysis → Oracle Étendu</span>.
        </p>

      </div>
    </div>
  );
}
