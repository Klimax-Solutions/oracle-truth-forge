import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";
import { cn } from "@/lib/utils";

interface Trade {
  id: string;
  day_of_week: string;
  entry_time: string;
  trade_date: string;
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

    // By week (ISO week)
    const byWeek: Record<string, { trades: number; totalRR: number; label: string }> = {};

    // By month
    const byMonth: Record<string, { trades: number; totalRR: number; label: string }> = {};

    // By quarter
    const byQuarter: Record<string, { trades: number; totalRR: number; label: string }> = {};

    // By year
    const byYear: Record<string, { trades: number; totalRR: number }> = {};

    trades.forEach((t) => {
      const date = new Date(t.trade_date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const quarter = Math.floor(month / 3) + 1;
      
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

      // Week (simplified - just use week number)
      const startOfYear = new Date(year, 0, 1);
      const weekNum = Math.ceil((((date.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
      const weekKey = `${year}-W${weekNum.toString().padStart(2, "0")}`;
      if (!byWeek[weekKey]) {
        byWeek[weekKey] = { trades: 0, totalRR: 0, label: `S${weekNum} ${year}` };
      }
      byWeek[weekKey].trades++;
      byWeek[weekKey].totalRR += t.rr || 0;

      // Month
      const monthKey = `${year}-${month.toString().padStart(2, "0")}`;
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { trades: 0, totalRR: 0, label: `${monthNames[month]} ${year}` };
      }
      byMonth[monthKey].trades++;
      byMonth[monthKey].totalRR += t.rr || 0;

      // Quarter
      const quarterKey = `${year}-Q${quarter}`;
      if (!byQuarter[quarterKey]) {
        byQuarter[quarterKey] = { trades: 0, totalRR: 0, label: `Q${quarter} ${year}` };
      }
      byQuarter[quarterKey].trades++;
      byQuarter[quarterKey].totalRR += t.rr || 0;

      // Year
      const yearKey = year.toString();
      if (!byYear[yearKey]) {
        byYear[yearKey] = { trades: 0, totalRR: 0 };
      }
      byYear[yearKey].trades++;
      byYear[yearKey].totalRR += t.rr || 0;
    });

    const dayData = DAYS_ORDER.map((day) => ({
      day: day.substring(0, 3),
      fullDay: day,
      trades: byDay[day].trades,
      rr: parseFloat(byDay[day].totalRR.toFixed(2)),
      avgRR: byDay[day].trades > 0 
        ? parseFloat((byDay[day].totalRR / byDay[day].trades).toFixed(2)) 
        : 0,
      euros: byDay[day].totalRR * 1000,
    }));

    const hourData = Object.entries(byHour)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([hour, data]) => ({
        hour: `${hour}h`,
        hourKey: hour,
        trades: data.trades,
        rr: parseFloat(data.totalRR.toFixed(2)),
        avgRR: data.trades > 0 ? parseFloat((data.totalRR / data.trades).toFixed(2)) : 0,
        euros: data.totalRR * 1000,
      }));

    const weekData = Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 weeks
      .map(([key, data]) => ({
        week: key,
        label: data.label,
        trades: data.trades,
        rr: parseFloat(data.totalRR.toFixed(2)),
        euros: data.totalRR * 1000,
      }));

    const monthData = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        month: key,
        label: data.label,
        trades: data.trades,
        rr: parseFloat(data.totalRR.toFixed(2)),
        euros: data.totalRR * 1000,
      }));

