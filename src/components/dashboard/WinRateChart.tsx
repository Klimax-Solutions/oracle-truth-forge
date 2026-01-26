import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

interface Trade {
  id: string;
  rr: number;
  direction: string;
}

interface WinRateChartProps {
  trades: Trade[];
}

export const WinRateChart = ({ trades }: WinRateChartProps) => {
  const stats = useMemo(() => {
    const wins = trades.filter((t) => (t.rr || 0) > 0).length;
    const losses = trades.filter((t) => (t.rr || 0) <= 0).length;
    const total = trades.length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    
    const longTrades = trades.filter((t) => t.direction === "Long");
    const shortTrades = trades.filter((t) => t.direction === "Short");
    
    const longWins = longTrades.filter((t) => (t.rr || 0) > 0).length;
    const shortWins = shortTrades.filter((t) => (t.rr || 0) > 0).length;
    
    const longWinRate = longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0;
    const shortWinRate = shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0;

    return {
      wins,
      losses,
      total,
      winRate,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      longWinRate,
      shortWinRate,
    };
  }, [trades]);

  const pieData = [
    { name: "Wins", value: stats.wins, color: "#22c55e" },
    { name: "Losses", value: stats.losses, color: "#ef4444" },
  ];

  const directionData = [
    { name: "Long", value: stats.longTrades, color: "#22c55e" },
    { name: "Short", value: stats.shortTrades, color: "#ef4444" },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-1">Win Rate Analysis</h2>
        <p className="text-sm text-neutral-500 font-mono">Performance globale et par direction</p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Main win rate */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-2 border border-neutral-800 p-6 bg-neutral-950">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-4">
              <p className="text-5xl font-bold text-white">{stats.winRate.toFixed(1)}%</p>
              <p className="text-sm text-neutral-500 font-mono uppercase tracking-wider mt-2">
                Win Rate Global
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-neutral-800 p-4 bg-neutral-950">
              <p className="text-3xl font-bold text-emerald-500">{stats.wins}</p>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
                Trades Gagnants
              </p>
            </div>
            <div className="border border-neutral-800 p-4 bg-neutral-950">
              <p className="text-3xl font-bold text-red-500">{stats.losses}</p>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
                Trades Perdants
              </p>
            </div>
            <div className="border border-neutral-800 p-4 bg-neutral-950">
              <p className="text-3xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
                Total Trades
              </p>
            </div>
          </div>
        </div>

        {/* Direction breakdown */}
        <div className="border-t border-neutral-800 pt-6">
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            Win Rate par Direction
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-neutral-800 p-6 bg-neutral-950">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-mono uppercase text-emerald-500">Long</span>
                <span className="text-2xl font-bold text-white">{stats.longWinRate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${stats.longWinRate}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">{stats.longTrades} trades</p>
            </div>
            <div className="border border-neutral-800 p-6 bg-neutral-950">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-mono uppercase text-red-500">Short</span>
                <span className="text-2xl font-bold text-white">{stats.shortWinRate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${stats.shortWinRate}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">{stats.shortTrades} trades</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
