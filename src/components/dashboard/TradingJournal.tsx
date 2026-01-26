import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  rr: number;
  entry_time: string;
  setup_type: string;
}

interface TradingJournalProps {
  trades: Trade[];
}

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export const TradingJournal = ({ trades }: TradingJournalProps) => {
  // Find the last trade date to set initial month
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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get trades grouped by date
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

  // Generate calendar days
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

  const formatDateKey = (date: Date) => date.toISOString().split("T")[0];

  const getDayData = (date: Date) => {
    const dateKey = formatDateKey(date);
    const dayTrades = tradesByDate.get(dateKey) || [];
    const totalRR = dayTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
    return { trades: dayTrades, totalRR };
  };

  const selectedDayData = selectedDate ? getDayData(selectedDate) : null;

  return (
    <div className="h-full flex">
      {/* Calendar - Compact */}
      <div className="w-[480px] border-r border-neutral-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <span className="text-sm font-mono uppercase tracking-wider text-neutral-400">
            Journal
          </span>
          <div className="flex items-center gap-2">
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevMonth}
            className="w-8 h-8 text-neutral-500 hover:text-white hover:bg-neutral-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium capitalize">{formatMonthYear(currentDate)}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="w-8 h-8 text-neutral-500 hover:text-white hover:bg-neutral-800"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 p-3 overflow-auto">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((day) => (
              <div key={day} className="py-1 text-center text-[10px] font-mono uppercase text-neutral-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells - Compact */}
          <div className="grid grid-cols-7 gap-0.5">
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
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "aspect-square border transition-all text-xs",
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
                    "text-[11px] font-medium",
                    hasTrades ? "text-white" : "text-neutral-600"
                  )}>
                    {date.getDate()}
                  </span>
                  {hasTrades && (
                    <span className={cn(
                      "text-[9px] font-mono",
                      totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      +{totalRR.toFixed(0)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-neutral-800">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-emerald-500/30" />
              <span className="text-[10px] text-neutral-500">Profit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-red-500/30" />
              <span className="text-[10px] text-neutral-500">Loss</span>
            </div>
          </div>
        </div>
      </div>

      {/* Details panel */}
      <div className="flex-1 flex flex-col">
        {selectedDayData && selectedDayData.trades.length > 0 ? (
          <>
            {/* Day header */}
            <div className="p-4 border-b border-neutral-800 bg-emerald-500/10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono uppercase tracking-wider text-neutral-400">
                  {selectedDate?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                <span className={cn(
                  "text-2xl font-bold",
                  selectedDayData.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  +{selectedDayData.totalRR.toFixed(2)} RR
                </span>
              </div>
            </div>

            {/* Trades list */}
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {selectedDayData.trades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between py-3 px-4 bg-neutral-900 border border-neutral-800"
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
                    <span className="text-xs text-neutral-600">{trade.setup_type}</span>
                  </div>
                  <span className={cn(
                    "font-mono font-bold",
                    (trade.rr || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    +{trade.rr?.toFixed(2)} RR
                  </span>
                </div>
              ))}
            </div>

            {/* Capital simulation */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
                  Capital 100K (1% risque)
                </p>
                <p className="text-xl font-bold text-white">
                  +{(selectedDayData.totalRR * 1000).toLocaleString("fr-FR")} €
                </p>
              </div>
            </div>
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
