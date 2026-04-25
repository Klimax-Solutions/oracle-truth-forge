import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Calendar, BarChart3, ChevronUp, ChevronDown, Lock, Info, Plus, Database, Globe, FlaskConical, Radio } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { TradingJournal } from "./TradingJournal";
import { RRDistributionChart } from "./RRDistributionChart";
import { AnalogClock } from "./AnalogClock";
import { CumulativeEvolution } from "./CumulativeEvolution";
import { DataRankings } from "./DataRankings";
import { supabase } from "@/integrations/supabase/client";
import SessionAnalysisSelector, { AnalysisSession } from "./SessionAnalysisSelector";
import type { DataSource } from "./DataSourceSelector";

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
  onNavigateToRecolte?: () => void;
  // Unified dataset selector (Oracle Core / Étendu / Sessions)
  dataSource?: DataSource;
  onDataSourceChange?: (v: DataSource) => void;
  showDataGenerale?: boolean;
}

// Trade augmented with optional session_id for filtering (trades from user_personal_trades carry it)
type TradeWithSession = Trade & { session_id?: string | null };

type ExpandedView = "journal" | "distribution" | null;

const ExpiredOverlay = () => (
  <div className="absolute inset-0 bg-background/80 backdrop-blur-md z-10 flex items-center justify-center rounded-md">
    <div className="text-center space-y-2">
      <Lock className="w-6 h-6 text-muted-foreground mx-auto" />
      <p className="text-sm font-mono text-muted-foreground">Accès expiré</p>
    </div>
  </div>
);

