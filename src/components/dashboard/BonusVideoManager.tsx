import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  { value: "member", label: "Membre" },
  { value: "early_access", label: "Early Access" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

interface BonusVideoManagerProps {
  collapsible?: boolean;
}

export const BonusVideoManager = ({ collapsible = false }: BonusVideoManagerProps) => {
  const [videos, setVideos] = useState<BonusVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BonusVideo | null>(null);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [embedCode, setEmbedCode] = useState("");
  const [category, setCategory] = useState("formation");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["member", "early_access", "admin", "super_admin"]);

  const fetchVideos = async () => {
    const { data } = await supabase
      .from("bonus_videos")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setVideos(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchVideos(); }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setEmbedCode("");
    setCategory("formation");
    setSelectedRoles(["member", "early_access", "admin", "super_admin"]);
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (video: BonusVideo) => {
    setEditing(video);
    setTitle(video.title);
    setDescription(video.description || "");
    setEmbedCode(video.embed_code);
    setCategory(video.category || "formation");
    setSelectedRoles(video.accessible_roles || ["member", "early_access", "admin", "super_admin"]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !embedCode.trim()) {
      toast({ title: "Erreur", description: "Titre et code embed requis", variant: "destructive" });
      return;
    }
    if (selectedRoles.length === 0) {
      toast({ title: "Erreur", description: "Sélectionnez au moins un rôle", variant: "destructive" });
      return;
    }

    const cleanedEmbed = embedCode.trim()
      .replace(/\s*width\s*=\s*["']\d+["']/gi, '')
      .replace(/\s*height\s*=\s*["']\d+["']/gi, '')
      .replace(/width:\s*\d+px\s*;?/gi, 'width:100%;')
      .replace(/height:\s*\d+px\s*;?/gi, 'height:100%;')
      .replace(/max-width:\s*\d+px\s*;?/gi, '');

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      embed_code: cleanedEmbed,
      category,
      accessible_roles: selectedRoles,
    };

    if (editing) {
      const { error } = await supabase.from("bonus_videos").update(payload as any).eq("id", editing.id);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo mise à jour" });
    } else {
      const nextOrder = videos.length > 0 ? Math.max(...videos.map(v => v.sort_order)) + 1 : 1;
      const { error } = await supabase.from("bonus_videos").insert({ ...payload, sort_order: nextOrder } as any);
      if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vidéo bonus ajoutée" });
    }

    setDialogOpen(false);
    resetForm();
    fetchVideos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette vidéo bonus ?")) return;
    const { error } = await supabase.from("bonus_videos").delete().eq("id", id);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Vidéo supprimée" });
    fetchVideos();
  };

  // Drag and drop
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setOverIndex(index); };

  const handleDragEnd = async () => {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }

    const newVideos = [...videos];
    const [moved] = newVideos.splice(dragIndex, 1);
    newVideos.splice(overIndex, 0, moved);

    const updates = newVideos.map((v, i) => ({ ...v, sort_order: i + 1 }));
    setVideos(updates);
    setDragIndex(null);
    setOverIndex(null);

    await Promise.all(
      updates.map(v =>
        supabase.from("bonus_videos").update({ sort_order: v.sort_order } as any).eq("id", v.id)
      )
    );
    toast({ title: "Ordre mis à jour" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Header inside collapsible */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <Badge variant="secondary" className="font-mono text-[10px]">{videos.length} vidéos</Badge>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Ajouter
        </Button>
      </div>

      <div className={cn("overflow-auto p-3 space-y-1.5", collapsible ? "max-h-[400px]" : "flex-1")}>
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
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{video.title}</p>
                <Badge variant="outline" className="text-[9px] font-mono flex-shrink-0">
                  {video.category === "live" ? "Live" : "Formation"}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {video.embed_code.substring(0, 80)}…
              </p>
              <div className="flex items-center gap-1 mt-1">
                {(video.accessible_roles || []).map(role => (
                  <Badge key={role} variant="secondary" className="text-[8px] px-1 py-0">
                    {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(video)}>
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
            Aucune vidéo bonus. Cliquez sur "Ajouter".
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la vidéo bonus" : "Ajouter une vidéo bonus"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Module 1 — Introduction" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description de la vidéo…" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Code Embed (iFrame / Script) ou Lien Google Drive *</Label>
              <Textarea
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder={'<iframe src="https://..." ...></iframe>\nou\nhttps://drive.google.com/file/d/.../view'}
                rows={5}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formation">Vidéo de formation</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Accessible par</Label>
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
    </>
  );
};
