import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts";

interface Trade {
  id: string;
  trade_number: number;
  rr: number;
  trade_date: string;
}

interface RRDistributionChartProps {
  trades: Trade[];
}

export const RRDistributionChart = ({ trades }: RRDistributionChartProps) => {
  const stats = useMemo(() => {
    // RR distribution buckets
    const buckets: Record<string, number> = {
      "0-1": 0,
      "1-2": 0,
      "2-3": 0,
      "3-5": 0,
      "5-10": 0,
      "10+": 0,
    };

    trades.forEach((t) => {
      const rr = t.rr || 0;
      if (rr <= 1) buckets["0-1"]++;
      else if (rr <= 2) buckets["1-2"]++;
      else if (rr <= 3) buckets["2-3"]++;
      else if (rr <= 5) buckets["3-5"]++;
      else if (rr <= 10) buckets["5-10"]++;
      else buckets["10+"]++;
    });

    const distributionData = Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
    }));

    // Cumulative RR over time
    const sortedTrades = [...trades].sort((a, b) => a.trade_number - b.trade_number);
    let cumulative = 0;
    const cumulativeData = sortedTrades.map((t) => {
      cumulative += t.rr || 0;
      return {
        trade: t.trade_number,
        cumulative: parseFloat(cumulative.toFixed(2)),
      };
    });

    // Stats
    const allRR = trades.map((t) => t.rr || 0);
    const avgRR = allRR.length > 0 ? allRR.reduce((a, b) => a + b, 0) / allRR.length : 0;
    const maxRR = Math.max(...allRR, 0);
    const minRR = Math.min(...allRR, 0);
    const totalRR = allRR.reduce((a, b) => a + b, 0);

    return {
      distributionData,
      cumulativeData,
      avgRR,
      maxRR,
      minRR,
      totalRR,
    };
  }, [trades]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-1">Distribution RR</h2>
        <p className="text-sm text-neutral-500 font-mono">Répartition et évolution des Risk-Reward</p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="border border-neutral-800 p-4 bg-neutral-950">
            <p className="text-3xl font-bold text-white">+{stats.totalRR.toFixed(0)}</p>
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">RR Total</p>
          </div>
          <div className="border border-neutral-800 p-4 bg-neutral-950">
            <p className="text-3xl font-bold text-white">{stats.avgRR.toFixed(2)}</p>
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">RR Moyen</p>
          </div>
          <div className="border border-neutral-800 p-4 bg-neutral-950">
            <p className="text-3xl font-bold text-emerald-500">+{stats.maxRR.toFixed(2)}</p>
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Meilleur Trade</p>
          </div>
          <div className="border border-neutral-800 p-4 bg-neutral-950">
            <p className="text-3xl font-bold text-red-500">{stats.minRR.toFixed(2)}</p>
            <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">Pire Trade</p>
          </div>
        </div>

        {/* Distribution chart */}
        <div className="border border-neutral-800 p-6 bg-neutral-950 mb-6">
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            Distribution par RR
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.distributionData}>
                <XAxis 
                  dataKey="range" 
                  tick={{ fill: "#a3a3a3", fontSize: 12 }}
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
                    borderRadius: 0,
                  }}
                  labelStyle={{ color: "#a3a3a3" }}
                  formatter={(value: number) => [`${value} trades`, "Nombre"]}
                />
                <Bar dataKey="count" fill="#ffffff" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cumulative RR chart */}
        <div className="border border-neutral-800 p-6 bg-neutral-950">
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            Évolution Cumulative RR
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.cumulativeData}>
                <defs>
                  <linearGradient id="colorRR" x1="0" y1="0" x2="0" y2="1">
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
                    borderRadius: 0,
                  }}
                  labelStyle={{ color: "#a3a3a3" }}
                  formatter={(value: number) => [`${value} RR`, "Cumul"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="#22c55e" 
                  fillOpacity={1}
                  fill="url(#colorRR)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
