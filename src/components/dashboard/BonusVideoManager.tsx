import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
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

export const BonusVideoManager = () => {
  const [videos, setVideos] = useState<BonusVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BonusVideo | null>(null);

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

    // Auto-strip dimensions for responsive embedding
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

  const moveVideo = async (index: number, direction: "up" | "down") => {
    const newVideos = [...videos];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newVideos.length) return;

    const tempOrder = newVideos[index].sort_order;
    newVideos[index].sort_order = newVideos[swapIndex].sort_order;
    newVideos[swapIndex].sort_order = tempOrder;

    await Promise.all([
      supabase.from("bonus_videos").update({ sort_order: newVideos[index].sort_order } as any).eq("id", newVideos[index].id),
      supabase.from("bonus_videos").update({ sort_order: newVideos[swapIndex].sort_order } as any).eq("id", newVideos[swapIndex].id),
    ]);
    fetchVideos();
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Sub-header */}
      <div className="px-4 md:px-6 py-3 border-b border-border flex items-center justify-between">
        <Badge variant="secondary" className="font-mono text-[10px] md:text-xs">
          {videos.length} vidéos
        </Badge>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Ajouter
        </Button>
      </div>

      {/* Video list */}
      <div className="flex-1 overflow-auto scrollbar-hide p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-2">
          {videos.map((video, index) => (
            <div
              key={video.id}
              className="flex items-center gap-3 p-3 md:p-4 border border-border bg-card rounded-lg"
            >
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button onClick={() => moveVideo(index, "up")} disabled={index === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">▲</button>
                <button onClick={() => moveVideo(index, "down")} disabled={index === videos.length - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">▼</button>
              </div>
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
                {video.description && (
                  <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{video.description}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  {(video.accessible_roles || []).map(role => (
                    <Badge key={role} variant="secondary" className="text-[8px] px-1 py-0">
                      {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(video)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(video.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {videos.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucune vidéo bonus. Cliquez sur "Ajouter" pour commencer.
            </div>
          )}
        </div>
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
              <Label>Code Embed / iFrame *</Label>
              <Textarea
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder='<iframe src="https://..." ...></iframe>'
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Compatible VDO Cipher, YouTube, ou tout code embed iFrame</p>
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                      onCheckedChange={() => toggleRole(role.value)}
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
