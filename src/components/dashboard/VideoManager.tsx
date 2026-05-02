import { useState, useEffect } from "react";
import { Plus, GripVertical, Pencil, Trash2, Save, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OracleVideo {
  id: string;
  title: string;
  description: string | null;
  embed_url: string;
  open_url: string | null;
  sort_order: number;
  accessible_roles: string[];
}

// mercure_videos et live_videos ont la même structure (pas de champ category)
interface EmbedVideo {
  id: string;
  title: string;
  description: string | null;
  embed_code: string;
  sort_order: number;
  accessible_roles: string[];
}

const ROLE_OPTIONS = [
  { value: "member",       label: "Membre" },
  { value: "early_access", label: "Early Access" },
  { value: "admin",        label: "Admin" },
  { value: "super_admin",  label: "Super Admin" },
];

// ─── Shared helpers ────────────────────────────────────────────────────────────

const S = {
  page: {
    height: "100%", display: "flex", flexDirection: "column" as const,
    background: "#08080c", fontFamily: "'Inter', system-ui, sans-serif",
  },
  header: {
    padding: "28px 36px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
    display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px",
  },
  title: {
    fontSize: "22px", fontWeight: 700, color: "rgba(255,255,255,0.88)",
    letterSpacing: "-0.02em", lineHeight: 1,
  },
  subtitle: {
    fontSize: "13px", color: "rgba(255,255,255,0.30)", fontWeight: 400, marginTop: "5px",
  },
  tabs: {
    display: "flex", gap: "2px", padding: "12px 36px",
    borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
  },
  body: { flex: 1, display: "flex", overflow: "hidden" as const },
  list: { flex: 1, overflowY: "auto" as const, padding: "24px 36px", display: "flex", flexDirection: "column" as const, gap: "8px" },
  panel: {
    width: "400px", flexShrink: 0,
    borderLeft: "1px solid rgba(255,255,255,0.06)",
    overflowY: "auto" as const, padding: "28px 32px",
    display: "flex", flexDirection: "column" as const, gap: "20px",
    background: "#0c0c12",
  },
};

// ─── Small components ──────────────────────────────────────────────────────────

function TabBtn({ active, label, count, accent, onClick }: {
  active: boolean; label: string; count: number; accent: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "7px 14px", borderRadius: "8px", cursor: "pointer", border: "none",
        background: active ? `${accent}15` : "transparent",
        color: active ? accent : "rgba(255,255,255,0.35)",
        fontSize: "13px", fontWeight: active ? 600 : 400,
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: "all 0.15s ease",
      }}
    >
      {label}
      <span style={{
        fontSize: "10px", padding: "1px 6px", borderRadius: "20px",
        background: active ? `${accent}25` : "rgba(255,255,255,0.07)",
        color: active ? accent : "rgba(255,255,255,0.25)",
        fontWeight: 600,
      }}>
        {count}
      </span>
    </button>
  );
}

function AddBtn({ accent, onClick }: { accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "7px",
        padding: "8px 16px", borderRadius: "10px", cursor: "pointer",
        background: accent, border: "none",
        color: "#fff", fontSize: "13px", fontWeight: 600,
        fontFamily: "'Inter', system-ui, sans-serif",
        boxShadow: `0 4px 20px -4px ${accent}88`,
        transition: "all 0.15s ease",
        flexShrink: 0,
      }}
    >
      <Plus style={{ width: "14px", height: "14px" }} />
      Ajouter
    </button>
  );
}

