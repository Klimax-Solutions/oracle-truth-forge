import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Save,
  User,
  ExternalLink,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";

interface EAUser {
  user_id: string;
  display_name: string | null;
  expires_at: string | null;
  role_id: string;
}

interface EASetting {
  id: string;
  user_id: string;
  button_key: string;
  button_label: string;
  button_url: string;
}

export const EarlyAccessManagement = () => {
  const [users, setUsers] = useState<EAUser[]>([]);
  const [settings, setSettings] = useState<EASetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newButtonKeys, setNewButtonKeys] = useState<Record<string, { label: string; url: string }>>({});
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);

    // Fetch all early_access roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("id, user_id, expires_at")
      .eq("role", "early_access");

    if (!roles || roles.length === 0) {
      setUsers([]);
      setSettings([]);
      setLoading(false);
      return;
    }

    const userIds = roles.map((r) => r.user_id);

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    // Fetch EA settings
    const { data: settingsData } = await supabase
      .from("early_access_settings")
      .select("*")
      .in("user_id", userIds);

    const eaUsers: EAUser[] = roles.map((r) => {
      const profile = profiles?.find((p) => p.user_id === r.user_id);
      return {
        user_id: r.user_id,
        display_name: profile?.display_name || `User ${r.user_id.slice(0, 8)}`,
        expires_at: r.expires_at,
        role_id: r.id,
      };
    });

    setUsers(eaUsers);
    setSettings((settingsData || []) as EASetting[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getUserSettings = (userId: string) => {
    return settings.filter((s) => s.user_id === userId);
  };

  const updateSetting = async (settingId: string, field: "button_label" | "button_url", value: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === settingId ? { ...s, [field]: value } : s))
    );
  };

  const saveSetting = async (setting: EASetting) => {
    setSaving(setting.id);
    const { error } = await supabase
      .from("early_access_settings")
      .update({
        button_label: setting.button_label,
        button_url: setting.button_url,
      })
      .eq("id", setting.id);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sauvegardé" });
    }
    setSaving(null);
  };

  const addButton = async (userId: string) => {
    const newData = newButtonKeys[userId];
    if (!newData?.label?.trim()) return;

    const key = newData.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setSaving(`new_${userId}`);

    const { data, error } = await supabase
      .from("early_access_settings")
      .insert({
        user_id: userId,
        button_key: key,
        button_label: newData.label,
        button_url: newData.url || "",
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else if (data) {
      setSettings((prev) => [...prev, data as EASetting]);
      setNewButtonKeys((prev) => ({ ...prev, [userId]: { label: "", url: "" } }));
      toast({ title: "Bouton ajouté" });
    }
    setSaving(null);
  };

  const deleteSetting = async (settingId: string) => {
    const { error } = await supabase
      .from("early_access_settings")
      .delete()
      .eq("id", settingId);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setSettings((prev) => prev.filter((s) => s.id !== settingId));
      toast({ title: "Bouton supprimé" });
    }
  };

  const updateExpiration = async (roleId: string, expiresAt: string) => {
    setSaving(`exp_${roleId}`);
    const { error } = await supabase
      .from("user_roles")
      .update({ expires_at: expiresAt || null })
      .eq("id", roleId);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.role_id === roleId ? { ...u, expires_at: expiresAt || null } : u))
      );
      toast({ title: "Expiration mise à jour" });
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 md:p-6 border-b border-border">
        <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">
          Gestion Early Access
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground font-mono">
          Personnalisation des boutons et URLs par membre Early Access
        </p>
      </div>

      <div className="flex-1 p-4 md:p-6 overflow-auto space-y-6">
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <User className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucun membre Early Access
            </h3>
            <p className="text-sm text-muted-foreground">
              Assignez le rôle Early Access à un membre via la gestion des rôles.
            </p>
          </div>
        ) : (
          users.map((user) => {
            const userSettings = getUserSettings(user.user_id);
            const newBtn = newButtonKeys[user.user_id] || { label: "", url: "" };

            return (
              <div
                key={user.user_id}
                className="border border-border rounded-md bg-card overflow-hidden"
              >
                {/* User header */}
                <div className="p-4 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">
                          {user.display_name}
                        </h4>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {user.user_id.slice(0, 12)}...
                        </p>
                      </div>
                    </div>

                    {/* Expiration */}
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        type="datetime-local"
                        value={user.expires_at ? new Date(user.expires_at).toISOString().slice(0, 16) : ""}
                        onChange={(e) => updateExpiration(user.role_id, e.target.value ? new Date(e.target.value).toISOString() : "")}
                        className="h-7 text-xs w-52"
                      />
                      {saving === `exp_${user.role_id}` && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Buttons configuration */}
                <div className="p-4 space-y-3">
                  <p className="text-[10px] font-mono uppercase text-muted-foreground">
                    Boutons personnalisés ({userSettings.length})
                  </p>

                  {/* Default buttons info */}
                  <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-md font-mono">
                    Boutons disponibles : "Continuer ma récolte", "Accéder à Oracle". Ajoutez des boutons personnalisés ci-dessous.
                  </div>

                  {userSettings.map((setting) => (
                    <div
                      key={setting.id}
                      className="flex items-center gap-2 p-2 border border-border/50 rounded-md"
                    >
                      <Input
                        value={setting.button_label}
                        onChange={(e) => updateSetting(setting.id, "button_label", e.target.value)}
                        placeholder="Libellé du bouton"
                        className="h-7 text-xs flex-1"
                      />
                      <Input
                        value={setting.button_url}
                        onChange={(e) => updateSetting(setting.id, "button_url", e.target.value)}
                        placeholder="URL (https://...)"
                        className="h-7 text-xs flex-[2]"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => saveSetting(setting)}
                        disabled={saving === setting.id}
                      >
                        {saving === setting.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteSetting(setting.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}

                  {/* Add new button */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newBtn.label}
                      onChange={(e) =>
                        setNewButtonKeys((prev) => ({
                          ...prev,
                          [user.user_id]: { ...newBtn, label: e.target.value },
                        }))
                      }
                      placeholder="Nouveau bouton (libellé)"
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      value={newBtn.url}
                      onChange={(e) =>
                        setNewButtonKeys((prev) => ({
                          ...prev,
                          [user.user_id]: { ...newBtn, url: e.target.value },
                        }))
                      }
                      placeholder="URL"
                      className="h-7 text-xs flex-[2]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => addButton(user.user_id)}
                      disabled={!newBtn.label.trim() || saving === `new_${user.user_id}`}
                    >
                      {saving === `new_${user.user_id}` ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Ajouter
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
