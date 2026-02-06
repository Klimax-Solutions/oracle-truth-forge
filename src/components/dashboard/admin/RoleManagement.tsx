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
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

type UserStatus = "active" | "frozen" | "banned";

interface UserWithRole {
  user_id: string;
  email: string;
  display_name: string | null;
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
  const [editingNameUserId, setEditingNameUserId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

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
    
    // Fetch all profiles with status
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name, status, status_reason");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      setLoading(false);
      return;
    }

    // Fetch all roles
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

  const startEditingName = (userId: string, currentName: string | null) => {
    setEditingNameUserId(userId);
    setEditingNameValue(currentName || "");
  };

  const saveDisplayName = async () => {
    if (!editingNameUserId) return;
    const trimmed = editingNameValue.trim();
    if (!trimmed) {
      toast.error("Le prénom ne peut pas être vide");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("user_id", editingNameUserId);

    if (error) {
      toast.error("Erreur lors de la mise à jour du prénom");
      console.error(error);
    } else {
      toast.success("Prénom mis à jour");
      setUsers(prev => prev.map(u => 
        u.user_id === editingNameUserId ? { ...u, display_name: trimmed } : u
      ));
    }
    setEditingNameUserId(null);
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
        // Delete all user data in order (child tables first)
        
        // Delete verification requests
        await supabase
          .from("verification_requests")
          .delete()
          .eq("user_id", selectedUser);

        // Delete user followups
        await supabase
          .from("user_followups")
          .delete()
          .eq("user_id", selectedUser);

        // Delete user executions
        await supabase
          .from("user_executions")
          .delete()
          .eq("user_id", selectedUser);

        // Delete user personal trades
        await supabase
          .from("user_personal_trades")
          .delete()
          .eq("user_id", selectedUser);

        // Delete user custom variables
        await supabase
          .from("user_custom_variables")
          .delete()
          .eq("user_id", selectedUser);

        // Delete user variable types
        await supabase
          .from("user_variable_types")
          .delete()
          .eq("user_id", selectedUser);

        // Delete user cycles
        await supabase
          .from("user_cycles")
          .delete()
          .eq("user_id", selectedUser);

        // Delete all user roles
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", selectedUser);

        // Finally delete profile
        const { error } = await supabase
          .from("profiles")
          .delete()
          .eq("user_id", selectedUser);

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
      case 'super_admin':
        return <Crown className="w-3 h-3" />;
      case 'admin':
        return <ShieldCheck className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return "default";
      case 'admin':
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return "Super Admin";
      case 'admin':
        return "Admin";
      default:
        return "Membre";
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
    const userName = user?.display_name || "cet utilisateur";

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

      {/* Stats - responsive grid */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
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

      {/* Users List - Card layout on mobile, table on desktop */}
      <div className="rounded-lg border overflow-hidden">
        {/* Mobile: Card view */}
        <div className="block md:hidden divide-y divide-border">
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
              <div key={user.user_id} className={cn("p-3", user.status !== 'active' && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground font-mono mb-0.5">{user.user_id.slice(0, 16)}...</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{user.display_name || "Sans nom"}</p>
                      {editingNameUserId !== user.user_id && (
                        <button onClick={() => startEditingName(user.user_id, user.display_name)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {editingNameUserId === user.user_id && (
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          className="h-7 text-sm"
                          placeholder="Nouveau prénom"
                          maxLength={50}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveDisplayName();
                            if (e.key === "Escape") setEditingNameUserId(null);
                          }}
                        />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={saveDisplayName}>
                          <Check className="w-3 h-3 text-emerald-500" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingNameUserId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(user.status)}
                    {!user.roles.includes('super_admin') && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openQuickActionsDialog(user.user_id)}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
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
            ))
          )}
        </div>

        {/* Desktop: Table view */}
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Rôles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Aucun utilisateur trouvé
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.user_id} className={user.status !== 'active' ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="text-xs text-muted-foreground font-mono mb-0.5">{user.user_id.slice(0, 16)}...</div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.display_name || "Sans nom"}</span>
                      {editingNameUserId !== user.user_id && (
                        <button onClick={() => startEditingName(user.user_id, user.display_name)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {editingNameUserId === user.user_id && (
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          className="h-7 text-sm w-40"
                          placeholder="Nouveau prénom"
                          maxLength={50}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveDisplayName();
                            if (e.key === "Escape") setEditingNameUserId(null);
                          }}
                        />
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={saveDisplayName}>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingNameUserId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    {user.status_reason && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {user.status_reason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(user.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      {user.roles.map((role) => (
                        <Badge 
                          key={role} 
                          variant={getRoleBadgeVariant(role) as any}
                          className="flex items-center gap-1"
                        >
                          {getRoleIcon(role)}
                          {getRoleLabel(role)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.roles.includes('admin') && !user.roles.includes('super_admin') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRole(user.user_id, 'admin')}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {!user.roles.includes('super_admin') && (
                        <Button variant="ghost" size="sm" onClick={() => openQuickActionsDialog(user.user_id)}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
                    <br />
                    <span className="text-xs font-mono">{qaUser.user_id.slice(0, 20)}...</span>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  {qaUser.status === 'active' && (
                    <>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        onClick={() => openActionDialog(qaUser.user_id, 'freeze')}
                      >
                        <Snowflake className="w-4 h-4 text-blue-500" />
                        Geler l'utilisateur
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        onClick={() => openActionDialog(qaUser.user_id, 'ban')}
                      >
                        <Ban className="w-4 h-4 text-destructive" />
                        Bannir l'utilisateur
                      </Button>
                    </>
                  )}
                  {qaUser.status === 'frozen' && (
                    <>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        onClick={() => openActionDialog(qaUser.user_id, 'unfreeze')}
                      >
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Dégeler l'utilisateur
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        onClick={() => openActionDialog(qaUser.user_id, 'ban')}
                      >
                        <Ban className="w-4 h-4 text-destructive" />
                        Bannir l'utilisateur
                      </Button>
                    </>
                  )}
                  {qaUser.status === 'banned' && (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-11"
                      onClick={() => openActionDialog(qaUser.user_id, 'unban')}
                    >
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Débannir l'utilisateur
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
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
                  Annuler
                </Button>
                <Button 
                  variant={dialogContent.buttonVariant}
                  onClick={executeAction}
                  disabled={processing}
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
    </div>
  );
};
