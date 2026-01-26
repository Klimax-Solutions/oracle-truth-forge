import { TrendingUp, TrendingDown, Filter, Clock, Target, Calendar, Image, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
}

interface OracleDatabaseProps {
  trades: Trade[];
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
}

export const OracleDatabase = ({ trades }: OracleDatabaseProps) => {
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [filters, setFilters] = useState<Filters>({
    direction: [],
    direction_structure: [],
    setup_type: [],
    entry_model: [],
    entry_timing: [],
    trade_duration: [],
    rr_range: [],
    stop_loss_size: [],
  });

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
      return true;
    });
  }, [trades, filters]);

  const totalTrades = filteredTrades.length;
  const totalRR = filteredTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const longTrades = filteredTrades.filter((t) => t.direction === "Long").length;
  const shortTrades = filteredTrades.filter((t) => t.direction === "Short").length;

  const activeFiltersCount = Object.values(filters).flat().length;

  const toggleFilter = (category: keyof Filters, value: string) => {
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
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Get trade context for charts (like TradingJournal)
  const getTradeContext = (trade: Trade) => {
    const tradeIndex = trades.findIndex(t => t.id === trade.id);
    const tradesUpToNow = trades.slice(0, tradeIndex + 1);
    const cumulativeRR = tradesUpToNow.reduce((sum, t) => sum + (t.rr || 0), 0);
    
    const recentTrades = trades.slice(Math.max(0, tradeIndex - 9), tradeIndex + 1);
    let runningTotal = tradesUpToNow.slice(0, -recentTrades.length).reduce((sum, t) => sum + (t.rr || 0), 0);
    const chartData = recentTrades.map(t => {
      runningTotal += t.rr || 0;
      return {
        trade: t.trade_number,
        rr: runningTotal,
        current: t.id === trade.id
      };
    });

    return { cumulativeRR, chartData, tradeIndex };
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with stats - redesigned */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-base font-bold text-white">{totalTrades}</span>
              <span className="text-[10px] text-neutral-500 font-mono uppercase">trades</span>
            </div>
            <div className="w-px h-5 bg-neutral-800" />
            <div className="flex items-center gap-3">
              <span className="text-base font-bold text-emerald-400">+{totalRR.toFixed(1)}</span>
              <span className="text-[10px] text-neutral-500 font-mono uppercase">RR</span>
            </div>
            <div className="w-px h-5 bg-neutral-800" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 font-mono">{longTrades} LONG</span>
              <span className="text-neutral-700">•</span>
              <span className="text-xs text-red-400 font-mono">{shortTrades} SHORT</span>
            </div>
          </div>

          {/* Filters - Modern design with rounded corners */}
          <div className="flex items-center gap-1.5">
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="px-2.5 py-1.5 text-[10px] text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700 rounded-md transition-colors flex items-center gap-1"
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
                    ? "bg-white text-black"
                    : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                )}>
                  Direction
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-neutral-900 border-neutral-800 z-50 rounded-md min-w-[140px] p-1">
                {filterOptions.direction.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.direction.includes(option)}
                    onCheckedChange={() => toggleFilter("direction", option)}
                    className="text-neutral-300 text-xs rounded-sm px-3 py-2 cursor-pointer focus:bg-neutral-800 focus:text-white data-[state=checked]:bg-neutral-800 data-[state=checked]:text-white"
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
                    ? "bg-white text-black"
                    : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                )}>
                  Setup
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-neutral-900 border-neutral-800 z-50 rounded-md min-w-[140px] p-1">
                {filterOptions.setup_type.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.setup_type.includes(option)}
                    onCheckedChange={() => toggleFilter("setup_type", option)}
                    className="text-neutral-300 text-xs rounded-sm px-3 py-2 cursor-pointer focus:bg-neutral-800 focus:text-white data-[state=checked]:bg-neutral-800 data-[state=checked]:text-white"
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
                    ? "bg-white text-black"
                    : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                )}>
                  Entry Model
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-neutral-900 border-neutral-800 z-50 rounded-md min-w-[160px] p-1 max-h-64 overflow-y-auto scrollbar-hide">
                {filterOptions.entry_model.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.entry_model.includes(option)}
                    onCheckedChange={() => toggleFilter("entry_model", option)}
                    className="text-neutral-300 text-xs rounded-sm px-3 py-2 cursor-pointer focus:bg-neutral-800 focus:text-white data-[state=checked]:bg-neutral-800 data-[state=checked]:text-white"
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
                    ? "bg-white text-black"
                    : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                )}>
                  Structure
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-neutral-900 border-neutral-800 z-50 rounded-md min-w-[140px] p-1">
                {filterOptions.direction_structure.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.direction_structure.includes(option)}
                    onCheckedChange={() => toggleFilter("direction_structure", option)}
                    className="text-neutral-300 text-xs rounded-sm px-3 py-2 cursor-pointer focus:bg-neutral-800 focus:text-white data-[state=checked]:bg-neutral-800 data-[state=checked]:text-white"
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
                    ? "bg-white text-black"
                    : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                )}>
                  Timing
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-neutral-900 border-neutral-800 z-50 rounded-md min-w-[140px] p-1 max-h-64 overflow-y-auto scrollbar-hide">
                {filterOptions.entry_timing.map(option => (
                  <DropdownMenuCheckboxItem
                    key={option}
                    checked={filters.entry_timing.includes(option)}
                    onCheckedChange={() => toggleFilter("entry_timing", option)}
                    className="text-neutral-300 text-xs rounded-sm px-3 py-2 cursor-pointer focus:bg-neutral-800 focus:text-white data-[state=checked]:bg-neutral-800 data-[state=checked]:text-white"
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
            <p className="text-neutral-500 text-lg mb-4">Aucun trade correspondant aux filtres</p>
            <Button variant="ghost" onClick={clearFilters} className="text-neutral-400">
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTrades.map((trade) => (
              <div
                key={trade.id}
                className={cn(
                  "border transition-all rounded-sm overflow-hidden",
                  selectedTrade?.id === trade.id
                    ? "border-white bg-neutral-900"
                    : "border-neutral-800 hover:border-neutral-700 bg-neutral-950"
                )}
              >
                {/* Main row - clickable */}
                <div 
                  onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                  className="px-5 py-3 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                    <span className="text-lg font-bold text-neutral-600 w-10">
                      {String(trade.trade_number).padStart(3, "0")}
                    </span>

                    <div
                      className={cn(
                        "flex items-center gap-2 w-16",
                        trade.direction === "Long" ? "text-emerald-400" : "text-red-400"
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
                      <p className="text-sm text-white">{formatDate(trade.trade_date)}</p>
                      <p className="text-[10px] text-neutral-600">{trade.day_of_week}</p>
                    </div>

                    <div className="hidden lg:block">
                      <p className="text-[10px] text-neutral-500 font-mono">{trade.setup_type || "—"}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">+{trade.rr?.toFixed(2) || "0"}</p>
                    <p className="text-[9px] text-neutral-600 font-mono uppercase">RR</p>
                  </div>
                </div>

                {/* Expanded details - like TradingJournal */}
                {selectedTrade?.id === trade.id && (
                  <div className="border-t border-neutral-800 p-4 space-y-4">
                    {(() => {
                      const context = getTradeContext(trade);
                      return (
                        <>
                          {/* Trade header */}
                          <div className="flex items-center gap-4 p-4 border border-neutral-800 bg-neutral-950 rounded-sm">
                            <div className={cn(
                              "w-12 h-12 flex items-center justify-center border rounded-sm",
                              trade.direction === "Long" 
                                ? "border-emerald-500/50 bg-emerald-500/10" 
                                : "border-red-500/50 bg-red-500/10"
                            )}>
                              {trade.direction === "Long" 
                                ? <TrendingUp className="w-6 h-6 text-emerald-400" />
                                : <TrendingDown className="w-6 h-6 text-red-400" />
                              }
                            </div>
                            <div className="flex-1">
                              <p className="text-lg font-bold text-white">
                                Trade #{trade.trade_number}
                              </p>
                              <p className="text-sm text-neutral-500">
                                {trade.setup_type || "Setup standard"} • {trade.entry_model || "Model standard"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-emerald-400">+{trade.rr?.toFixed(2)} RR</p>
                              <p className="text-sm text-neutral-500">≈ +{((trade.rr || 0) * 1000).toLocaleString("fr-FR")} €</p>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div className="grid grid-cols-4 gap-3">
                            <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-neutral-500" />
                                <span className="text-[10px] text-neutral-600 font-mono uppercase">Entrée</span>
                              </div>
                              <p className="text-base font-bold text-white">{trade.entry_time || "—"}</p>
                            </div>
                            <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-neutral-500" />
                                <span className="text-[10px] text-neutral-600 font-mono uppercase">Sortie</span>
                              </div>
                              <p className="text-base font-bold text-white">{trade.exit_time || "—"}</p>
                            </div>
                            <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <Target className="w-4 h-4 text-neutral-500" />
                                <span className="text-[10px] text-neutral-600 font-mono uppercase">Durée</span>
                              </div>
                              <p className="text-base font-bold text-white">{trade.trade_duration || "—"}</p>
                            </div>
                            <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-neutral-500" />
                                <span className="text-[10px] text-neutral-600 font-mono uppercase">News</span>
                              </div>
                              <p className="text-base font-bold text-white">
                                {trade.news_day ? (trade.news_label || "Oui") : "Non"}
                              </p>
                            </div>
                          </div>

                          {/* Additional info */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-sm">
                              <span className="text-[10px] text-neutral-600 font-mono uppercase">Structure</span>
                              <p className="text-sm font-medium text-white mt-1">{trade.direction_structure || "—"}</p>
                            </div>
                            <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-sm">
                              <span className="text-[10px] text-neutral-600 font-mono uppercase">Entry Timing</span>
                              <p className="text-sm font-medium text-white mt-1">{trade.entry_timing || "—"}</p>
                            </div>
                            <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-sm">
                              <span className="text-[10px] text-neutral-600 font-mono uppercase">Stop Loss</span>
                              <p className="text-sm font-medium text-white mt-1">{trade.stop_loss_size || "—"}</p>
                            </div>
                          </div>

                          {/* Cumulative RR chart */}
                          <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-sm">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                                Progression RR (10 derniers trades)
                              </h4>
                              <span className="text-base font-bold text-emerald-400">
                                Cumul: +{context.cumulativeRR.toFixed(2)} RR
                              </span>
                            </div>
                            <div className="h-32">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={context.chartData}>
                                  <defs>
                                    <linearGradient id="colorCumRROracle" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <XAxis 
                                    dataKey="trade" 
                                    tick={{ fill: "#525252", fontSize: 10 }}
                                    axisLine={{ stroke: "#262626" }}
                                    tickLine={false}
                                  />
                                  <YAxis 
                                    tick={{ fill: "#525252", fontSize: 10 }}
                                    axisLine={{ stroke: "#262626" }}
                                    tickLine={false}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: "#171717",
                                      border: "1px solid #262626",
                                      borderRadius: 2,
                                    }}
                                    labelStyle={{ color: "#a3a3a3" }}
                                    formatter={(value: number) => [`${value.toFixed(2)} RR`, "Cumul"]}
                                  />
                                  <Area 
                                    type="monotone" 
                                    dataKey="rr" 
                                    stroke="#22c55e" 
                                    fillOpacity={1}
                                    fill="url(#colorCumRROracle)"
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Screenshot placeholder */}
                          <div className="border border-dashed border-neutral-700 p-6 bg-neutral-950/50 rounded-sm flex flex-col items-center justify-center">
                            <Image className="w-8 h-8 text-neutral-600 mb-2" />
                            <p className="text-sm text-neutral-500">Screenshot à venir</p>
                            <p className="text-[10px] text-neutral-600 mt-1">Emplacement réservé pour les captures</p>
                          </div>
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
