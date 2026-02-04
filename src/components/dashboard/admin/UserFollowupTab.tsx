import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Calendar,
  Clock,
  Users,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
}

interface UserFollowup {
  id: string;
  user_id: string;
  day_number: number;
  contact_date: string;
  message_sent: boolean;
  is_blocked: boolean;
  correct_actions: boolean;
  call_done: boolean;
  notes: string | null;
}

interface FollowupUser {
  id: string;
  displayName: string;
  followups: UserFollowup[];
  totalCheckpoints: number;
  completedCheckpoints: number;
  nextCheckpoint: UserFollowup | null;
  startDate: string;
  todayCheckpoint: UserFollowup | null;
  tomorrowCheckpoint: UserFollowup | null;
  dayAfterCheckpoint: UserFollowup | null;
  needsVerification: boolean;
}

export const UserFollowupTab = () => {
  const [users, setUsers] = useState<FollowupUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const { toast } = useToast();

  const getDateString = (daysFromNow: number = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  };

  const today = getDateString(0);
  const tomorrow = getDateString(1);
  const dayAfter = getDateString(2);

  const fetchFollowups = async () => {
    setLoading(true);

    // Fetch profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*");

    // Fetch all followups
    const { data: followupsData, error } = await supabase
      .from("user_followups")
      .select("*")
      .order("day_number", { ascending: true });

    // Fetch pending verification requests
    const { data: pendingVerifications } = await supabase
      .from("user_cycles")
      .select("user_id")
      .eq("status", "pending_review");

    const usersWithPendingVerification = new Set(pendingVerifications?.map(v => v.user_id) || []);

    if (error) {
      console.error("Error fetching followups:", error);
      setLoading(false);
      return;
    }

    // Group by user
    const userIds = [...new Set(followupsData?.map(f => f.user_id) || [])];
    
    const followupUsers: FollowupUser[] = userIds.map(userId => {
      const userFollowups = (followupsData?.filter(f => f.user_id === userId) || []) as UserFollowup[];
      const profile = profilesData?.find(p => p.user_id === userId);
      
      const completedCheckpoints = userFollowups.filter(f => 
        f.message_sent || f.call_done
      ).length;

      const nextCheckpoint = userFollowups.find(f => 
        f.contact_date >= today && !f.message_sent && !f.call_done
      ) || null;

      const todayCheckpoint = userFollowups.find(f => f.contact_date === today) || null;
      const tomorrowCheckpoint = userFollowups.find(f => f.contact_date === tomorrow) || null;
      const dayAfterCheckpoint = userFollowups.find(f => f.contact_date === dayAfter) || null;

      return {
        id: userId,
        displayName: profile?.display_name || `Utilisateur ${userId.slice(0, 8)}`,
        followups: userFollowups,
        totalCheckpoints: userFollowups.length,
        completedCheckpoints,
        nextCheckpoint,
        startDate: userFollowups[0]?.contact_date || today,
        todayCheckpoint,
        tomorrowCheckpoint,
        dayAfterCheckpoint,
        needsVerification: usersWithPendingVerification.has(userId),
      };
    });

    setUsers(followupUsers);
    setLoading(false);
  };

  useEffect(() => {
    fetchFollowups();
  }, []);

  const updateFollowup = async (
    followupId: string, 
    field: 'message_sent' | 'is_blocked' | 'correct_actions' | 'call_done',
    value: boolean
  ) => {
    const { error } = await supabase
      .from("user_followups")
      .update({ [field]: value })
      .eq("id", followupId);

    if (error) {
      console.error("Error updating followup:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le suivi.",
        variant: "destructive",
      });
    } else {
      // Update local state
      setUsers(prev => prev.map(user => ({
        ...user,
        followups: user.followups.map(f => 
          f.id === followupId ? { ...f, [field]: value } : f
        ),
        completedCheckpoints: user.followups.filter(f => 
          f.id === followupId 
            ? (field === 'message_sent' || field === 'call_done' ? value : f.message_sent || f.call_done)
            : (f.message_sent || f.call_done)
        ).length,
      })));
    }
  };

  const getProgressColor = (completed: number, total: number) => {
    const percentage = (completed / total) * 100;
    if (percentage >= 80) return "bg-emerald-500";
    if (percentage >= 50) return "bg-blue-500";
    if (percentage >= 25) return "bg-orange-500";
    return "bg-muted";
  };

  // Calculate stats
  const usersToContactToday = users.filter(u => 
    u.todayCheckpoint && !u.todayCheckpoint.message_sent && !u.todayCheckpoint.call_done
  );
  const usersToContactTomorrow = users.filter(u => 
    u.tomorrowCheckpoint && !u.tomorrowCheckpoint.message_sent && !u.tomorrowCheckpoint.call_done
  );
  const usersToContactDayAfter = users.filter(u => 
    u.dayAfterCheckpoint && !u.dayAfterCheckpoint.message_sent && !u.dayAfterCheckpoint.call_done
  );
  const blockedSituations = users.reduce((sum, u) => 
    sum + u.followups.filter(f => f.is_blocked).length, 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Stats - 3-day cycle overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3 mb-4 md:mb-6">
        <div className="p-3 md:p-4 bg-card border border-border rounded-md">
          <p className="text-[9px] md:text-[10px] text-muted-foreground font-mono uppercase mb-1">
            Utilisateurs
          </p>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Users className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <p className="text-xl md:text-2xl font-bold text-foreground">{users.length}</p>
          </div>
        </div>
        
        <div className="p-3 md:p-4 bg-orange-500/10 border border-orange-500/30 rounded-md">
          <p className="text-[9px] md:text-[10px] text-orange-400 font-mono uppercase mb-1">
            Aujourd'hui
          </p>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Clock className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
            <p className="text-xl md:text-2xl font-bold text-orange-400">{usersToContactToday.length}</p>
          </div>
        </div>
        
        <div className="p-3 md:p-4 bg-blue-500/10 border border-blue-500/30 rounded-md">
          <p className="text-[9px] md:text-[10px] text-blue-400 font-mono uppercase mb-1">
            Demain
          </p>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Calendar className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            <p className="text-xl md:text-2xl font-bold text-blue-400">{usersToContactTomorrow.length}</p>
          </div>
        </div>
        
        <div className="p-3 md:p-4 bg-purple-500/10 border border-purple-500/30 rounded-md">
          <p className="text-[9px] md:text-[10px] text-purple-400 font-mono uppercase mb-1">
            J+2
          </p>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Calendar className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
            <p className="text-xl md:text-2xl font-bold text-purple-400">{usersToContactDayAfter.length}</p>
          </div>
        </div>
        
        <div className="p-3 md:p-4 bg-red-500/10 border border-red-500/30 rounded-md col-span-2 sm:col-span-1">
          <p className="text-[9px] md:text-[10px] text-red-400 font-mono uppercase mb-1">
            Bloquantes
          </p>
          <div className="flex items-center gap-1.5 md:gap-2">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
            <p className="text-xl md:text-2xl font-bold text-red-400">{blockedSituations}</p>
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Aucun suivi actif
          </h3>
          <p className="text-sm text-muted-foreground">
            Les suivis apparaîtront ici une fois initialisés.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Sort users: today's contacts first, then tomorrow, then others */}
          {[...users].sort((a, b) => {
            const aToday = a.todayCheckpoint && !a.todayCheckpoint.message_sent && !a.todayCheckpoint.call_done;
            const bToday = b.todayCheckpoint && !b.todayCheckpoint.message_sent && !b.todayCheckpoint.call_done;
            if (aToday && !bToday) return -1;
            if (!aToday && bToday) return 1;
            return 0;
          }).map((user) => {
            const isExpanded = expandedUser === user.id;
            const progress = (user.completedCheckpoints / user.totalCheckpoints) * 100;
            const needsContactToday = user.todayCheckpoint && !user.todayCheckpoint.message_sent && !user.todayCheckpoint.call_done;
            const needsContactTomorrow = user.tomorrowCheckpoint && !user.tomorrowCheckpoint.message_sent && !user.tomorrowCheckpoint.call_done;

            return (
              <div
                key={user.id}
                className={cn(
                  "border rounded-md overflow-hidden transition-all",
                  needsContactToday 
                    ? "border-orange-500/50 bg-orange-500/5" 
                    : "border-border bg-card"
                )}
              >
                {/* User Header */}
                <div 
                  className={cn(
                    "p-3 md:p-4 cursor-pointer transition-colors",
                    needsContactToday 
                      ? "hover:bg-orange-500/10" 
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                >
                  {/* Mobile Layout */}
                  <div className="flex flex-col gap-3 md:hidden">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          needsContactToday 
                            ? "bg-orange-500/20" 
                            : "bg-primary/20"
                        )}>
                          <User className={cn(
                            "w-4 h-4",
                            needsContactToday ? "text-orange-400" : "text-primary"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-foreground text-xs truncate">
                            {user.displayName}
                          </h4>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            J{user.nextCheckpoint?.day_number || "—"} • {
                              user.nextCheckpoint 
                                ? new Date(user.nextCheckpoint.contact_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                                : "Fin"
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-bold text-foreground">
                            {user.completedCheckpoints}/{user.totalCheckpoints}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    
                    {/* Badges */}
                    <div className="flex flex-wrap gap-1">
                      {needsContactToday && (
                        <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[8px] font-bold rounded uppercase">
                          À contacter
                        </span>
                      )}
                      {user.needsVerification && (
                        <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded uppercase">
                          Vérif
                        </span>
                      )}
                      {!needsContactToday && needsContactTomorrow && (
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[8px] font-bold rounded uppercase">
                          Demain
                        </span>
                      )}
                    </div>

                    {/* Quick actions for today's checkpoint - Mobile */}
                    {user.todayCheckpoint && (
                      <div className="flex items-center gap-3 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            checked={user.todayCheckpoint.message_sent}
                            onCheckedChange={(checked) => 
                              updateFollowup(user.todayCheckpoint!.id, 'message_sent', checked as boolean)
                            }
                            className="w-4 h-4 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                          <span className="text-[9px] text-muted-foreground">Msg</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            checked={user.todayCheckpoint.is_blocked}
                            onCheckedChange={(checked) => 
                              updateFollowup(user.todayCheckpoint!.id, 'is_blocked', checked as boolean)
                            }
                            className="w-4 h-4 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                          />
                          <span className="text-[9px] text-muted-foreground">Bloq</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            checked={user.todayCheckpoint.correct_actions}
                            onCheckedChange={(checked) => 
                              updateFollowup(user.todayCheckpoint!.id, 'correct_actions', checked as boolean)
                            }
                            className="w-4 h-4 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          />
                          <span className="text-[9px] text-muted-foreground">OK</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            checked={user.todayCheckpoint.call_done}
                            onCheckedChange={(checked) => 
                              updateFollowup(user.todayCheckpoint!.id, 'call_done', checked as boolean)
                            }
                            className="w-4 h-4 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                          />
                          <span className="text-[9px] text-muted-foreground">Call</span>
                        </div>
                      </div>
                    )}

                    {/* Progress Bar - Mobile */}
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", getProgressColor(user.completedCheckpoints, user.totalCheckpoints))}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:block">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          needsContactToday 
                            ? "bg-orange-500/20" 
                            : "bg-primary/20"
                        )}>
                          <User className={cn(
                            "w-5 h-5",
                            needsContactToday ? "text-orange-400" : "text-primary"
                          )} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground text-sm">
                              {user.displayName}
                            </h4>
                            {needsContactToday && (
                              <span className="px-2 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded uppercase">
                                À contacter
                              </span>
                            )}
                            {user.needsVerification && (
                              <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded uppercase">
                                Vérification
                              </span>
                            )}
                            {!needsContactToday && needsContactTomorrow && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-bold rounded uppercase">
                                Demain
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            Jour {user.nextCheckpoint?.day_number || "—"} • Prochain: {
                              user.nextCheckpoint 
                                ? new Date(user.nextCheckpoint.contact_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                                : "Terminé"
                            }
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {/* Quick actions for today's checkpoint */}
                        {user.todayCheckpoint && (
                          <div className="flex items-center gap-2 border-r border-border pr-4" onClick={(e) => e.stopPropagation()}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Checkbox
                                    checked={user.todayCheckpoint.message_sent}
                                    onCheckedChange={(checked) => 
                                      updateFollowup(user.todayCheckpoint!.id, 'message_sent', checked as boolean)
                                    }
                                    className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Message envoyé</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Checkbox
                                    checked={user.todayCheckpoint.is_blocked}
                                    onCheckedChange={(checked) => 
                                      updateFollowup(user.todayCheckpoint!.id, 'is_blocked', checked as boolean)
                                    }
                                    className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Situation bloquante</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Checkbox
                                    checked={user.todayCheckpoint.correct_actions}
                                    onCheckedChange={(checked) => 
                                      updateFollowup(user.todayCheckpoint!.id, 'correct_actions', checked as boolean)
                                    }
                                    className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Bonnes actions</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Checkbox
                                    checked={user.todayCheckpoint.call_done}
                                    onCheckedChange={(checked) => 
                                      updateFollowup(user.todayCheckpoint!.id, 'call_done', checked as boolean)
                                    }
                                    className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Call effectué</TooltipContent>
                            </Tooltip>
                          </div>
                        )}

                        {/* Progress */}
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">
                            {user.completedCheckpoints}/{user.totalCheckpoints}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            checkpoints
                          </p>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Progress Bar - Desktop */}
                    <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", getProgressColor(user.completedCheckpoints, user.totalCheckpoints))}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border/50 p-3 md:p-4">
                    <p className="text-[10px] md:text-xs font-mono uppercase text-muted-foreground mb-2 md:mb-3">
                      Historique des contacts (80 jours)
                    </p>
                    
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-2 max-h-64 overflow-y-auto">
                      {user.followups.map((followup) => {
                        const isToday = followup.contact_date === today;
                        const isTomorrow = followup.contact_date === tomorrow;
                        const isDayAfter = followup.contact_date === dayAfter;
                        const isPast = followup.contact_date < today;
                        const isMissed = isPast && !followup.message_sent && !followup.call_done;

                        return (
                          <div 
                            key={followup.id} 
                            className={cn(
                              "p-2.5 rounded-md border",
                              isToday && "bg-orange-500/20 border-orange-500/50",
                              isTomorrow && "bg-blue-500/10 border-blue-500/30",
                              isDayAfter && "bg-purple-500/10 border-purple-500/30",
                              isMissed && "bg-red-500/10 border-red-500/30",
                              !isToday && !isTomorrow && !isDayAfter && !isMissed && "border-border"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold">J{followup.day_number}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {new Date(followup.contact_date).toLocaleDateString("fr-FR", { 
                                    day: "2-digit", 
                                    month: "short"
                                  })}
                                </span>
                              </div>
                              {isToday && (
                                <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[8px] rounded font-bold">
                                  AUJ.
                                </span>
                              )}
                              {isTomorrow && (
                                <span className="px-1.5 py-0.5 bg-blue-500/30 text-blue-400 text-[8px] rounded font-bold">
                                  DEM.
                                </span>
                              )}
                              {isDayAfter && (
                                <span className="px-1.5 py-0.5 bg-purple-500/30 text-purple-400 text-[8px] rounded font-bold">
                                  J+2
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Checkbox
                                  checked={followup.message_sent}
                                  onCheckedChange={(checked) => 
                                    updateFollowup(followup.id, 'message_sent', checked as boolean)
                                  }
                                  className="w-4 h-4 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                />
                                <MessageSquare className="w-3 h-3 text-muted-foreground" />
                              </div>
                              <div className="flex items-center gap-1">
                                <Checkbox
                                  checked={followup.is_blocked}
                                  onCheckedChange={(checked) => 
                                    updateFollowup(followup.id, 'is_blocked', checked as boolean)
                                  }
                                  className="w-4 h-4 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                />
                                <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                              </div>
                              <div className="flex items-center gap-1">
                                <Checkbox
                                  checked={followup.correct_actions}
                                  onCheckedChange={(checked) => 
                                    updateFollowup(followup.id, 'correct_actions', checked as boolean)
                                  }
                                  className="w-4 h-4 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                />
                                <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
                              </div>
                              <div className="flex items-center gap-1">
                                <Checkbox
                                  checked={followup.call_done}
                                  onCheckedChange={(checked) => 
                                    updateFollowup(followup.id, 'call_done', checked as boolean)
                                  }
                                  className="w-4 h-4 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                                />
                                <Phone className="w-3 h-3 text-muted-foreground" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Desktop Table View */}
                    <div className="hidden md:block border border-border rounded-md overflow-hidden max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="h-8 text-[10px] font-mono w-16">Jour</TableHead>
                            <TableHead className="h-8 text-[10px] font-mono">Date</TableHead>
                            <TableHead className="h-8 text-[10px] font-mono text-center">
                              <Tooltip>
                                <TooltipTrigger>
                                  <MessageSquare className="w-3.5 h-3.5 mx-auto" />
                                </TooltipTrigger>
                                <TooltipContent>Message envoyé</TooltipContent>
                              </Tooltip>
                            </TableHead>
                            <TableHead className="h-8 text-[10px] font-mono text-center">
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="w-3.5 h-3.5 mx-auto" />
                                </TooltipTrigger>
                                <TooltipContent>Situation bloquante</TooltipContent>
                              </Tooltip>
                            </TableHead>
                            <TableHead className="h-8 text-[10px] font-mono text-center">
                              <Tooltip>
                                <TooltipTrigger>
                                  <CheckCircle2 className="w-3.5 h-3.5 mx-auto" />
                                </TooltipTrigger>
                                <TooltipContent>Bonnes actions</TooltipContent>
                              </Tooltip>
                            </TableHead>
                            <TableHead className="h-8 text-[10px] font-mono text-center">
                              <Tooltip>
                                <TooltipTrigger>
                                  <Phone className="w-3.5 h-3.5 mx-auto" />
                                </TooltipTrigger>
                                <TooltipContent>Call effectué</TooltipContent>
                              </Tooltip>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {user.followups.map((followup) => {
                            const isToday = followup.contact_date === today;
                            const isTomorrow = followup.contact_date === tomorrow;
                            const isDayAfter = followup.contact_date === dayAfter;
                            const isPast = followup.contact_date < today;
                            const isMissed = isPast && !followup.message_sent && !followup.call_done;

                            return (
                              <TableRow 
                                key={followup.id} 
                                className={cn(
                                  "hover:bg-muted/30",
                                  isToday && "bg-orange-500/20",
                                  isTomorrow && "bg-blue-500/10",
                                  isDayAfter && "bg-purple-500/10",
                                  isMissed && "bg-red-500/10"
                                )}
                              >
                                <TableCell className="py-2 text-xs font-mono font-bold">
                                  J{followup.day_number}
                                </TableCell>
                                <TableCell className="py-2 text-xs font-mono text-muted-foreground">
                                  {new Date(followup.contact_date).toLocaleDateString("fr-FR", { 
                                    day: "2-digit", 
                                    month: "short",
                                    year: "numeric"
                                  })}
                                  {isToday && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-orange-500 text-white text-[9px] rounded font-bold">
                                      AUJOURD'HUI
                                    </span>
                                  )}
                                  {isTomorrow && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-blue-500/30 text-blue-400 text-[9px] rounded font-bold">
                                      DEMAIN
                                    </span>
                                  )}
                                  {isDayAfter && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-purple-500/30 text-purple-400 text-[9px] rounded font-bold">
                                      J+2
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  <Checkbox
                                    checked={followup.message_sent}
                                    onCheckedChange={(checked) => 
                                      updateFollowup(followup.id, 'message_sent', checked as boolean)
                                    }
                                    className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                  />
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  <Checkbox
                                    checked={followup.is_blocked}
                                    onCheckedChange={(checked) => 
                                      updateFollowup(followup.id, 'is_blocked', checked as boolean)
                                    }
                                    className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                  />
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  <Checkbox
                                    checked={followup.correct_actions}
                                    onCheckedChange={(checked) => 
                                      updateFollowup(followup.id, 'correct_actions', checked as boolean)
                                    }
                                    className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                  />
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  <Checkbox
                                    checked={followup.call_done}
                                    onCheckedChange={(checked) => 
                                      updateFollowup(followup.id, 'call_done', checked as boolean)
                                    }
                                    className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
