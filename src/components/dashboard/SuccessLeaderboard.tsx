import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Crown, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  success_count: number;
  data_count: number;
  score: number;
}

const SuccessLeaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();

    const channel = supabase
      .channel("leaderboard_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_successes" }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeaderboard = async () => {
    // Use the security definer function so all members can see the leaderboard
    const { data, error } = await supabase.rpc("get_leaderboard_data");

    if (error || !data) {
      console.error("Error fetching leaderboard:", error);
      setLoading(false);
      return;
    }

    const board: LeaderboardEntry[] = (data as any[]).map((row) => ({
      user_id: row.user_id,
      display_name: row.display_name || "Anonyme",
      success_count: Number(row.success_count),
      data_count: Number(row.data_count),
      score: Number(row.success_count) + Number(row.data_count),
    }));

    setEntries(board);
    setLoading(false);
  };

  if (loading || entries.length === 0) return null;

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3, 10);

  const podiumColors = [
    "from-yellow-500/20 to-yellow-600/10 border-yellow-500/40 text-yellow-500",
    "from-slate-300/20 to-slate-400/10 border-slate-400/40 text-slate-400",
    "from-amber-700/20 to-amber-800/10 border-amber-700/40 text-amber-700",
  ];

  const podiumIcons = [
    <Crown className="w-6 h-6" key="1" />,
    <Medal className="w-5 h-5" key="2" />,
    <Award className="w-5 h-5" key="3" />,
  ];

  // Reorder for visual podium: [2nd, 1st, 3rd]
  const podiumOrder = podium.length >= 3 ? [1, 0, 2] : podium.map((_, i) => i);

  return (
    <div className="border border-border bg-card rounded-lg p-5 space-y-5">
      <div className="flex items-center gap-3">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h2 className="text-lg font-bold tracking-tight">Leaderboard</h2>
      </div>

      {/* Podium */}
      <div className="flex items-end justify-center gap-3 pt-2">
        {podiumOrder.map((idx) => {
          const entry = podium[idx];
          if (!entry) return null;
          const rank = idx + 1;
          const isFirst = idx === 0;

          return (
            <div
              key={entry.user_id}
              className={cn(
                "flex flex-col items-center rounded-lg border bg-gradient-to-b p-4 transition-all",
                podiumColors[idx],
                isFirst ? "min-w-[130px] pb-6" : "min-w-[110px]"
              )}
              style={{ height: isFirst ? 180 : idx === 1 ? 155 : 135 }}
            >
              <div className={cn("mb-2", podiumColors[idx].split(" ").pop())}>
                {podiumIcons[idx]}
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-primary uppercase">
                  {entry.display_name.charAt(0)}
                </span>
              </div>
              <span className="text-xs font-semibold text-foreground text-center truncate max-w-[100px]">
                {entry.display_name}
              </span>
              <span className="text-2xl font-black text-foreground mt-1">{rank}</span>
              <div className="mt-auto text-center">
                <span className="text-[10px] text-muted-foreground block">
                  {entry.success_count} succès · {entry.data_count} data
                </span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {entry.score} pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <div className="space-y-1 pt-2">
          {rest.map((entry, i) => (
            <div
              key={entry.user_id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-mono font-bold text-muted-foreground w-6 text-right">
                {i + 4}
              </span>
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-primary uppercase">
                  {entry.display_name.charAt(0)}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground flex-1 truncate">
                {entry.display_name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {entry.success_count} succès · {entry.data_count} data
              </span>
              <span className="text-xs font-mono font-bold text-foreground min-w-[45px] text-right">
                {entry.score} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { SuccessLeaderboard };