export const DataAnalysisPage = ({ trades, onNavigateToDatabase, isEarlyAccess = false, isExpired = false, isPersoOnly = false, onNavigateToRecolte, dataSource, onDataSourceChange, showDataGenerale = false }: DataAnalysisPageProps) => {
  const [isEntering, setIsEntering] = useState(true);
  const [expandedView, setExpandedView] = useState<ExpandedView>(null);

  // ── Sessions state (new selector) ──
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch user sessions (backtesting + live)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSessionsLoaded(true); return; }
      const { data } = await supabase
        .from("trading_sessions" as any)
        .select("id,name,asset,type,updated_at")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      const list: AnalysisSession[] = ((data as any[]) || []).map((s) => ({
        id: s.id, name: s.name, asset: s.asset, type: s.type,
      }));
      setSessions(list);
      // NOTE: we no longer auto-preselect a session here. The default dataset is Setup Oracle Core
      // (driven by dataSource). User explicitly picks a session to switch to personal analysis.
      setSessionsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  // For EA: strip screenshots, hide contributor info + apply session filter
  const displayTrades = useMemo(() => {
    const base = trades as TradeWithSession[];
    // Session filter only when a session is selected AND any trade in the set carries session_id
    // (avoids wiping Oracle-only trades which have no session_id)
    const anyWithSession = base.some((t) => t.session_id);
    const filtered = selectedSessionId && anyWithSession
      ? base.filter((t) => t.session_id === selectedSessionId)
      : base;
    if (!isEarlyAccess) return filtered;
    return filtered.map((t) => ({
      ...t,
      screenshot_m15_m5: null,
      screenshot_m1: null,
      contributor: undefined,
    }));
  }, [trades, isEarlyAccess, selectedSessionId]);

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

  // Empty state for perso-only with no sessions yet (new flow: require at least one session)
  if (isPersoOnly && sessionsLoaded && sessions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Aucune session à analyser</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Créez votre première session (backtesting ou live trading) dans Récolte de données pour commencer à analyser vos trades.
        </p>
        {onNavigateToRecolte && (
          <button
            onClick={onNavigateToRecolte}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-foreground text-background hover:opacity-90 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Aller à Récolte de données
          </button>
        )}
      </div>
    );
  }

  // Empty state for perso-only with no trades (legacy fallback when sessions exist but are empty)
  if (isPersoOnly && displayTrades.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Aucune donnée personnelle</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {selectedSession
            ? `La session « ${selectedSession.name} » ne contient encore aucun trade.`
            : "Commencez par enregistrer vos trades dans Récolte de données pour voir vos analyses ici."}
        </p>
      </div>
    );
  }

  // Couleurs dataset (source de vérité)
  const TEAL  = "#1AAFA0"; // Oracle Core — cohérent avec RecolteDonneesPage
  const AMBER = "#C8882A"; // Oracle Max  — tier premium

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header minimaliste — une seule ligne ── */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm px-4 md:px-6 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Dataset actif — badge coloré */}
          <span className="text-[11px] font-semibold" style={{
            color: selectedSessionId
              ? (sessions.find(s => s.id === selectedSessionId)?.type === "backtesting" ? "#3B82F6" : "#F97316")
              : dataSource === "data-generale" ? AMBER : TEAL,
          }}>
            {selectedSessionId
              ? (sessions.find(s => s.id === selectedSessionId)?.name ?? "Session")
              : dataSource === "data-generale" ? "Oracle Max" : "Oracle Core"}
          </span>
          <span className="text-border/60 text-[11px]">·</span>
          {/* Stats */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
            <span>{displayTrades.length} trades</span>
            <span className="opacity-40">·</span>
            <span className={totalRR >= 0 ? "text-emerald-400/75" : "text-red-400/75"}>
              {totalRR >= 0 ? "+" : ""}{totalRR.toFixed(1)} RR
            </span>
            <span className="opacity-40">·</span>
            <span>WR {winRate}%</span>
          </div>
          {/* EA note inline */}
          {isEarlyAccess && (
            <span className="ml-auto text-[10px] text-amber-400/60 flex items-center gap-1 flex-shrink-0">
              <Info className="w-3 h-3" />
              WR réelle 69–80%
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="p-4 md:p-6 space-y-6 max-w-full">

          {/* ── Sélecteur hero — central et élégant ── */}
          <div
            className={cn(
              "relative rounded-xl border border-border/60 bg-gradient-to-br from-card via-card/80 to-card/60 px-6 py-6 md:px-10 md:py-8",
              "flex flex-col items-center justify-center gap-5 text-center shadow-lg",
              isEntering && "opacity-0",
            )}
            style={{
              animation: isEntering ? "none" : "data-card-deal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0ms forwards",
              backgroundImage:
                `radial-gradient(circle at 20% 0%, ${TEAL}18, transparent 55%), radial-gradient(circle at 80% 100%, rgba(249,115,22,0.06), transparent 55%)`,
            }}
          >
            <div className="space-y-1">
              <p className="text-[10px] md:text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground/80">
                Setup à analyser
              </p>
              <h3 className="text-base md:text-lg font-semibold text-foreground">
                Choisissez le dataset que vous voulez analyser
              </h3>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 w-full">
              {/* Oracle pills */}
              {onDataSourceChange && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
                    Setup Oracle
                  </p>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <OraclePill
                      active={dataSource === "oracle" && !selectedSessionId}
                      icon={Database}
                      label="Core"
                      sublabel="314 trades"
                      color={TEAL}
                      onClick={() => { setSelectedSessionId(null); onDataSourceChange("oracle"); }}
                    />
                    {showDataGenerale && (
                      <OraclePill
                        active={dataSource === "data-generale" && !selectedSessionId}
                        icon={Globe}
                        label="Max"
                        sublabel="+ complémentaires"
                        color={AMBER}
                        onClick={() => { setSelectedSessionId(null); onDataSourceChange("data-generale"); }}
                      />
                    )}
                  </div>
                </div>
              )}

              {onDataSourceChange && (
                <span className="text-[11px] font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.25em] px-1 self-center">
                  OU
                </span>
              )}

              {/* Sessions */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
                  Mes sessions
                </p>
                <SessionAnalysisSelector
                  sessions={sessions}
                  selectedId={selectedSessionId}
                  onChange={(id) => {
                    setSelectedSessionId(id);
                    if (id && onDataSourceChange) onDataSourceChange("perso");
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row 1: Données clés + quick access */}
          <div
            className={cn("space-y-4", isEntering && "opacity-0")}
            style={{ animation: isEntering ? "none" : "data-card-deal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 80ms forwards" }}
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

// ─── OraclePill — styled toggle button pour le sélecteur hero ───
const OraclePill = ({
  active, icon: Icon, label, sublabel, color, onClick,
}: {
  active: boolean; icon: React.ElementType;
  label: string; sublabel: string; color: string; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn("group flex items-stretch gap-0 rounded-lg border-2 transition-all overflow-hidden min-w-[180px]", "hover:shadow-lg")}
    style={{
      borderColor: active ? color : `${color}40`,
      backgroundColor: active ? `${color}10` : "transparent",
      boxShadow: active ? `0 0 0 1px ${color}30, 0 4px 16px ${color}20` : undefined,
    }}
  >
    <div className="flex items-center justify-center px-3 py-2.5 transition-colors" style={{ backgroundColor: active ? color : `${color}20`, color: active ? "#fff" : color }}>
      <Icon className="w-4 h-4" strokeWidth={2.5} />
    </div>
    <div className="flex-1 flex flex-col items-start justify-center px-3 py-1.5 text-left">
      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] leading-none" style={{ color }}>{label}</span>
      <span className={cn("text-xs font-semibold mt-0.5 leading-tight", active ? "text-foreground" : "text-muted-foreground")}>{sublabel}</span>
    </div>
  </button>
);
