import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  User,
  Phone,
  Mail,
  Clock,
  LogIn,
  Activity,
  Database,
  Circle,
  CalendarDays,
  Hash,
  KeyRound,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface EACrmMember {
  user_id: string;
  first_name: string;
  email: string;
  phone: string;
  display_name: string | null;
  early_access_type: string | null;
  expires_at: string | null;
  request_created_at: string;
  approved_at: string | null;
  // Activity
  session_count: number;
  first_login: string | null;
  last_login: string | null;
  execution_count: number;
  password_set: boolean;
  is_online: boolean;
}

export const EarlyAccessCRM = () => {
  const [members, setMembers] = useState<EACrmMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCrmData = async () => {
    setLoading(true);

    // 1. Get approved EA requests
    const { data: approvedRequests } = await supabase
      .from("early_access_requests" as any)
      .select("*")
      .eq("status", "approuvée")
      .order("created_at", { ascending: false });

    if (!approvedRequests || approvedRequests.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    // 2. Get EA roles
    const { data: eaRoles } = await supabase
      .from("user_roles")
      .select("user_id, early_access_type, expires_at" as any)
      .eq("role", "early_access");

    // 3. Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, first_name");

    // 4. Get sessions for all users
    const { data: sessions } = await supabase
      .from("user_sessions")
      .select("user_id, created_at, updated_at");

    // 5. Get execution counts
    const { data: executions } = await supabase
      .from("user_executions")
      .select("user_id");

    // Build member data by matching email from requests to profiles
    const membersList: EACrmMember[] = [];

    for (const req of approvedRequests as any[]) {
      // Find matching role by looking up profile with same email pattern
      const role = (eaRoles as any[])?.find((r: any) => {
        const profile = (profiles as any[])?.find((p: any) => p.user_id === r.user_id);
        return profile !== undefined;
      });

      // Try to find user by matching profiles
      let matchedUserId: string | null = null;
      let matchedProfile: any = null;

      // Match by looking at all EA role user_ids and finding the one whose profile first_name matches
      for (const r of (eaRoles as any[]) || []) {
        const profile = (profiles as any[])?.find((p: any) => p.user_id === r.user_id);
        if (profile) {
          // Match by first_name from the request
          const profileName = (profile.first_name || profile.display_name || "").toLowerCase().trim();
          const reqName = (req.first_name || "").toLowerCase().trim();
          if (profileName === reqName) {
            matchedUserId = r.user_id;
            matchedProfile = profile;
            break;
          }
        }
      }

      // If no match by name, try to find any EA user not already in our list
      if (!matchedUserId) {
        for (const r of (eaRoles as any[]) || []) {
          if (!membersList.some((m) => m.user_id === r.user_id)) {
            const profile = (profiles as any[])?.find((p: any) => p.user_id === r.user_id);
            matchedUserId = r.user_id;
            matchedProfile = profile;
            break;
          }
        }
      }

      const userRole = (eaRoles as any[])?.find((r: any) => r.user_id === matchedUserId);
      const userSessions = (sessions as any[])?.filter((s: any) => s.user_id === matchedUserId) || [];
      const userExecCount = (executions as any[])?.filter((e: any) => e.user_id === matchedUserId).length || 0;

      // Check online: last session updated within last 10 minutes
      const lastSessionUpdate = userSessions.length > 0
        ? Math.max(...userSessions.map((s: any) => new Date(s.updated_at).getTime()))
        : 0;
      const isOnline = lastSessionUpdate > Date.now() - 10 * 60 * 1000;

      const firstLogin = userSessions.length > 0
        ? userSessions.reduce((min: any, s: any) => {
            const d = new Date(s.created_at).getTime();
            return d < min ? d : min;
          }, Infinity)
        : null;

      const lastLogin = userSessions.length > 0
        ? userSessions.reduce((max: any, s: any) => {
            const d = new Date(s.updated_at).getTime();
            return d > max ? d : max;
          }, 0)
        : null;

      membersList.push({
        user_id: matchedUserId || req.id,
        first_name: req.first_name,
        email: req.email,
        phone: req.phone,
        display_name: matchedProfile?.display_name || null,
        early_access_type: userRole?.early_access_type || "precall",
        expires_at: userRole?.expires_at || null,
        request_created_at: req.created_at,
        approved_at: req.reviewed_at,
        session_count: userSessions.length,
        first_login: firstLogin ? new Date(firstLogin).toISOString() : null,
        last_login: lastLogin ? new Date(lastLogin).toISOString() : null,
        execution_count: userExecCount,
        password_set: false, // We can't check this without admin API
        is_online: isOnline,
      });
    }

    setMembers(membersList);
    setLoading(false);
  };

  useEffect(() => {
    fetchCrmData();
  }, []);

  const [resending, setResending] = useState<string | null>(null);

  const handleResetPassword = async (member: EACrmMember) => {
    setResetting(member.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("approve-early-access", {
        body: { action: "reset_password", userId: member.user_id },
      });
      if (error) throw error;
      toast({ title: "Mot de passe réinitialisé", description: data?.message });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setResetting(null);
  };

  const handleResendLink = async (member: EACrmMember) => {
    setResending(member.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("approve-early-access", {
        body: { action: "resend_magic_link", email: member.email },
      });
      if (error) throw error;
      if (data?.magic_link) {
        // Copy link to clipboard if email failed
        await navigator.clipboard.writeText(data.magic_link);
        toast({ title: "Lien copié", description: "Le lien de connexion a été copié dans le presse-papier (email rate-limité)." });
      } else {
        toast({ title: "Email envoyé", description: data?.message });
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
    setResending(null);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucun membre Early Access approuvé.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        CRM Early Access — Membres approuvés ({members.length})
      </h3>

      <div className="grid gap-3">
        {members.map((member) => (
          <div
            key={member.user_id}
            className="border border-border rounded-lg bg-card overflow-hidden"
          >
            {/* Header */}
            <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <Circle
                    className={`w-3 h-3 absolute -bottom-0.5 -right-0.5 ${
                      member.is_online
                        ? "text-emerald-500 fill-emerald-500"
                        : "text-muted-foreground/50 fill-muted-foreground/30"
                    }`}
                  />
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground">{member.first_name}</span>
                  <span
                    className={`ml-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full ${
                      member.early_access_type === "precall"
                        ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                    }`}
                  >
                    {member.early_access_type === "precall" ? "Pré-call" : "Post-call"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    member.is_online
                      ? "bg-emerald-500/20 text-emerald-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {member.is_online ? "● En ligne" : "○ Hors ligne"}
                </span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {/* Contact Info */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Coordonnées</p>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span>{member.phone}</span>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Chronologie</p>
                <div className="flex items-center gap-1.5 text-foreground">
                  <CalendarDays className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Soumission :</span>
                  <span>{formatDate(member.request_created_at)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <CalendarDays className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Approbation :</span>
                  <span>{formatDate(member.approved_at)}</span>
                </div>
                {member.expires_at && (
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <span className="text-muted-foreground">Expiration :</span>
                    <span>{formatDate(member.expires_at)}</span>
                  </div>
                )}
              </div>

              {/* Activity */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">Activité</p>
                <div className="flex items-center gap-1.5 text-foreground">
                  <LogIn className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">1ère connexion :</span>
                  <span>{formatDate(member.first_login)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <LogIn className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Dernière :</span>
                  <span>{formatDate(member.last_login)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Sessions :</span>
                  <span className="font-semibold">{member.session_count}</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Database className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Data récoltée :</span>
                  <span className={`font-semibold ${member.execution_count > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {member.execution_count} exécution{member.execution_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  member.session_count > 0
                    ? "bg-emerald-500/20 text-emerald-500"
                    : "bg-destructive/20 text-destructive"
                }`}
              >
                {member.session_count > 0 ? "✓ S'est connecté" : "✗ Jamais connecté"}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  member.execution_count > 0
                    ? "bg-emerald-500/20 text-emerald-500"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {member.execution_count > 0 ? "✓ A récolté de la data" : "✗ Pas de data"}
              </span>
              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-5 text-[10px] gap-1"
                  onClick={() => handleResendLink(member)}
                  disabled={resending === member.user_id}
                >
                  {resending === member.user_id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Renvoyer le lien
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-5 text-[10px] gap-1"
                  onClick={() => handleResetPassword(member)}
                  disabled={resetting === member.user_id}
                >
                  {resetting === member.user_id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <KeyRound className="w-3 h-3" />
                  )}
                  Reset MDP
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
