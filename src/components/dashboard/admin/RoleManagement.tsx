import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Shield, 
  ShieldCheck, 
  User, 
  UserPlus, 
  Trash2, 
  Crown, 
  MoreHorizontal,
  Snowflake,
  Ban,
  UserX,
  CheckCircle,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  Mail,
  IdCard,
  UserCircle,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { AdminUserDataViewer } from "./AdminUserDataViewer";

type UserStatus = "active" | "frozen" | "banned";

interface UserWithRole {
  user_id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  roles: string[];
  status: UserStatus;
  status_reason: string | null;
}

export const RoleManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"freeze" | "ban" | "remove" | "unfreeze" | "unban" | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [actionReason, setActionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [editingFirstNameUserId, setEditingFirstNameUserId] = useState<string | null>(null);
  const [editingFirstNameValue, setEditingFirstNameValue] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [dataViewerUserId, setDataViewerUserId] = useState<string | null>(null);
  const [dataViewerUserName, setDataViewerUserName] = useState("");

  useEffect(() => {
    checkSuperAdmin();
    fetchUsersWithRoles();
  }, []);

  const checkSuperAdmin = async () => {
    const { data, error } = await supabase.rpc('is_super_admin');
    if (!error && data) {
      setIsSuperAdmin(true);
    }
  };

  const fetchUsersWithRoles = async () => {
    setLoading(true);
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name, first_name, status, status_reason");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      setLoading(false);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      setLoading(false);
      return;
    }

    const usersMap = new Map<string, UserWithRole>();

    profiles?.forEach((profile) => {
      usersMap.set(profile.user_id, {
        user_id: profile.user_id,
        email: profile.display_name || "Unknown",
        display_name: profile.display_name,
        first_name: (profile as any).first_name || null,
        roles: [],
        status: (profile.status as UserStatus) || "active",
        status_reason: profile.status_reason,
      });
    });

    roles?.forEach((role) => {
      const user = usersMap.get(role.user_id);
      if (user) {
        user.roles.push(role.role);
      }
    });

    setUsers(Array.from(usersMap.values()));
    setLoading(false);
  };

  const addRole = async () => {
    if (!selectedUser || !selectedRole) return;

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("user_roles")
      .insert({
        user_id: selectedUser,
        role: selectedRole as any,
        assigned_by: currentUser?.id,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error("Cet utilisateur a déjà ce rôle");
      } else {
        toast.error("Erreur lors de l'ajout du rôle");
        console.error(error);
      }
      return;
    }

    toast.success("Rôle ajouté avec succès");
    setDialogOpen(false);
    setSelectedUser(null);
    fetchUsersWithRoles();
  };

  const removeRole = async (userId: string, role: "super_admin" | "admin" | "member") => {
    if (role === 'member') {
      toast.error("Impossible de retirer le rôle membre");
      return;
    }

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);

    if (error) {
      toast.error("Erreur lors de la suppression du rôle");
      console.error(error);
      return;
    }

    toast.success("Rôle retiré avec succès");
    fetchUsersWithRoles();
  };

  const saveFirstName = async (userId: string) => {
    const trimmed = editingFirstNameValue.trim();
    if (!trimmed) {
      toast.error("Le prénom ne peut pas être vide");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ first_name: trimmed } as any)
      .eq("user_id", userId);

    if (error) {
      toast.error("Erreur lors de la mise à jour du prénom");
      console.error(error);
    } else {
      toast.success("Prénom mis à jour");
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, first_name: trimmed } : u
      ));
    }
    setEditingFirstNameUserId(null);
  };

  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickActionsUserId, setQuickActionsUserId] = useState<string | null>(null);

  const openQuickActionsDialog = (userId: string) => {
    setQuickActionsUserId(userId);
    setQuickActionsOpen(true);
  };

  const openActionDialog = (userId: string, action: "freeze" | "ban" | "remove" | "unfreeze" | "unban") => {
    setQuickActionsOpen(false);
    setSelectedUser(userId);
    setActionType(action);
    setActionReason("");
    setActionDialogOpen(true);
  };

  const executeAction = async () => {
    if (!selectedUser || !actionType) return;
    
    setProcessing(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    try {
      if (actionType === "freeze") {
        const { error } = await supabase
          .from("profiles")
          .update({
            status: "frozen" as any,
            frozen_at: new Date().toISOString(),
            frozen_by: currentUser?.id,
            status_reason: actionReason || null,
          })
          .eq("user_id", selectedUser);
        if (error) throw error;
        toast.success("Utilisateur gelé avec succès");
      } 
      else if (actionType === "ban") {
        const { error } = await supabase
          .from("profiles")
          .update({
            status: "banned" as any,
            banned_at: new Date().toISOString(),
            banned_by: currentUser?.id,
            status_reason: actionReason || null,
          })
          .eq("user_id", selectedUser);
        if (error) throw error;
        toast.success("Utilisateur banni avec succès");
      }
      else if (actionType === "unfreeze" || actionType === "unban") {
        const { error } = await supabase
          .from("profiles")
          .update({
            status: "active" as any,
            frozen_at: null,
            banned_at: null,
            frozen_by: null,
            banned_by: null,
            status_reason: null,
          })
          .eq("user_id", selectedUser);
        if (error) throw error;
        toast.success("Utilisateur réactivé avec succès");
      }
      else if (actionType === "remove") {
        await supabase.from("verification_requests").delete().eq("user_id", selectedUser);
        await supabase.from("user_followups").delete().eq("user_id", selectedUser);
        await supabase.from("user_executions").delete().eq("user_id", selectedUser);
        await supabase.from("user_personal_trades").delete().eq("user_id", selectedUser);
        await supabase.from("user_custom_variables").delete().eq("user_id", selectedUser);
        await supabase.from("user_variable_types").delete().eq("user_id", selectedUser);
        await supabase.from("user_cycles").delete().eq("user_id", selectedUser);
        await supabase.from("user_roles").delete().eq("user_id", selectedUser);
        const { error } = await supabase.from("profiles").delete().eq("user_id", selectedUser);
        if (error) throw error;
        toast.success("Utilisateur supprimé avec succès");
      }

      setActionDialogOpen(false);
      fetchUsersWithRoles();
    } catch (error) {
      console.error("Error executing action:", error);
      toast.error("Erreur lors de l'exécution de l'action");
    } finally {
      setProcessing(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <Crown className="w-3 h-3" />;
      case 'admin': return <ShieldCheck className="w-3 h-3" />;
      case 'early_access': return <Shield className="w-3 h-3" />;
      default: return <User className="w-3 h-3" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return "default";
      case 'admin': return "secondary";
      case 'early_access': return "outline";
      default: return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return "Super Admin";
      case 'admin': return "Admin";
      case 'early_access': return "Early Access";
      default: return "Membre";
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'frozen':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
            <Snowflake className="w-3 h-3 mr-1" />
            Gelé
          </Badge>
        );
      case 'banned':
        return (
          <Badge variant="destructive">
            <Ban className="w-3 h-3 mr-1" />
            Banni
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Actif
          </Badge>
        );
    }
  };

  const getActionDialogContent = () => {
    const user = users.find(u => u.user_id === selectedUser);
    const userName = user?.first_name || user?.display_name || "cet utilisateur";

    switch (actionType) {
      case 'freeze':
        return {
          title: "Geler l'utilisateur",
          description: `Êtes-vous sûr de vouloir geler ${userName} ? Il ne pourra plus accéder à l'application.`,
          icon: <Snowflake className="w-6 h-6 text-blue-500" />,
          buttonText: "Geler",
          buttonVariant: "default" as const,
        };
      case 'ban':
        return {
          title: "Bannir l'utilisateur",
          description: `Êtes-vous sûr de vouloir bannir ${userName} ? Cette action est plus sévère qu'un gel.`,
          icon: <Ban className="w-6 h-6 text-destructive" />,
          buttonText: "Bannir",
          buttonVariant: "destructive" as const,
        };
      case 'remove':
        return {
          title: "Supprimer l'utilisateur",
          description: `Êtes-vous sûr de vouloir supprimer définitivement ${userName} ? Toutes ses données seront perdues.`,
          icon: <UserX className="w-6 h-6 text-destructive" />,
          buttonText: "Supprimer",
          buttonVariant: "destructive" as const,
        };
      case 'unfreeze':
      case 'unban':
        return {
          title: "Réactiver l'utilisateur",
          description: `Êtes-vous sûr de vouloir réactiver ${userName} ?`,
          icon: <CheckCircle className="w-6 h-6 text-green-500" />,
          buttonText: "Réactiver",
          buttonVariant: "default" as const,
        };
      default:
        return null;
    }
  };

  // Expandable profile detail panel
  const renderProfileDetail = (user: UserWithRole) => {
    const isEditingFirstName = editingFirstNameUserId === user.user_id;

    return (
      <div className="px-4 py-3 bg-muted/30 border-t border-border space-y-3">
        {/* User ID */}
        <div className="flex items-center gap-2">
          <IdCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground font-mono">{user.user_id}</span>
        </div>

        {/* Display name (username from signup) */}
        <div className="flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground">Nom d'utilisateur :</span>
          <span className="text-sm font-medium">{user.display_name || "—"}</span>
        </div>

        {/* Email (same as display_name currently, but shown distinctly) */}
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground">Email :</span>
          <span className="text-sm">{user.email}</span>
        </div>

        {/* First name - editable, separate field */}
        <div className="flex items-start gap-2 pt-1 border-t border-border/50">
          <User className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-xs text-primary font-semibold uppercase tracking-wider">Prénom (animation)</span>
            {isEditingFirstName ? (
              <div className="flex items-center gap-1 mt-1">
                <Input
                  value={editingFirstNameValue}
                  onChange={(e) => setEditingFirstNameValue(e.target.value)}
                  className="h-8 text-sm flex-1"
                  placeholder="Entrez le prénom..."
                  maxLength={50}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveFirstName(user.user_id);
                    if (e.key === "Escape") setEditingFirstNameUserId(null);
                  }}
                />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => saveFirstName(user.user_id)}>
                  <Check className="w-4 h-4 text-emerald-500" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingFirstNameUserId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-medium">{user.first_name || "Non défini"}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setEditingFirstNameUserId(user.user_id);
                    setEditingFirstNameValue(user.first_name || "");
                  }}
                >
                  Modifier
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Status reason if any */}
        {user.status_reason && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1 border-t border-border/50">
            <AlertTriangle className="w-3 h-3" />
            {user.status_reason}
          </div>
        )}

        {/* View all data button */}
        <div className="pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={(e) => {
              e.stopPropagation();
              setDataViewerUserId(user.user_id);
              setDataViewerUserName(user.first_name || user.display_name || "Utilisateur");
            }}
          >
            <Database className="w-4 h-4" />
            Voir toutes les données
          </Button>
        </div>
      </div>
    );
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Accès restreint</h2>
        <p className="text-muted-foreground">
          Seuls les super administrateurs peuvent gérer les rôles.
        </p>
      </div>
    );
  }

  const dialogContent = getActionDialogContent();

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Gestion des Membres</h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Gérez les rôles et le statut des utilisateurs
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <UserPlus className="w-4 h-4 mr-2" />
              Ajouter Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[90vw] md:max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un rôle</DialogTitle>
              <DialogDescription>
                Sélectionnez un utilisateur et le rôle à attribuer
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Utilisateur</Label>
                <Select value={selectedUser || ""} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter(u => !u.roles.includes('admin') && !u.roles.includes('super_admin'))
                      .map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.display_name || user.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="early_access">Early Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                Annuler
              </Button>
              <Button onClick={addRole} disabled={!selectedUser} className="w-full sm:w-auto">
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4">
        <div className="p-3 md:p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground mb-1">
            <Crown className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-[10px] md:text-sm">Super</span>
          </div>
          <p className="text-lg md:text-2xl font-bold">
            {users.filter(u => u.roles.includes('super_admin')).length}
          </p>
        </div>
        <div className="p-3 md:p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground mb-1">
            <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-[10px] md:text-sm">Admins</span>
          </div>
          <p className="text-lg md:text-2xl font-bold">
            {users.filter(u => u.roles.includes('admin')).length}
          </p>
        </div>
        <div className="p-3 md:p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground mb-1">
            <User className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-[10px] md:text-sm">Actifs</span>
          </div>
          <p className="text-lg md:text-2xl font-bold">
            {users.filter(u => u.status === 'active').length}
          </p>
        </div>
        <div className="p-3 md:p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-1.5 md:gap-2 text-amber-500 mb-1">
            <Shield className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-[10px] md:text-sm">Early</span>
          </div>
          <p className="text-lg md:text-2xl font-bold text-amber-500">
            {users.filter(u => u.roles.includes('early_access')).length}
          </p>
        </div>
        <div className="p-3 md:p-4 rounded-lg border bg-card hidden md:block">
          <div className="flex items-center gap-1.5 md:gap-2 text-blue-500 mb-1">
            <Snowflake className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-[10px] md:text-sm">Gelés</span>
          </div>
          <p className="text-lg md:text-2xl font-bold text-blue-500">
            {users.filter(u => u.status === 'frozen').length}
          </p>
        </div>
        <div className="p-3 md:p-4 rounded-lg border bg-card hidden md:block">
          <div className="flex items-center gap-1.5 md:gap-2 text-destructive mb-1">
            <Ban className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-[10px] md:text-sm">Bannis</span>
          </div>
          <p className="text-lg md:text-2xl font-bold text-destructive">
            {users.filter(u => u.status === 'banned').length}
          </p>
        </div>
      </div>

      {/* Users List */}
      <div className="rounded-lg border overflow-hidden">
        <div className="divide-y divide-border">
          {loading ? (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucun utilisateur
            </div>
          ) : (
            users.map((user) => (
              <Collapsible
                key={user.user_id}
                open={expandedUserId === user.user_id}
                onOpenChange={(open) => setExpandedUserId(open ? user.user_id : null)}
              >
                <div className={cn(
                  "transition-colors",
                  user.status !== 'active' && 'opacity-60',
                  expandedUserId === user.user_id && 'bg-muted/10'
                )}>
                  {/* Main row - clickable to expand */}
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between gap-3 p-3 md:p-4 cursor-pointer hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ChevronDown className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
                          expandedUserId === user.user_id && "rotate-180"
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {user.display_name || "Sans nom"}
                            {user.first_name && (
                              <span className="text-muted-foreground font-normal ml-2">
                                — {user.first_name}
                              </span>
                            )}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.roles.map((role) => (
                              <Badge 
                                key={role} 
                                variant={getRoleBadgeVariant(role) as any}
                                className="flex items-center gap-1 text-[10px]"
                              >
                                {getRoleIcon(role)}
                                {getRoleLabel(role)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(user.status)}
                        {!user.roles.includes('super_admin') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              openQuickActionsDialog(user.user_id);
                            }}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  {/* Expanded detail panel */}
                  <CollapsibleContent>
                    {renderProfileDetail(user)}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions Dialog */}
      <Dialog open={quickActionsOpen} onOpenChange={setQuickActionsOpen}>
        <DialogContent className="max-w-sm">
          {(() => {
            const qaUser = users.find(u => u.user_id === quickActionsUserId);
            if (!qaUser) return null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <MoreHorizontal className="w-5 h-5" />
                    Actions rapides
                  </DialogTitle>
                  <DialogDescription>
                    <span className="font-medium text-foreground">{qaUser.display_name || "Sans nom"}</span>
                    {qaUser.first_name && (
                      <span className="text-muted-foreground"> — Prénom: {qaUser.first_name}</span>
                    )}
                    <br />
                    <span className="text-xs font-mono">{qaUser.user_id.slice(0, 20)}...</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  {qaUser.status === 'active' && (
                    <>
                      <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => openActionDialog(qaUser.user_id, 'freeze')}>
                        <Snowflake className="w-4 h-4 text-blue-500" />
                        Geler l'utilisateur
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => openActionDialog(qaUser.user_id, 'ban')}>
                        <Ban className="w-4 h-4 text-destructive" />
                        Bannir l'utilisateur
                      </Button>
                    </>
                  )}
                  {qaUser.status === 'frozen' && (
                    <>
                      <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => openActionDialog(qaUser.user_id, 'unfreeze')}>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Dégeler l'utilisateur
                      </Button>
                      <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => openActionDialog(qaUser.user_id, 'ban')}>
                        <Ban className="w-4 h-4 text-destructive" />
                        Bannir l'utilisateur
                      </Button>
                    </>
                  )}
                  {qaUser.status === 'banned' && (
                    <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => openActionDialog(qaUser.user_id, 'unban')}>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Débannir l'utilisateur
                    </Button>
                  )}
                  {qaUser.roles.includes('admin') && !qaUser.roles.includes('super_admin') && (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-11"
                      onClick={() => {
                        setQuickActionsOpen(false);
                        removeRole(qaUser.user_id, 'admin');
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-orange-500" />
                      Retirer le rôle Admin
                    </Button>
                  )}
                  <div className="border-t border-border my-2" />
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-11 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => openActionDialog(qaUser.user_id, 'remove')}
                  >
                    <UserX className="w-4 h-4" />
                    Supprimer définitivement
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          {dialogContent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {dialogContent.icon}
                  <DialogTitle>{dialogContent.title}</DialogTitle>
                </div>
                <DialogDescription>
                  {dialogContent.description}
                </DialogDescription>
              </DialogHeader>
              
              {(actionType === 'freeze' || actionType === 'ban') && (
                <div className="space-y-2 py-4">
                  <Label>Raison (optionnel)</Label>
                  <Textarea
                    placeholder="Expliquez la raison de cette action..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
              
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setActionDialogOpen(false)} className="w-full sm:w-auto" disabled={processing}>
                  Annuler
                </Button>
                <Button
                  variant={dialogContent.buttonVariant}
                  onClick={executeAction}
                  disabled={processing}
                  className="w-full sm:w-auto"
                >
                  {processing ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    dialogContent.buttonText
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* User Data Viewer */}
      <AdminUserDataViewer
        userId={dataViewerUserId}
        userName={dataViewerUserName}
        open={!!dataViewerUserId}
        onOpenChange={(open) => {
          if (!open) setDataViewerUserId(null);
        }}
      />
    </div>
  );
};
