import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Crown, Medal, Award, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  const [restOpen, setRestOpen] = useState(false);

  useEffect(() => {
    fetchLeaderboard();

    const channel = supabase
      .channel("leaderboard_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_successes" }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLeaderboard = async () => {
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) return null;

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3, 10);

  const podiumConfig = [
    { gradient: "from-yellow-500/20 to-yellow-600/5", border: "border-yellow-500/40", accent: "text-yellow-500", icon: <Crown className="w-4 h-4 sm:w-5 sm:h-5" />, label: "1er" },
    { gradient: "from-slate-300/15 to-slate-400/5", border: "border-slate-400/30", accent: "text-slate-400", icon: <Medal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, label: "2ème" },
    { gradient: "from-amber-700/15 to-amber-800/5", border: "border-amber-700/30", accent: "text-amber-700", icon: <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />, label: "3ème" },
  ];

  // Display order: 2nd, 1st, 3rd for podium effect
  const podiumOrder = podium.length >= 3 ? [1, 0, 2] : podium.map((_, i) => i);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 justify-center">
        <Trophy className="w-5 h-5 text-yellow-500" />
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">Leaderboard</h2>
      </div>

      {/* Podium — responsive grid */}
      <div className="flex items-end justify-center gap-2 sm:gap-3 md:gap-4 px-2">
        {podiumOrder.map((idx) => {
          const entry = podium[idx];
          if (!entry) return null;
          const rank = idx + 1;
          const isFirst = idx === 0;
          const cfg = podiumConfig[idx];

          return (
            <div
              key={entry.user_id}
              className={cn(
                "flex flex-col items-center rounded-lg border bg-gradient-to-b transition-all flex-1 min-w-0",
                "p-2 sm:p-3",
                cfg.gradient, cfg.border,
                isFirst ? "max-w-[160px]" : "max-w-[140px]"
              )}
            >
              {/* Icon */}
              <div className={cn("mb-1 sm:mb-2", cfg.accent)}>{cfg.icon}</div>

              {/* Avatar */}
              <div className={cn(
                "rounded-full bg-primary/20 flex items-center justify-center mb-1",
                isFirst ? "w-10 h-10 sm:w-12 sm:h-12" : "w-8 h-8 sm:w-10 sm:h-10"
              )}>
                <span className={cn("font-bold text-primary uppercase", isFirst ? "text-sm sm:text-base" : "text-xs sm:text-sm")}>
                  {entry.display_name.charAt(0)}
                </span>
              </div>

              {/* Name */}
              <span className="text-[10px] sm:text-xs font-semibold text-foreground text-center truncate w-full leading-tight">
                {entry.display_name}
              </span>

              {/* Rank label */}
              <span className={cn("font-black text-foreground mt-0.5", isFirst ? "text-xl sm:text-2xl" : "text-lg sm:text-xl")}>
                {rank}
              </span>

              {/* Stats */}
              <div className="mt-auto text-center pt-1">
                <span className="text-[8px] sm:text-[10px] text-muted-foreground block leading-tight">
                  {entry.success_count}s · {entry.data_count}d
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-bold text-foreground">
                  {entry.score} pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest — collapsible list */}
      {rest.length > 0 && (
        <div className="border border-border bg-card rounded-lg overflow-hidden">
          <Collapsible open={restOpen} onOpenChange={setRestOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors px-3 sm:px-4 py-2.5 hover:bg-muted/30">
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform flex-shrink-0", restOpen && "rotate-180")} />
              <span>Classement complet ({rest.length} autres)</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border">
                {rest.map((entry, i) => (
                  <div
                    key={entry.user_id}
                    className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0"
                  >
                    <span className="text-xs font-mono font-bold text-muted-foreground w-5 text-right flex-shrink-0">
                      {i + 4}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-primary uppercase">
                        {entry.display_name.charAt(0)}
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-foreground flex-1 truncate min-w-0">
                      {entry.display_name}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground flex-shrink-0">
                      {entry.success_count}s · {entry.data_count}d
                    </span>
                    <span className="text-[10px] sm:text-xs font-mono font-bold text-foreground flex-shrink-0">
                      {entry.score} pts
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
};

export { SuccessLeaderboard };
