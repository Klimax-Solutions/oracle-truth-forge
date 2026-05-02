import React from "react";
import { TrendingUp, TrendingDown, Filter, Clock, Target, Calendar, Image, ChevronDown, X, CheckSquare, Lock, Pencil, EyeOff } from "lucide-react";
import { getOracleAccessLimitByCycles, ORACLE_CYCLE_BOUNDARIES } from "@/lib/oracle-cycle-windows";
import { SignedImageCard } from "./SignedImageCard";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useChartColors } from "@/hooks/useChartColors";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { OracleTradeEditDialog } from "./OracleTradeEditDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  screenshot_m1: string | null;
  screenshot_m15_m5: string | null;
  contributor?: string;
  sl_placement?: string | null;
  tp_placement?: string | null;
  context_timeframe?: string | null;
  entry_timeframe?: string | null;
  comment?: string | null;
}

interface OracleDatabaseProps {
  trades: Trade[];
  initialFilters?: Filters;
  analyzedTradeNumbers?: number[];
  onAnalysisToggle?: (tradeNumber: number, checked: boolean) => void;
  isDataGenerale?: boolean;
  isAdmin?: boolean;
  onTradeUpdated?: () => void;
  /**
   * R1 (STATUS-DRIVEN, §0.3b DANS LE MARBRE) — liste des cycle_number où
   * user_cycles.status != 'locked'. SOURCE UNIQUE de gating Oracle DB.
   *
   * Contrat (§0.3b master CLAUDE.md) :
   *   - isAdmin === true       → Infinity (admin/super_admin voit tout)
   *   - isDataGenerale === true → Infinity (vue agrégée community/curated)
   *   - sinon                   → unlockedCycleNumbers OBLIGATOIRE
   *   - fail-safe (aucun)       → 0 trades (jamais Infinity, jamais count-driven)
   *
   * ⚠️ Ne jamais réintroduire un gating count-driven (par nb d'executions) :
   * la règle est status-driven uniquement.
   */
  unlockedCycleNumbers?: number[];
}

interface Filters {
  direction: string[];
  direction_structure: string[];
  setup_type: string[];
  entry_model: string[];
  entry_timing: string[];
  trade_duration: string[];
  rr_range: string[];
  stop_loss_size: string[];
  day_of_week: string[];
  quarter: string[];
  year: string[];
  contributor: string[];
  cycle: number[];
  hasScreenshots?: boolean;
}

// ─── Cycles ───────────────────────────────────────────────────────────────────
const CYCLES = [
  { num: 0, name: "Ébauche", phase: 0, start: 1,   end: 15  },
  { num: 1, name: "Cycle 1", phase: 1, start: 16,  end: 40  },
  { num: 2, name: "Cycle 2", phase: 1, start: 41,  end: 65  },
  { num: 3, name: "Cycle 3", phase: 1, start: 66,  end: 90  },
  { num: 4, name: "Cycle 4", phase: 1, start: 91,  end: 115 },
  { num: 5, name: "Cycle 5", phase: 2, start: 116, end: 165 },
  { num: 6, name: "Cycle 6", phase: 2, start: 166, end: 215 },
  { num: 7, name: "Cycle 7", phase: 2, start: 216, end: 265 },
  { num: 8, name: "Cycle 8", phase: 2, start: 266, end: 314 },
];
type CycleDef = typeof CYCLES[number];

const getCycleForTrade = (n: number): CycleDef | null =>
  CYCLES.find(c => n >= c.start && n <= c.end) ?? null;

// ─── Couleurs par phase ────────────────────────────────────────────────────────
const cycleColor = (phase: number) => {
  if (phase === 0) return {
    rail:   'from-amber-500/80 via-amber-500/40 to-amber-500/10',
    text:   'text-amber-500',
    border: 'border-amber-500/30',
    bg:     'bg-amber-500/10',
    soft:   'bg-amber-500/5',
    glow:   'shadow-[0_0_20px_-8px_theme(colors.amber.500)]',
  };
  if (phase === 2) return {
    rail:   'from-emerald-500/80 via-emerald-500/40 to-emerald-500/10',
    text:   'text-emerald-500',
    border: 'border-emerald-500/30',
    bg:     'bg-emerald-500/10',
    soft:   'bg-emerald-500/5',
    glow:   'shadow-[0_0_20px_-8px_theme(colors.emerald.500)]',
  };
  return {
    rail:   'from-primary/80 via-primary/40 to-primary/10',
    text:   'text-primary',
    border: 'border-primary/30',
    bg:     'bg-primary/10',
    soft:   'bg-primary/5',
    glow:   'shadow-[0_0_20px_-8px_hsl(var(--primary))]',
  };
};

