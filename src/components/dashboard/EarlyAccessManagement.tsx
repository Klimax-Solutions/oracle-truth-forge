import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useEaFeaturedTrade } from "@/hooks/useEaFeaturedTrade";
import {
  Loader2,
  Save,
  User,
  Clock,
  Upload,
  Video,
  Image as ImageIcon,
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

  // ─── Featured Trade Config ───
  const { featured, loading: featuredLoading, refetch: refetchFeatured } = useEaFeaturedTrade();
  const [ftContentType, setFtContentType] = useState<"screenshot" | "video">("screenshot");
  const [ftDirection, setFtDirection] = useState("");
  const [ftDate, setFtDate] = useState("");
  const [ftRR, setFtRR] = useState("");
  const [ftEntryTime, setFtEntryTime] = useState("");
  const [ftVideoUrl, setFtVideoUrl] = useState("");
  const [ftSaving, setFtSaving] = useState(false);
  const [ftFile, setFtFile] = useState<File | null>(null);
  const [ftPreview, setFtPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (featured) {
      setFtContentType(featured.content_type as "screenshot" | "video");
      setFtDirection(featured.direction || "");
      setFtDate(featured.trade_date || "");
      setFtRR(featured.rr?.toString() || "");
      setFtEntryTime(featured.entry_time || "");
      setFtVideoUrl(featured.video_url || "");
    }
  }, [featured]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFtFile(file);
      setFtPreview(URL.createObjectURL(file));
    }
  };

  const saveFeaturedTrade = async () => {
    setFtSaving(true);
    let imagePath = featured?.image_path || null;

    if (ftContentType === "screenshot" && ftFile) {
      const ext = ftFile.name.split(".").pop();
      const path = `ea-featured/featured-trade.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("trade-screenshots")
        .upload(path, ftFile, { upsert: true });
      if (uploadErr) {
        toast({ title: "Erreur upload", description: uploadErr.message, variant: "destructive" });
        setFtSaving(false);
        return;
      }
      imagePath = path;
    }

    const payload = {
      content_type: ftContentType,
      image_path: ftContentType === "screenshot" ? imagePath : null,
      video_url: ftContentType === "video" ? ftVideoUrl : null,
      direction: ftDirection || null,
      trade_date: ftDate || null,
      rr: ftRR ? parseFloat(ftRR) : null,
      entry_time: ftEntryTime || null,
    };

    if (featured?.id) {
      const { error } = await supabase
        .from("ea_featured_trade")
        .update(payload)
        .eq("id", featured.id);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Contenu mis à jour" });
        refetchFeatured();
      }
    } else {
      const { error } = await supabase
        .from("ea_featured_trade")
        .insert(payload);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Contenu créé" });
        refetchFeatured();
      }
    }
    setFtFile(null);
    setFtPreview(null);
    setFtSaving(false);
  };

  const deleteFeaturedTrade = async () => {
    if (!featured?.id) return;
    setFtSaving(true);
    await supabase.from("ea_featured_trade").delete().eq("id", featured.id);
    toast({ title: "Contenu supprimé" });
    refetchFeatured();
    setFtDirection(""); setFtDate(""); setFtRR(""); setFtEntryTime(""); setFtVideoUrl("");
    setFtFile(null); setFtPreview(null);
    setFtSaving(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 md:p-6 border-b border-border">
        <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">
          Gestion Early Access
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground font-mono">
          Configuration des URLs personnalisées et contenu mis en avant
        </p>
      </div>

      <div className="flex-1 p-4 md:p-6 overflow-auto space-y-6">
        {/* ─── Featured Trade Config ─── */}
        <div className="border border-border rounded-md bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h4 className="font-semibold text-foreground text-sm">Dernière data récoltée (contenu mis en avant)</h4>
            <p className="text-[10px] text-muted-foreground font-mono mt-1">
              Screenshot ou vidéo affiché dans l'espace Early Access
            </p>
          </div>
          <div className="p-4 space-y-4">
            {/* Content type toggle */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={ftContentType === "screenshot" ? "default" : "outline"}
                className="gap-1.5 text-xs"
                onClick={() => setFtContentType("screenshot")}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Screenshot
              </Button>
              <Button
                size="sm"
                variant={ftContentType === "video" ? "default" : "outline"}
                className="gap-1.5 text-xs"
                onClick={() => setFtContentType("video")}
              >
                <Video className="w-3.5 h-3.5" /> Vidéo
              </Button>
            </div>

            {/* Trade details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground">Direction</label>
                <select
                  value={ftDirection}
                  onChange={(e) => setFtDirection(e.target.value)}
                  className="w-full h-7 text-xs rounded-md border border-input bg-background px-2"
                >
                  <option value="">—</option>
                  <option value="Long">Long</option>
                  <option value="Short">Short</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground">Date</label>
                <Input type="date" value={ftDate} onChange={(e) => setFtDate(e.target.value)} className="h-7 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground">RR</label>
                <Input type="number" step="0.1" value={ftRR} onChange={(e) => setFtRR(e.target.value)} className="h-7 text-xs" placeholder="ex: 2.5" />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground">Heure d'entrée</label>
                <Input type="time" value={ftEntryTime} onChange={(e) => setFtEntryTime(e.target.value)} className="h-7 text-xs" />
              </div>
            </div>

            {/* Screenshot upload or Video URL */}
            {ftContentType === "screenshot" ? (
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" /> Uploader un screenshot
                </Button>
                {(ftPreview || featured?.image_path) && (
                  <div className="rounded-md overflow-hidden border border-border max-w-sm">
                    <img
                      src={ftPreview || ""}
                      alt="Preview"
                      className="w-full h-auto"
                      onError={async (e) => {
                        if (!ftPreview && featured?.image_path) {
                          const { data } = await supabase.storage.from("trade-screenshots").createSignedUrl(featured.image_path, 3600);
                          if (data) (e.target as HTMLImageElement).src = data.signedUrl;
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground">URL Google Drive (embed)</label>
                <Input
                  value={ftVideoUrl}
                  onChange={(e) => setFtVideoUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../preview"
                  className="h-7 text-xs"
                />
              </div>
            )}

            {/* Save / Delete */}
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={saveFeaturedTrade} disabled={ftSaving}>
                {ftSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Sauvegarder
              </Button>
              {featured?.id && (
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={deleteFeaturedTrade} disabled={ftSaving}>
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Per-user EA Settings ─── */}
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