    const quarterData = Object.entries(byQuarter)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        quarter: key,
        label: data.label,
        trades: data.trades,
        rr: parseFloat(data.totalRR.toFixed(2)),
        euros: data.totalRR * 1000,
      }));

    const yearData = Object.entries(byYear)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, data]) => ({
        year,
        trades: data.trades,
        rr: parseFloat(data.totalRR.toFixed(2)),
        euros: data.totalRR * 1000,
      }));

    // Best day and hour
    const bestDay = dayData.reduce((best, curr) => 
      curr.rr > best.rr ? curr : best, dayData[0]);
    const worstDay = dayData.reduce((worst, curr) => 
      curr.rr < worst.rr ? curr : worst, dayData[0]);
    const bestHour = hourData.length > 0 
      ? hourData.reduce((best, curr) => curr.rr > best.rr ? curr : best, hourData[0])
      : { hour: "N/A", rr: 0 };

    return { dayData, hourData, weekData, monthData, quarterData, yearData, bestDay, worstDay, bestHour };
  }, [trades]);

  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-1">Timing Analysis</h2>
        <p className="text-sm text-neutral-500 font-mono">Performance par période et heure d'entrée</p>
      </div>

      <div className="flex-1 p-6 overflow-auto space-y-8">
        {/* Day cards */}
        <div>
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            Performance par Jour
          </h3>
          <div className="grid grid-cols-5 gap-3">
            {stats.dayData.map((day) => (
              <div 
                key={day.fullDay} 
                className={cn(
                  "p-4 border transition-all rounded-sm",
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
                  <p className="text-xs text-neutral-500">≈ {day.euros >= 0 ? "+" : ""}{day.euros.toLocaleString("fr-FR")} €</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hour cards - same green style, no hover background change */}
        <div>
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            Performance par Heure
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {stats.hourData.map((hour) => (
              <div 
                key={hour.hourKey}
                className={cn(
                  "p-3 border transition-colors cursor-pointer rounded-sm group",
                  hour.rr > 0 
                    ? "bg-emerald-500/20 border-emerald-500/30" 
                    : hour.rr < 0 
                    ? "bg-red-500/20 border-red-500/30"
                    : "bg-neutral-900 border-neutral-800"
                )}
              >
                <p className="text-xs font-mono uppercase text-neutral-400 mb-1">{hour.hour}</p>
                <p className="text-lg font-bold text-white">
                  {hour.rr > 0 ? "+" : ""}{hour.rr.toFixed(1)}
                </p>
                <p className="text-[10px] text-neutral-500">{hour.trades} trades</p>
              </div>
            ))}
          </div>
        </div>

        {/* Week performance - cards like days */}
        <div>
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            Performance par Semaine (12 dernières)
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {stats.weekData.map((week) => (
              <div 
                key={week.week}
                className={cn(
                  "p-3 border transition-colors rounded-sm",
                  week.rr > 0 
                    ? "bg-emerald-500/20 border-emerald-500/30" 
                    : week.rr < 0 
                    ? "bg-red-500/20 border-red-500/30"
                    : "bg-neutral-900 border-neutral-800"
                )}
              >
                <p className="text-[10px] font-mono uppercase text-neutral-400 mb-1">{week.label}</p>
                <p className="text-base font-bold text-white">
                  {week.rr > 0 ? "+" : ""}{week.rr.toFixed(1)}
                </p>
                <p className="text-[10px] text-neutral-500">{week.trades} trades</p>
              </div>
            ))}
          </div>
        </div>

        {/* Month and Quarter row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Month performance */}
          <div>
            <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
              Performance par Mois
            </h3>
            <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-sm">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.monthData}>
                    <defs>
                      <linearGradient id="colorMonth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="label" 
                      tick={{ fill: "#737373", fontSize: 9 }}
                      axisLine={{ stroke: "#404040" }}
                      tickLine={false}
                      interval="preserveStartEnd"
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
                        borderRadius: 2,
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)} RR`, "Total"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="rr" 
                      stroke="#22c55e" 
                      fillOpacity={1}
                      fill="url(#colorMonth)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Quarter performance - cards like days */}
          <div>
            <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
              Performance par Trimestre
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {stats.quarterData.map((quarter) => (
                <div 
                  key={quarter.quarter}
                  className={cn(
                    "p-3 border transition-colors rounded-sm",
                    quarter.rr > 0 
                      ? "bg-emerald-500/20 border-emerald-500/30" 
                      : quarter.rr < 0 
                      ? "bg-red-500/20 border-red-500/30"
                      : "bg-neutral-900 border-neutral-800"
                  )}
                >
                  <p className="text-xs font-mono uppercase text-neutral-400 mb-1">{quarter.label}</p>
                  <p className="text-xl font-bold text-white">
                    {quarter.rr > 0 ? "+" : ""}{quarter.rr.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-1">{quarter.trades} trades</p>
                  <p className="text-[10px] text-emerald-400/80">≈ {quarter.euros >= 0 ? "+" : ""}{quarter.euros.toLocaleString("fr-FR")} €</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Year performance */}
        <div>
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            Performance par Année
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {stats.yearData.map((year) => (
              <div 
                key={year.year}
                className={cn(
                  "p-4 border transition-all rounded-sm",
                  year.rr > 0 
                    ? "bg-emerald-500/20 border-emerald-500/30" 
                    : year.rr < 0 
                    ? "bg-red-500/20 border-red-500/30"
                    : "bg-neutral-900 border-neutral-800"
                )}
              >
                <p className="text-sm font-mono uppercase text-neutral-400 mb-2">{year.year}</p>
                <p className={cn(
                  "text-2xl font-bold",
                  year.rr > 0 ? "text-emerald-400" : year.rr < 0 ? "text-red-400" : "text-white"
                )}>
                  {year.rr > 0 ? "+" : ""}{year.rr.toFixed(1)}
                </p>
                <p className="text-xs text-neutral-500 mt-1">RR Total</p>
                <div className="mt-3 pt-3 border-t border-neutral-700/50">
                  <p className="text-xs text-neutral-400">{year.trades} trades</p>
                  <p className="text-xs text-emerald-400/80">≈ {year.euros >= 0 ? "+" : ""}{year.euros.toLocaleString("fr-FR")} €</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-emerald-500/30 p-4 bg-emerald-500/10 rounded-sm">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-1">
              Total Cumulé
            </p>
            <p className="text-2xl font-bold text-emerald-400">+{totalRR.toFixed(1)} RR</p>
            <p className="text-sm text-neutral-500 mt-1">≈ +{(totalRR * 1000).toLocaleString("fr-FR")} €</p>
          </div>
          <div className="border border-emerald-500/30 p-4 bg-emerald-500/10 rounded-sm">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-1">
              Meilleur Jour
            </p>
            <p className="text-xl font-bold text-white">{stats.bestDay?.fullDay || "N/A"}</p>
            <p className="text-sm text-emerald-400 font-mono">+{stats.bestDay?.rr || 0} RR</p>
          </div>
          <div className="border border-red-500/30 p-4 bg-red-500/10 rounded-sm">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-1">
              Pire Jour
            </p>
            <p className="text-xl font-bold text-white">{stats.worstDay?.fullDay || "N/A"}</p>
            <p className="text-sm text-red-400 font-mono">{stats.worstDay?.rr || 0} RR</p>
          </div>
          <div className="border border-neutral-700 p-4 bg-neutral-900 rounded-sm">
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider mb-1">
              Meilleure Heure
            </p>
            <p className="text-xl font-bold text-white">{stats.bestHour?.hour || "N/A"}</p>
            <p className="text-sm text-neutral-400 font-mono">+{stats.bestHour?.rr || 0} RR</p>
          </div>
        </div>
      </div>
    </div>
  );
};
