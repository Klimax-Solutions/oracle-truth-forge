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
  Clock,
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

const DEFAULT_BUTTONS = [
  { key: "continuer_ma_recolte", label: "Continuer ma récolte" },
  { key: "video_bonus_mercure_institut", label: "Vidéo bonus Mercure Institut" },
  { key: "acceder_a_oracle", label: "Accéder à Oracle" },
];

export const EarlyAccessManagement = () => {
  const [users, setUsers] = useState<EAUser[]>([]);
  const [settings, setSettings] = useState<EASetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);

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

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

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

  // Get user's URL for a specific button key
  const getButtonUrl = (userId: string, buttonKey: string) => {
    const setting = settings.find(
      (s) => s.user_id === userId && s.button_key === buttonKey
    );
    return setting?.button_url || "";
  };

  // Save/update URL for a button
  const saveButtonUrl = async (userId: string, buttonKey: string, buttonLabel: string, url: string) => {
    const saveKey = `${userId}_${buttonKey}`;
    setSaving(saveKey);

    const existing = settings.find(
      (s) => s.user_id === userId && s.button_key === buttonKey
    );

    if (existing) {
      const { error } = await supabase
        .from("early_access_settings")
        .update({ button_url: url })
        .eq("id", existing.id);

      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        setSettings((prev) =>
          prev.map((s) => (s.id === existing.id ? { ...s, button_url: url } : s))
        );
        toast({ title: "URL sauvegardée" });
      }
    } else {
      const { data, error } = await supabase
        .from("early_access_settings")
        .insert({
          user_id: userId,
          button_key: buttonKey,
          button_label: buttonLabel,
          button_url: url,
        })
        .select()
        .single();

      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else if (data) {
        setSettings((prev) => [...prev, data as EASetting]);
        toast({ title: "URL sauvegardée" });
      }
    }
    setSaving(null);
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

  // Local URL state for editing
  const [urlEdits, setUrlEdits] = useState<Record<string, string>>({});

  const getEditUrl = (userId: string, buttonKey: string) => {
    const editKey = `${userId}_${buttonKey}`;
    if (editKey in urlEdits) return urlEdits[editKey];
    return getButtonUrl(userId, buttonKey);
  };

  const setEditUrl = (userId: string, buttonKey: string, value: string) => {
    setUrlEdits((prev) => ({ ...prev, [`${userId}_${buttonKey}`]: value }));
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
          Configuration des URLs personnalisées par membre Early Access
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
          users.map((user) => (
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

              {/* Predefined buttons with URL configuration */}
              <div className="p-4 space-y-3">
                <p className="text-[10px] font-mono uppercase text-muted-foreground">
                  URLs personnalisées par bouton
                </p>

                {DEFAULT_BUTTONS.map((btn) => {
                  const saveKey = `${user.user_id}_${btn.key}`;
                  return (
                    <div
                      key={btn.key}
                      className="flex items-center gap-2 p-2 border border-border/50 rounded-md"
                    >
                      <span className="text-xs font-mono text-foreground min-w-[180px] flex-shrink-0">
                        {btn.label}
                      </span>
                      <Input
                        value={getEditUrl(user.user_id, btn.key)}
                        onChange={(e) => setEditUrl(user.user_id, btn.key, e.target.value)}
                        placeholder="URL (https://...)"
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          saveButtonUrl(
                            user.user_id,
                            btn.key,
                            btn.label,
                            getEditUrl(user.user_id, btn.key)
                          )
                        }
                        disabled={saving === saveKey}
                      >
                        {saving === saveKey ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
