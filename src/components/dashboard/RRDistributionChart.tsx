import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, Zap, BarChart2 } from "lucide-react";

interface Trade {
  id: string;
  trade_number: number;
  rr: number;
  trade_date: string;
  direction?: string;
  setup_type?: string;
  entry_model?: string;
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
      percentage: trades.length > 0 ? ((count / trades.length) * 100).toFixed(1) : "0",
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

    // RR by direction
    const byDirection: Record<string, { count: number; totalRR: number }> = {
      Long: { count: 0, totalRR: 0 },
      Short: { count: 0, totalRR: 0 },
    };
    trades.forEach(t => {
      if (t.direction && byDirection[t.direction]) {
        byDirection[t.direction].count++;
        byDirection[t.direction].totalRR += t.rr || 0;
      }
    });
    const directionData = Object.entries(byDirection).map(([dir, data]) => ({
      name: dir,
      value: data.count,
      rr: data.totalRR,
      avgRR: data.count > 0 ? data.totalRR / data.count : 0,
    }));

    // RR by setup type
    const bySetup: Record<string, { count: number; totalRR: number }> = {};
    trades.forEach(t => {
      const setup = t.setup_type || "Non défini";
      if (!bySetup[setup]) bySetup[setup] = { count: 0, totalRR: 0 };
      bySetup[setup].count++;
      bySetup[setup].totalRR += t.rr || 0;
    });
    const setupData = Object.entries(bySetup)
      .map(([setup, data]) => ({
        setup,
        count: data.count,
        rr: parseFloat(data.totalRR.toFixed(2)),
        avgRR: parseFloat((data.totalRR / data.count).toFixed(2)),
      }))
      .sort((a, b) => b.rr - a.rr);

    // Stats
    const allRR = trades.map((t) => t.rr || 0);
    const avgRR = allRR.length > 0 ? allRR.reduce((a, b) => a + b, 0) / allRR.length : 0;
    const maxRR = Math.max(...allRR, 0);
    const minRR = Math.min(...allRR, 0);
    const totalRR = allRR.reduce((a, b) => a + b, 0);

    // RR consistency (std deviation)
    const variance = allRR.length > 0 
      ? allRR.reduce((sum, rr) => sum + Math.pow(rr - avgRR, 2), 0) / allRR.length
      : 0;
    const stdDev = Math.sqrt(variance);

    // Rolling average (last 20 trades)
    const rollingData = sortedTrades.slice(-50).map((t, idx, arr) => {
      const start = Math.max(0, idx - 19);
      const window = arr.slice(start, idx + 1);
      const avg = window.reduce((sum, trade) => sum + (trade.rr || 0), 0) / window.length;
      return {
        trade: t.trade_number,
        avg: parseFloat(avg.toFixed(2)),
      };
    });

    return {
      distributionData,
      cumulativeData,
      directionData,
      setupData,
      rollingData,
      avgRR,
      maxRR,
      minRR,
      totalRR,
      stdDev,
    };
  }, [trades]);

  const COLORS = ["#22c55e", "#ef4444"];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-1">Distribution RR</h2>
        <p className="text-sm text-neutral-500 font-mono">Analyse complète des Risk-Reward</p>
      </div>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-5 gap-3">
          <div className="border border-emerald-500/30 p-4 bg-emerald-500/10 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">RR Total</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">+{stats.totalRR.toFixed(0)}</p>
          </div>
          <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-neutral-500" />
              <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">RR Moyen</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.avgRR.toFixed(2)}</p>
          </div>
          <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">Meilleur</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">+{stats.maxRR.toFixed(2)}</p>
          </div>
          <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">Pire</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{stats.minRR.toFixed(2)}</p>
          </div>
          <div className="border border-neutral-800 p-4 bg-neutral-950 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <BarChart2 className="w-4 h-4 text-neutral-500" />
              <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">Écart-type</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.stdDev.toFixed(2)}</p>
          </div>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-2 gap-4">
          {/* Distribution chart */}
          <div className="border border-neutral-800 p-5 bg-neutral-950 rounded-md">
            <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
              Distribution par RR
            </h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.distributionData}>
                  <XAxis 
                    dataKey="range" 
                    tick={{ fill: "#a3a3a3", fontSize: 11 }}
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
                      `${value} trades (${props.payload.percentage}%)`, 
                      "Nombre"
                    ]}
                  />
                  <Bar dataKey="count" fill="#ffffff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Direction pie chart */}
          <div className="border border-neutral-800 p-5 bg-neutral-950 rounded-md">
            <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
              RR par Direction
            </h3>
            <div className="h-44 flex items-center">
              <div className="w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.directionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {stats.directionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "#171717",
                        border: "1px solid #262626",
                        borderRadius: 4,
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} trades (+${props.payload.rr.toFixed(1)} RR)`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-3">
                {stats.directionData.map((dir, idx) => (
                  <div key={dir.name} className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-sm" 
                      style={{ backgroundColor: COLORS[idx] }}
                    />
                    <div>
                      <p className="text-sm text-white font-medium">{dir.name}</p>
                      <p className="text-xs text-neutral-500">
                        {dir.value} trades • +{dir.rr.toFixed(1)} RR
                      </p>
                      <p className="text-xs text-neutral-600">
                        Moy: {dir.avgRR.toFixed(2)} RR
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cumulative RR chart */}
        <div className="border border-neutral-800 p-5 bg-neutral-950 rounded-md">
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
                    borderRadius: 4,
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

        {/* Charts row 2 */}
        <div className="grid grid-cols-2 gap-4">
          {/* Rolling average */}
          <div className="border border-neutral-800 p-5 bg-neutral-950 rounded-md">
            <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
              Moyenne Mobile (20 trades)
            </h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.rollingData}>
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
                    formatter={(value: number) => [`${value} RR`, "Moyenne"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avg" 
                    stroke="#a855f7" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Setup performance */}
          <div className="border border-neutral-800 p-5 bg-neutral-950 rounded-md">
            <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
              Performance par Setup
            </h3>
            <div className="space-y-2 max-h-40 overflow-auto">
              {stats.setupData.slice(0, 6).map((setup, idx) => (
                <div 
                  key={setup.setup}
                  className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-600 font-mono w-4">{idx + 1}</span>
                    <span className="text-sm text-white truncate max-w-[150px]">{setup.setup}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-neutral-500">{setup.count} trades</span>
                    <span className={cn(
                      "text-sm font-mono font-medium",
                      setup.rr > 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      +{setup.rr} RR
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
