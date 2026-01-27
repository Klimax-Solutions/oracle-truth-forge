import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Shield, ShieldCheck, User, UserPlus, Trash2, Crown } from "lucide-react";
import { toast } from "sonner";

interface UserWithRole {
  user_id: string;
  email: string;
  display_name: string | null;
  roles: string[];
}

export const RoleManagement = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("admin");

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
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name");

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

    // Get user emails from auth (we'll use profile display_name as fallback)
    const usersMap = new Map<string, UserWithRole>();

    profiles?.forEach((profile) => {
      usersMap.set(profile.user_id, {
        user_id: profile.user_id,
        email: profile.display_name || "Unknown",
        display_name: profile.display_name,
        roles: [],
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestion des Rôles</h2>
          <p className="text-muted-foreground">
            Attribuez des rôles admin aux utilisateurs
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Ajouter un Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
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
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={addRole} disabled={!selectedUser}>
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Crown className="w-4 h-4" />
            <span className="text-sm">Super Admins</span>
          </div>
          <p className="text-2xl font-bold">
            {users.filter(u => u.roles.includes('super_admin')).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-sm">Admins</span>
          </div>
          <p className="text-2xl font-bold">
            {users.filter(u => u.roles.includes('admin')).length}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <User className="w-4 h-4" />
            <span className="text-sm">Membres</span>
          </div>
          <p className="text-2xl font-bold">
            {users.filter(u => u.roles.includes('member') && !u.roles.includes('admin') && !u.roles.includes('super_admin')).length}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Rôles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Aucun utilisateur trouvé
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div className="font-medium">{user.display_name || "Sans nom"}</div>
                    <div className="text-sm text-muted-foreground">{user.user_id.slice(0, 8)}...</div>
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
