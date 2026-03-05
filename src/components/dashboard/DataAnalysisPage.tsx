import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Calendar, BarChart3, ChevronUp, Lock, Info } from "lucide-react";
import { TradingJournal } from "./TradingJournal";
import { RRDistributionChart } from "./RRDistributionChart";
import { AnalogClock } from "./AnalogClock";
import { CumulativeEvolution } from "./CumulativeEvolution";
import { DataRankings } from "./DataRankings";

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
  contributor?: string;
}

interface DataAnalysisPageProps {
  trades: Trade[];
  onNavigateToDatabase?: (filters: any) => void;
  isEarlyAccess?: boolean;
  isExpired?: boolean;
  isPersoOnly?: boolean;
}

type ExpandedView = "journal" | "distribution" | null;

const ExpiredOverlay = () => (
  <div className="absolute inset-0 bg-background/80 backdrop-blur-md z-10 flex items-center justify-center rounded-md">
    <div className="text-center space-y-2">
      <Lock className="w-6 h-6 text-muted-foreground mx-auto" />
      <p className="text-sm font-mono text-muted-foreground">Accès expiré</p>
    </div>
  </div>
);

export const DataAnalysisPage = ({ trades, onNavigateToDatabase, isEarlyAccess = false, isExpired = false, isPersoOnly = false }: DataAnalysisPageProps) => {
  const [isEntering, setIsEntering] = useState(true);
  const [expandedView, setExpandedView] = useState<ExpandedView>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // For EA: strip screenshots, hide contributor info
  const displayTrades = useMemo(() => {
    if (!isEarlyAccess) return trades;
    return trades.map(t => ({
      ...t,
      screenshot_m15_m5: null,
      screenshot_m1: null,
      contributor: undefined,
    }));
  }, [trades, isEarlyAccess]);

  // For EA: limit journal/distribution to first 50 trades
  const limitedTrades = useMemo(() => {
    if (!isEarlyAccess) return displayTrades;
    return displayTrades.slice(0, 50);
  }, [displayTrades, isEarlyAccess]);

  const totalRR = displayTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const winRate = displayTrades.length > 0 ? ((displayTrades.filter(t => (t.rr || 0) > 0).length / displayTrades.length) * 100).toFixed(1) : "0";

  const handleTimingSelect = (key: string, selectedTrades: Trade[]) => {};

  const quickSections = [
    { id: "journal" as const, label: "Journal", icon: Calendar },
    { id: "distribution" as const, label: "Distribution RR", icon: BarChart3 },
  ];

  // Expanded views
  if (expandedView === "journal") {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <button
          onClick={() => setExpandedView(null)}
          className="flex items-center gap-2 p-4 border-b border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
          <span className="font-mono uppercase tracking-wider">Retour à Data Analysis</span>
        </button>
        <div className="flex-1 overflow-hidden">
          <TradingJournal trades={limitedTrades} />
        </div>
      </div>
    );
  }

  if (expandedView === "distribution") {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <button
          onClick={() => setExpandedView(null)}
          className="flex items-center gap-2 p-4 border-b border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
          <span className="font-mono uppercase tracking-wider">Retour à Data Analysis</span>
        </button>
        <div className="flex-1 overflow-hidden">
          <RRDistributionChart trades={displayTrades} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">
              {isEarlyAccess ? "Data Analysis — Indices US" : isPersoOnly ? "Data Analysis — Setup Perso" : "Data Analysis"}
            </h2>
            <p className="text-xs text-muted-foreground font-mono">
              {displayTrades.length} trades • {totalRR >= 0 ? "+" : ""}{totalRR.toFixed(1)} RR • WR {winRate}%
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="p-4 md:p-6 space-y-6 max-w-full">
          {/* Warning banner for EA */}
          {isEarlyAccess && (
            <div className="flex items-start gap-3 p-3 border border-amber-500/30 rounded-md bg-amber-500/5">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Pour bâtir un système qui fonctionne, la data a été récoltée exclusivement sur des trades gagnants.{" "}
                <span className="text-foreground/70">(Sachez qu'une récolte sur les trades perdants est en cours et que la win rate réelle et objective se situe entre 69% et 80%.)</span>
              </p>
            </div>
          )}
          {/* Row 1: Données clés + quick access */}
          <div
            className={cn("space-y-4", isEntering && "opacity-0")}
            style={{ animation: isEntering ? "none" : "data-card-deal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0ms forwards" }}
          >
            <div className="relative">
              {isExpired && <ExpiredOverlay />}
              <DonneesClés trades={displayTrades} />
            </div>

            {/* Data Rankings */}
            <div className="relative">
              {isExpired && <ExpiredOverlay />}
              <DataRankings trades={displayTrades} blurTop={isEarlyAccess} />
            </div>

            {/* Quick access buttons — hidden when expired */}
            {!isExpired && (
              <div className="grid grid-cols-2 gap-3">
                {quickSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setExpandedView(section.id)}
                    className={cn(
                      "data-analysis-card border border-border rounded-md p-3 md:p-4 text-left transition-all group",
                      "hover:border-foreground/30 bg-card"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md border border-border flex items-center justify-center group-hover:border-foreground/30 transition-colors flex-shrink-0">
                        <section.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-foreground">{section.label}</h3>
                        <p className="text-[9px] text-muted-foreground font-mono uppercase">Ouvrir</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Row 2: Analog Clock — hidden when expired */}
          {!isExpired && (
            <div
              className={cn(
                "py-4 md:py-8",
                isEntering && "opacity-0"
              )}
              style={{ animation: isEntering ? "none" : "data-card-deal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 160ms forwards" }}
            >
              <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-6 text-center tracking-widest">
                Horloge des Timings
              </p>
              <AnalogClock trades={displayTrades} onSelectTiming={handleTimingSelect} />
            </div>
          )}

          {/* Row 3: Cumulative Evolution — always visible */}
          <div
            className={cn(
              "border border-border p-4 md:p-5 bg-card rounded-md chart-glow-container",
              isEntering && "opacity-0"
            )}
            style={{ animation: isEntering ? "none" : "data-card-deal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 320ms forwards" }}
          >
            <CumulativeEvolution trades={displayTrades} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Données Clés component ───
const DonneesClés = ({ trades }: { trades: { rr: number; direction?: string; trade_number: number }[] }) => {
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

    const variance = allRR.length > 0
      ? allRR.reduce((sum, rr) => sum + Math.pow(rr - avgRR, 2), 0) / allRR.length
      : 0;
    const stdDev = Math.sqrt(variance);

    return { totalRR, avgRR, maxRR, minRR, winRate, longCount: longTrades.length, shortCount: shortTrades.length, longRR, shortRR, stdDev };
  }, [trades]);

  return (
    <div className="border border-border rounded-md p-4 md:p-5 bg-card chart-glow-container">
      <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-3">
        Données Clés
      </p>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
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
        <div className="text-center p-2 border border-border rounded-md">
          <p className="text-[8px] text-muted-foreground font-mono uppercase">Écart-type</p>
          <p className="text-lg font-bold text-foreground">{stats.stdDev.toFixed(2)}</p>
        </div>
      </div>

      {/* Direction split */}
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
