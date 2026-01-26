import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

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
  onNavigateToDatabase?: (filters: { day_of_week?: string[]; quarter?: string[]; year?: string[]; hour?: string; week?: string }) => void;
}

const DAYS_ORDER = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export const TimingAnalysis = ({ trades, onNavigateToDatabase }: TimingAnalysisProps) => {

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

    // Cumulative year data for line chart
    let cumulativeYearRR = 0;
    const yearCumulativeData = yearData.map(y => {
      cumulativeYearRR += y.rr;
      return {
        year: y.year,
        cumulative: parseFloat(cumulativeYearRR.toFixed(2)),
        rr: y.rr,
        trades: y.trades,
      };
    });

    // Best day and hour
    const bestDay = dayData.reduce((best, curr) => 
      curr.rr > best.rr ? curr : best, dayData[0]);
    const worstDay = dayData.reduce((worst, curr) => 
      curr.rr < worst.rr ? curr : worst, dayData[0]);
    const bestHour = hourData.length > 0 
      ? hourData.reduce((best, curr) => curr.rr > best.rr ? curr : best, hourData[0])
      : { hour: "N/A", rr: 0 };

    return { dayData, hourData, weekData, monthData, quarterData, yearData, yearCumulativeData, bestDay, worstDay, bestHour };
  }, [trades]);

  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);

  const handleDayClick = (day: string) => {
    onNavigateToDatabase?.({ day_of_week: [day] });
  };

  const handleHourClick = (hour: string) => {
    onNavigateToDatabase?.({ hour });
  };

  const handleWeekClick = (week: string) => {
    onNavigateToDatabase?.({ week });
  };

  const handleQuarterClick = (quarter: string) => {
    onNavigateToDatabase?.({ quarter: [quarter] });
  };

  const handleYearClick = (year: string) => {
    onNavigateToDatabase?.({ year: [year] });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground mb-1">Timing Analysis</h2>
        <p className="text-sm text-muted-foreground font-mono">Performance par période • Cliquez sur un élément pour voir les trades</p>
      </div>

      <div className="flex-1 p-6 overflow-auto scrollbar-hide space-y-8">
        
        {/* ===== SECTION 1: BAR CHARTS ===== */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
            Graphiques en Barres
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {/* Day bar chart */}
            <div className="border border-border p-5 bg-card rounded-md">
              <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Performance par Jour</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dayData} barSize={16}>
                    <XAxis 
                      dataKey="day" 
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
                        borderRadius: 8,
                        color: "var(--chart-tooltip-text)",
                      }}
                      itemStyle={{ color: "var(--chart-tooltip-text)" }}
                      labelStyle={{ color: "var(--chart-tooltip-text)" }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toFixed(2)} RR (${props.payload.trades} trades)`,
                        props.payload.fullDay
                      ]}
                    />
                    <Bar dataKey="rr" radius={[4, 4, 0, 0]}>
                      {stats.dayData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.rr >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Hour bar chart */}
            <div className="border border-border p-5 bg-card rounded-md">
              <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Performance par Heure</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.hourData} barSize={12}>
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
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
                        borderRadius: 8,
                        color: "var(--chart-tooltip-text)",
                      }}
                      itemStyle={{ color: "var(--chart-tooltip-text)" }}
                      labelStyle={{ color: "var(--chart-tooltip-text)" }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toFixed(2)} RR (${props.payload.trades} trades)`,
                        props.payload.hour
                      ]}
                    />
                    <Bar dataKey="rr" radius={[3, 3, 0, 0]}>
                      {stats.hourData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.rr >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Year bar chart */}
            <div className="border border-border p-5 bg-card rounded-md">
              <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Performance par Année</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.yearData} barSize={20}>
                    <XAxis 
                      dataKey="year" 
                      tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
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
                        borderRadius: 8,
                        color: "var(--chart-tooltip-text)",
                      }}
                      itemStyle={{ color: "var(--chart-tooltip-text)" }}
                      labelStyle={{ color: "var(--chart-tooltip-text)" }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toFixed(2)} RR (${props.payload.trades} trades)`,
                        props.payload.year
                      ]}
                    />
                    <Bar dataKey="rr" radius={[4, 4, 0, 0]}>
                      {stats.yearData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.rr >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ===== SECTION 2: LINE & AREA CHARTS ===== */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
            Graphiques en Courbes
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {/* Week area chart */}
            <div className="border border-border p-5 bg-card rounded-md">
              <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Performance Hebdomadaire (12 dernières)</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.weekData}>
                    <defs>
                      <linearGradient id="colorWeek" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="label" 
                      tick={{ fill: "var(--chart-axis)", fontSize: 8 }}
                      axisLine={{ stroke: "var(--chart-axis-line)" }}
                      tickLine={false}
                      interval="preserveStartEnd"
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
                        borderRadius: 8,
                        color: "var(--chart-tooltip-text)",
                      }}
                      itemStyle={{ color: "var(--chart-tooltip-text)" }}
                      labelStyle={{ color: "var(--chart-tooltip-text)" }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toFixed(2)} RR (${props.payload.trades} trades)`,
                        props.payload.label
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="rr" 
                      stroke="#22c55e" 
                      fillOpacity={1}
                      fill="url(#colorWeek)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Month area chart */}
            <div className="border border-border p-5 bg-card rounded-md">
              <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Performance Mensuelle</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.monthData}>
                    <defs>
                      <linearGradient id="colorMonth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="label" 
                      tick={{ fill: "var(--chart-axis)", fontSize: 8 }}
                      axisLine={{ stroke: "var(--chart-axis-line)" }}
                      tickLine={false}
                      interval="preserveStartEnd"
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
                        borderRadius: 8,
                        color: "var(--chart-tooltip-text)",
                      }}
                      itemStyle={{ color: "var(--chart-tooltip-text)" }}
                      labelStyle={{ color: "var(--chart-tooltip-text)" }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value.toFixed(2)} RR (${props.payload.trades} trades)`,
                        props.payload.label
                      ]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="rr" 
                      stroke="#a855f7" 
                      fillOpacity={1}
                      fill="url(#colorMonth)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Year cumulative line chart */}
            <div className="border border-border p-5 bg-card rounded-md">
              <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Évolution Cumulative</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.yearCumulativeData}>
                    <XAxis 
                      dataKey="year" 
                      tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
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
                        borderRadius: 8,
                        color: "var(--chart-tooltip-text)",
                      }}
                      itemStyle={{ color: "var(--chart-tooltip-text)" }}
                      labelStyle={{ color: "var(--chart-tooltip-text)" }}
                      formatter={(value: number) => [
                        `${value.toFixed(2)} RR`,
                        "Cumul"
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={{ fill: "#22c55e", strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: "var(--chart-bar)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ===== SECTION 3: CLICKABLE CARDS ===== */}
        <div>
          <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-2">
            Détails par Période (cliquez pour filtrer)
          </h3>
          
          {/* Day cards */}
          <div className="mb-6">
            <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Par Jour</p>
            <div className="grid grid-cols-5 gap-3">
              {stats.dayData.map((day) => (
                <button 
                  key={day.fullDay} 
                  onClick={() => handleDayClick(day.fullDay)}
                  className={cn(
                    "p-4 border rounded-md text-left transition-all group",
                    day.rr > 0 
                      ? "bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-400" 
                      : day.rr < 0 
                      ? "bg-red-500/20 border-red-500/30 hover:border-red-400"
                      : "bg-muted border-border hover:border-muted-foreground/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-mono uppercase text-muted-foreground mb-2">{day.fullDay}</p>
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {day.rr > 0 ? "+" : ""}{day.rr.toFixed(2)} RR
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{day.trades} trades</p>
                  <p className="text-xs text-emerald-500/80">≈ {day.euros >= 0 ? "+" : ""}{day.euros.toLocaleString("fr-FR")} €</p>
                </button>
              ))}
            </div>
          </div>

          {/* Hour cards - clickable */}
          <div className="mb-6">
            <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Par Heure</p>
            <div className="grid grid-cols-8 gap-2">
              {stats.hourData.map((hour) => (
                <button 
                  key={hour.hourKey}
                  onClick={() => handleHourClick(hour.hourKey)}
                  className={cn(
                    "p-3 border rounded-md text-left transition-all group",
                    hour.rr > 0 
                      ? "bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-400" 
                      : hour.rr < 0 
                      ? "bg-red-500/20 border-red-500/30 hover:border-red-400"
                      : "bg-muted border-border hover:border-muted-foreground/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono uppercase text-muted-foreground mb-1">{hour.hour}</p>
                    <ExternalLink className="w-2 h-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-base font-bold text-foreground">
                    {hour.rr > 0 ? "+" : ""}{hour.rr.toFixed(1)} RR
                  </p>
                  <p className="text-[10px] text-muted-foreground">{hour.trades} trades</p>
                </button>
              ))}
            </div>
          </div>

          {/* Week cards - clickable */}
          <div className="mb-6">
            <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Par Semaine (8 dernières)</p>
            <div className="grid grid-cols-8 gap-2">
              {stats.weekData.slice(-8).map((week) => (
                <button 
                  key={week.week}
                  onClick={() => handleWeekClick(week.week)}
                  className={cn(
                    "p-3 border rounded-md text-left transition-all group",
                    week.rr > 0 
                      ? "bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-400" 
                      : week.rr < 0 
                      ? "bg-red-500/20 border-red-500/30 hover:border-red-400"
                      : "bg-muted border-border hover:border-muted-foreground/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">{week.label}</p>
                    <ExternalLink className="w-2 h-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {week.rr > 0 ? "+" : ""}{week.rr.toFixed(1)} RR
                  </p>
                  <p className="text-[10px] text-muted-foreground">{week.trades} trades</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quarter cards - clickable */}
          <div className="mb-6">
            <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Par Trimestre</p>
            <div className="grid grid-cols-8 gap-2">
              {stats.quarterData.map((quarter) => (
                <button 
                  key={quarter.quarter}
                  onClick={() => handleQuarterClick(quarter.label)}
                  className={cn(
                    "p-3 border rounded-md text-left transition-all group",
                    quarter.rr > 0 
                      ? "bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-400" 
                      : quarter.rr < 0 
                      ? "bg-red-500/20 border-red-500/30 hover:border-red-400"
                      : "bg-muted border-border hover:border-muted-foreground/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono uppercase text-muted-foreground mb-1">{quarter.label}</p>
                    <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {quarter.rr > 0 ? "+" : ""}{quarter.rr.toFixed(1)} RR
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">{quarter.trades} trades</p>
                  <p className="text-[10px] text-emerald-500/80">≈ {quarter.euros >= 0 ? "+" : ""}{quarter.euros.toLocaleString("fr-FR")} €</p>
                </button>
              ))}
            </div>
          </div>

          {/* Year cards - clickable */}
          <div>
            <p className="text-xs text-muted-foreground font-mono uppercase mb-3">Par Année</p>
            <div className="grid grid-cols-4 gap-3">
              {stats.yearData.map((year) => (
                <button 
                  key={year.year}
                  onClick={() => handleYearClick(year.year)}
                  className={cn(
                    "p-4 border rounded-md text-left transition-all group",
                    year.rr > 0 
                      ? "bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-400" 
                      : year.rr < 0 
                      ? "bg-red-500/20 border-red-500/30 hover:border-red-400"
                      : "bg-muted border-border hover:border-muted-foreground/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-mono uppercase text-muted-foreground mb-2">{year.year}</p>
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-xl font-bold text-foreground">
                    {year.rr > 0 ? "+" : ""}{year.rr.toFixed(1)} RR
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{year.trades} trades</p>
                  <p className="text-xs text-emerald-500/80">≈ {year.euros >= 0 ? "+" : ""}{year.euros.toLocaleString("fr-FR")} €</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-emerald-500/30 p-4 bg-emerald-500/10 rounded-md">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">
              Total Cumulé
            </p>
            <p className="text-xl font-bold text-emerald-500">+{totalRR.toFixed(1)} RR</p>
            <p className="text-sm text-muted-foreground mt-1">≈ +{(totalRR * 1000).toLocaleString("fr-FR")} €</p>
          </div>
          <div className="border border-emerald-500/30 p-4 bg-emerald-500/10 rounded-md">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">
              Meilleur Jour
            </p>
            <p className="text-lg font-bold text-foreground">{stats.bestDay?.fullDay || "N/A"}</p>
            <p className="text-sm text-emerald-500 font-mono">+{stats.bestDay?.rr || 0} RR</p>
          </div>
          <div className="border border-red-500/30 p-4 bg-red-500/10 rounded-md">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">
              Pire Jour
            </p>
            <p className="text-lg font-bold text-foreground">{stats.worstDay?.fullDay || "N/A"}</p>
            <p className="text-sm text-red-500 font-mono">{stats.worstDay?.rr || 0} RR</p>
          </div>
          <div className="border border-border p-4 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">
              Meilleure Heure
            </p>
            <p className="text-lg font-bold text-foreground">{stats.bestHour?.hour || "N/A"}</p>
            <p className="text-sm text-muted-foreground font-mono">+{stats.bestHour?.rr || 0} RR</p>
          </div>
        </div>
      </div>
    </div>
  );
};
