import { useMemo } from "react";

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

  // Calculate circle properties
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.winRate / 100) * circumference;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-1">Win Rate Analysis</h2>
        <p className="text-sm text-neutral-500 font-mono">Performance globale et par direction</p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Main win rate with custom circle */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-2 border border-neutral-800 p-8 bg-neutral-950 flex flex-col items-center">
            {/* Custom SVG Circle */}
            <div className="relative w-52 h-52">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                {/* Background circle */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke="#262626"
                  strokeWidth="12"
                />
                {/* Progress circle */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000"
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-5xl font-bold text-white">{stats.winRate.toFixed(0)}%</p>
                <p className="text-xs text-neutral-500 font-mono uppercase mt-1">Win Rate</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-neutral-800 p-4 bg-emerald-500/10">
              <p className="text-3xl font-bold text-emerald-400">{stats.wins}</p>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
                Trades Gagnants
              </p>
            </div>
            <div className="border border-neutral-800 p-4 bg-red-500/10">
              <p className="text-3xl font-bold text-red-400">{stats.losses}</p>
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
            <div className="border border-neutral-800 p-6 bg-emerald-500/5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-mono uppercase text-emerald-400">Long</span>
                <span className="text-2xl font-bold text-white">{stats.longWinRate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${stats.longWinRate}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">{stats.longTrades} trades</p>
            </div>
            <div className="border border-neutral-800 p-6 bg-red-500/5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-mono uppercase text-red-400">Short</span>
                <span className="text-2xl font-bold text-white">{stats.shortWinRate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-neutral-800 overflow-hidden">
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
