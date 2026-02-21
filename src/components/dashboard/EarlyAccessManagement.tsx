import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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

// ── Types ──

interface EAUser {
  user_id: string;
  display_name: string | null;
  expires_at: string | null;
  role_id: string;
  early_access_type: string | null;
}

interface EASetting {
  id: string;
  user_id: string;
  button_key: string;
  button_label: string;
  button_url: string;
}

interface GlobalSetting {
  id: string;
  setting_key: string;
  setting_value: string;
}

const PRECALL_BUTTONS = [
  { key: "continuer_ma_recolte", label: "Continuer ma récolte vidéo", globalKey: "precall_continuer_ma_recolte" },
  { key: "video_bonus_mercure_institut", label: "Bonus Mercure Institut", globalKey: "precall_video_bonus_mercure_institut" },
  { key: "acceder_a_oracle", label: "Accéder à Oracle", globalKey: "precall_acceder_a_oracle" },
];

const POSTCALL_BUTTONS = [
  { key: "continuer_ma_recolte", label: "Continuer ma récolte" },
  { key: "video_bonus_mercure_institut", label: "Vidéo bonus Mercure Institut" },
  { key: "acceder_a_oracle", label: "Accéder à Oracle" },
];

export const EarlyAccessManagement = () => {
  const [users, setUsers] = useState<EAUser[]>([]);
  const [settings, setSettings] = useState<EASetting[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSetting[]>([]);
  const [globalEdits, setGlobalEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  // ── Featured Trade ──
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

  // Local URL state for postcall per-user editing
  const [urlEdits, setUrlEdits] = useState<Record<string, string>>({});

  // ── Fetch data ──

  const fetchData = async () => {
    setLoading(true);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("id, user_id, expires_at, early_access_type" as any)
      .eq("role", "early_access");

    if (!roles || roles.length === 0) {
      setUsers([]);
      setSettings([]);
      setLoading(false);
      return;
    }

    const userIds = roles.map((r: any) => r.user_id);

    const [profilesRes, settingsRes, globalRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
      supabase.from("early_access_settings").select("*").in("user_id", userIds),
      supabase.from("ea_global_settings" as any).select("*"),
    ]);

    setGlobalSettings((globalRes.data || []) as unknown as GlobalSetting[]);

    const eaUsers: EAUser[] = (roles as any[]).map((r: any) => {
      const profile = profilesRes.data?.find((p: any) => p.user_id === r.user_id);
      return {
        user_id: r.user_id,
        display_name: profile?.display_name || `User ${r.user_id.slice(0, 8)}`,
        expires_at: r.expires_at,
        role_id: r.id,
        early_access_type: r.early_access_type || "postcall",
      };
    });

    setUsers(eaUsers);
    setSettings((settingsRes.data || []) as EASetting[]);
    setGlobalSettings((globalRes.data || []) as unknown as GlobalSetting[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  // ── Global settings helpers ──

  const getGlobalUrl = (key: string) => {
    if (key in globalEdits) return globalEdits[key];
    const gs = globalSettings.find((s) => s.setting_key === key);
    return gs?.setting_value || "";
  };

  const saveGlobalUrl = async (key: string) => {
    const saveId = `global_${key}`;
    setSaving(saveId);
    const value = getGlobalUrl(key);

    const existing = globalSettings.find((s) => s.setting_key === key);
    if (existing) {
      await supabase
        .from("ea_global_settings" as any)
        .update({ setting_value: value, updated_at: new Date().toISOString() } as any)
        .eq("id", existing.id);
      setGlobalSettings((prev) =>
        prev.map((s) => (s.id === existing.id ? { ...s, setting_value: value } : s))
      );
    } else {
      const { data } = await supabase
        .from("ea_global_settings" as any)
        .insert({ setting_key: key, setting_value: value } as any)
        .select()
        .single();
      if (data) setGlobalSettings((prev) => [...prev, data as any]);
    }
    toast({ title: "URL sauvegardée" });
    setSaving(null);
  };

  // ── Per-user (postcall) URL helpers ──

  const getEditUrl = (userId: string, buttonKey: string) => {
    const editKey = `${userId}_${buttonKey}`;
    if (editKey in urlEdits) return urlEdits[editKey];
    const setting = settings.find((s) => s.user_id === userId && s.button_key === buttonKey);
    return setting?.button_url || "";
  };

  const setEditUrl = (userId: string, buttonKey: string, value: string) => {
    setUrlEdits((prev) => ({ ...prev, [`${userId}_${buttonKey}`]: value }));
  };

  const saveButtonUrl = async (userId: string, buttonKey: string, buttonLabel: string, url: string) => {
    const saveKey = `${userId}_${buttonKey}`;
    setSaving(saveKey);

    const existing = settings.find((s) => s.user_id === userId && s.button_key === buttonKey);

    if (existing) {
      const { error } = await supabase
        .from("early_access_settings")
        .update({ button_url: url })
        .eq("id", existing.id);
      if (!error) {
        setSettings((prev) => prev.map((s) => (s.id === existing.id ? { ...s, button_url: url } : s)));
        toast({ title: "URL sauvegardée" });
      }
    } else {
      const { data, error } = await supabase
        .from("early_access_settings")
        .insert({ user_id: userId, button_key: buttonKey, button_label: buttonLabel, button_url: url })
        .select()
        .single();
      if (!error && data) {
        setSettings((prev) => [...prev, data as EASetting]);
        toast({ title: "URL sauvegardée" });
      }
    }
    setSaving(null);
  };

  // ── Switch EA type ──

  const switchEaType = async (userId: string, roleId: string, newType: "precall" | "postcall") => {
    setSaving(`type_${userId}`);
    const { error } = await supabase
      .from("user_roles")
      .update({ early_access_type: newType } as any)
      .eq("id", roleId);

    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.role_id === roleId ? { ...u, early_access_type: newType } : u))
      );
      toast({ title: `Passé en ${newType === "precall" ? "pré-call" : "post-call"}` });
    }
    setSaving(null);
  };

  // ── Expiration ──

  const updateExpiration = async (roleId: string, expiresAt: string) => {
    setSaving(`exp_${roleId}`);
    const { error } = await supabase
      .from("user_roles")
      .update({ expires_at: expiresAt || null })
      .eq("id", roleId);

    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.role_id === roleId ? { ...u, expires_at: expiresAt || null } : u))
      );
      toast({ title: "Expiration mise à jour" });
    }
    setSaving(null);
  };

  // ── Featured Trade ──

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
      const { error } = await supabase.from("ea_featured_trade").update(payload).eq("id", featured.id);
      if (!error) { toast({ title: "Contenu mis à jour" }); refetchFeatured(); }
    } else {
      const { error } = await supabase.from("ea_featured_trade").insert(payload);
      if (!error) { toast({ title: "Contenu créé" }); refetchFeatured(); }
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

  // ── Derived lists ──

  const precallUsers = users.filter((u) => u.early_access_type === "precall");
  const postcallUsers = users.filter((u) => u.early_access_type !== "precall");

  // ── Render ──

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 md:p-6 border-b border-border">
        <h2 className="text-lg md:text-xl font-semibold text-foreground mb-1">
          Gestion Early Access
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground font-mono">
          Configuration des sous-rôles Pré-call et Post-call
        </p>
      </div>

      <div className="flex-1 p-4 md:p-6 overflow-auto space-y-8">

        {/* ═══ Featured Trade Config ═══ */}
        <div className="border border-border rounded-md bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h4 className="font-semibold text-foreground text-sm">Dernière data récoltée (contenu mis en avant)</h4>
            <p className="text-[10px] text-muted-foreground font-mono mt-1">
              Screenshot ou vidéo affiché dans l'espace Early Access
            </p>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={ftContentType === "screenshot" ? "default" : "outline"} className="gap-1.5 text-xs" onClick={() => setFtContentType("screenshot")}>
                <ImageIcon className="w-3.5 h-3.5" /> Screenshot
              </Button>
              <Button size="sm" variant={ftContentType === "video" ? "default" : "outline"} className="gap-1.5 text-xs" onClick={() => setFtContentType("video")}>
                <Video className="w-3.5 h-3.5" /> Vidéo
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground">Direction</label>
                <select value={ftDirection} onChange={(e) => setFtDirection(e.target.value)} className="w-full h-7 text-xs rounded-md border border-input bg-background px-2">
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
                <Input value={ftVideoUrl} onChange={(e) => setFtVideoUrl(e.target.value)} placeholder="https://drive.google.com/file/d/.../preview" className="h-7 text-xs" />
              </div>
            )}
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

        {/* ═══ SECTION PRÉ-CALL (AMBER) ═══ */}
        <div className="border-2 border-amber-500/40 rounded-md overflow-hidden">
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-500 border border-amber-500/30">
              PRÉ-CALL
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Early Access Pré-call</h3>
              <p className="text-[10px] text-muted-foreground font-mono">URLs universelles — appliquées à tous les membres pré-call</p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Global URL configuration */}
            <div className="space-y-3">
              <p className="text-[10px] font-mono uppercase text-amber-500/80">Configuration des URLs globales</p>
              {PRECALL_BUTTONS.map((btn) => {
                const saveId = `global_${btn.globalKey}`;
                return (
                  <div key={btn.globalKey} className="flex items-center gap-2 p-2 border border-amber-500/20 rounded-md bg-amber-500/5">
                    <span className="text-xs font-mono text-foreground min-w-[180px] flex-shrink-0">{btn.label}</span>
                    <Input
                      value={getGlobalUrl(btn.globalKey)}
                      onChange={(e) => setGlobalEdits((prev) => ({ ...prev, [btn.globalKey]: e.target.value }))}
                      placeholder="URL universelle (https://...)"
                      className="h-7 text-xs flex-1"
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => saveGlobalUrl(btn.globalKey)} disabled={saving === saveId}>
                      {saving === saveId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Precall members list */}
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase text-amber-500/80">Membres pré-call ({precallUsers.length})</p>
             {precallUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Aucun membre pré-call</p>
              ) : loading ? null : (
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                       <tr className="bg-muted/30 border-b border-border">
                         <th className="text-left p-2 font-mono uppercase text-muted-foreground">Nom</th>
                         <th className="text-left p-2 font-mono uppercase text-muted-foreground">Expiration</th>
                         <th className="text-left p-2 font-mono uppercase text-muted-foreground">Type</th>
                         <th className="text-left p-2 font-mono uppercase text-muted-foreground">Action</th>
                       </tr>
                    </thead>
                    <tbody>
                      {precallUsers.map((u) => (
                        <tr key={u.user_id} className="border-b border-border/50">
                          <td className="p-2 flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-amber-500" />
                            {u.display_name}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <Input
                                type="datetime-local"
                                value={u.expires_at ? new Date(u.expires_at).toISOString().slice(0, 16) : ""}
                                onChange={(e) => updateExpiration(u.role_id, e.target.value ? new Date(e.target.value).toISOString() : "")}
                                className="h-6 text-[10px] w-44"
                              />
                            </div>
                          </td>
                           <td className="p-2">
                             <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-500">pré-call</span>
                           </td>
                           <td className="p-2">
                             <Button
                               variant="outline"
                               size="sm"
                               className="h-6 text-[10px] gap-1 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                               onClick={() => switchEaType(u.user_id, u.role_id, "postcall")}
                               disabled={saving === `type_${u.user_id}`}
                             >
                               {saving === `type_${u.user_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "→ Post-call"}
                             </Button>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ SECTION POST-CALL (EMERALD) ═══ */}
        <div className="border-2 border-emerald-500/40 rounded-md overflow-hidden">
          <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
              POST-CALL
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Early Access Post-call</h3>
              <p className="text-[10px] text-muted-foreground font-mono">URLs personnalisées par membre</p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {postcallUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <User className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucun membre post-call</p>
              </div>
            ) : (
              postcallUsers.map((user) => (
                <div key={user.user_id} className="border border-emerald-500/20 rounded-md bg-emerald-500/5 overflow-hidden">
                  <div className="p-3 border-b border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-sm font-semibold text-foreground">{user.display_name}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-500">post-call</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 ml-2"
                        onClick={() => switchEaType(user.user_id, user.role_id, "precall")}
                        disabled={saving === `type_${user.user_id}`}
                      >
                        {saving === `type_${user.user_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "→ Pré-call"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <Input
                        type="datetime-local"
                        value={user.expires_at ? new Date(user.expires_at).toISOString().slice(0, 16) : ""}
                        onChange={(e) => updateExpiration(user.role_id, e.target.value ? new Date(e.target.value).toISOString() : "")}
                        className="h-6 text-[10px] w-44"
                      />
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {POSTCALL_BUTTONS.map((btn) => {
                      const saveKey = `${user.user_id}_${btn.key}`;
                      return (
                        <div key={btn.key} className="flex items-center gap-2">
                          <span className="text-xs font-mono text-foreground min-w-[180px] flex-shrink-0">{btn.label}</span>
                          <Input
                            value={getEditUrl(user.user_id, btn.key)}
                            onChange={(e) => setEditUrl(user.user_id, btn.key, e.target.value)}
                            placeholder="URL personnalisée (https://...)"
                            className="h-7 text-xs flex-1"
                          />
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => saveButtonUrl(user.user_id, btn.key, btn.label, getEditUrl(user.user_id, btn.key))} disabled={saving === saveKey}>
                            {saving === saveKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
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

      </div>
    </div>
  );
};
