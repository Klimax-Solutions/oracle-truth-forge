import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Pencil, Trash2, Save, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BonusVideoManager } from "./BonusVideoManager";

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  embed_url: string;
  open_url: string | null;
  sort_order: number;
  accessible_roles: string[];
}

const ROLE_OPTIONS = [
  { value: "member", label: "Membre" },
  { value: "early_access", label: "Early Access" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

interface VideoManagerProps {
  embedded?: boolean;
}

export const VideoManager = ({ embedded = false }: VideoManagerProps) => {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VideoData | null>(null);
  const [oracleOpen, setOracleOpen] = useState(true);
  const [bonusOpen, setBonusOpen] = useState(true);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [openUrl, setOpenUrl] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["member", "early_access", "admin", "super_admin"]);

  const fetchVideos = async () => {
    const { data } = await supabase
      .from("videos")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setVideos(data);
    setLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEmbedUrl("");
    setOpenUrl("");
    setSelectedRoles(["member", "early_access", "admin", "super_admin"]);
    setEditing(null);
  };

  const openEditDialog = (video: VideoData) => {
    setEditing(video);
    setTitle(video.title);
    setDescription(video.description || "");
    setEmbedUrl(video.embed_url);
    setOpenUrl(video.open_url || "");
    setSelectedRoles(video.accessible_roles || ["member", "early_access", "admin", "super_admin"]);
    setDialogOpen(true);
  };

  const openCreateDialog = () => { resetForm(); setDialogOpen(true); };

  const handleSave = async () => {
    if (!title.trim() || !embedUrl.trim()) {
      toast({ title: "Erreur", description: "Titre et lien embed requis", variant: "destructive" });
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      embed_url: embedUrl.trim(),
      open_url: openUrl.trim() || null,
      accessible_roles: selectedRoles,
    };
    if (editing) {
      const { error } = await supabase.from("videos").update(payload as any).eq("id", editing.id);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo mise à jour" });
    } else {
      const nextOrder = videos.length > 0 ? Math.max(...videos.map((v) => v.sort_order)) + 1 : 1;
      const { error } = await supabase.from("videos").insert({ ...payload, sort_order: nextOrder } as any);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo ajoutée" });
    }
    setDialogOpen(false);
    resetForm();
    fetchVideos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette vidéo ?")) return;
    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Vidéo supprimée" });
    fetchVideos();
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setOverIndex(index);
  };

  const handleDragEnd = async () => {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }

    const newVideos = [...videos];
    const [moved] = newVideos.splice(dragIndex, 1);
    newVideos.splice(overIndex, 0, moved);

    // Reassign sort_order
    const updates = newVideos.map((v, i) => ({ ...v, sort_order: i + 1 }));
    setVideos(updates);
    setDragIndex(null);
    setOverIndex(null);

    // Save all in parallel
    await Promise.all(
      updates.map(v =>
        supabase.from("videos").update({ sort_order: v.sort_order } as any).eq("id", v.id)
      )
    );
    toast({ title: "Ordre mis à jour" });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {!embedded && (
        <div className="p-4 md:p-6 border-b border-border flex-shrink-0">
          <h2 className="text-lg md:text-xl font-semibold text-foreground">
            Gestion des Vidéos
          </h2>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Oracle Videos - Collapsible */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setOracleOpen(!oracleOpen)}
              className="w-full flex items-center justify-between p-3 md:p-4 bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                {oracleOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm font-semibold text-foreground">Vidéos Setup Oracle</span>
                <Badge variant="secondary" className="font-mono text-[10px]">{videos.length}</Badge>
              </div>
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); openCreateDialog(); }}
                className="gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </Button>
            </button>

            {oracleOpen && (
              <div className="max-h-[400px] overflow-auto p-3 space-y-1.5">
                {videos.map((video, index) => (
                  <div
                    key={video.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-2 p-2.5 md:p-3 border border-border bg-card rounded-lg transition-all cursor-grab active:cursor-grabbing",
                      dragIndex === index && "opacity-50 scale-[0.98]",
                      overIndex === index && dragIndex !== null && dragIndex !== index && "border-primary border-2"
                    )}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{video.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{video.embed_url}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {(video.accessible_roles || []).map(role => (
                          <Badge key={role} variant="secondary" className="text-[8px] px-1 py-0">
                            {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEditDialog(video)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => handleDelete(video.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {videos.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Aucune vidéo. Cliquez sur "Ajouter".
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bonus Videos - Collapsible */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setBonusOpen(!bonusOpen)}
              className="w-full flex items-center justify-between p-3 md:p-4 bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2">
                {bonusOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm font-semibold text-foreground">Vidéos Bonus — Mercure Institut</span>
              </div>
            </button>

            {bonusOpen && (
              <BonusVideoManager collapsible />
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la vidéo" : "Ajouter une vidéo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Vidéo 1 – Introduction" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description de la vidéo…" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Lien Embed *</Label>
              <Input value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)} placeholder="https://drive.google.com/file/d/.../preview" />
              <p className="text-[10px] text-muted-foreground">Lien Google Drive /preview, YouTube embed, ou tout lien iframe compatible</p>
            </div>
            <div className="space-y-2">
              <Label>Lien d'ouverture (optionnel)</Label>
              <Input value={openUrl} onChange={(e) => setOpenUrl(e.target.value)} placeholder="https://drive.google.com/file/d/.../view" />
            </div>
            <div className="space-y-2">
              <Label>Rôles autorisés</Label>
              <div className="flex flex-wrap gap-3">
                {ROLE_OPTIONS.map(role => (
                  <label key={role.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedRoles.includes(role.value)}
                      onCheckedChange={(checked) => {
                        setSelectedRoles(prev =>
                          checked ? [...prev, role.value] : prev.filter(r => r !== role.value)
                        );
                      }}
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Annuler</Button>
              <Button onClick={handleSave} className="gap-1.5">
                <Save className="w-4 h-4" />
                {editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
