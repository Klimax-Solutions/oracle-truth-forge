import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Clock, Target, Calendar, TrendingUp, TrendingDown, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from "recharts";

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
    <div className="h-full flex">
      {/* Calendar - Larger */}
      <div className="w-[560px] border-r border-neutral-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <span className="text-base font-mono uppercase tracking-wider text-neutral-400">
            Journal de Trading
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToFirstTrade}
              className="text-xs text-neutral-500 hover:text-white hover:bg-neutral-800 gap-1"
            >
              <SkipBack className="w-3 h-3" />
              Premier trade
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToLastTrade}
              className="text-xs text-neutral-500 hover:text-white hover:bg-neutral-800 gap-1"
            >
              <SkipForward className="w-3 h-3" />
              Dernier trade
            </Button>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevMonth}
            className="w-9 h-9 text-neutral-500 hover:text-white hover:bg-neutral-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-base font-medium capitalize">{formatMonthYear(currentDate)}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="w-9 h-9 text-neutral-500 hover:text-white hover:bg-neutral-800"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 p-4 overflow-auto">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-mono uppercase text-neutral-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1">
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
                      ? "border-white bg-neutral-900"
                      : hasProfit
                      ? "border-transparent bg-emerald-500/20"
                      : hasLoss
                      ? "border-transparent bg-red-500/20"
                      : "border-neutral-800 hover:border-neutral-600"
                  )}
                >
                  <span className={cn(
                    "text-sm font-medium",
                    hasTrades ? "text-white" : "text-neutral-600"
                  )}>
                    {date.getDate()}
                  </span>
                  {hasTrades && (
                    <span className={cn(
                      "text-[10px] font-mono",
                      totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      +{totalRR.toFixed(1)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500/30 rounded-md" />
              <span className="text-xs text-neutral-500">Profit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500/30 rounded-md" />
              <span className="text-xs text-neutral-500">Loss</span>
            </div>
          </div>
        </div>
      </div>

      {/* Details panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDayData && selectedDayData.trades.length > 0 ? (
          <>
            {/* Day header */}
            <div className="p-5 border-b border-neutral-800 bg-emerald-500/10">
              <div className="flex items-center justify-between">
                <span className="text-base font-mono uppercase tracking-wider text-neutral-400">
                  {selectedDate?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
                <div className="text-right">
                  <span className={cn(
                    "text-xl font-bold",
                    selectedDayData.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    +{selectedDayData.totalRR.toFixed(2)} RR
                  </span>
                  <p className="text-sm text-neutral-500">
                    ≈ +{(selectedDayData.totalRR * 1000).toLocaleString("fr-FR")} € sur 100K
                  </p>
                </div>
              </div>
            </div>

            {/* Trades list */}
            <div className="p-4 border-b border-neutral-800 space-y-2">
              {selectedDayData.trades.map((trade) => (
                <button
                  key={trade.id}
                  onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                  className={cn(
                    "w-full flex items-center justify-between py-3 px-4 border transition-all text-left rounded-md",
                    selectedTrade?.id === trade.id
                      ? "border-white bg-neutral-900"
                      : "border-neutral-800 bg-neutral-950 hover:border-neutral-600"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-neutral-600 font-mono text-sm">#{trade.trade_number}</span>
                    <span className={cn(
                      "text-xs font-mono uppercase px-2 py-0.5",
                      trade.direction === "Long" 
                        ? "text-emerald-400 bg-emerald-500/10" 
                        : "text-red-400 bg-red-500/10"
                    )}>
                      {trade.direction}
                    </span>
                    <span className="text-xs text-neutral-500">{trade.entry_time}</span>
                  </div>
                  <span className={cn(
                    "font-mono font-bold",
                    (trade.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    +{trade.rr?.toFixed(2)} RR
                  </span>
                </button>
              ))}
            </div>

            {/* Selected trade details with graphs */}
            {selectedTrade && (
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {(() => {
                  const context = getTradeContext(selectedTrade);
                  return (
                    <>
                      {/* Trade header */}
                      <div className="flex items-center gap-4 p-4 border border-neutral-800 bg-neutral-950 rounded-md">
                        <div className={cn(
                          "w-12 h-12 flex items-center justify-center border rounded-md",
                          selectedTrade.direction === "Long" 
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-red-500/50 bg-red-500/10"
                        )}>
                          {selectedTrade.direction === "Long" 
                            ? <TrendingUp className="w-6 h-6 text-emerald-400" />
                            : <TrendingDown className="w-6 h-6 text-red-400" />
                          }
                        </div>
                        <div className="flex-1">
                          <p className="text-xl font-bold text-white">
                            Trade #{selectedTrade.trade_number}
                          </p>
                          <p className="text-sm text-neutral-500">
                            {selectedTrade.setup_type || "Setup standard"} • {selectedTrade.entry_model || "Model standard"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-400">+{selectedTrade.rr?.toFixed(2)} RR</p>
                          <p className="text-sm text-neutral-500">≈ +{((selectedTrade.rr || 0) * 1000).toLocaleString("fr-FR")} €</p>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-md">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-neutral-500" />
                            <span className="text-xs text-neutral-600 font-mono uppercase">Entrée</span>
                          </div>
                          <p className="text-lg font-bold text-white">{selectedTrade.entry_time || "—"}</p>
                        </div>
                        <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-md">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-neutral-500" />
                            <span className="text-xs text-neutral-600 font-mono uppercase">Sortie</span>
                          </div>
                          <p className="text-lg font-bold text-white">{selectedTrade.exit_time || "—"}</p>
                        </div>
                        <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-md">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-neutral-500" />
                            <span className="text-xs text-neutral-600 font-mono uppercase">Durée</span>
                          </div>
                          <p className="text-lg font-bold text-white">{selectedTrade.trade_duration || "—"}</p>
                        </div>
                        <div className="border border-neutral-800 p-3 bg-neutral-950 rounded-md">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-neutral-500" />
                            <span className="text-xs text-neutral-600 font-mono uppercase">News</span>
                          </div>
                          <p className="text-lg font-bold text-white">
                            {selectedTrade.news_day ? (selectedTrade.news_label || "Oui") : "Non"}
                          </p>
                        </div>
                      </div>

                      {/* RR charts - improved with bar chart and isolated cumul */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Bar chart - individual RR per trade */}
                        <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-md">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-mono uppercase tracking-wider text-neutral-500">
                              RR par Trade (10 derniers)
                            </h4>
                          </div>
                          <div className="h-36">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={context.chartData}>
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
                                    borderRadius: 4,
                                  }}
                                  labelStyle={{ color: "#a3a3a3" }}
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
                                      fill={entry.current ? "#ffffff" : entry.individual >= 0 ? "#22c55e" : "#ef4444"} 
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Cumulative RR chart - ISOLATED */}
                        <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-md">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-mono uppercase tracking-wider text-neutral-500">
                              Cumul Isolé (10 trades)
                            </h4>
                            <span className="text-base font-bold text-emerald-400">
                              +{context.isolatedTotal.toFixed(2)} RR
                            </span>
                          </div>
                          <div className="h-36">
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
                                    borderRadius: 4,
                                  }}
                                  labelStyle={{ color: "#a3a3a3" }}
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

                      {/* Trade details */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-md">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-600 mb-3">
                            Paramètres d'entrée
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-neutral-500">Entry Timing</span>
                              <span className="text-sm text-white">{selectedTrade.entry_timing || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-neutral-500">Stop Loss</span>
                              <span className="text-sm text-white">{selectedTrade.stop_loss_size || "—"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-neutral-500">Setup Type</span>
                              <span className="text-sm text-white">{selectedTrade.setup_type || "—"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-md">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-600 mb-3">
                            Position dans la série
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-neutral-500">Trade #</span>
                              <span className="text-sm text-white">{context.tradeIndex + 1} / {trades.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-neutral-500">RR avant ce trade</span>
                              <span className="text-sm text-white">+{(context.cumulativeRR - (selectedTrade.rr || 0)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-neutral-500">RR après ce trade</span>
                              <span className="text-sm text-emerald-400">+{context.cumulativeRR.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Screenshot placeholder */}
                      <div className="border border-dashed border-neutral-700 p-8 bg-neutral-950 text-center rounded-md">
                        <Image className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                        <p className="text-sm text-neutral-600">Screenshot du trade</p>
                        <p className="text-xs text-neutral-700 mt-1">À venir</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Placeholder when no trade selected */}
            {!selectedTrade && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-neutral-600 font-mono">
                  Cliquez sur un trade pour voir les détails
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600">
            <p className="text-sm font-mono">Sélectionnez un jour pour voir les détails</p>
          </div>
        )}
      </div>
    </div>
  );
};
