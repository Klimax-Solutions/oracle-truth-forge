import { useState, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, RotateCcw, DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Input } from "@/components/ui/input";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  rr: number;
}

interface CumulativeEvolutionProps {
  trades: Trade[];
  isSuperAdmin?: boolean;
}

const CAPITAL_PRESETS = [
  { label: "105K", value: "105000" },
  { label: "205K", value: "205000" },
  { label: "305K", value: "305000" },
  { label: "405K", value: "405000" },
  { label: "1M", value: "1000000" },
];

export const CumulativeEvolution = ({ trades, isSuperAdmin = false }: CumulativeEvolutionProps) => {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [capital, setCapital] = useState<string>("10000");
  const [riskPercent, setRiskPercent] = useState<string>("1");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isEarlyAccess } = useEarlyAccess();

  // Build monthly data
  const monthlyData = useMemo(() => {
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    const byMonth: Record<string, { trades: Trade[]; totalRR: number; label: string }> = {};

    trades.forEach(t => {
      const date = new Date(t.trade_date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month.toString().padStart(2, "0")}`;
      if (!byMonth[key]) byMonth[key] = { trades: [], totalRR: 0, label: `${monthNames[month]} ${year}` };
      byMonth[key].trades.push(t);
      byMonth[key].totalRR += t.rr || 0;
    });

    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        key,
        label: data.label,
        trades: data.trades,
        rr: parseFloat(data.totalRR.toFixed(2)),
        tradeCount: data.trades.length,
      }));
  }, [trades]);

  // Filtered trades based on selected month
  const filteredTrades = useMemo(() => {
    if (!selectedMonth) return trades;
    const monthData = monthlyData.find(m => m.key === selectedMonth);
    return monthData ? monthData.trades : trades;
  }, [trades, selectedMonth, monthlyData]);

  // Build cumulative data
  const cumulativeData = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => a.trade_number - b.trade_number);
    let cumul = 0;
    return sorted.map(t => {
      cumul += t.rr || 0;
      return {
        trade: t.trade_number,
        cumulative: parseFloat(cumul.toFixed(2)),
        rr: t.rr || 0,
        date: t.trade_date,
      };
    });
  }, [filteredTrades]);

  // Simulator: risk indexed on INITIAL capital (not rolling/compound)
  const simulatorResult = useMemo(() => {
    const initialCap = parseFloat(capital) || 0;
    const risk = parseFloat(riskPercent) || 0;
    const sorted = [...filteredTrades].sort((a, b) => a.trade_number - b.trade_number);
    
    const totalRR = sorted.reduce((sum, t) => sum + (t.rr || 0), 0);
    const riskAmount = initialCap * (risk / 100);
    const gain = riskAmount * totalRR;
    const finalCapital = initialCap + gain;
    const percentGain = initialCap > 0 ? ((gain / initialCap) * 100) : 0;
    
    return { riskAmount, totalRR, gain, finalCapital, percentGain };
  }, [capital, riskPercent, filteredTrades]);

  const scrollMonths = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleReset = () => {
    setSelectedMonth(null);
  };

  const selectedLabel = selectedMonth
    ? monthlyData.find(m => m.key === selectedMonth)?.label || "Toutes les données"
    : "Toutes les données";

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] md:text-xs text-muted-foreground font-mono uppercase">
          Évolution Cumulative
          <span className="text-foreground/60 ml-2">· {selectedLabel}</span>
        </p>
        {selectedMonth && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Month selector with arrows */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => scrollMonths("left")}
          className="flex-shrink-0 p-1.5 border border-border rounded-md hover:bg-accent/50 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        <div
          ref={scrollRef}
          className="flex-1 flex items-center gap-1 overflow-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {monthlyData.map((d) => (
            <button
              key={d.key}
              onClick={() => setSelectedMonth(d.key === selectedMonth ? null : d.key)}
              className={cn(
                "flex-shrink-0 px-2 py-1 border rounded text-[9px] font-mono transition-all",
                d.key === selectedMonth
                  ? "border-foreground/40 bg-accent text-foreground"
                  : d.rr >= 0
                  ? "border-emerald-500/30 text-emerald-500 hover:border-emerald-400"
                  : "border-red-500/30 text-red-500 hover:border-red-400"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => scrollMonths("right")}
          className="flex-shrink-0 p-1.5 border border-border rounded-md hover:bg-accent/50 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Chart */}
      <div className="h-44 md:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={cumulativeData}>
            <defs>
              <linearGradient id="colorCumulEvo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="trade"
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
                `${value.toFixed(2)} RR cumulé`,
                `Trade #${props.payload.trade}`,
              ]}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#22c55e"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCumulEvo)"
              className="chart-line-glow"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Simulator */}
      <div className="border border-border rounded-md p-3 md:p-4 bg-card">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] md:text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Simulateur de Performance
          </span>
        </div>

        {/* Capital presets for early access */}
        {(isEarlyAccess || isSuperAdmin) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {CAPITAL_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setCapital(preset.value)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-mono font-bold border-2 transition-all",
                  capital === preset.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                ${preset.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Capital ($)</label>
            <Input
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder="10000"
            />
          </div>
          <div>
            <label className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Risque par trade (%)</label>
            <Input
              type="number"
              value={riskPercent}
              onChange={(e) => setRiskPercent(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder="1"
              step="0.1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="border border-border p-2 rounded-md text-center">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">Risque/trade</p>
            <p className="text-sm font-mono font-bold text-foreground">{simulatorResult.riskAmount.toLocaleString("fr-FR")} $</p>
          </div>
          <div className="border border-border p-2 rounded-md text-center">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">RR Total</p>
            <p className={cn(
              "text-sm font-mono font-bold",
              simulatorResult.totalRR >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              {simulatorResult.totalRR >= 0 ? "+" : ""}{simulatorResult.totalRR.toFixed(1)}
            </p>
          </div>
          <div className="border border-emerald-500/30 p-2 rounded-md text-center bg-emerald-500/5">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">Payout / Retrait</p>
            <p className={cn(
              "text-sm font-mono font-bold",
              simulatorResult.gain >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              {simulatorResult.gain >= 0 ? "+" : ""}{simulatorResult.gain.toLocaleString("fr-FR")} $
            </p>
          </div>
          <div className="border border-border p-2 rounded-md text-center">
            <p className="text-[8px] text-muted-foreground font-mono uppercase">Capital Final</p>
            <p className="text-sm font-mono font-bold text-foreground">
              {simulatorResult.finalCapital.toLocaleString("fr-FR")} $
            </p>
            <p className={cn(
              "text-[9px] font-mono",
              simulatorResult.percentGain >= 0 ? "text-emerald-500" : "text-red-500"
            )}>
              ({simulatorResult.percentGain >= 0 ? "+" : ""}{simulatorResult.percentGain.toFixed(1)}%)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
