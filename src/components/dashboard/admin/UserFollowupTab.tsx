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
  Plus,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export const UserFollowupTab = () => {
  const [users, setUsers] = useState<FollowupUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

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

      const today = new Date().toISOString().split('T')[0];
      const nextCheckpoint = userFollowups.find(f => 
        f.contact_date >= today && !f.message_sent && !f.call_done
      ) || null;

      return {
        id: userId,
        displayName: profile?.display_name || `Utilisateur ${userId.slice(0, 8)}`,
        followups: userFollowups,
        totalCheckpoints: userFollowups.length,
        completedCheckpoints,
        nextCheckpoint,
        startDate: userFollowups[0]?.contact_date || today,
      };
    });

    setUsers(followupUsers);
    setLoading(false);
  };

  useEffect(() => {
    fetchFollowups();
  }, []);

  const initializeFollowup = async (userId: string) => {
    setUpdating(userId);
    
    const { error } = await supabase.rpc("initialize_user_followups", {
      p_user_id: userId,
    });

    if (error) {
      console.error("Error initializing followup:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'initialiser le suivi.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Suivi initialisé",
        description: "Les checkpoints ont été créés pour cet utilisateur.",
      });
      fetchFollowups();
    }
    
    setUpdating(null);
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="p-4 bg-card border border-border rounded-md">
          <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">
            Utilisateurs suivis
          </p>
          <p className="text-2xl font-bold text-foreground">{users.length}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-md">
          <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">
            Checkpoints aujourd'hui
          </p>
          <p className="text-2xl font-bold text-orange-400">
            {users.filter(u => u.nextCheckpoint?.contact_date === new Date().toISOString().split('T')[0]).length}
          </p>
        </div>
        <div className="p-4 bg-card border border-border rounded-md">
          <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">
            Calls cette semaine
          </p>
          <p className="text-2xl font-bold text-blue-400">
            {users.reduce((sum, u) => sum + u.followups.filter(f => f.call_done).length, 0)}
          </p>
        </div>
        <div className="p-4 bg-card border border-border rounded-md">
          <p className="text-[10px] text-muted-foreground font-mono uppercase mb-1">
            Situations bloquantes
          </p>
          <p className="text-2xl font-bold text-red-400">
            {users.reduce((sum, u) => sum + u.followups.filter(f => f.is_blocked).length, 0)}
          </p>
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
          {users.map((user) => {
            const isExpanded = expandedUser === user.id;
            const progress = (user.completedCheckpoints / user.totalCheckpoints) * 100;
            const today = new Date().toISOString().split('T')[0];

            return (
              <div
                key={user.id}
                className="border border-border bg-card rounded-md overflow-hidden"
              >
                {/* User Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">
                          {user.displayName}
                        </h4>
                        <p className="text-xs text-muted-foreground font-mono">
                          Jour {user.nextCheckpoint?.day_number || "—"} • Prochain contact: {
                            user.nextCheckpoint 
                              ? new Date(user.nextCheckpoint.contact_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                              : "Terminé"
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
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

                  {/* Progress Bar */}
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all", getProgressColor(user.completedCheckpoints, user.totalCheckpoints))}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border/50 p-4">
                    <p className="text-xs font-mono uppercase text-muted-foreground mb-3">
                      Historique des contacts (80 jours)
                    </p>
                    <div className="border border-border rounded-md overflow-hidden max-h-80 overflow-y-auto">
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
                            const isPast = followup.contact_date < today;
                            const isMissed = isPast && !followup.message_sent && !followup.call_done;

                            return (
                              <TableRow 
                                key={followup.id} 
                                className={cn(
                                  "hover:bg-muted/30",
                                  isToday && "bg-primary/10",
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
                                    <span className="ml-2 px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] rounded">
                                      AUJOURD'HUI
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
