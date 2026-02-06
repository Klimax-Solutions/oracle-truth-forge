import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  TrendingUp,
  BarChart3,
} from "lucide-react";

interface Profile {
  user_id: string;
  display_name: string | null;
}

interface ExecutionDay {
  date: string;
  count: number;
  wins: number;
  rr: number;
}

interface UserHistory {
  userId: string;
  displayName: string;
  executionDays: ExecutionDay[];
  totalTrades: number;
  totalWins: number;
  totalRR: number;
  activeDays: number;
}

export const UserHistoryTab = () => {
  const [users, setUsers] = useState<UserHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [profilesRes, executionsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name"),
        supabase.from("user_executions").select("user_id, rr, created_at").order("created_at", { ascending: false }),
      ]);

      const profiles = (profilesRes.data || []) as Profile[];
      const executions = executionsRes.data || [];

      // Group executions by user then by date
      const byUser: Record<string, { dates: Record<string, { count: number; wins: number; rr: number }> }> = {};

      executions.forEach((exec: any) => {
        const userId = exec.user_id;
        const date = exec.created_at?.split("T")[0];
        if (!date || !userId) return;

        if (!byUser[userId]) byUser[userId] = { dates: {} };
        if (!byUser[userId].dates[date]) byUser[userId].dates[date] = { count: 0, wins: 0, rr: 0 };
        byUser[userId].dates[date].count++;
        if ((exec.rr || 0) > 0) byUser[userId].dates[date].wins++;
        byUser[userId].dates[date].rr += exec.rr || 0;
      });

      const usersData: UserHistory[] = Object.entries(byUser).map(([userId, data]) => {
        const profile = profiles.find(p => p.user_id === userId);
        const days = Object.entries(data.dates)
          .map(([date, stats]) => ({ date, ...stats }))
          .sort((a, b) => b.date.localeCompare(a.date));

        return {
          userId,
          displayName: profile?.display_name || `Utilisateur ${userId.slice(0, 8)}`,
          executionDays: days,
          totalTrades: days.reduce((s, d) => s + d.count, 0),
          totalWins: days.reduce((s, d) => s + d.wins, 0),
          totalRR: days.reduce((s, d) => s + d.rr, 0),
          activeDays: days.length,
        };
      }).sort((a, b) => b.totalTrades - a.totalTrades);

      setUsers(usersData);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Aucun historique</h3>
        <p className="text-sm text-muted-foreground">Les données d'exécution apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        <div className="p-3 bg-card border border-border rounded-md">
          <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Traders actifs</p>
          <p className="text-xl font-bold text-foreground">{users.length}</p>
        </div>
        <div className="p-3 bg-card border border-border rounded-md">
          <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Total datas</p>
          <p className="text-xl font-bold text-foreground">{users.reduce((s, u) => s + u.totalTrades, 0)}</p>
        </div>
        <div className="p-3 bg-card border border-border rounded-md">
          <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">Gagnantes</p>
          <p className="text-xl font-bold text-emerald-400">{users.reduce((s, u) => s + u.totalWins, 0)}</p>
        </div>
        <div className="p-3 bg-card border border-border rounded-md">
          <p className="text-[9px] text-muted-foreground font-mono uppercase mb-1">RR Total</p>
          <p className={cn(
            "text-xl font-bold",
            users.reduce((s, u) => s + u.totalRR, 0) >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {users.reduce((s, u) => s + u.totalRR, 0) >= 0 ? "+" : ""}
            {users.reduce((s, u) => s + u.totalRR, 0).toFixed(1)}
          </p>
        </div>
      </div>

      {/* User list */}
      {users.map((user) => {
        const isExpanded = expandedUser === user.userId;

        return (
          <div
            key={user.userId}
            className="border border-border rounded-md overflow-hidden bg-card"
          >
            {/* User header */}
            <div
              className="p-3 md:p-4 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setExpandedUser(isExpanded ? null : user.userId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{user.displayName}</h4>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {user.activeDays} jours actifs • {user.totalTrades} datas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-foreground font-mono">{user.totalTrades}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span className={cn(
                        "font-mono",
                        user.totalRR >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {user.totalRR >= 0 ? "+" : ""}{user.totalRR.toFixed(1)} RR
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded: daily breakdown */}
            {isExpanded && (
              <div className="border-t border-border p-3 md:p-4 space-y-2 max-h-96 overflow-auto">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
                  Historique journalier
                </p>
                {user.executionDays.map((day) => (
                  <div
                    key={day.date}
                    className={cn(
                      "flex items-center justify-between p-2 md:p-3 rounded-md border",
                      day.wins >= 5
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : day.count > 0
                        ? "border-border bg-muted/30"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        day.wins >= 5 ? "bg-emerald-500" : "bg-muted-foreground/30"
                      )} />
                      <span className="text-xs font-mono text-foreground">
                        {new Date(day.date).toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 text-xs font-mono">
                      <span className="text-muted-foreground">{day.count} datas</span>
                      <span className="text-emerald-400">{day.wins} win{day.wins > 1 ? "s" : ""}</span>
                      <span className={cn(
                        "w-16 text-right",
                        day.rr >= 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {day.rr >= 0 ? "+" : ""}{day.rr.toFixed(1)} RR
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
