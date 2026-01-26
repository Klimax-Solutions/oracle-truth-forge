import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

interface Trade {
  id: string;
  day_of_week: string;
  entry_time: string;
  rr: number;
  direction: string;
}

interface TimingAnalysisProps {
  trades: Trade[];
}

const DAYS_ORDER = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export const TimingAnalysis = ({ trades }: TimingAnalysisProps) => {
  const stats = useMemo(() => {
    // By day of week
    const byDay: Record<string, { trades: number; totalRR: number }> = {};
    DAYS_ORDER.forEach((day) => {
      byDay[day] = { trades: 0, totalRR: 0 };
    });

    // By hour
    const byHour: Record<string, { trades: number; totalRR: number }> = {};

    trades.forEach((t) => {
      // Day
      if (byDay[t.day_of_week]) {
        byDay[t.day_of_week].trades++;
        byDay[t.day_of_week].totalRR += t.rr || 0;
      }

      // Hour
      if (t.entry_time) {
        const hour = t.entry_time.split(":")[0];
        if (!byHour[hour]) {
          byHour[hour] = { trades: 0, totalRR: 0 };
        }
        byHour[hour].trades++;
        byHour[hour].totalRR += t.rr || 0;
      }
    });

    const dayData = DAYS_ORDER.map((day) => ({
      day: day.substring(0, 3),
      fullDay: day,
      trades: byDay[day].trades,
      rr: parseFloat(byDay[day].totalRR.toFixed(2)),
      avgRR: byDay[day].trades > 0 
        ? parseFloat((byDay[day].totalRR / byDay[day].trades).toFixed(2)) 
        : 0,
    }));

    const hourData = Object.entries(byHour)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([hour, data]) => ({
        hour: `${hour}h`,
        trades: data.trades,
        rr: parseFloat(data.totalRR.toFixed(2)),
        avgRR: data.trades > 0 ? parseFloat((data.totalRR / data.trades).toFixed(2)) : 0,
      }));

    // Best day and hour
    const bestDay = dayData.reduce((best, curr) => 
      curr.rr > best.rr ? curr : best, dayData[0]);
    const worstDay = dayData.reduce((worst, curr) => 
      curr.rr < worst.rr ? curr : worst, dayData[0]);
    const bestHour = hourData.length > 0 
      ? hourData.reduce((best, curr) => curr.rr > best.rr ? curr : best, hourData[0])
      : { hour: "N/A", rr: 0 };

    return { dayData, hourData, bestDay, worstDay, bestHour };
  }, [trades]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-1">Timing Analysis</h2>
        <p className="text-sm text-neutral-500 font-mono">Performance par jour et heure d'entrée</p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Day cards - Redesigned with colored backgrounds */}
        <div className="mb-8">
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            Performance par Jour
          </h3>
          <div className="grid grid-cols-5 gap-3">
            {stats.dayData.map((day) => (
              <div 
                key={day.fullDay} 
                className={cn(
                  "p-4 border transition-all",
                  day.rr > 0 
                    ? "bg-emerald-500/20 border-emerald-500/30" 
                    : day.rr < 0 
                    ? "bg-red-500/20 border-red-500/30"
                    : "bg-neutral-900 border-neutral-800"
                )}
              >
                <p className="text-sm font-mono uppercase text-neutral-400 mb-2">{day.fullDay}</p>
                <p className={cn(
                  "text-2xl font-bold",
                  day.rr > 0 ? "text-emerald-400" : day.rr < 0 ? "text-red-400" : "text-white"
                )}>
                  {day.rr > 0 ? "+" : ""}{day.rr.toFixed(2)}
                </p>
                <p className="text-xs text-neutral-500 mt-1">RR Total</p>
                <div className="mt-3 pt-3 border-t border-neutral-700/50">
                  <p className="text-xs text-neutral-400">{day.trades} trades</p>
                  <p className="text-xs text-neutral-500">moy. {day.avgRR.toFixed(1)}R</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border border-emerald-500/30 p-4 bg-emerald-500/10">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-1">
              Meilleur Jour
            </p>
            <p className="text-xl font-bold text-white">{stats.bestDay?.fullDay || "N/A"}</p>
            <p className="text-sm text-emerald-400 font-mono">+{stats.bestDay?.rr || 0} RR</p>
          </div>
          <div className="border border-red-500/30 p-4 bg-red-500/10">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-1">
              Pire Jour
            </p>
            <p className="text-xl font-bold text-white">{stats.worstDay?.fullDay || "N/A"}</p>
            <p className="text-sm text-red-400 font-mono">{stats.worstDay?.rr || 0} RR</p>
          </div>
          <div className="border border-neutral-700 p-4 bg-neutral-900">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-1">
              Meilleure Heure
            </p>
            <p className="text-xl font-bold text-white">{stats.bestHour?.hour || "N/A"}</p>
            <p className="text-sm text-neutral-400 font-mono">+{stats.bestHour?.rr || 0} RR</p>
          </div>
        </div>

        {/* By hour chart - Improved visibility */}
        <div className="border border-neutral-800 p-6 bg-neutral-900">
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            Performance par Heure
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.hourData}>
                <XAxis 
                  dataKey="hour" 
                  tick={{ fill: "#a3a3a3", fontSize: 11 }}
                  axisLine={{ stroke: "#404040" }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: "#737373", fontSize: 10 }}
                  axisLine={{ stroke: "#404040" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#171717",
                    border: "1px solid #404040",
                    borderRadius: 0,
                  }}
                  labelStyle={{ color: "#e5e5e5" }}
                  formatter={(value: number) => [`${value.toFixed(2)} RR`, "Total"]}
                />
                <Bar dataKey="rr" radius={0}>
                  {stats.hourData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.rr >= 0 ? "#22c55e" : "#ef4444"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
