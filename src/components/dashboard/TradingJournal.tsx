import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [currentDate, setCurrentDate] = useState(new Date());
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

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, [year, month]);

  // Get weeks for tabs
  const weeks = useMemo(() => {
    const result: { start: number; end: number; label: string }[] = [];
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    let weekStart = 1;
    let weekNum = 1;
    
    while (weekStart <= lastDay) {
      const weekEnd = Math.min(weekStart + 6, lastDay);
      result.push({
        start: weekStart,
        end: weekEnd,
        label: `Week ${weekNum}`,
      });
      weekStart = weekEnd + 1;
      weekNum++;
    }
    
    return result;
  }, [year, month]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  };

  const formatDateKey = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const getDayData = (date: Date) => {
    const dateKey = formatDateKey(date);
    const dayTrades = tradesByDate.get(dateKey) || [];
    const totalRR = dayTrades.reduce((sum, t) => sum + (t.rr || 0), 0);
    return { trades: dayTrades, totalRR };
  };

  const selectedDayData = selectedDate ? getDayData(selectedDate) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-neutral-700 flex items-center justify-center">
            <span className="text-xs">📅</span>
          </div>
          <span className="text-sm font-mono uppercase tracking-wider text-neutral-400">
            Daily Summary
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevMonth}
            className="text-neutral-500 hover:text-white hover:bg-neutral-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-[120px] text-center">
            {formatMonthYear(currentDate)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="text-neutral-500 hover:text-white hover:bg-neutral-800"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Week tabs */}
      <div className="flex gap-2 p-4 border-b border-neutral-800 overflow-x-auto">
        {weeks.map((week, idx) => (
          <button
            key={idx}
            className="px-4 py-2 text-xs font-mono uppercase tracking-wider border border-neutral-700 text-neutral-500 hover:text-white hover:border-neutral-500 transition-all whitespace-nowrap"
          >
            <div>{week.label}</div>
            <div className="text-neutral-600">
              {new Date(year, month, week.start).toLocaleDateString("fr-FR", { month: "short", day: "numeric" })}
              {" - "}
              {new Date(year, month, week.end).toLocaleDateString("fr-FR", { month: "short", day: "numeric" })}
            </div>
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 p-4 overflow-auto">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-mono uppercase tracking-wider text-neutral-600"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, idx) => {
            if (!date) {
              return <div key={idx} className="aspect-square bg-neutral-950" />;
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
                  "aspect-square border transition-all relative group",
                  "flex flex-col items-start justify-start p-2",
                  isSelected
                    ? "border-white bg-neutral-900"
                    : hasProfit
                    ? "border-neutral-800 bg-emerald-500/10"
                    : hasLoss
                    ? "border-neutral-800 bg-red-500/10"
                    : "border-neutral-800 bg-neutral-950 hover:border-neutral-600"
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
                    "text-xs font-mono mt-1",
                    totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                  )}>
                    {totalRR >= 0 ? "+" : ""}{totalRR.toFixed(1)}R
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500/30 border border-emerald-500/50" />
            <span className="text-xs text-neutral-500 font-mono">Profit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500/30 border border-red-500/50" />
            <span className="text-xs text-neutral-500 font-mono">Loss</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-neutral-900 border border-neutral-700" />
            <span className="text-xs text-neutral-500 font-mono">No trades</span>
          </div>
        </div>
      </div>

      {/* Selected day details */}
      {selectedDayData && selectedDayData.trades.length > 0 && (
        <div className="border-t border-neutral-800 p-4 bg-neutral-950">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-mono uppercase tracking-wider text-neutral-500">
              {selectedDate?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <span className={cn(
              "text-lg font-bold",
              selectedDayData.totalRR >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              {selectedDayData.totalRR >= 0 ? "+" : ""}{selectedDayData.totalRR.toFixed(2)} RR
            </span>
          </div>
          <div className="space-y-2">
            {selectedDayData.trades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between py-2 px-3 bg-neutral-900 border border-neutral-800"
              >
                <div className="flex items-center gap-4">
                  <span className="text-neutral-600 font-mono">#{trade.trade_number}</span>
                  <span className={cn(
                    "text-xs font-mono uppercase",
                    trade.direction === "Long" ? "text-emerald-500" : "text-red-500"
                  )}>
                    {trade.direction}
                  </span>
                  <span className="text-xs text-neutral-500">{trade.entry_time}</span>
                </div>
                <span className={cn(
                  "font-mono",
                  (trade.rr || 0) >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  +{trade.rr?.toFixed(2)} RR
                </span>
              </div>
            ))}
          </div>
          {/* Simulation 100K */}
          <div className="mt-4 p-3 bg-neutral-900 border border-neutral-700">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-1">
              Sur un capital de 100K (1% risque)
            </p>
            <p className="text-xl font-bold text-white">
              {selectedDayData.totalRR >= 0 ? "+" : ""}
              {(selectedDayData.totalRR * 1000).toLocaleString("fr-FR")} €
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
