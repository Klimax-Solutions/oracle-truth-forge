import { TrendingUp, TrendingDown, Filter, Clock, Target, Calendar, Image, ChevronDown, X } from "lucide-react";
import { SignedImageCard } from "./SignedImageCard";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { useChartColors } from "@/hooks/useChartColors";
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
}

interface OracleDatabaseProps {
  trades: Trade[];
  initialFilters?: Filters;
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
  hasScreenshots?: boolean;
}

export const OracleDatabase = ({ trades, initialFilters }: OracleDatabaseProps) => {
  const chartColors = useChartColors();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters || {
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

  return (
    <div className="h-full flex flex-col">
      {/* Header with stats - redesigned */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-base font-bold text-foreground">{totalTrades}</span>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">trades</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-3">
              <span className="text-base font-bold text-emerald-400">+{totalRR.toFixed(1)}</span>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">RR</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 font-mono">{longTrades} LONG</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-red-400 font-mono">{shortTrades} SHORT</span>
            </div>
          </div>

          {/* Filters - Modern design with rounded corners */}
          <div className="flex items-center gap-1.5">
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
                  "px-3 py-1.5 text-[10px] font-medium rounded-md transition-all flex items-center gap-1.5",
                  filters.direction.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Direction
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[140px] p-1">
                {filterOptions.direction.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.direction.includes(option)}
                    onCheckedChange={() => toggleFilter("direction", option)}
                    className="text-foreground text-xs rounded-md px-3 py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-3 py-1.5 text-[10px] font-medium rounded-md transition-all flex items-center gap-1.5",
                  filters.setup_type.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Setup
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[140px] p-1">
                {filterOptions.setup_type.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.setup_type.includes(option)}
                    onCheckedChange={() => toggleFilter("setup_type", option)}
                    className="text-foreground text-xs rounded-md px-3 py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-3 py-1.5 text-[10px] font-medium rounded-md transition-all flex items-center gap-1.5",
                  filters.entry_model.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Entry Model
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[160px] p-1 max-h-64 overflow-y-auto scrollbar-hide">
                {filterOptions.entry_model.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.entry_model.includes(option)}
                    onCheckedChange={() => toggleFilter("entry_model", option)}
                    className="text-foreground text-xs rounded-md px-3 py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-3 py-1.5 text-[10px] font-medium rounded-md transition-all flex items-center gap-1.5",
                  filters.direction_structure.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Structure
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[140px] p-1">
                {filterOptions.direction_structure.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.direction_structure.includes(option)}
                    onCheckedChange={() => toggleFilter("direction_structure", option)}
                    className="text-foreground text-xs rounded-md px-3 py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "px-3 py-1.5 text-[10px] font-medium rounded-md transition-all flex items-center gap-1.5",
                  filters.entry_timing.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  Timing
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-popover border-border z-50 rounded-md min-w-[140px] p-1 max-h-64 overflow-y-auto scrollbar-hide">
                {filterOptions.entry_timing.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.entry_timing.includes(option)}
                    onCheckedChange={() => toggleFilter("entry_timing", option)}
                    className="text-foreground text-xs rounded-md px-3 py-2 cursor-pointer focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:text-foreground"
                  >
                    {option}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

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
          <div className="space-y-2">
            {filteredTrades.map((trade) => (
              <div
                key={trade.id}
                className={cn(
                  "border transition-all rounded-md overflow-hidden",
                  selectedTrade?.id === trade.id
                    ? "border-foreground/20 bg-accent/40"
                    : "border-border hover:bg-accent/30 bg-transparent"
                )}
              >
                {/* Main row - clickable */}
                <div 
                  onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                  className="px-5 py-3 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                    <span className="text-lg font-bold text-muted-foreground/50 w-10">
                      {String(trade.trade_number).padStart(3, "0")}
                    </span>

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
                  <div className="border-t border-border p-4 space-y-4 bg-transparent">
                    {(() => {
                      const context = getTradeContext(trade);
                      return (
                        <>
                          {/* Trade header */}
                          <div className="flex items-center gap-4 p-4 border border-border bg-transparent rounded-md">
                            <div className={cn(
                              "w-12 h-12 flex items-center justify-center border rounded-md",
                              trade.direction === "Long" 
                                ? "border-emerald-500/50 bg-emerald-500/10" 
                                : "border-red-500/50 bg-red-500/10"
                            )}>
                              {trade.direction === "Long" 
                                ? <TrendingUp className="w-6 h-6 text-emerald-500" />
                                : <TrendingDown className="w-6 h-6 text-red-500" />
                              }
                            </div>
                            <div className="flex-1">
                              <p className="text-lg font-bold text-foreground">
                                Trade #{trade.trade_number}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {trade.setup_type || "Setup standard"} • {trade.entry_model || "Model standard"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-emerald-500">+{trade.rr?.toFixed(2)} RR</p>
                              <p className="text-sm text-muted-foreground">≈ +{((trade.rr || 0) * 1000).toLocaleString("fr-FR")} €</p>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-4 gap-3">
                            <div className="border border-border bg-transparent p-3 rounded-md">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground font-mono uppercase">Entrée</span>
                              </div>
                              <p className="text-base font-bold text-foreground">{trade.entry_time || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-3 rounded-md">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground font-mono uppercase">Sortie</span>
                              </div>
                              <p className="text-base font-bold text-foreground">{trade.exit_time || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-3 rounded-md">
                              <div className="flex items-center gap-2 mb-2">
                                <Target className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground font-mono uppercase">Durée</span>
                              </div>
                              <p className="text-base font-bold text-foreground">{trade.trade_duration || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-3 rounded-md">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground font-mono uppercase">News</span>
                              </div>
                              <p className="text-base font-bold text-foreground">
                                {trade.news_day ? (trade.news_label || "Oui") : "Non"}
                              </p>
                            </div>
                          </div>

                          {/* Additional info */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="border border-border bg-transparent p-3 rounded-md">
                              <span className="text-[10px] text-muted-foreground font-mono uppercase">Structure</span>
                              <p className="text-sm font-medium text-foreground mt-1">{trade.direction_structure || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-3 rounded-md">
                              <span className="text-[10px] text-muted-foreground font-mono uppercase">Entry Timing</span>
                              <p className="text-sm font-medium text-foreground mt-1">{trade.entry_timing || "—"}</p>
                            </div>
                            <div className="border border-border bg-transparent p-3 rounded-md">
                              <span className="text-[10px] text-muted-foreground font-mono uppercase">Stop Loss</span>
                              <p className="text-sm font-medium text-foreground mt-1">{trade.stop_loss_size || "—"}</p>
                            </div>
                          </div>

                          {/* RR charts - BAR + ISOLATED CUMUL (like TradingJournal) */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* Bar chart - individual RR per trade */}
                            <div className="border border-border p-4 bg-transparent rounded-md">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                  RR par Trade (10 derniers)
                                </h4>
                              </div>
                              <div className="h-36">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={context.chartData}>
                                    <XAxis 
                                      dataKey="trade" 
                                      tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                                      axisLine={{ stroke: "var(--chart-axis-line)" }}
                                      tickLine={false}
                                    />
                                    <YAxis 
                                      tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
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
                            <div className="border border-border p-4 bg-transparent rounded-md">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                  Cumul Isolé (10 derniers)
                                </h4>
                                <span className="text-base font-bold text-emerald-500">
                                  +{context.isolatedTotal.toFixed(2)} RR
                                </span>
                              </div>
                              <div className="h-36">
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
                                      tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
                                      axisLine={{ stroke: "var(--chart-axis-line)" }}
                                      tickLine={false}
                                    />
                                    <YAxis 
                                      tick={{ fill: "var(--chart-axis)", fontSize: 10 }}
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
                          <div className="flex items-center justify-between p-3 border border-border bg-card rounded-md">
                            <span className="text-xs text-muted-foreground font-mono uppercase">Cumul Total (depuis Trade #1)</span>
                            <span className="text-base font-bold text-emerald-500">+{context.cumulativeRR.toFixed(2)} RR</span>
                          </div>

                          {/* Screenshots */}
                          {(trade.screenshot_m1 || trade.screenshot_m15_m5) ? (
                            <div className="grid grid-cols-2 gap-4">
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
                            <div className="border border-dashed border-border p-6 bg-muted/50 rounded-md flex flex-col items-center justify-center">
                              <Image className="w-8 h-8 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">Screenshot à venir</p>
                              <p className="text-[10px] text-muted-foreground/70 mt-1">Emplacement réservé pour les captures</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
