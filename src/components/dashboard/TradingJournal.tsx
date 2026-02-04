import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Clock, Target, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell

 } from "recharts";
import { SignedImageCard } from "./SignedImageCard";

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  rr: number;
  entry_time: string;
  exit_time?: string;
  trade_duration?: string;
  setup_type: string;
  entry_model?: string;
  entry_timing?: string;
  stop_loss_size?: string;
  news_day?: boolean;
  news_label?: string;
  screenshot_m15_m5?: string | null;
  screenshot_m1?: string | null;
}

interface TradingJournalProps {
  trades: Trade[];
}

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export const TradingJournal = ({ trades }: TradingJournalProps) => {
  const firstTrade = useMemo(() => {
    if (trades.length === 0) return null;
    return trades.reduce((earliest, t) => 
      new Date(t.trade_date) < new Date(earliest.trade_date) ? t : earliest
    , trades[0]);
  }, [trades]);

  const lastTrade = useMemo(() => {
    if (trades.length === 0) return null;
    return trades.reduce((latest, t) => 
      new Date(t.trade_date) > new Date(latest.trade_date) ? t : latest
    , trades[0]);
  }, [trades]);

  const [currentDate, setCurrentDate] = useState(() => {
    if (lastTrade) {
      return new Date(lastTrade.trade_date);
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const tradesByDate = useMemo(() => {
    const map = new Map<string, Trade[]>();
    trades.forEach((trade) => {
      const dateStr = trade.trade_date;
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(trade);
    });
    return map;
  }, [trades]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: (Date | null)[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, [year, month]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const goToFirstTrade = () => {
    if (firstTrade) {
      const firstTradeDate = new Date(firstTrade.trade_date);
      setCurrentDate(firstTradeDate);
      setSelectedDate(firstTradeDate);
    }
  };

  const goToLastTrade = () => {
    if (lastTrade) {
      const lastTradeDate = new Date(lastTrade.trade_date);
      setCurrentDate(lastTradeDate);
      setSelectedDate(lastTradeDate);
    }
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDayData = (date: Date) => {
    const dateKey = formatDateKey(date);
    const dayTrades = tradesByDate.get(dateKey) || [];
    const totalRR = dayTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
    return { trades: dayTrades, totalRR };
  };

  const selectedDayData = selectedDate ? getDayData(selectedDate) : null;

  // Get cumulative RR for selected trade context - ISOLATED last 10 trades
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
    <div className="h-full flex flex-col md:flex-row">
      {/* Calendar */}
      <div className="w-full md:w-[560px] border-b md:border-b-0 md:border-r border-border/34 flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-5 border-b border-border/34 gap-2">
          <span className="text-sm md:text-base font-mono uppercase tracking-wider text-muted-foreground">
            Journal de Trading
          </span>
          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToFirstTrade}
              className="text-[10px] md:text-xs text-muted-foreground hover:text-foreground hover:bg-accent gap-1 px-2 md:px-3"
            >
              <SkipBack className="w-3 h-3" />
              <span className="hidden sm:inline">Premier</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToLastTrade}
              className="text-[10px] md:text-xs text-muted-foreground hover:text-foreground hover:bg-accent gap-1 px-2 md:px-3"
            >
              <SkipForward className="w-3 h-3" />
              <span className="hidden sm:inline">Dernier</span>
            </Button>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-border/34">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevMonth}
            className="w-8 h-8 md:w-9 md:h-9 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
          <span className="text-sm md:text-base font-medium capitalize text-foreground">{formatMonthYear(currentDate)}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="w-8 h-8 md:w-9 md:h-9 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 p-3 md:p-4 overflow-auto">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map((day) => (
              <div key={day} className="py-1 md:py-2 text-center text-[10px] md:text-xs font-mono uppercase text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-1">
            {calendarDays.map((date, idx) => {
              if (!date) {
                return <div key={idx} className="aspect-square" />;
              }

              const { trades: dayTrades, totalRR } = getDayData(date);
              const hasProfit = totalRR > 0;
              const hasLoss = totalRR < 0;
              const hasTrades = dayTrades.length > 0;
              const isSelected = selectedDate?.toDateString() === date.toDateString();

              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedDate(date);
                    // Auto-select first trade of the day
                    const dayTrades = tradesByDate.get(formatDateKey(date)) || [];
                    setSelectedTrade(dayTrades.length > 0 ? dayTrades[0] : null);
                  }}
                  className={cn(
                    "aspect-square border transition-all rounded-md",
                    "flex flex-col items-center justify-center",
                    isSelected
                      ? "border-foreground/30 bg-accent/60"
                      : hasProfit
                      ? "border-transparent bg-emerald-500/15"
                      : hasLoss
                      ? "border-transparent bg-red-500/15"
                      : "border-border hover:bg-accent/30"
                  )}
                >
                  <span className={cn(
                    "text-sm font-medium",
                    hasTrades ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {date.getDate()}
                  </span>
                  {hasTrades && (
                    <span className={cn(
                      "text-[10px] font-mono",
                      totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                    )}>
                      +{totalRR.toFixed(1)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-border/34">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500/30 rounded-md" />
              <span className="text-xs text-muted-foreground">Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500/30 rounded-md" />
              <span className="text-xs text-muted-foreground">Loss</span>
            </div>
          </div>
        </div>
      </div>

      {/* Details panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDayData && selectedDayData.trades.length > 0 ? (
          <>
            {/* Day header - responsive */}
            <div className="p-3 md:p-5 border-b border-border">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <span className="text-xs md:text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  {selectedDate?.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </span>
                <div className="text-left md:text-right">
                  <span className={cn(
                    "text-base md:text-xl font-bold",
                    selectedDayData.totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {selectedDayData.totalRR >= 0 ? "+" : ""}{selectedDayData.totalRR.toFixed(2)} RR
                  </span>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    ≈ {selectedDayData.totalRR >= 0 ? "+" : ""}{(selectedDayData.totalRR * 1000).toLocaleString("fr-FR")} €
                  </p>
                </div>
              </div>
            </div>

            {/* Trades list - responsive like OracleDatabase */}
            <div className="p-3 md:p-4 border-b border-border/34 space-y-2">
              {selectedDayData.trades.map((trade) => (
                <button
                  key={trade.id}
                  onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                  className={cn(
                    "w-full flex items-center justify-between py-2 md:py-3 px-3 md:px-4 border transition-all text-left rounded-md",
                    selectedTrade?.id === trade.id
                      ? "border-foreground/20 bg-accent/50"
                      : "border-border bg-transparent hover:bg-accent/30"
                  )}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={cn(
                      "w-6 h-6 md:w-8 md:h-8 flex items-center justify-center border rounded-md flex-shrink-0",
                      trade.direction === "Long" 
                        ? "border-emerald-500/50 bg-emerald-500/10" 
                        : "border-red-500/50 bg-red-500/10"
                    )}>
                      {trade.direction === "Long" 
                        ? <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-emerald-500" />
                        : <TrendingDown className="w-3 h-3 md:w-4 md:h-4 text-red-500" />
                      }
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground font-mono text-xs md:text-sm">#{trade.trade_number}</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground ml-2 hidden sm:inline">{trade.entry_time}</span>
                    </div>
                  </div>
                  <span className={cn(
                    "font-mono font-bold text-sm md:text-base",
                    (trade.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {(trade.rr || 0) >= 0 ? "+" : ""}{trade.rr?.toFixed(2)} RR
                  </span>
                </button>
              ))}
            </div>

            {/* Selected trade details with graphs */}
            {selectedTrade && (
              <div className="flex-1 overflow-auto p-3 md:p-4 space-y-3 md:space-y-4">
                {(() => {
                  const context = getTradeContext(selectedTrade);
                  return (
                    <>
                      {/* Trade header - responsive like OracleDatabase */}
                      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3 md:p-4 border border-border bg-transparent rounded-md">
                        <div className={cn(
                          "w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border rounded-md flex-shrink-0",
                          selectedTrade.direction === "Long" 
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-red-500/50 bg-red-500/10"
                        )}>
                          {selectedTrade.direction === "Long" 
                            ? <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
                            : <TrendingDown className="w-5 h-5 md:w-6 md:h-6 text-red-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base md:text-lg font-bold text-foreground">
                            Trade #{selectedTrade.trade_number}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">
                            {selectedTrade.setup_type || "Setup standard"} • {selectedTrade.entry_model || "Model standard"}
                          </p>
                        </div>
                        <div className="text-left md:text-right">
                          <p className={cn(
                            "text-lg md:text-xl font-bold",
                            (selectedTrade.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                          )}>
                            {(selectedTrade.rr || 0) >= 0 ? "+" : ""}{selectedTrade.rr?.toFixed(2)} RR
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            ≈ {(selectedTrade.rr || 0) >= 0 ? "+" : ""}{((selectedTrade.rr || 0) * 1000).toLocaleString("fr-FR")} €
                          </p>
                        </div>
                      </div>

                      {/* Stats row - responsive grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                        <div className="border border-border p-2 md:p-3 bg-transparent rounded-md">
                          <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
                            <Clock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                            <span className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase">Entrée</span>
                          </div>
                          <p className="text-sm md:text-lg font-bold text-foreground">{selectedTrade.entry_time || "—"}</p>
                        </div>
                        <div className="border border-border p-2 md:p-3 bg-transparent rounded-md">
                          <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
                            <Clock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                            <span className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase">Sortie</span>
                          </div>
                          <p className="text-sm md:text-lg font-bold text-foreground">{selectedTrade.exit_time || "—"}</p>
                        </div>
                        <div className="border border-border p-2 md:p-3 bg-transparent rounded-md">
                          <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
                            <Target className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                            <span className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase">Durée</span>
                          </div>
                          <p className="text-sm md:text-lg font-bold text-foreground">{selectedTrade.trade_duration || "—"}</p>
                        </div>
                        <div className="border border-border p-2 md:p-3 bg-transparent rounded-md">
                          <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
                            <Calendar className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
                            <span className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase">News</span>
                          </div>
                          <p className="text-sm md:text-lg font-bold text-foreground">
                            {selectedTrade.news_day ? (selectedTrade.news_label || "Oui") : "Non"}
                          </p>
                        </div>
                      </div>

                      {/* RR charts - stacked on mobile */}
                      <div className="grid grid-cols-1 gap-3 md:gap-4">
                        {/* Bar chart - individual RR per trade */}
                        <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                          <div className="flex items-center justify-between mb-3 md:mb-4">
                            <h4 className="text-[10px] md:text-sm font-mono uppercase tracking-wider text-muted-foreground">
                              RR par Trade (10 derniers)
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
                                  width={25}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "var(--chart-tooltip-bg)",
                                    border: "1px solid var(--chart-tooltip-border)",
                                    borderRadius: 4,
                                    color: "var(--chart-tooltip-text)",
                                    fontSize: 11,
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
                                      fill={entry.current ? "var(--chart-bar)" : entry.individual >= 0 ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.6)"} 
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Cumulative RR chart - ISOLATED */}
                        <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                          <div className="flex items-center justify-between mb-3 md:mb-4">
                            <h4 className="text-[10px] md:text-sm font-mono uppercase tracking-wider text-muted-foreground">
                              Cumul Isolé (10 trades)
                            </h4>
                            <span className={cn(
                              "text-sm md:text-base font-bold",
                              context.isolatedTotal >= 0 ? "text-emerald-500" : "text-red-500"
                            )}>
                              {context.isolatedTotal >= 0 ? "+" : ""}{context.isolatedTotal.toFixed(2)} RR
                            </span>
                          </div>
                          <div className="h-28 md:h-36">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={context.chartData}>
                                <defs>
                                  <linearGradient id="colorCumRR" x1="0" y1="0" x2="0" y2="1">
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
                                  width={25}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "var(--chart-tooltip-bg)",
                                    border: "1px solid var(--chart-tooltip-border)",
                                    borderRadius: 4,
                                    color: "var(--chart-tooltip-text)",
                                    fontSize: 11,
                                  }}
                                  itemStyle={{ color: "var(--chart-tooltip-text)" }}
                                  labelStyle={{ color: "var(--chart-tooltip-text)" }}
                                  formatter={(value: number) => [`${value.toFixed(2)} RR`, "Cumul"]}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="rr" 
                                  stroke="#22c55e" 
                                  fillOpacity={1}
                                  fill="url(#colorCumRR)"
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Trade details - stacked on mobile */}
                      <div className="grid grid-cols-1 gap-3">
                        <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                          <h4 className="text-[10px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 md:mb-3">
                            Paramètres d'entrée
                          </h4>
                          <div className="space-y-1.5 md:space-y-2">
                            <div className="flex justify-between">
                              <span className="text-xs md:text-sm text-muted-foreground">Entry Timing</span>
                              <span className="text-xs md:text-sm text-foreground">{selectedTrade.entry_timing || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs md:text-sm text-muted-foreground">Stop Loss</span>
                              <span className="text-xs md:text-sm text-foreground">{selectedTrade.stop_loss_size || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs md:text-sm text-muted-foreground">Setup Type</span>
                              <span className="text-xs md:text-sm text-foreground">{selectedTrade.setup_type || "—"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="border border-border p-3 md:p-4 bg-transparent rounded-md">
                          <h4 className="text-[10px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 md:mb-3">
                            Position dans la série
                          </h4>
                          <div className="space-y-1.5 md:space-y-2">
                            <div className="flex justify-between">
                              <span className="text-xs md:text-sm text-muted-foreground">Trade #</span>
                              <span className="text-xs md:text-sm text-foreground">{context.tradeIndex + 1} / {trades.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs md:text-sm text-muted-foreground">RR avant</span>
                              <span className="text-xs md:text-sm text-foreground">
                                {(context.cumulativeRR - (selectedTrade.rr || 0)) >= 0 ? "+" : ""}{(context.cumulativeRR - (selectedTrade.rr || 0)).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs md:text-sm text-muted-foreground">RR après</span>
                              <span className={cn(
                                "text-xs md:text-sm",
                                context.cumulativeRR >= 0 ? "text-emerald-500" : "text-red-500"
                              )}>
                                {context.cumulativeRR >= 0 ? "+" : ""}{context.cumulativeRR.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Screenshots - stacked on mobile */}
                      <div className="grid grid-cols-1 gap-3">
                        <SignedImageCard
                          storagePath={selectedTrade.screenshot_m15_m5}
                          alt={`Trade ${selectedTrade.trade_number} M15/M5`}
                          label="M15 / Contexte"
                        />
                        <SignedImageCard
                          storagePath={selectedTrade.screenshot_m1}
                          alt={`Trade ${selectedTrade.trade_number} M1`}
                          label="M5 / Entrée"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Placeholder when no trade selected */}
            {!selectedTrade && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground font-mono">
                  Cliquez sur un trade pour voir les détails
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p className="text-sm font-mono">Sélectionnez un jour pour voir les détails</p>
          </div>
        )}
      </div>
    </div>
  );
};
