import { TrendingUp, TrendingDown, Filter, Clock, Target, Calendar, Image, ChevronDown, X, CheckSquare, Lock, Pencil } from "lucide-react";
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
  hasScreenshots?: boolean;
}

export const OracleDatabase = ({ trades, initialFilters, analyzedTradeNumbers = [], onAnalysisToggle, isDataGenerale, isAdmin, onTradeUpdated }: OracleDatabaseProps) => {
  const chartColors = useChartColors();
  const { isEarlyAccess } = useEarlyAccess();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters ? { ...initialFilters, contributor: (initialFilters as any).contributor || [] } : {
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

  // Apply filters
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
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

  const toggleFilter = (category: keyof Omit<Filters, 'hasScreenshots'>, value: string) => {
    setFilters(prev => ({
      ...prev,
      [category]: prev[category].includes(value)
        ? prev[category].filter(v => v !== value)
        : [...prev[category], value]
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
      hasScreenshots: false,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Cycle definitions (mirrors public.cycles)
  const CYCLES = [
    { num: 0, name: "Ébauche",  phase: 0, start: 1,   end: 15  },
    { num: 1, name: "Cycle 1",  phase: 1, start: 16,  end: 40  },
    { num: 2, name: "Cycle 2",  phase: 1, start: 41,  end: 65  },
    { num: 3, name: "Cycle 3",  phase: 1, start: 66,  end: 90  },
    { num: 4, name: "Cycle 4",  phase: 1, start: 91,  end: 115 },
    { num: 5, name: "Cycle 5",  phase: 2, start: 116, end: 165 },
    { num: 6, name: "Cycle 6",  phase: 2, start: 166, end: 215 },
    { num: 7, name: "Cycle 7",  phase: 2, start: 216, end: 265 },
    { num: 8, name: "Cycle 8",  phase: 2, start: 266, end: 314 },
  ] as const;

  const getCycleForTrade = (tradeNumber: number) => {
    return CYCLES.find(c => tradeNumber >= c.start && tradeNumber <= c.end) || null;
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

  return (
    <div className="flex flex-col min-h-full">
      {/* Header with stats - redesigned & responsive */}
      <div className="p-3 md:p-4 border-b border-border bg-card">
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

      {/* Trades list */}
      <div className="flex-1 overflow-auto p-4">
      {filteredTrades.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">Aucun trade correspondant aux filtres</p>
            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              // Group filtered trades by cycle (only when not in Data Générale)
              type Group = { cycle: ReturnType<typeof getCycleForTrade>; trades: Trade[]; startIdx: number };
              const groups: Group[] = [];
              filteredTrades.forEach((trade, idx) => {
                const cycle = !isDataGenerale ? getCycleForTrade(trade.trade_number) : null;
                const last = groups[groups.length - 1];
                if (last && last.cycle?.num === cycle?.num) {
                  last.trades.push(trade);
                } else {
                  groups.push({ cycle, trades: [trade], startIdx: idx });
                }
              });

              const cycleColor = (cycle: ReturnType<typeof getCycleForTrade>) => {
                if (!cycle) return { rail: "bg-border", text: "text-muted-foreground", border: "border-border", bg: "bg-transparent", soft: "bg-muted/30", glow: "" };
                if (cycle.num === 0) return {
                  rail: "bg-gradient-to-b from-amber-500/80 via-amber-500/40 to-amber-500/10",
                  text: "text-amber-400",
                  border: "border-amber-500/30",
                  bg: "bg-amber-500/5",
                  soft: "bg-amber-500/10",
                  glow: "shadow-[0_0_20px_-8px_hsl(38_92%_50%/0.4)]",
                };
                if (cycle.phase === 1) return {
                  rail: "bg-gradient-to-b from-primary/80 via-primary/40 to-primary/10",
                  text: "text-primary",
                  border: "border-primary/30",
                  bg: "bg-primary/5",
                  soft: "bg-primary/10",
                  glow: "shadow-[0_0_20px_-8px_hsl(var(--primary)/0.4)]",
                };
                return {
                  rail: "bg-gradient-to-b from-emerald-500/80 via-emerald-500/40 to-emerald-500/10",
                  text: "text-emerald-400",
                  border: "border-emerald-500/30",
                  bg: "bg-emerald-500/5",
                  soft: "bg-emerald-500/10",
                  glow: "shadow-[0_0_20px_-8px_hsl(160_84%_39%/0.4)]",
                };
              };

              return groups.map((group, groupIdx) => {
                const { cycle } = group;
                const colors = cycleColor(cycle);
                const showCycleUI = !isDataGenerale && cycle;
                const totalInCycle = cycle ? cycle.end - cycle.start + 1 : 0;

                return (
                  <div key={`group-${groupIdx}`} className={cn("relative", showCycleUI && "flex gap-2 md:gap-3")}>
                    {/* Side rail with vertical sticky label */}
                    {showCycleUI && cycle && (
                      <div className="relative flex-shrink-0 w-7 md:w-9">
                        {/* Vertical color rail */}
                        <div className={cn("absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] rounded-full", colors.rail)} />
                        {/* Sticky vertical label */}
                        <div className="sticky top-2 z-10 flex flex-col items-center">
                          <div
                            className={cn(
                              "rounded-md border backdrop-blur-md px-1 py-2 md:py-2.5 flex flex-col items-center gap-1.5",
                              colors.border, colors.bg, colors.glow
                            )}
                          >
                            {/* Phase chip */}
                            <span
                              className={cn(
                                "text-[8px] md:text-[9px] font-mono font-bold leading-none",
                                colors.text
                              )}
                              title={cycle.num === 0 ? "Phase 0" : `Phase ${cycle.phase}`}
                            >
                              P{cycle.num === 0 ? 0 : cycle.phase}
                            </span>
                            <div className={cn("h-px w-3 md:w-4", colors.soft)} />
                            {/* Vertical cycle name */}
                            <span
                              className={cn(
                                "text-[10px] md:text-[11px] font-bold tracking-[0.2em] uppercase whitespace-nowrap",
                                colors.text
                              )}
                              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                            >
                              {cycle.name}
                            </span>
                            <div className={cn("h-px w-3 md:w-4", colors.soft)} />
                            {/* Trade count */}
                            <span className="text-[9px] md:text-[10px] font-mono text-foreground font-semibold leading-none">
                              {group.trades.length}
                            </span>
                            <span className="text-[7px] md:text-[8px] font-mono text-muted-foreground leading-none">
                              /{totalInCycle}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Trades column */}
                    <div className={cn("flex-1 min-w-0 space-y-2", showCycleUI && "pl-0")}>
                      {/* Cycle header row */}
                      {showCycleUI && cycle && (
                        <div
                          className={cn(
                            "sticky top-0 z-20 backdrop-blur-md border rounded-md px-3 md:px-4 py-2 flex items-center justify-between gap-3",
                            colors.border, colors.bg
                          )}
                        >
                          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                            <h3 className={cn("text-xs md:text-sm font-bold truncate", colors.text)}>
                              {cycle.name}
                            </h3>
                            <span className="hidden sm:inline text-[10px] md:text-[11px] font-mono text-muted-foreground">
                              #{String(cycle.start).padStart(3, "0")} → #{String(cycle.end).padStart(3, "0")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] md:text-[11px] font-mono text-foreground font-semibold">
                              {group.trades.length}
                            </span>
                            <span className="text-[9px] md:text-[10px] font-mono text-muted-foreground uppercase">
                              / {totalInCycle} trades
                            </span>
                          </div>
                        </div>
                      )}

                      {group.trades.map((trade, localIdx) => {
                        const tradeIdx = group.startIdx + localIdx;
                        const isBlurred = isEarlyAccess && tradeIdx >= 50;
                        return (
              <div key={`wrap-${trade.id}`}>
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

                          {/* Stats row - responsive 2x2 on mobile */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                            <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                              <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                <Clock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                                <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Entrée</span>
                              </div>
                              <p className="text-sm md:text-base font-bold text-foreground">{trade.entry_time || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                              <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                <Clock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                                <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Sortie</span>
                              </div>
                              <p className="text-sm md:text-base font-bold text-foreground">{trade.exit_time || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                              <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                <Target className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                                <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Durée</span>
                              </div>
                              <p className="text-sm md:text-base font-bold text-foreground">{trade.trade_duration || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                              <div className="flex items-center gap-1.5 md:gap-2 mb-1 md:mb-2">
                                <Calendar className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                                <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">News</span>
                              </div>
                              <p className="text-sm md:text-base font-bold text-foreground">
                                {trade.news_day ? (trade.news_label || "Oui") : "Non"}
                              </p>
                            </div>
                          </div>

                          {/* Additional info - responsive */}
                          <div className="grid grid-cols-3 gap-2 md:gap-3">
                            <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                              <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Structure</span>
                              <p className="text-xs md:text-sm font-medium text-foreground mt-0.5 md:mt-1">{trade.direction_structure || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                              <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">Entry</span>
                              <p className="text-xs md:text-sm font-medium text-foreground mt-0.5 md:mt-1">{trade.entry_timing || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-2 md:p-3 rounded-md">
                              <span className="text-[8px] md:text-[10px] text-muted-foreground font-mono uppercase">SL</span>
                              <p className="text-xs md:text-sm font-medium text-foreground mt-0.5 md:mt-1">{trade.stop_loss_size || "—"}</p>
                            </div>
                          </div>

                          {/* RR charts - vertical stack on mobile */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {/* Bar chart - individual RR per trade */}
                            <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                              <div className="flex items-center justify-between mb-3 md:mb-4">
                                <h4 className="text-[9px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground">
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
                            <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                              <div className="flex items-center justify-between mb-3 md:mb-4">
                                <h4 className="text-[9px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                  Cumul Isolé
                                </h4>
                                <span className="text-sm md:text-base font-bold text-emerald-500">
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

                          {/* Total cumulative RR note */}
                          <div className="flex items-center justify-between p-2 md:p-3 border border-border bg-card rounded-md">
                            <span className="text-[9px] md:text-xs text-muted-foreground font-mono uppercase">Cumul Total</span>
                            <span className="text-sm md:text-base font-bold text-emerald-500">+{context.cumulativeRR.toFixed(2)} RR</span>
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
                                  />
                                  <SignedImageCard
                                    storagePath={trade.screenshot_m1}
                                    alt={`Trade ${trade.trade_number} M5`}
                                    label="M5 / Entrée"
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
                                />
                                <SignedImageCard
                                  storagePath={trade.screenshot_m1}
                                  alt={`Trade ${trade.trade_number} M5`}
                                  label="M5 / Entrée"
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
              </div>
            );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
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
