import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Calendar, BarChart3, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { TradingJournal } from "./TradingJournal";
import { RRDistributionChart } from "./RRDistributionChart";
import { AnalogClock } from "./AnalogClock";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from "recharts";

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
  screenshot_m15_m5: string | null;
  screenshot_m1: string | null;
}

interface DataAnalysisPageProps {
  trades: Trade[];
  onNavigateToDatabase?: (filters: any) => void;
}

type Section = "journal" | "distribution" | "timing";

const DAYS_ORDER = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export const DataAnalysisPage = ({ trades, onNavigateToDatabase }: DataAnalysisPageProps) => {
  const [isEntering, setIsEntering] = useState(true);
  const [expandedSection, setExpandedSection] = useState<Section | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Timing stats for compact chart
  const timingStats = useMemo(() => {
    const byDay: Record<string, { trades: number; totalRR: number }> = {};
    DAYS_ORDER.forEach(d => { byDay[d] = { trades: 0, totalRR: 0 }; });

    const byHour: Record<string, { trades: number; totalRR: number }> = {};

    trades.forEach(t => {
      if (byDay[t.day_of_week]) {
        byDay[t.day_of_week].trades++;
        byDay[t.day_of_week].totalRR += t.rr || 0;
      }
      if (t.entry_time) {
        const hour = t.entry_time.split(":")[0];
        if (!byHour[hour]) byHour[hour] = { trades: 0, totalRR: 0 };
        byHour[hour].trades++;
        byHour[hour].totalRR += t.rr || 0;
      }
    });

    const dayData = DAYS_ORDER.map(day => ({
      day: day.substring(0, 3),
      fullDay: day,
      rr: parseFloat(byDay[day].totalRR.toFixed(2)),
      trades: byDay[day].trades,
    }));

    const hourData = Object.entries(byHour)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([hour, data]) => ({
        hour: `${hour}h`,
        hourKey: hour,
        rr: parseFloat(data.totalRR.toFixed(2)),
        trades: data.trades,
      }));

    // Timeline data
    const byMonth: Record<string, { trades: number; totalRR: number; label: string }> = {};
    trades.forEach(t => {
      const date = new Date(t.trade_date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
      const key = `${year}-${month.toString().padStart(2, "0")}`;
      if (!byMonth[key]) byMonth[key] = { trades: 0, totalRR: 0, label: `${monthNames[month]} ${year}` };
      byMonth[key].trades++;
      byMonth[key].totalRR += t.rr || 0;
    });

    const timelineData = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => ({
        label: data.label,
        rr: parseFloat(data.totalRR.toFixed(2)),
        trades: data.trades,
      }));

    // Cumulative for timeline
    let cumul = 0;
    const cumulativeTimeline = timelineData.map(d => {
      cumul += d.rr;
      return { ...d, cumulative: parseFloat(cumul.toFixed(2)) };
    });

    const bestDay = dayData.length > 0 ? dayData.reduce((best, curr) => curr.rr > best.rr ? curr : best, dayData[0]) : null;
    const bestHour = hourData.length > 0 ? hourData.reduce((best, curr) => curr.rr > best.rr ? curr : best, hourData[0]) : null;

    return { dayData, hourData, timelineData, cumulativeTimeline, bestDay, bestHour };
  }, [trades]);

  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);
  const winRate = trades.length > 0 ? ((trades.filter(t => (t.rr || 0) > 0).length / trades.length) * 100).toFixed(1) : "0";

  const sections = [
    { id: "journal" as Section, label: "Journal", icon: Calendar, delay: "0ms" },
    { id: "distribution" as Section, label: "Distribution RR", icon: BarChart3, delay: "80ms" },
    { id: "timing" as Section, label: "Timing & Clock", icon: Clock, delay: "160ms" },
  ];

  const handleTimingSelect = (key: string, selectedTrades: Trade[]) => {
    // Could navigate to database with filter
  };

  if (expandedSection === "journal") {
    return (
      <div className="h-full flex flex-col">
        <button
          onClick={() => setExpandedSection(null)}
          className="flex items-center gap-2 p-4 border-b border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
          <span className="font-mono uppercase tracking-wider">Retour à Data Analysis</span>
        </button>
        <div className="flex-1 overflow-hidden">
          <TradingJournal trades={trades} />
        </div>
      </div>
    );
  }

  if (expandedSection === "distribution") {
    return (
      <div className="h-full flex flex-col">
        <button
          onClick={() => setExpandedSection(null)}
          className="flex items-center gap-2 p-4 border-b border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
          <span className="font-mono uppercase tracking-wider">Retour à Data Analysis</span>
        </button>
        <div className="flex-1 overflow-hidden">
          <RRDistributionChart trades={trades} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">Data Analysis</h2>
            <p className="text-xs text-muted-foreground font-mono">
              {trades.length} trades • {totalRR >= 0 ? "+" : ""}{totalRR.toFixed(1)} RR • WR {winRate}%
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 overflow-auto scrollbar-hide">
        {/* Section Cards - Animated entry */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {sections.map((section, idx) => (
            <button
              key={section.id}
              onClick={() => setExpandedSection(section.id)}
              className={cn(
                "data-analysis-card border border-border rounded-md p-5 text-left transition-all group",
                "hover:border-foreground/30 bg-card",
                isEntering && "opacity-0 translate-y-4"
              )}
              style={{
                animationDelay: section.delay,
                animation: isEntering ? "none" : `data-card-deal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${section.delay} forwards`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-md border border-border flex items-center justify-center group-hover:border-foreground/30 transition-colors">
                  <section.icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{section.label}</h3>
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">Cliquer pour ouvrir</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground mx-auto mt-2 group-hover:translate-y-1 transition-transform" />
            </button>
          ))}
        </div>

        {/* Condensed Charts Overview */}
        <div className="space-y-6">
          {/* Row 1: Day performance + Hour performance */}
          <div
            className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", isEntering && "opacity-0")}
            style={{ animation: isEntering ? "none" : "data-card-deal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 240ms forwards" }}
          >
            {/* Day bar chart */}
            <div className="border border-border p-4 md:p-5 bg-card rounded-md chart-glow-container">
              <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-3">
                Performance par Jour
                {timingStats.bestDay && (
                  <span className="text-emerald-500 ml-2">★ {timingStats.bestDay.day}</span>
                )}
              </p>
              <div className="h-36 md:h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timingStats.dayData} barSize={20}>
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
                      formatter={(value: number, _: string, props: any) => [
                        `${value.toFixed(2)} RR (${props.payload.trades} trades)`,
                        props.payload.fullDay,
                      ]}
                    />
                    <Bar dataKey="rr" radius={[4, 4, 0, 0]} className="chart-bar-glow">
                      {timingStats.dayData.map((entry, index) => (
                        <Cell key={index} fill={entry.rr >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Hour bar chart */}
            <div className="border border-border p-4 md:p-5 bg-card rounded-md chart-glow-container">
              <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-3">
                Performance par Heure
                {timingStats.bestHour && (
                  <span className="text-emerald-500 ml-2">★ {timingStats.bestHour.hour}</span>
                )}
              </p>
              <div className="h-36 md:h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timingStats.hourData} barSize={12}>
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
                      formatter={(value: number, _: string, props: any) => [
                        `${value.toFixed(2)} RR (${props.payload.trades} trades)`,
                        props.payload.hour,
                      ]}
                    />
                    <Bar dataKey="rr" radius={[3, 3, 0, 0]} className="chart-bar-glow">
                      {timingStats.hourData.map((entry, index) => (
                        <Cell key={index} fill={entry.rr >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Analog Clock */}
          <div
            className={cn(
              "border border-border p-4 md:p-6 bg-card rounded-md chart-glow-container",
              isEntering && "opacity-0"
            )}
            style={{ animation: isEntering ? "none" : "data-card-deal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 320ms forwards" }}
          >
            <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-4">
              Horloge des Timings · Paris GMT+1
            </p>
            <AnalogClock trades={trades} onSelectTiming={handleTimingSelect} />
          </div>

          {/* Row 3: Timeline */}
          <div
            className={cn(
              "border border-border p-4 md:p-5 bg-card rounded-md chart-glow-container",
              isEntering && "opacity-0"
            )}
            style={{ animation: isEntering ? "none" : "data-card-deal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 400ms forwards" }}
          >
            <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase mb-3">
              Frise Chronologique · Évolution Cumulative
            </p>
            <div className="h-44 md:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timingStats.cumulativeTimeline}>
                  <defs>
                    <linearGradient id="colorTimeline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--chart-axis)", fontSize: 9 }}
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
                    formatter={(value: number, _: string, props: any) => [
                      `${value.toFixed(2)} RR cumulé (${props.payload.trades} trades)`,
                      props.payload.label,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTimeline)"
                    className="chart-line-glow"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Timeline markers */}
            <div className="mt-4 flex items-center gap-1 overflow-auto scrollbar-hide pb-2">
              {timingStats.timelineData.map((d, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const parts = d.label.split(" ");
                    if (parts.length === 2) {
                      onNavigateToDatabase?.({ year: [parts[1]] });
                    }
                  }}
                  className={cn(
                    "flex-shrink-0 px-2 py-1 border rounded text-[9px] font-mono transition-all",
                    d.rr >= 0
                      ? "border-emerald-500/30 text-emerald-500 hover:border-emerald-400"
                      : "border-red-500/30 text-red-500 hover:border-red-400"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
