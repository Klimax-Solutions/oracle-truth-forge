import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Crown, Medal, Award, ChevronDown, Circle } from "lucide-react";
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

interface OnlineUser {
  user_id: string;
  display_name: string;
}

const SuccessLeaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restOpen, setRestOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

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

  // Presence for online users
  useEffect(() => {
    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;

    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get display name
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();

      const displayName = profile?.display_name || "Anonyme";

      presenceChannel = supabase.channel("online_users", {
        config: { presence: { key: user.id } },
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel!.presenceState();
          const users: OnlineUser[] = [];
          for (const [userId, presences] of Object.entries(state)) {
            const p = (presences as any[])[0];
            users.push({
              user_id: userId,
              display_name: p?.display_name || "Anonyme",
            });
          }
          setOnlineUsers(users);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel!.track({
              display_name: displayName,
              online_at: new Date().toISOString(),
            });
          }
        });
    };

    initPresence();

    return () => {
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
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

  if (loading || entries.length === 0) return null;

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3, 10);

  const podiumConfig = [
    { gradient: "from-yellow-500/20 to-yellow-600/5", border: "border-yellow-500/40", accent: "text-yellow-500", icon: <Crown className="w-5 h-5" /> },
    { gradient: "from-slate-300/15 to-slate-400/5", border: "border-slate-400/30", accent: "text-slate-400", icon: <Medal className="w-4 h-4" /> },
    { gradient: "from-amber-700/15 to-amber-800/5", border: "border-amber-700/30", accent: "text-amber-700", icon: <Award className="w-4 h-4" /> },
  ];

  // Visual order: [2nd, 1st, 3rd]
  const podiumOrder = podium.length >= 3 ? [1, 0, 2] : podium.map((_, i) => i);
  const podiumHeights = [160, 130, 115];

  return (
    <div className="border border-border bg-card rounded-lg overflow-hidden">
      <div className="flex">
        {/* Left: Leaderboard */}
        <div className="flex-1 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h2 className="text-sm font-bold tracking-tight">Leaderboard</h2>
          </div>

          {/* Podium — responsive grid */}
          <div className="flex items-end justify-center gap-2 sm:gap-3">
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
                    "flex flex-col items-center rounded-lg border bg-gradient-to-b p-2 sm:p-3 transition-all flex-1 max-w-[140px]",
                    cfg.gradient, cfg.border
                  )}
                  style={{ height: isFirst ? podiumHeights[0] : idx === 1 ? podiumHeights[1] : podiumHeights[2] }}
                >
                  <div className={cn("mb-1", cfg.accent)}>{cfg.icon}</div>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/20 flex items-center justify-center mb-1">
                    <span className="text-xs font-bold text-primary uppercase">
                      {entry.display_name.charAt(0)}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-foreground text-center truncate w-full">
                    {entry.display_name}
                  </span>
                  <span className="text-lg sm:text-xl font-black text-foreground">{rank}</span>
                  <div className="mt-auto text-center">
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground block leading-tight">
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

          {/* Rest of leaderboard — collapsible */}
          {rest.length > 0 && (
            <Collapsible open={restOpen} onOpenChange={setRestOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", restOpen && "rotate-180")} />
                <span>Voir le classement complet ({rest.length} autres)</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-0.5 pt-1">
                  {rest.map((entry, i) => (
                    <div
                      key={entry.user_id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-xs font-mono font-bold text-muted-foreground w-5 text-right">
                        {i + 4}
                      </span>
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-primary uppercase">
                          {entry.display_name.charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-foreground flex-1 truncate">
                        {entry.display_name}
                      </span>
                      <span className="text-[9px] text-muted-foreground hidden sm:inline">
                        {entry.success_count}s · {entry.data_count}d
                      </span>
                      <span className="text-[10px] font-mono font-bold text-foreground">
                        {entry.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Right: Online users */}
        <div className="w-36 sm:w-44 border-l border-border p-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              En ligne — {onlineUsers.length}
            </span>
          </div>
          <div className="space-y-1">
            {onlineUsers.map((u) => (
              <div key={u.user_id} className="flex items-center gap-2 py-1">
                <div className="relative flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary uppercase">
                      {u.display_name.charAt(0)}
                    </span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                </div>
                <span className="text-[10px] font-medium text-foreground truncate">
                  {u.display_name}
                </span>
              </div>
            ))}
            {onlineUsers.length === 0 && (
              <p className="text-[10px] text-muted-foreground italic">Personne en ligne</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { SuccessLeaderboard };
