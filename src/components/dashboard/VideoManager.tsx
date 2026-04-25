import { useState, useEffect } from "react";
import { Plus, GripVertical, Pencil, Trash2, Save, X, Film, Layers, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

interface BonusVideo {
  id: string;
  title: string;
  description: string | null;
  embed_code: string;
  sort_order: number;
  category: string;
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

// ─── Bonus Video List ──────────────────────────────────────────────────────────

interface BonusPanelProps {
  accent: string;
  videos: BonusVideo[];
  dragIndex: number | null;
  overIndex: number | null;
  editingId: string | null;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
  onEdit: (v: BonusVideo) => void;
  onDelete: (id: string) => void;
}

function BonusVideoList({ accent, videos, dragIndex, overIndex, editingId, onDragStart, onDragOver, onDragEnd, onEdit, onDelete }: BonusPanelProps) {
  if (videos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.18)", fontSize: "13px" }}>
        Aucune vidéo bonus. Cliquez sur "Ajouter" pour commencer.
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {video.title}
                </p>
                <span style={{
                  fontSize: "9px", padding: "2px 6px", borderRadius: "4px", flexShrink: 0,
                  background: video.category === "live" ? "rgba(239,68,68,0.12)" : "rgba(99,102,241,0.12)",
                  color: video.category === "live" ? "#f87171" : "#a5b4fc",
                  fontWeight: 600,
                }}>
                  {video.category === "live" ? "Live" : "Formation"}
                </span>
              </div>
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
  const [section, setSection] = useState<"oracle" | "bonus">("oracle");

  // Oracle videos state
  const [oracleVideos, setOracleVideos] = useState<OracleVideo[]>([]);
  const [oracleLoading, setOracleLoading] = useState(true);
  const [oracleDragIndex, setOracleDragIndex] = useState<number | null>(null);
  const [oracleOverIndex, setOracleOverIndex] = useState<number | null>(null);

  // Bonus videos state
  const [bonusVideos, setBonusVideos] = useState<BonusVideo[]>([]);
  const [bonusLoading, setBonusLoading] = useState(true);
  const [bonusDragIndex, setBonusDragIndex] = useState<number | null>(null);
  const [bonusOverIndex, setBonusOverIndex] = useState<number | null>(null);

  // Edit panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingOracle, setEditingOracle] = useState<OracleVideo | null>(null);
  const [editingBonus, setEditingBonus] = useState<BonusVideo | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Oracle form
  const [oTitle, setOTitle] = useState("");
  const [oDesc, setODesc] = useState("");
  const [oEmbed, setOEmbed] = useState("");
  const [oOpen, setOOpen] = useState("");
  const [oRoles, setORoles] = useState<string[]>(["member", "early_access", "admin", "super_admin"]);

  // Bonus form
  const [bTitle, setBTitle] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [bEmbed, setBEmbed] = useState("");
  const [bCategory, setBCategory] = useState("formation");
  const [bRoles, setBRoles] = useState<string[]>(["member", "early_access", "admin", "super_admin"]);

  const ORACLE_ACCENT = "#4F78CC";
  const BONUS_ACCENT  = "#C8882A";
  const accent = section === "oracle" ? ORACLE_ACCENT : BONUS_ACCENT;

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchOracle = async () => {
    const { data } = await supabase.from("videos").select("*").order("sort_order", { ascending: true });
    if (data) setOracleVideos(data);
    setOracleLoading(false);
  };

  const fetchBonus = async () => {
    const { data } = await supabase.from("bonus_videos").select("*").order("sort_order", { ascending: true });
    if (data) setBonusVideos(data as any);
    setBonusLoading(false);
  };

  useEffect(() => { fetchOracle(); fetchBonus(); }, []);

  // ── Panel helpers ─────────────────────────────────────────────────────────────

  const closePanel = () => {
    setPanelOpen(false);
    setEditingOracle(null);
    setEditingBonus(null);
    setIsNew(false);
  };

  const openOracleNew = () => {
    setSection("oracle");
    setEditingOracle(null); setEditingBonus(null);
    setOTitle(""); setODesc(""); setOEmbed(""); setOOpen("");
    setORoles(["member", "early_access", "admin", "super_admin"]);
    setIsNew(true); setPanelOpen(true);
  };

  const openOracleEdit = (v: OracleVideo) => {
    setSection("oracle");
    setEditingBonus(null);
    setEditingOracle(v);
    setOTitle(v.title); setODesc(v.description || ""); setOEmbed(v.embed_url); setOOpen(v.open_url || "");
    setORoles(v.accessible_roles || ["member", "early_access", "admin", "super_admin"]);
    setIsNew(false); setPanelOpen(true);
  };

  const openBonusNew = () => {
    setSection("bonus");
    setEditingOracle(null); setEditingBonus(null);
    setBTitle(""); setBDesc(""); setBEmbed(""); setBCategory("formation");
    setBRoles(["member", "early_access", "admin", "super_admin"]);
    setIsNew(true); setPanelOpen(true);
  };

  const openBonusEdit = (v: BonusVideo) => {
    setSection("bonus");
    setEditingOracle(null);
    setEditingBonus(v);
    setBTitle(v.title); setBDesc(v.description || ""); setBEmbed(v.embed_code); setBCategory(v.category || "formation");
    setBRoles(v.accessible_roles || ["member", "early_access", "admin", "super_admin"]);
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

  const saveBonus = async () => {
    if (!bTitle.trim() || !bEmbed.trim()) {
      toast({ title: "Champs requis", description: "Titre et code embed sont obligatoires.", variant: "destructive" });
      return;
    }
    const cleanEmbed = bEmbed.trim()
      .replace(/\s*width\s*=\s*["']\d+["']/gi, "")
      .replace(/\s*height\s*=\s*["']\d+["']/gi, "")
      .replace(/width:\s*\d+px\s*;?/gi, "width:100%;")
      .replace(/height:\s*\d+px\s*;?/gi, "height:100%;");

    const payload = {
      title: bTitle.trim(), description: bDesc.trim() || null,
      embed_code: cleanEmbed, category: bCategory, accessible_roles: bRoles,
    };
    if (editingBonus) {
      const { error } = await supabase.from("bonus_videos").update(payload as any).eq("id", editingBonus.id);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo mise à jour" });
    } else {
      const nextOrder = bonusVideos.length > 0 ? Math.max(...bonusVideos.map(v => v.sort_order)) + 1 : 1;
      const { error } = await supabase.from("bonus_videos").insert({ ...payload, sort_order: nextOrder } as any);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo bonus ajoutée" });
    }
    closePanel(); fetchBonus();
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const deleteOracle = async (id: string) => {
    if (!confirm("Supprimer cette vidéo ?")) return;
    await supabase.from("videos").delete().eq("id", id);
    toast({ title: "Vidéo supprimée" });
    if (editingOracle?.id === id) closePanel();
    fetchOracle();
  };

  const deleteBonus = async (id: string) => {
    if (!confirm("Supprimer cette vidéo bonus ?")) return;
    await supabase.from("bonus_videos").delete().eq("id", id);
    toast({ title: "Vidéo supprimée" });
    if (editingBonus?.id === id) closePanel();
    fetchBonus();
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

  // ── Drag Bonus ────────────────────────────────────────────────────────────────

  const handleBonusDragEnd = async () => {
    if (bonusDragIndex === null || bonusOverIndex === null || bonusDragIndex === bonusOverIndex) {
      setBonusDragIndex(null); setBonusOverIndex(null); return;
    }
    const next = [...bonusVideos];
    const [moved] = next.splice(bonusDragIndex, 1);
    next.splice(bonusOverIndex, 0, moved);
    const updates = next.map((v, i) => ({ ...v, sort_order: i + 1 }));
    setBonusVideos(updates);
    setBonusDragIndex(null); setBonusOverIndex(null);
    await Promise.all(updates.map(v => supabase.from("bonus_videos").update({ sort_order: v.sort_order } as any).eq("id", v.id)));
    toast({ title: "Ordre mis à jour" });
  };

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (oracleLoading && bonusLoading) {
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
          onClick={section === "oracle" ? openOracleNew : openBonusNew}
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
          active={section === "bonus"} accent={BONUS_ACCENT}
          label="Mercure Institut" count={bonusVideos.length}
          onClick={() => setSection("bonus")}
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
          ) : (
            <BonusVideoList
              accent={BONUS_ACCENT}
              videos={bonusVideos}
              dragIndex={bonusDragIndex}
              overIndex={bonusOverIndex}
              editingId={editingBonus?.id ?? null}
              onDragStart={setBonusDragIndex}
              onDragOver={(e, i) => { e.preventDefault(); setBonusOverIndex(i); }}
              onDragEnd={handleBonusDragEnd}
              onEdit={openBonusEdit}
              onDelete={deleteBonus}
            />
          )}
        </div>

        {/* Edit panel — slides in */}
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

            {/* Bonus form */}
            {section === "bonus" && (
              <>
                <FieldGroup label="Titre *">
                  <Input value={bTitle} onChange={e => setBTitle(e.target.value)} placeholder="Ex : Module 1 – Introduction" style={inputStyle} />
                </FieldGroup>
                <FieldGroup label="Description">
                  <Textarea value={bDesc} onChange={e => setBDesc(e.target.value)} placeholder="Description…" rows={2} style={{ ...inputStyle, resize: "none" as const }} />
                </FieldGroup>
                <FieldGroup label="Code Embed / Lien *" hint="iFrame, script Vidalytics, ou lien Google Drive">
                  <Textarea value={bEmbed} onChange={e => setBEmbed(e.target.value)} placeholder={'<iframe src="https://…"></iframe>\nou\nhttps://drive.google.com/…/view'} rows={4} style={{ ...inputStyle, resize: "none" as const, fontFamily: "monospace", fontSize: "11px" }} />
                </FieldGroup>
                <FieldGroup label="Catégorie">
                  <Select value={bCategory} onValueChange={setBCategory}>
                    <SelectTrigger style={inputStyle}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formation">Vidéo de formation</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>
                <FieldGroup label="Rôles autorisés">
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {ROLE_OPTIONS.map(role => (
                      <label key={role.value} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
                        <Checkbox
                          checked={bRoles.includes(role.value)}
                          onCheckedChange={checked => setBRoles(prev => checked ? [...prev, role.value] : prev.filter(r => r !== role.value))}
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
              onClick={section === "oracle" ? saveOracle : saveBonus}
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