function RoleChips({ roles }: { roles: string[] }) {
  return (
    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" as const }}>
      {roles.map(r => {
        const label = ROLE_OPTIONS.find(o => o.value === r)?.label || r;
        return (
          <span key={r} style={{
            fontSize: "9px", padding: "2px 6px", borderRadius: "4px",
            background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.38)",
            fontWeight: 500,
          }}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      <div>
        <Label style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
          {label}
        </Label>
        {hint && (
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.22)", marginTop: "2px" }}>{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  color: "rgba(255,255,255,0.80)",
  fontSize: "13px",
  borderRadius: "8px",
};

// ─── Oracle Video List ─────────────────────────────────────────────────────────

interface OraclePanelProps {
  accent: string;
  videos: OracleVideo[];
  dragIndex: number | null;
  overIndex: number | null;
  editingId: string | null;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
  onEdit: (v: OracleVideo) => void;
  onDelete: (id: string) => void;
}

function OracleVideoList({ accent, videos, dragIndex, overIndex, editingId, onDragStart, onDragOver, onDragEnd, onEdit, onDelete }: OraclePanelProps) {
  if (videos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.18)", fontSize: "13px" }}>
        Aucune vidéo. Cliquez sur "Ajouter" pour commencer.
      </div>
    );
  }
  return (
    <>
      {videos.map((video, index) => {
        const isActive = editingId === video.id;
        return (
          <div
            key={video.id}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "14px 16px", borderRadius: "12px", cursor: "grab",
              border: isActive
                ? `1px solid ${accent}55`
                : overIndex === index && dragIndex !== null && dragIndex !== index
                ? `2px solid ${accent}`
                : "1px solid rgba(255,255,255,0.07)",
              background: isActive ? `${accent}0c` : dragIndex === index ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)",
              opacity: dragIndex === index ? 0.4 : 1,
              transition: "border-color 0.15s ease, background 0.15s ease",
            }}
          >
            <GripVertical style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.18)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.80)", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {video.title}
              </p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.22)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "6px" }}>
                {video.embed_url}
              </p>
              <RoleChips roles={video.accessible_roles || []} />
            </div>
            <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
              <button onClick={() => onEdit(video)} style={{
                width: "30px", height: "30px", borderRadius: "8px", border: "none", cursor: "pointer",
                background: isActive ? `${accent}20` : "transparent",
                color: isActive ? accent : "rgba(255,255,255,0.30)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}>
                <Pencil style={{ width: "12px", height: "12px" }} />
              </button>
              <button onClick={() => onDelete(video.id)} style={{
                width: "30px", height: "30px", borderRadius: "8px", border: "none", cursor: "pointer",
                background: "transparent", color: "rgba(255,80,80,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}>
                <Trash2 style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Embed Video List (partagé Mercure + Live — pas de badge catégorie) ─────────

interface EmbedPanelProps {
  accent: string;
  videos: EmbedVideo[];
  dragIndex: number | null;
  overIndex: number | null;
  editingId: string | null;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
  onEdit: (v: EmbedVideo) => void;
  onDelete: (id: string) => void;
}

function EmbedVideoList({ accent, videos, dragIndex, overIndex, editingId, onDragStart, onDragOver, onDragEnd, onEdit, onDelete }: EmbedPanelProps) {
  if (videos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.18)", fontSize: "13px" }}>
        Aucune vidéo. Cliquez sur "Ajouter" pour commencer.
      </div>
    );
  }
  return (
    <>
      {videos.map((video, index) => {
        const isActive = editingId === video.id;
        return (
          <div
            key={video.id}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "14px 16px", borderRadius: "12px", cursor: "grab",
              border: isActive
                ? `1px solid ${accent}55`
                : overIndex === index && dragIndex !== null && dragIndex !== index
                ? `2px solid ${accent}`
                : "1px solid rgba(255,255,255,0.07)",
              background: isActive ? `${accent}0c` : dragIndex === index ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)",
              opacity: dragIndex === index ? 0.4 : 1,
              transition: "border-color 0.15s ease, background 0.15s ease",
            }}
          >
            <GripVertical style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.18)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "6px" }}>
                {video.title}
              </p>
              <RoleChips roles={video.accessible_roles || []} />
            </div>
            <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
              <button onClick={() => onEdit(video)} style={{
                width: "30px", height: "30px", borderRadius: "8px", border: "none", cursor: "pointer",
                background: isActive ? `${accent}20` : "transparent",
                color: isActive ? accent : "rgba(255,255,255,0.30)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}>
                <Pencil style={{ width: "12px", height: "12px" }} />
              </button>
              <button onClick={() => onDelete(video.id)} style={{
                width: "30px", height: "30px", borderRadius: "8px", border: "none", cursor: "pointer",
                background: "transparent", color: "rgba(255,80,80,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}>
                <Trash2 style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export const VideoManager = () => {
  const [section, setSection] = useState<"oracle" | "mercure" | "live">("oracle");

  // Oracle videos
  const [oracleVideos, setOracleVideos] = useState<OracleVideo[]>([]);
  const [oracleLoading, setOracleLoading] = useState(true);
  const [oracleDragIndex, setOracleDragIndex] = useState<number | null>(null);
  const [oracleOverIndex, setOracleOverIndex] = useState<number | null>(null);

  // Mercure videos (table: mercure_videos)
  const [mercureVideos, setMercureVideos] = useState<EmbedVideo[]>([]);
  const [mercureLoading, setMercureLoading] = useState(true);
  const [mercureDragIndex, setMercureDragIndex] = useState<number | null>(null);
  const [mercureOverIndex, setMercureOverIndex] = useState<number | null>(null);

  // Live videos (table: live_videos)
  const [liveVideos, setLiveVideos] = useState<EmbedVideo[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveDragIndex, setLiveDragIndex] = useState<number | null>(null);
  const [liveOverIndex, setLiveOverIndex] = useState<number | null>(null);

  // Edit panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingOracle, setEditingOracle] = useState<OracleVideo | null>(null);
  const [editingEmbed, setEditingEmbed] = useState<EmbedVideo | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Oracle form
  const [oTitle, setOTitle] = useState("");
  const [oDesc, setODesc] = useState("");
  const [oEmbed, setOEmbed] = useState("");
  const [oOpen, setOOpen] = useState("");
  const [oRoles, setORoles] = useState<string[]>(["member", "early_access", "admin", "super_admin"]);

  // Embed form (mercure + live)
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eEmbed, setEEmbed] = useState("");
  const [eRoles, setERoles] = useState<string[]>(["member", "early_access", "admin", "super_admin"]);

  const ORACLE_ACCENT  = "#4F78CC";
  const MERCURE_ACCENT = "#C8882A";
  const LIVE_ACCENT    = "#22C55E";
  const accent = section === "oracle" ? ORACLE_ACCENT : section === "mercure" ? MERCURE_ACCENT : LIVE_ACCENT;

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchOracle = async () => {
    const { data } = await supabase.from("videos").select("*").order("sort_order", { ascending: true });
    if (data) setOracleVideos(data);
    setOracleLoading(false);
  };

  const fetchMercure = async () => {
    const { data } = await supabase.from("mercure_videos" as any).select("*").order("sort_order", { ascending: true });
    if (data) setMercureVideos(data as EmbedVideo[]);
    setMercureLoading(false);
  };

  const fetchLive = async () => {
    const { data } = await supabase.from("live_videos" as any).select("*").order("sort_order", { ascending: true });
    if (data) setLiveVideos(data as EmbedVideo[]);
    setLiveLoading(false);
  };

  useEffect(() => { fetchOracle(); fetchMercure(); fetchLive(); }, []);

  // ── Panel helpers ─────────────────────────────────────────────────────────────

  const closePanel = () => {
    setPanelOpen(false);
    setEditingOracle(null);
    setEditingEmbed(null);
    setIsNew(false);
  };

  const openOracleNew = () => {
    setSection("oracle");
    setEditingOracle(null); setEditingEmbed(null);
    setOTitle(""); setODesc(""); setOEmbed(""); setOOpen("");
    setORoles(["member", "early_access", "admin", "super_admin"]);
    setIsNew(true); setPanelOpen(true);
  };

  const openOracleEdit = (v: OracleVideo) => {
    setSection("oracle");
    setEditingEmbed(null); setEditingOracle(v);
    setOTitle(v.title); setODesc(v.description || ""); setOEmbed(v.embed_url); setOOpen(v.open_url || "");
    setORoles(v.accessible_roles || ["member", "early_access", "admin", "super_admin"]);
    setIsNew(false); setPanelOpen(true);
  };

  const openMercureNew = () => {
    setSection("mercure");
    setEditingOracle(null); setEditingEmbed(null);
    setETitle(""); setEDesc(""); setEEmbed("");
    setERoles(["member", "early_access", "admin", "super_admin"]);
    setIsNew(true); setPanelOpen(true);
  };

  const openMercureEdit = (v: EmbedVideo) => {
    setSection("mercure");
    setEditingOracle(null); setEditingEmbed(v);
    setETitle(v.title); setEDesc(v.description || ""); setEEmbed(v.embed_code);
    setERoles(v.accessible_roles || ["member", "early_access", "admin", "super_admin"]);
    setIsNew(false); setPanelOpen(true);
  };

  const openLiveNew = () => {
    setSection("live");
    setEditingOracle(null); setEditingEmbed(null);
    setETitle(""); setEDesc(""); setEEmbed("");
    setERoles(["member", "early_access", "admin", "super_admin"]);
    setIsNew(true); setPanelOpen(true);
  };

  const openLiveEdit = (v: EmbedVideo) => {
    setSection("live");
    setEditingOracle(null); setEditingEmbed(v);
    setETitle(v.title); setEDesc(v.description || ""); setEEmbed(v.embed_code);
    setERoles(v.accessible_roles || ["member", "early_access", "admin", "super_admin"]);
    setIsNew(false); setPanelOpen(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const saveOracle = async () => {
    if (!oTitle.trim() || !oEmbed.trim()) {
      toast({ title: "Champs requis", description: "Titre et lien embed sont obligatoires.", variant: "destructive" });
      return;
    }
    const payload = {
      title: oTitle.trim(), description: oDesc.trim() || null,
      embed_url: oEmbed.trim(), open_url: oOpen.trim() || null,
      accessible_roles: oRoles,
    };
    if (editingOracle) {
      const { error } = await supabase.from("videos").update(payload as any).eq("id", editingOracle.id);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo mise à jour" });
    } else {
      const nextOrder = oracleVideos.length > 0 ? Math.max(...oracleVideos.map(v => v.sort_order)) + 1 : 1;
      const { error } = await supabase.from("videos").insert({ ...payload, sort_order: nextOrder } as any);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo ajoutée" });
    }
    closePanel(); fetchOracle();
  };

  const saveEmbed = async () => {
    if (!eTitle.trim() || !eEmbed.trim()) {
      toast({ title: "Champs requis", description: "Titre et code embed sont obligatoires.", variant: "destructive" });
      return;
    }
    const tableName = section === "mercure" ? "mercure_videos" : "live_videos";
    const videoList = section === "mercure" ? mercureVideos : liveVideos;
    const cleanEmbed = eEmbed.trim()
      .replace(/\s*width\s*=\s*["']\d+["']/gi, "")
      .replace(/\s*height\s*=\s*["']\d+["']/gi, "")
      .replace(/width:\s*\d+px\s*;?/gi, "width:100%;")
      .replace(/height:\s*\d+px\s*;?/gi, "height:100%;");

    const payload = {
      title: eTitle.trim(), description: eDesc.trim() || null,
      embed_code: cleanEmbed, accessible_roles: eRoles,
    };
    if (editingEmbed) {
      const { error } = await supabase.from(tableName as any).update(payload as any).eq("id", editingEmbed.id);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo mise à jour" });
    } else {
      const nextOrder = videoList.length > 0 ? Math.max(...videoList.map(v => v.sort_order)) + 1 : 1;
      const { error } = await supabase.from(tableName as any).insert({ ...payload, sort_order: nextOrder } as any);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo ajoutée" });
    }
    closePanel();
    if (section === "mercure") fetchMercure(); else fetchLive();
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const deleteOracle = async (id: string) => {
    if (!confirm("Supprimer cette vidéo ?")) return;
    await supabase.from("videos").delete().eq("id", id);
    toast({ title: "Vidéo supprimée" });
    if (editingOracle?.id === id) closePanel();
    fetchOracle();
  };

  const deleteMercure = async (id: string) => {
    if (!confirm("Supprimer cette vidéo Mercure ?")) return;
    await supabase.from("mercure_videos" as any).delete().eq("id", id);
    toast({ title: "Vidéo supprimée" });
    if (editingEmbed?.id === id) closePanel();
    fetchMercure();
  };

  const deleteLive = async (id: string) => {
    if (!confirm("Supprimer cette vidéo Live ?")) return;
    await supabase.from("live_videos" as any).delete().eq("id", id);
    toast({ title: "Vidéo supprimée" });
    if (editingEmbed?.id === id) closePanel();
    fetchLive();
  };

  // ── Drag Oracle ───────────────────────────────────────────────────────────────

  const handleOracleDragEnd = async () => {
    if (oracleDragIndex === null || oracleOverIndex === null || oracleDragIndex === oracleOverIndex) {
      setOracleDragIndex(null); setOracleOverIndex(null); return;
    }
    const next = [...oracleVideos];
    const [moved] = next.splice(oracleDragIndex, 1);
    next.splice(oracleOverIndex, 0, moved);
    const updates = next.map((v, i) => ({ ...v, sort_order: i + 1 }));
    setOracleVideos(updates);
    setOracleDragIndex(null); setOracleOverIndex(null);
    await Promise.all(updates.map(v => supabase.from("videos").update({ sort_order: v.sort_order } as any).eq("id", v.id)));
    toast({ title: "Ordre mis à jour" });
  };

  // ── Drag Mercure ──────────────────────────────────────────────────────────────

  const handleMercureDragEnd = async () => {
    if (mercureDragIndex === null || mercureOverIndex === null || mercureDragIndex === mercureOverIndex) {
      setMercureDragIndex(null); setMercureOverIndex(null); return;
    }
    const next = [...mercureVideos];
    const [moved] = next.splice(mercureDragIndex, 1);
    next.splice(mercureOverIndex, 0, moved);
    const updates = next.map((v, i) => ({ ...v, sort_order: i + 1 }));
    setMercureVideos(updates);
    setMercureDragIndex(null); setMercureOverIndex(null);
    await Promise.all(updates.map(v => supabase.from("mercure_videos" as any).update({ sort_order: v.sort_order } as any).eq("id", v.id)));
    toast({ title: "Ordre mis à jour" });
  };

  // ── Drag Live ─────────────────────────────────────────────────────────────────

  const handleLiveDragEnd = async () => {
    if (liveDragIndex === null || liveOverIndex === null || liveDragIndex === liveOverIndex) {
      setLiveDragIndex(null); setLiveOverIndex(null); return;
    }
    const next = [...liveVideos];
    const [moved] = next.splice(liveDragIndex, 1);
    next.splice(liveOverIndex, 0, moved);
    const updates = next.map((v, i) => ({ ...v, sort_order: i + 1 }));
    setLiveVideos(updates);
    setLiveDragIndex(null); setLiveOverIndex(null);
    await Promise.all(updates.map(v => supabase.from("live_videos" as any).update({ sort_order: v.sort_order } as any).eq("id", v.id)));
    toast({ title: "Ordre mis à jour" });
  };

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (oracleLoading && mercureLoading && liveLoading) {
    return (
      <div style={{ ...S.page, alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: "22px", height: "22px", borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.08)",
          borderTopColor: ORACLE_ACCENT,
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Médiathèque</h1>
          <p style={S.subtitle}>Gérez les vidéos diffusées aux membres</p>
        </div>
        <AddBtn
          accent={accent}
          onClick={section === "oracle" ? openOracleNew : section === "mercure" ? openMercureNew : openLiveNew}
        />
      </div>

      {/* Section tabs */}
      <div style={S.tabs}>
        <TabBtn
          active={section === "oracle"} accent={ORACLE_ACCENT}
          label="Setup Oracle" count={oracleVideos.length}
          onClick={() => setSection("oracle")}
        />
        <TabBtn
          active={section === "mercure"} accent={MERCURE_ACCENT}
          label="Mercure Institut" count={mercureVideos.length}
          onClick={() => setSection("mercure")}
        />
        <TabBtn
          active={section === "live"} accent={LIVE_ACCENT}
          label="Live" count={liveVideos.length}
          onClick={() => setSection("live")}
        />
      </div>

      {/* Body: list + edit panel */}
      <div style={S.body}>

        {/* Video list */}
        <div style={S.list}>
          {section === "oracle" ? (
            <OracleVideoList
              accent={ORACLE_ACCENT}
              videos={oracleVideos}
              dragIndex={oracleDragIndex}
              overIndex={oracleOverIndex}
              editingId={editingOracle?.id ?? null}
              onDragStart={setOracleDragIndex}
              onDragOver={(e, i) => { e.preventDefault(); setOracleOverIndex(i); }}
              onDragEnd={handleOracleDragEnd}
              onEdit={openOracleEdit}
              onDelete={deleteOracle}
            />
          ) : section === "mercure" ? (
            <EmbedVideoList
              accent={MERCURE_ACCENT}
              videos={mercureVideos}
              dragIndex={mercureDragIndex}
              overIndex={mercureOverIndex}
              editingId={editingEmbed?.id ?? null}
              onDragStart={setMercureDragIndex}
              onDragOver={(e, i) => { e.preventDefault(); setMercureOverIndex(i); }}
              onDragEnd={handleMercureDragEnd}
              onEdit={openMercureEdit}
              onDelete={deleteMercure}
            />
          ) : (
            <EmbedVideoList
              accent={LIVE_ACCENT}
              videos={liveVideos}
              dragIndex={liveDragIndex}
              overIndex={liveOverIndex}
              editingId={editingEmbed?.id ?? null}
              onDragStart={setLiveDragIndex}
              onDragOver={(e, i) => { e.preventDefault(); setLiveOverIndex(i); }}
              onDragEnd={handleLiveDragEnd}
              onEdit={openLiveEdit}
              onDelete={deleteLive}
            />
          )}
        </div>

        {/* Edit panel */}
        {panelOpen && (
          <div style={S.panel}>
            {/* Panel header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "rgba(255,255,255,0.78)", letterSpacing: "-0.01em" }}>
                {isNew ? "Nouvelle vidéo" : "Modifier"}
              </p>
              <button onClick={closePanel} style={{
                width: "28px", height: "28px", borderRadius: "7px", border: "none", cursor: "pointer",
                background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <X style={{ width: "13px", height: "13px" }} />
              </button>
            </div>

            {/* Thin accent line */}
            <div style={{ height: "1px", background: `linear-gradient(to right, ${accent}80, transparent)`, margin: "-8px 0 4px" }} />

            {/* Oracle form */}
            {section === "oracle" && (
              <>
                <FieldGroup label="Titre *">
                  <Input value={oTitle} onChange={e => setOTitle(e.target.value)} placeholder="Ex : Vidéo 1 – Introduction" style={inputStyle} />
                </FieldGroup>
                <FieldGroup label="Description">
                  <Textarea value={oDesc} onChange={e => setODesc(e.target.value)} placeholder="Description de la vidéo…" rows={2} style={{ ...inputStyle, resize: "none" as const }} />
                </FieldGroup>
                <FieldGroup label="Lien Embed *" hint="Google Drive /preview, YouTube embed, ou iframe compatible">
                  <Input value={oEmbed} onChange={e => setOEmbed(e.target.value)} placeholder="https://drive.google.com/…/preview" style={inputStyle} />
                </FieldGroup>
                <FieldGroup label="Lien d'ouverture" hint="Optionnel — lien pour ouvrir dans un nouvel onglet">
                  <Input value={oOpen} onChange={e => setOOpen(e.target.value)} placeholder="https://drive.google.com/…/view" style={inputStyle} />
                </FieldGroup>
                <FieldGroup label="Rôles autorisés">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {ROLE_OPTIONS.map(role => (
                      <label key={role.value} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
                        <Checkbox
                          checked={oRoles.includes(role.value)}
                          onCheckedChange={checked => setORoles(prev => checked ? [...prev, role.value] : prev.filter(r => r !== role.value))}
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>
                </FieldGroup>
              </>
            )}

            {/* Mercure / Live form — identique, table déterminée par section */}
            {(section === "mercure" || section === "live") && (
              <>
                <FieldGroup label="Titre *">
                  <Input value={eTitle} onChange={e => setETitle(e.target.value)} placeholder="Ex : Module 1 – Introduction" style={inputStyle} />
                </FieldGroup>
                <FieldGroup label="Description">
                  <Textarea value={eDesc} onChange={e => setEDesc(e.target.value)} placeholder="Description…" rows={2} style={{ ...inputStyle, resize: "none" as const }} />
                </FieldGroup>
                <FieldGroup label="Code Embed / Lien *" hint="iFrame, script Vidalytics, ou lien Google Drive">
                  <Textarea value={eEmbed} onChange={e => setEEmbed(e.target.value)} placeholder={'<iframe src="https://…"></iframe>\nou\nhttps://drive.google.com/…/view'} rows={4} style={{ ...inputStyle, resize: "none" as const, fontFamily: "monospace", fontSize: "11px" }} />
                </FieldGroup>
                <FieldGroup label="Rôles autorisés">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {ROLE_OPTIONS.map(role => (
                      <label key={role.value} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
                        <Checkbox
                          checked={eRoles.includes(role.value)}
                          onCheckedChange={checked => setERoles(prev => checked ? [...prev, role.value] : prev.filter(r => r !== role.value))}
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>
                </FieldGroup>
              </>
            )}

            {/* Save button */}
            <button
              onClick={section === "oracle" ? saveOracle : saveEmbed}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                padding: "11px 0", borderRadius: "10px", border: "none", cursor: "pointer",
                background: accent, color: "#fff", fontSize: "13px", fontWeight: 600,
                fontFamily: "'Inter', system-ui, sans-serif",
                boxShadow: `0 4px 20px -4px ${accent}88`,
                marginTop: "4px",
              }}
            >
              <Save style={{ width: "14px", height: "14px" }} />
              {isNew ? "Ajouter la vidéo" : "Enregistrer"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