export const OracleDatabase = ({ trades, initialFilters, analyzedTradeNumbers = [], onAnalysisToggle, isDataGenerale, isAdmin, onTradeUpdated, unlockedCycleNumbers }: OracleDatabaseProps) => {
  const chartColors = useChartColors();
  const { isEarlyAccess } = useEarlyAccess();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters ? { ...initialFilters, contributor: (initialFilters as any).contributor || [], cycle: (initialFilters as any).cycle || [] } : {
    direction: [],
    direction_structure: [],
    setup_type: [],
    entry_model: [],
    entry_timing: [],
    trade_duration: [],
    rr_range: [],
    stop_loss_size: [],
    day_of_week: [],
    quarter: [],
    year: [],
    contributor: [],
    cycle: [],
    hasScreenshots: false,
  });

  // Sync filters when initialFilters change (e.g., from Timing Analysis navigation or screenshots filter)
  useEffect(() => {
    if (initialFilters && (Object.values(initialFilters).some((arr: any) => Array.isArray(arr) && arr.length > 0) || initialFilters.hasScreenshots)) {
      setFilters(prev => ({
        ...prev,
        ...initialFilters,
      }));
    }
  }, [initialFilters]);

  // Extract unique values for filters
  const filterOptions = useMemo(() => ({
    direction: [...new Set(trades.map(t => t.direction).filter(Boolean))],
    direction_structure: [...new Set(trades.map(t => t.direction_structure).filter(Boolean))],
    setup_type: [...new Set(trades.map(t => t.setup_type).filter(Boolean))],
    entry_model: [...new Set(trades.flatMap(t => t.entry_model?.split(", ") || []).filter(Boolean))],
    entry_timing: [...new Set(trades.map(t => t.entry_timing).filter(Boolean))],
    contributor: [...new Set(trades.map(t => t.contributor).filter(Boolean))],
  }), [trades]);

  // R1 — Accès Oracle limité (règle DANS LE MARBRE, §0.3b master CLAUDE.md)
  // Un membre ne voit JAMAIS plus de trades que son cycle débloqué le plus haut.
  // Priorité de résolution (STATUS-DRIVEN UNIQUEMENT) :
  //   1. isAdmin              → Infinity (admin/super_admin voit tout)
  //   2. isDataGenerale       → Infinity (vue agrégée community/curated, table différente sémantiquement)
  //   3. unlockedCycleNumbers → status-driven (source de vérité)
  //   4. fail-safe            → 0 trades (pas de contexte = pas d'accès)
  //
  // ⚠️ NEVER reintroduce count-driven gating (userTotalTrades / nb executions).
  // ⚠️ NEVER fallback to Infinity. Any breach found in the past came from such fallback.
  const accessLimit = useMemo(() => {
    if (isAdmin) return Infinity;
    if (isDataGenerale) return Infinity;
    if (unlockedCycleNumbers !== undefined) return getOracleAccessLimitByCycles(unlockedCycleNumbers);
    return 0;
  }, [isAdmin, isDataGenerale, unlockedCycleNumbers]);

  // Cycles Oracle verrouillés (à afficher en placeholder "locked")
  const lockedCycles = useMemo(() => {
    if (accessLimit === Infinity) return [];
    return ORACLE_CYCLE_BOUNDARIES.filter(b => b.tradeStart > accessLimit);
  }, [accessLimit]);

  // Apply filters
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      // R1 — exclure les trades des cycles non encore débloqués
      if (trade.trade_number > accessLimit) return false;
      if (filters.direction.length > 0 && !filters.direction.includes(trade.direction)) return false;
      if (filters.direction_structure.length > 0 && !filters.direction_structure.includes(trade.direction_structure)) return false;
      if (filters.setup_type.length > 0 && !filters.setup_type.includes(trade.setup_type)) return false;
      if (filters.entry_timing.length > 0 && !filters.entry_timing.includes(trade.entry_timing)) return false;
      if (filters.entry_model.length > 0) {
        const tradeModels = trade.entry_model?.split(", ") || [];
        if (!filters.entry_model.some(m => tradeModels.includes(m))) return false;
      }
      if (filters.day_of_week.length > 0 && !filters.day_of_week.includes(trade.day_of_week)) return false;
      if (filters.quarter.length > 0) {
        const date = new Date(trade.trade_date);
        const quarter = `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
        if (!filters.quarter.includes(quarter)) return false;
      }
      if (filters.year.length > 0) {
        const year = new Date(trade.trade_date).getFullYear().toString();
        if (!filters.year.includes(year)) return false;
      }
      // Filter by screenshots
      if (filters.hasScreenshots && !trade.screenshot_m15_m5 && !trade.screenshot_m1) return false;
      // Filter by contributor
      if (filters.contributor.length > 0 && (!trade.contributor || !filters.contributor.includes(trade.contributor))) return false;
      // Filter by cycle
      if (filters.cycle.length > 0) {
        const c = getCycleForTrade(trade.trade_number);
        if (!c || !filters.cycle.includes(c.num)) return false;
      }
      return true;
    });
  }, [trades, filters]);

  const totalTrades = filteredTrades.length;
  const totalRR = filteredTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const longTrades = filteredTrades.filter((t) => t.direction === "Long").length;
  const shortTrades = filteredTrades.filter((t) => t.direction === "Short").length;

  // Count active filters (excluding boolean hasScreenshots from flat count)
  const activeFiltersCount = Object.entries(filters)
    .filter(([key]) => key !== 'hasScreenshots')
    .flatMap(([, value]) => value as string[])
    .length + (filters.hasScreenshots ? 1 : 0);

  const toggleFilter = (category: Exclude<keyof Filters, 'hasScreenshots' | 'cycle'>, value: string) => {
    setFilters(prev => ({
      ...prev,
      [category]: prev[category].includes(value)
        ? prev[category].filter(v => v !== value)
        : [...prev[category], value]
    }));
  };

  const toggleCycle = (cycleNum: number) => {
    setFilters(prev => ({
      ...prev,
      cycle: prev.cycle.includes(cycleNum)
        ? prev.cycle.filter(v => v !== cycleNum)
        : [...prev.cycle, cycleNum]
    }));
  };

  const clearFilters = () => {
    setFilters({
      direction: [],
      direction_structure: [],
      setup_type: [],
      entry_model: [],
      entry_timing: [],
      trade_duration: [],
      rr_range: [],
      stop_loss_size: [],
      day_of_week: [],
      quarter: [],
      year: [],
      contributor: [],
      cycle: [],
      hasScreenshots: false,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };




  // Get trade context for charts - ISOLATED 10 last trades (like TradingJournal)
  const getTradeContext = (trade: Trade) => {
    const tradeIndex = trades.findIndex(t => t.id === trade.id);
    const tradesUpToNow = trades.slice(0, tradeIndex + 1);
    const cumulativeRR = tradesUpToNow.reduce((sum, t) => sum + (t.rr || 0), 0);
    
    // Get last 10 trades and show ISOLATED cumul (as if trades 1-10)
    const recentTrades = trades.slice(Math.max(0, tradeIndex - 9), tradeIndex + 1);
    let isolatedCumul = 0;
    const chartData = recentTrades.map((t, idx) => {
      isolatedCumul += t.rr || 0;
      return {
        trade: idx + 1, // Trades 1-10 isolated
        tradeNum: t.trade_number,
        rr: parseFloat(isolatedCumul.toFixed(2)),
        individual: t.rr || 0,
        current: t.id === trade.id
      };
    });
    
    const isolatedTotal = recentTrades.reduce((sum, t) => sum + (t.rr || 0), 0);

    return { cumulativeRR, chartData, tradeIndex, isolatedTotal };
  };

  // ─── Groupes par cycle pour le rail ─────────────────────────────────────────
  type CycleGroup = { cycle: CycleDef | null; trades: Trade[]; startIdx: number };
  const groups = useMemo<CycleGroup[]>(() => {
    if (isDataGenerale) return [];
    const result: CycleGroup[] = [];
    filteredTrades.forEach((trade, idx) => {
      const cycle = getCycleForTrade(trade.trade_number);
      const last = result[result.length - 1];
      if (last && last.cycle?.num === cycle?.num) last.trades.push(trade);
      else result.push({ cycle, trades: [trade], startIdx: idx });
    });
    return result;
  }, [filteredTrades, isDataGenerale]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header with stats — sticky so it stays visible while scrolling */}
      <div className="sticky top-0 z-40 p-3 md:p-4 border-b border-border bg-card/95 backdrop-blur-sm">
        {/* Mobile: Stack stats and filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Stats row - scrollable on mobile */}
          <div className="flex items-center gap-3 md:gap-6 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
              <span className="text-sm md:text-base font-bold text-foreground">{totalTrades}</span>
              <span className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase">trades</span>
            </div>
            <div className="w-px h-4 md:h-5 bg-border flex-shrink-0" />
            <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
              <span className="text-sm md:text-base font-bold text-emerald-400">+{totalRR.toFixed(1)}</span>
              <span className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase">RR</span>
            </div>
            <div className="w-px h-4 md:h-5 bg-border flex-shrink-0 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-emerald-400 font-mono">{longTrades} L</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-red-400 font-mono">{shortTrades} S</span>
            </div>
          </div>

          {/* Filters - horizontal scroll on mobile */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-accent rounded-md transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                {activeFiltersCount}
              </button>
            )}

            {!isDataGenerale && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-medium rounded-md transition-all flex items-center gap-1 flex-shrink-0",
                    filters.cycle.length > 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}>
                    Cycle{filters.cycle.length > 0 && ` (${filters.cycle.length})`}
                    <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[160px] p-1 max-h-72 overflow-y-auto scrollbar-hide">
                  {CYCLES.map(c => (
                    <DropdownMenuCheckboxItem
                      key={c.num}
                      checked={filters.cycle.includes(c.num)}
                      onCheckedChange={() => toggleCycle(c.num)}
                      className="text-foreground text-[10px] md:text-xs rounded-md px-2 md:px-3 py-1.5 md:py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                    >
                      <span className="flex items-center justify-between gap-3 w-full">
                        <span>{c.name}</span>
                        <span className="text-muted-foreground font-mono text-[9px] md:text-[10px]">#{String(c.start).padStart(3,'0')}–{String(c.end).padStart(3,'0')}</span>
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-medium rounded-md transition-all flex items-center gap-1 flex-shrink-0",
                  filters.direction.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Dir
                  <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[120px] p-1">
                {filterOptions.direction.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.direction.includes(option)}
                    onCheckedChange={() => toggleFilter("direction", option)}
                    className="text-foreground text-[10px] md:text-xs rounded-md px-2 md:px-3 py-1.5 md:py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-medium rounded-md transition-all flex items-center gap-1 flex-shrink-0",
                  filters.setup_type.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Setup
                  <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[120px] p-1">
                {filterOptions.setup_type.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.setup_type.includes(option)}
                    onCheckedChange={() => toggleFilter("setup_type", option)}
                    className="text-foreground text-[10px] md:text-xs rounded-md px-2 md:px-3 py-1.5 md:py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-medium rounded-md transition-all flex items-center gap-1 flex-shrink-0",
                  filters.entry_model.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Entry
                  <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[120px] p-1 max-h-64 overflow-y-auto scrollbar-hide">
                {filterOptions.entry_model.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.entry_model.includes(option)}
                    onCheckedChange={() => toggleFilter("entry_model", option)}
                    className="text-foreground text-[10px] md:text-xs rounded-md px-2 md:px-3 py-1.5 md:py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-medium rounded-md transition-all flex items-center gap-1 flex-shrink-0",
                  filters.direction_structure.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Struct
                  <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[120px] p-1">
                {filterOptions.direction_structure.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.direction_structure.includes(option)}
                    onCheckedChange={() => toggleFilter("direction_structure", option)}
                    className="text-foreground text-[10px] md:text-xs rounded-md px-2 md:px-3 py-1.5 md:py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-medium rounded-md transition-all flex items-center gap-1 flex-shrink-0",
                  filters.entry_timing.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Time
                  <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[120px] p-1 max-h-64 overflow-y-auto scrollbar-hide">
                {filterOptions.entry_timing.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.entry_timing.includes(option)}
                    onCheckedChange={() => toggleFilter("entry_timing", option)}
                    className="text-foreground text-[10px] md:text-xs rounded-md px-2 md:px-3 py-1.5 md:py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Contributor filter - only show in Data Générale, hidden for EA */}
            {isDataGenerale && !isEarlyAccess && filterOptions.contributor.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-[10px] font-medium rounded-md transition-all flex items-center gap-1 flex-shrink-0",
                    filters.contributor.length > 0
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}>
                    Contrib
                    <ChevronDown className="w-2.5 h-2.5 md:w-3 md:h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[120px] p-1 max-h-64 overflow-y-auto scrollbar-hide">
                  {filterOptions.contributor.map(option => (
                    <DropdownMenuCheckboxItem
                      key={option}
                      checked={filters.contributor.includes(option)}
                      onCheckedChange={() => toggleFilter("contributor", option)}
                      className="text-foreground text-[10px] md:text-xs rounded-md px-2 md:px-3 py-1.5 md:py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                    >
                      {option}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

          </div>
        </div>
      </div>

      {/* Trades list — no overflow-auto so sticky children work vs the parent scroll container */}
      <div className="flex-1 p-4">
      {/* Data Générale : bandeau récap + toggle Oracle / Complémentaires */}
      {isDataGenerale && !isEarlyAccess && (() => {
        const oracleCount = filteredTrades.filter(t => t.contributor === "John").length;
        const compCount = filteredTrades.filter(t => t.contributor !== "John").length;
        const isOracleOn = filters.contributor.length === 0 || filters.contributor.includes("John");
        const isCompOn = filters.contributor.length === 0 || filters.contributor.some(c => c !== "John");
        const compContribs = filterOptions.contributor.filter(c => c !== "John");
        const setOnly = (mode: "all" | "oracle" | "comp") => {
          setFilters(prev => ({
            ...prev,
            contributor:
              mode === "all" ? [] :
              mode === "oracle" ? ["John"] :
              compContribs,
          }));
        };
        const activeMode: "all" | "oracle" | "comp" =
          filters.contributor.length === 0 ? "all"
          : filters.contributor.length === 1 && filters.contributor[0] === "John" ? "oracle"
          : "comp";
        return (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border/60 bg-muted/20">
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Oracle</span>
                <span className="font-mono font-bold text-foreground">{oracleCount}</span>
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Complémentaires</span>
                <span className="font-mono font-bold text-foreground">{compCount}</span>
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono font-bold text-foreground">{oracleCount + compCount}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-md border border-border bg-background">
              <button
                type="button"
                onClick={() => setOnly("all")}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded transition-colors",
                  activeMode === "all" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setOnly("oracle")}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded transition-colors inline-flex items-center gap-1",
                  activeMode === "oracle" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Oracle
              </button>
              <button
                type="button"
                onClick={() => setOnly("comp")}
                disabled={compContribs.length === 0}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed",
                  activeMode === "comp" ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Complémentaires
              </button>
            </div>
          </div>
        );
      })()}
      {filteredTrades.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">Aucun trade correspondant aux filtres</p>
            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
              Réinitialiser les filtres
            </Button>
          </div>
        ) : isDataGenerale ? (
          /* ── Data Générale : liste plate, pas de groupement ── */
          <div className="space-y-2">
            {filteredTrades.map((trade, tradeIdx) => {
              const isBlurred = isEarlyAccess && tradeIdx >= 50;
              return (
              <div
                key={trade.id}
                className={cn(
                  "border transition-all rounded-md overflow-hidden relative",
                  isBlurred && "pointer-events-none",
                  selectedTrade?.id === trade.id
                    ? "border-foreground/20 bg-accent/40"
                    : "border-border hover:bg-accent/30 bg-transparent"
                )}
              >
                {/* Blur overlay for Early Access beyond 50 trades */}
                {isBlurred && (
                  <div className="absolute inset-0 z-10 backdrop-blur-md bg-background/50 flex items-center justify-center pointer-events-auto cursor-not-allowed">
                    <div className="flex flex-col items-center gap-1 px-3 py-2 bg-background/80 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">Accès complet requis</span>
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground">Data bientôt disponible</span>
                    </div>
                  </div>
                )}
                {/* Main row - clickable */}
                <div 
                  onClick={() => !isBlurred && setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                  className="px-3 md:px-5 py-3 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3 md:gap-5">
                    {/* Edit pencil for Data Générale admin mode */}
                    {isDataGenerale && isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingTrade(trade); }}
                        className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors"
                        title="Modifier ce trade"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                    {/* Checkbox for trades 1-15 (non Data Générale) */}
                    {!isDataGenerale && trade.trade_number >= 1 && trade.trade_number <= 15 && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center"
                        title="Trade analysé et compris"
                      >
                        <Checkbox
                          checked={analyzedTradeNumbers.includes(trade.trade_number)}
                          onCheckedChange={(checked) => onAnalysisToggle?.(trade.trade_number, !!checked)}
                          className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                      </div>
                    )}
                    {/* Trade number or contributor label */}
                    {isDataGenerale ? (
                      <span className={cn(
                        "text-[10px] font-mono px-2 py-0.5 rounded-md border",
                        trade.contributor === "John"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      )}>
                      {isEarlyAccess ? (
                        <span className="blur-sm select-none">{trade.contributor || "—"}</span>
                      ) : (
                        trade.contributor || "—"
                      )}
                    </span>
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground/50 w-10">
                        {String(trade.trade_number).padStart(3, "0")}
                      </span>
                    )}

                    <div
                      className={cn(
                        "flex items-center gap-2 w-16",
                        trade.direction === "Long" ? "text-emerald-500" : "text-red-500"
                      )}
                    >
                      {trade.direction === "Long" ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="text-xs font-mono uppercase">{trade.direction}</span>
                    </div>

                    <div className="hidden md:block">
                      <p className="text-sm text-foreground">{formatDate(trade.trade_date)}</p>
                      <p className="text-[10px] text-muted-foreground">{trade.day_of_week}</p>
                    </div>

                    <div className="hidden lg:block">
                      <p className="text-[10px] text-muted-foreground font-mono">{trade.setup_type || "—"}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-500">+{trade.rr?.toFixed(2) || "0"}</p>
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">RR</p>
                  </div>
                </div>

                {/* Expanded details - like TradingJournal with isolated charts */}
                {selectedTrade?.id === trade.id && (
                  <div className="border-t border-border p-3 md:p-4 space-y-3 md:space-y-4 bg-transparent">
                    {(() => {
                      const context = getTradeContext(trade);
                      return (
                        <>
                          {/* Trade header - responsive like UserDataEntry */}
                          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3 md:p-4 border border-border bg-transparent rounded-md">
                            <div className={cn(
                              "w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border rounded-md flex-shrink-0",
                              trade.direction === "Long" 
                                ? "border-emerald-500/50 bg-emerald-500/10" 
                                : "border-red-500/50 bg-red-500/10"
                            )}>
                              {trade.direction === "Long" 
                                ? <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
                                : <TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base md:text-lg font-bold text-foreground">
                                Trade #{trade.trade_number}
                              </p>
                              <p className="text-xs md:text-sm text-muted-foreground truncate">
                                {trade.setup_type || "Setup standard"} • {trade.entry_model || "Model standard"}
                              </p>
                            </div>
                            <div className="text-left md:text-right">
                              <p className={cn(
                                "text-lg md:text-xl font-bold",
                                (trade.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                              )}>
                                {(trade.rr || 0) >= 0 ? "+" : ""}{trade.rr?.toFixed(2)} RR
                              </p>
                              <p className="text-xs md:text-sm text-muted-foreground">
                                ≈ {(trade.rr || 0) >= 0 ? "+" : ""}{((trade.rr || 0) * 1000).toLocaleString("fr-FR")} €
                              </p>
                            </div>
                          </div>

                          {/* Stats + Contexte — un seul bloc, zéro background, dividers simples */}
                          <div className="rounded-xl border border-border/30 overflow-hidden">
                            {/* Row 1 : 4 métriques temporelles */}
                            <div className="grid grid-cols-2 md:grid-cols-4">
                              <div className="flex flex-col gap-2 px-4 py-4 border-r border-b md:border-b-0 border-border/30">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-muted-foreground/40" />
                                  <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Entrée</span>
                                </div>
                                <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{trade.entry_time || "—"}</p>
                              </div>
                              <div className="flex flex-col gap-2 px-4 py-4 border-b md:border-b-0 md:border-r border-border/30">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-muted-foreground/40" />
                                  <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Sortie</span>
                                </div>
                                <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{trade.exit_time || "—"}</p>
                              </div>
                              <div className="flex flex-col gap-2 px-4 py-4 border-r border-border/30">
                                <div className="flex items-center gap-1.5">
                                  <Target className="w-3 h-3 text-muted-foreground/40" />
                                  <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Durée</span>
                                </div>
                                <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{trade.trade_duration || "—"}</p>
                              </div>
                              <div className="flex flex-col gap-2 px-4 py-4">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 text-muted-foreground/40" />
                                  <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">News</span>
                                </div>
                                <p className="text-2xl font-bold text-foreground leading-none">
                                  {trade.news_day ? (trade.news_label || "Oui") : "Non"}
                                </p>
                              </div>
                            </div>
                            {/* Row 2 : contexte setup */}
                            <div className="grid grid-cols-3 border-t border-border/30">
                              <div className="flex flex-col gap-1.5 px-4 py-3 border-r border-border/30">
                                <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Structure</span>
                                <p className="text-sm font-semibold text-foreground">{trade.direction_structure || "—"}</p>
                              </div>
                              <div className="flex flex-col gap-1.5 px-4 py-3 border-r border-border/30">
                                <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Timing entrée</span>
                                <p className="text-sm font-semibold text-foreground">{trade.entry_timing || "—"}</p>
                              </div>
                              <div className="flex flex-col gap-1.5 px-4 py-3">
                                <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Stop-Loss</span>
                                <p className="text-sm font-semibold text-foreground">{trade.stop_loss_size || "—"}</p>
                              </div>
                            </div>
                          </div>

                          {/* RR charts - vertical stack on mobile */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {/* Bar chart - individual RR per trade */}
                            <div className="border border-border/50 p-4 md:p-5 rounded-xl">
                              <div className="flex items-center justify-between mb-3 md:mb-4">
                                <h4 className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
                                  RR par Trade
                                </h4>
                              </div>
                              <div className="h-28 md:h-36">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={context.chartData}>
                                    <XAxis 
                                      dataKey="trade" 
                                      tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                                      axisLine={{ stroke: "var(--chart-axis-line)" }}
                                      tickLine={false}
                                    />
                                    <YAxis 
                                      tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                                      axisLine={{ stroke: "var(--chart-axis-line)" }}
                                      tickLine={false}
                                    />
                                    <Tooltip
                                      contentStyle={{
                                        backgroundColor: "var(--chart-tooltip-bg)",
                                        border: "1px solid var(--chart-tooltip-border)",
                                        borderRadius: 4,
                                        color: "var(--chart-tooltip-text)",
                                      }}
                                      itemStyle={{ color: "var(--chart-tooltip-text)" }}
                                      labelStyle={{ color: "var(--chart-tooltip-text)" }}
                                      formatter={(value: number, name: string, props: any) => [
                                        `${value.toFixed(2)} RR`,
                                        `Trade #${props.payload.tradeNum}`
                                      ]}
                                    />
                                    <Bar 
                                      dataKey="individual" 
                                      radius={[3, 3, 0, 0]}
                                    >
                                      {context.chartData.map((entry, index) => (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={entry.current ? "var(--chart-bar)" : "#22c55e"}
                                        />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>

                            {/* Isolated cumulative RR chart */}
                            <div className="border border-border/50 p-4 md:p-5 rounded-xl">
                              <div className="flex items-center justify-between mb-3 md:mb-4">
                                <h4 className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">
                                  Cumul Isolé
                                </h4>
                                <span className="text-base md:text-lg font-bold tabular-nums text-emerald-500">
                                  +{context.isolatedTotal.toFixed(2)}
                                </span>
                              </div>
                              <div className="h-28 md:h-36">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={context.chartData}>
                                    <defs>
                                      <linearGradient id="colorIsolatedRR" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <XAxis 
                                      dataKey="trade" 
                                      tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                                      axisLine={{ stroke: "var(--chart-axis-line)" }}
                                      tickLine={false}
                                    />
                                    <YAxis 
                                      tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
                                      axisLine={{ stroke: "var(--chart-axis-line)" }}
                                      tickLine={false}
                                    />
                                    <Tooltip
                                      contentStyle={{
                                        backgroundColor: "var(--chart-tooltip-bg)",
                                        border: "1px solid var(--chart-tooltip-border)",
                                        borderRadius: 4,
                                        color: "var(--chart-tooltip-text)",
                                      }}
                                      itemStyle={{ color: "var(--chart-tooltip-text)" }}
                                      labelStyle={{ color: "var(--chart-tooltip-text)" }}
                                      formatter={(value: number, name: string, props: any) => [
                                        `${value.toFixed(2)} RR`,
                                        `Trade #${props.payload.tradeNum}`
                                      ]}
                                    />
                                    <Area 
                                      type="monotone" 
                                      dataKey="rr" 
                                      stroke="#22c55e" 
                                      fillOpacity={1}
                                      fill="url(#colorIsolatedRR)"
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>

                          {/* Cumul Total */}
                          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/50">
                            <div className="flex items-center gap-2.5">
                              <div className={cn("w-0.5 h-5 rounded-full", context.cumulativeRR >= 0 ? "bg-emerald-500/60" : "bg-red-500/60")} />
                              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">Cumul Total</span>
                            </div>
                            <span className={cn("text-xl font-bold tabular-nums", context.cumulativeRR >= 0 ? "text-emerald-500" : "text-red-500")}>
                              {context.cumulativeRR >= 0 ? "+" : ""}{context.cumulativeRR.toFixed(2)} RR
                            </span>
                          </div>

                          {/* Screenshots - vertical stack on mobile */}
                          {(trade.screenshot_m1 || trade.screenshot_m15_m5) ? (
                            isEarlyAccess ? (
                              // EA: show screenshots every other trade (odd index = 0, 2, 4...)
                              tradeIdx % 2 === 0 && tradeIdx < 50 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                  <SignedImageCard
                                    storagePath={trade.screenshot_m15_m5}
                                    alt={`Trade ${trade.trade_number} M15`}
                                    label="M15 / Contexte"
                                    bucket="oracle-screenshots"
                                  />
                                  <SignedImageCard
                                    storagePath={trade.screenshot_m1}
                                    alt={`Trade ${trade.trade_number} M5`}
                                    label="M5 / Entrée"
                                    bucket="oracle-screenshots"
                                  />
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                  <div className="relative border border-border rounded-md overflow-hidden aspect-video bg-muted/50">
                                    <div className="absolute inset-0 backdrop-blur-xl bg-background/30 flex flex-col items-center justify-center z-10">
                                      <Lock className="w-5 h-5 text-muted-foreground mb-1" />
                                      <span className="text-[10px] font-mono text-muted-foreground">M15 / Contexte</span>
                                    </div>
                                  </div>
                                  <div className="relative border border-border rounded-md overflow-hidden aspect-video bg-muted/50">
                                    <div className="absolute inset-0 backdrop-blur-xl bg-background/30 flex flex-col items-center justify-center z-10">
                                      <Lock className="w-5 h-5 text-muted-foreground mb-1" />
                                      <span className="text-[10px] font-mono text-muted-foreground">M5 / Entrée</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                <SignedImageCard
                                  storagePath={trade.screenshot_m15_m5}
                                  alt={`Trade ${trade.trade_number} M15`}
                                  label="M15 / Contexte"
                                  bucket="oracle-screenshots"
                                />
                                <SignedImageCard
                                  storagePath={trade.screenshot_m1}
                                  alt={`Trade ${trade.trade_number} M5`}
                                  label="M5 / Entrée"
                                  bucket="oracle-screenshots"
                                />
                              </div>
                            )
                          ) : (
                            <div className="border border-dashed border-border p-4 md:p-6 bg-muted/50 rounded-md flex flex-col items-center justify-center">
                              <Image className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground mb-2" />
                              <p className="text-xs md:text-sm text-muted-foreground">Screenshot à venir</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        ) : (
          /* ── Oracle Vérif : groupé par cycle avec rail latéral sticky ── */
          <div className="space-y-8">
            {/* R1 — Banner d'information si des cycles sont verrouillés */}
            {lockedCycles.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-white/[.03] border border-white/[.07] mx-1">
                <EyeOff className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  <span className="font-semibold text-muted-foreground">
                    {lockedCycles.length === 1
                      ? `${lockedCycles[0].name} masqué`
                      : `${lockedCycles.length} cycles masqués`}
                  </span>
                  {" — "}
                  Les trades Oracle de ton cycle en cours et des suivants seront révélés une fois chaque cycle complété de ton côté.
                </p>
              </div>
            )}

            {groups.map((group) => {
              const cycle = group.cycle;
              const colors = cycleColor(cycle?.phase ?? 1);
              const cycleTotal = cycle ? cycle.end - cycle.start + 1 : group.trades.length;
              return (
                <div key={String(cycle?.num ?? 'u')} className="flex gap-3 md:gap-4">

                  {/* ── Rail latéral ── */}
                  <div className="relative w-14 md:w-16 flex-shrink-0">
                    {/* Barre verticale — court sur toute la hauteur du groupe */}
                    <div className={cn(
                      "absolute top-14 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-gradient-to-b",
                      colors.rail
                    )} />
                    {/* Chip sticky — suit le scroll, se positionne sous le header stats */}
                    <div className="sticky top-[96px] z-30">
                      <div className={cn(
                        "rounded-lg border-2 flex flex-col items-center gap-1 py-2.5 px-1",
                        "bg-background shadow-md",
                        colors.border, colors.glow
                      )}>
                        {/* Numéro/abrév — grand et lisible */}
                        <span className={cn("text-xl font-black font-mono leading-none", colors.text)}>
                          {String(cycle?.num ?? "?")}
                        </span>
                        {/* Label phase */}
                        <span className={cn("text-[10px] font-bold font-mono tracking-widest leading-none", colors.text)}>
                          {cycle?.num === 0 ? "Ébauche" : `Cycle ${cycle?.num}`}
                        </span>
                        {/* Séparateur */}
                        <div className="w-6 border-t border-border/60 my-0.5" />
                        {/* Compteur */}
                        <span className={cn("text-xs font-bold font-mono leading-none", colors.text)}>
                          {group.trades.length}
                          <span className="text-muted-foreground font-normal">/{cycleTotal}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Colonne droite : header + trades ── */}
                  <div className="flex-1 min-w-0 pb-4">
                    {/* Header du groupe — bandeau coloré */}
                    <div className={cn(
                      "flex items-center gap-2 mb-3 px-3 py-2 rounded-md border-l-4",
                      colors.bg, colors.border
                    )}>
                      <span className={cn("text-sm font-bold font-mono", colors.text)}>
                        {cycle?.name ?? "—"}
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        #{String(cycle?.start ?? 0).padStart(3, "0")} → #{String(cycle?.end ?? 0).padStart(3, "0")}
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {group.trades.length} / {cycleTotal}
                      </span>
                    </div>

                    {/* Cartes de trades du groupe */}
                    <div className="space-y-2">
                      {group.trades.map((trade, idxInGroup) => {
                        const tradeIdx = group.startIdx + idxInGroup;
                        const isBlurred = isEarlyAccess && tradeIdx >= 50;
                        return (
                          <div
                            key={trade.id}
                            className={cn(
                              "border transition-all rounded-md overflow-hidden relative",
                              isBlurred && "pointer-events-none",
                              selectedTrade?.id === trade.id
                                ? "border-foreground/20 bg-accent/40"
                                : "border-border hover:bg-accent/30 bg-transparent"
                            )}
                          >
                            {/* Blur overlay for Early Access beyond 50 trades */}
                            {isBlurred && (
                              <div className="absolute inset-0 z-10 backdrop-blur-md bg-background/50 flex items-center justify-center pointer-events-auto cursor-not-allowed">
                                <div className="flex flex-col items-center gap-1 px-3 py-2 bg-background/80 rounded-lg border border-border">
                                  <div className="flex items-center gap-2">
                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase">Accès complet requis</span>
                                  </div>
                                  <span className="text-[9px] font-mono text-muted-foreground">Data bientôt disponible</span>
                                </div>
                              </div>
                            )}
                            {/* Main row - clickable */}
                            <div
                              onClick={() => !isBlurred && setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                              className="px-3 md:px-5 py-3 flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-3 md:gap-5">
                                {/* Checkbox for trades 1-15 */}
                                {trade.trade_number >= 1 && trade.trade_number <= 15 && (
                                  <div onClick={(e) => e.stopPropagation()} className="flex items-center" title="Trade analysé et compris">
                                    <Checkbox
                                      checked={analyzedTradeNumbers.includes(trade.trade_number)}
                                      onCheckedChange={(checked) => onAnalysisToggle?.(trade.trade_number, !!checked)}
                                      className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                    />
                                  </div>
                                )}
                                {/* Trade number */}
                                <span className="text-lg font-bold text-muted-foreground/50 w-10">
                                  {String(trade.trade_number).padStart(3, "0")}
                                </span>
                                <div className={cn("flex items-center gap-2 w-16", trade.direction === "Long" ? "text-emerald-500" : "text-red-500")}>
                                  {trade.direction === "Long" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                  <span className="text-xs font-mono uppercase">{trade.direction}</span>
                                </div>
                                <div className="hidden md:block">
                                  <p className="text-sm text-foreground">{formatDate(trade.trade_date)}</p>
                                  <p className="text-[10px] text-muted-foreground">{trade.day_of_week}</p>
                                </div>
                                <div className="hidden lg:block">
                                  <p className="text-[10px] text-muted-foreground font-mono">{trade.setup_type || "—"}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-500">+{trade.rr?.toFixed(2) || "0"}</p>
                                <p className="text-[9px] text-muted-foreground font-mono uppercase">RR</p>
                              </div>
                            </div>
                            {/* Expanded details */}
                            {selectedTrade?.id === trade.id && (
                              <div className="border-t border-border p-3 md:p-4 space-y-3 md:space-y-4 bg-transparent">
                                {(() => {
                                  const context = getTradeContext(trade);
                                  return (
                                    <>
                                      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3 md:p-4 border border-border bg-transparent rounded-md">
                                        <div className={cn("w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border rounded-md flex-shrink-0", trade.direction === "Long" ? "border-emerald-500/50 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10")}>
                                          {trade.direction === "Long" ? <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" /> : <TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-red-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-base md:text-lg font-bold text-foreground">Trade #{trade.trade_number}</p>
                                          <p className="text-xs md:text-sm text-muted-foreground truncate">{trade.setup_type || "Setup standard"} • {trade.entry_model || "Model standard"}</p>
                                        </div>
                                        <div className="text-left md:text-right">
                                          <p className={cn("text-lg md:text-xl font-bold", (trade.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500")}>{(trade.rr || 0) >= 0 ? "+" : ""}{trade.rr?.toFixed(2)} RR</p>
                                          <p className="text-xs md:text-sm text-muted-foreground">≈ {(trade.rr || 0) >= 0 ? "+" : ""}{((trade.rr || 0) * 1000).toLocaleString("fr-FR")} €</p>
                                        </div>
                                      </div>
                                      <div className="rounded-xl border border-border/30 overflow-hidden">
                                        <div className="grid grid-cols-2 md:grid-cols-4">
                                          <div className="flex flex-col gap-2 px-4 py-4 border-r border-b md:border-b-0 border-border/30"><div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground/40" /><span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Entrée</span></div><p className="text-2xl font-bold text-foreground tabular-nums leading-none">{trade.entry_time || "—"}</p></div>
                                          <div className="flex flex-col gap-2 px-4 py-4 border-b md:border-b-0 md:border-r border-border/30"><div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground/40" /><span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Sortie</span></div><p className="text-2xl font-bold text-foreground tabular-nums leading-none">{trade.exit_time || "—"}</p></div>
                                          <div className="flex flex-col gap-2 px-4 py-4 border-r border-border/30"><div className="flex items-center gap-1.5"><Target className="w-3 h-3 text-muted-foreground/40" /><span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Durée</span></div><p className="text-2xl font-bold text-foreground tabular-nums leading-none">{trade.trade_duration || "—"}</p></div>
                                          <div className="flex flex-col gap-2 px-4 py-4"><div className="flex items-center gap-1.5"><Calendar className="w-3 h-3 text-muted-foreground/40" /><span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">News</span></div><p className="text-2xl font-bold text-foreground leading-none">{trade.news_day ? (trade.news_label || "Oui") : "Non"}</p></div>
                                        </div>
                                        <div className="grid grid-cols-3 border-t border-border/30">
                                          <div className="flex flex-col gap-1.5 px-4 py-3 border-r border-border/30"><span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Structure</span><p className="text-sm font-semibold text-foreground">{trade.direction_structure || "—"}</p></div>
                                          <div className="flex flex-col gap-1.5 px-4 py-3 border-r border-border/30"><span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Timing entrée</span><p className="text-sm font-semibold text-foreground">{trade.entry_timing || "—"}</p></div>
                                          <div className="flex flex-col gap-1.5 px-4 py-3"><span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/50">Stop-Loss</span><p className="text-sm font-semibold text-foreground">{trade.stop_loss_size || "—"}</p></div>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                        <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                                          <div className="flex items-center justify-between mb-3 md:mb-4"><h4 className="text-[9px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground">RR par Trade</h4></div>
                                          <div className="h-28 md:h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={context.chartData}><XAxis dataKey="trade" tick={{ fill: "var(--chart-axis)", fontSize: 9 }} axisLine={{ stroke: "var(--chart-axis-line)" }} tickLine={false} /><YAxis tick={{ fill: "var(--chart-axis)", fontSize: 9 }} axisLine={{ stroke: "var(--chart-axis-line)" }} tickLine={false} /><Tooltip contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 4, color: "var(--chart-tooltip-text)" }} itemStyle={{ color: "var(--chart-tooltip-text)" }} labelStyle={{ color: "var(--chart-tooltip-text)" }} formatter={(value: number, name: string, props: any) => [`${value.toFixed(2)} RR`, `Trade #${props.payload.tradeNum}`]} /><Bar dataKey="individual" radius={[3, 3, 0, 0]}>{context.chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.current ? "var(--chart-bar)" : "#22c55e"} />))}</Bar></BarChart></ResponsiveContainer></div>
                                        </div>
                                        <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                                          <div className="flex items-center justify-between mb-3 md:mb-4"><h4 className="text-[9px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground">Cumul Isolé</h4><span className="text-sm md:text-base font-bold text-emerald-500">+{context.isolatedTotal.toFixed(2)}</span></div>
                                          <div className="h-28 md:h-36"><ResponsiveContainer width="100%" height="100%"><AreaChart data={context.chartData}><defs><linearGradient id="colorIsolatedRR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="trade" tick={{ fill: "var(--chart-axis)", fontSize: 9 }} axisLine={{ stroke: "var(--chart-axis-line)" }} tickLine={false} /><YAxis tick={{ fill: "var(--chart-axis)", fontSize: 9 }} axisLine={{ stroke: "var(--chart-axis-line)" }} tickLine={false} /><Tooltip contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 4, color: "var(--chart-tooltip-text)" }} itemStyle={{ color: "var(--chart-tooltip-text)" }} labelStyle={{ color: "var(--chart-tooltip-text)" }} formatter={(value: number, name: string, props: any) => [`${value.toFixed(2)} RR`, `Trade #${props.payload.tradeNum}`]} /><Area type="monotone" dataKey="rr" stroke="#22c55e" fillOpacity={1} fill="url(#colorIsolatedRR)" /></AreaChart></ResponsiveContainer></div>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/50">
                                        <div className="flex items-center gap-2.5"><div className={cn("w-0.5 h-5 rounded-full", context.cumulativeRR >= 0 ? "bg-emerald-500/60" : "bg-red-500/60")} /><span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/60">Cumul Total</span></div>
                                        <span className={cn("text-xl font-bold tabular-nums", context.cumulativeRR >= 0 ? "text-emerald-500" : "text-red-500")}>{context.cumulativeRR >= 0 ? "+" : ""}{context.cumulativeRR.toFixed(2)} RR</span>
                                      </div>
                                      {(trade.screenshot_m1 || trade.screenshot_m15_m5) ? (
                                        isEarlyAccess ? (
                                          tradeIdx % 2 === 0 && tradeIdx < 50 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                              <SignedImageCard storagePath={trade.screenshot_m15_m5} alt={`Trade ${trade.trade_number} M15`} label="M15 / Contexte" bucket="oracle-screenshots" />
                                              <SignedImageCard storagePath={trade.screenshot_m1} alt={`Trade ${trade.trade_number} M5`} label="M5 / Entrée" bucket="oracle-screenshots" />
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                              <div className="relative border border-border rounded-md overflow-hidden aspect-video bg-muted/50"><div className="absolute inset-0 backdrop-blur-xl bg-background/30 flex flex-col items-center justify-center z-10"><Lock className="w-5 h-5 text-muted-foreground mb-1" /><span className="text-[10px] font-mono text-muted-foreground">M15 / Contexte</span></div></div>
                                              <div className="relative border border-border rounded-md overflow-hidden aspect-video bg-muted/50"><div className="absolute inset-0 backdrop-blur-xl bg-background/30 flex flex-col items-center justify-center z-10"><Lock className="w-5 h-5 text-muted-foreground mb-1" /><span className="text-[10px] font-mono text-muted-foreground">M5 / Entrée</span></div></div>
                                            </div>
                                          )
                                        ) : (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                            <SignedImageCard storagePath={trade.screenshot_m15_m5} alt={`Trade ${trade.trade_number} M15`} label="M15 / Contexte" bucket="oracle-screenshots" />
                                            <SignedImageCard storagePath={trade.screenshot_m1} alt={`Trade ${trade.trade_number} M5`} label="M5 / Entrée" bucket="oracle-screenshots" />
                                          </div>
                                        )
                                      ) : (
                                        <div className="border border-dashed border-border p-4 md:p-6 bg-muted/50 rounded-md flex flex-col items-center justify-center">
                                          <Image className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground mb-2" />
                                          <p className="text-xs md:text-sm text-muted-foreground">Screenshot à venir</p>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Dialog for Data Générale */}
      {editingTrade && (
        <OracleTradeEditDialog
          isOpen={!!editingTrade}
          onClose={() => setEditingTrade(null)}
          onSaved={() => { setEditingTrade(null); onTradeUpdated?.(); }}
          trade={editingTrade}
        />
      )}
    </div>
  );
};
