import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, Target, Flame } from "lucide-react";

interface Trade {
  id: string;
  trade_number: number;
  rr: number;
  trade_date: string;
}

interface StreaksChartProps {
  trades: Trade[];
}

export const StreaksChart = ({ trades }: StreaksChartProps) => {
  const stats = useMemo(() => {
    // Sort trades by number
    const sortedTrades = [...trades].sort((a, b) => a.trade_number - b.trade_number);
    
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let currentStreak = 0;
    let currentStreakType: "win" | "loss" | null = null;

    const streakHistory: { trade: number; streak: number; type: "win" | "loss" }[] = [];

    sortedTrades.forEach((trade) => {
      const isWin = (trade.rr || 0) > 0;
      
      if (isWin) {
        if (currentStreakType === "win") {
          currentStreak++;
        } else {
          currentStreak = 1;
          currentStreakType = "win";
        }
        currentWinStreak = currentStreak;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else {
        if (currentStreakType === "loss") {
          currentStreak++;
        } else {
          currentStreak = 1;
          currentStreakType = "loss";
        }
        currentLossStreak = currentStreak;
        currentWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentStreak);
      }

      streakHistory.push({
        trade: trade.trade_number,
        streak: currentStreak,
        type: currentStreakType,
      });
    });

    // Last 50 trades for visualization
    const recentTrades = sortedTrades.slice(-50).map((t) => ({
      trade: t.trade_number,
      rr: t.rr || 0,
    }));

    return {
      currentWinStreak: currentStreakType === "win" ? currentStreak : 0,
      currentLossStreak: currentStreakType === "loss" ? currentStreak : 0,
      maxWinStreak,
      maxLossStreak,
      currentStreakType,
      recentTrades,
    };
  }, [trades]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <h2 className="text-xl font-semibold text-white mb-1">Winning & Losing Streaks</h2>
        <p className="text-sm text-neutral-500 font-mono">Séries consécutives de trades</p>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Current streak highlight */}
        <div className="mb-8">
          <div className={`border p-6 ${
            stats.currentStreakType === "win" 
              ? "border-emerald-500/30 bg-emerald-500/5" 
              : stats.currentStreakType === "loss"
              ? "border-red-500/30 bg-red-500/5"
              : "border-neutral-800 bg-neutral-950"
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <Flame className={`w-6 h-6 ${
                stats.currentStreakType === "win" ? "text-emerald-500" : "text-red-500"
              }`} />
              <span className="text-sm font-mono uppercase tracking-wider text-neutral-500">
                Série Actuelle
              </span>
            </div>
            <p className="text-5xl font-bold text-white">
              {stats.currentStreakType === "win" ? stats.currentWinStreak : stats.currentLossStreak}
              <span className={`text-lg ml-2 ${
                stats.currentStreakType === "win" ? "text-emerald-500" : "text-red-500"
              }`}>
                {stats.currentStreakType === "win" ? "Victoires" : "Défaites"}
              </span>
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border border-neutral-800 p-6 bg-neutral-950">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-mono uppercase tracking-wider text-neutral-500">
                Max Winning Streak
              </span>
            </div>
            <p className="text-4xl font-bold text-emerald-500">{stats.maxWinStreak}</p>
            <p className="text-xs text-neutral-600 mt-1">victoires consécutives</p>
          </div>
          <div className="border border-neutral-800 p-6 bg-neutral-950">
            <div className="flex items-center gap-3 mb-4">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <span className="text-sm font-mono uppercase tracking-wider text-neutral-500">
                Max Losing Streak
              </span>
            </div>
            <p className="text-4xl font-bold text-red-500">{stats.maxLossStreak}</p>
            <p className="text-xs text-neutral-600 mt-1">défaites consécutives</p>
          </div>
        </div>

        {/* Recent trades chart */}
        <div className="border border-neutral-800 p-6 bg-neutral-950">
          <h3 className="text-sm font-mono uppercase tracking-wider text-neutral-500 mb-4">
            50 Derniers Trades
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.recentTrades}>
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
                />
                <Bar dataKey="rr" radius={0}>
                  {stats.recentTrades.map((entry, index) => (
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
