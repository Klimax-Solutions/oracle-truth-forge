import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, GripVertical, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

  useEffect(() => {
    fetchVideos();
  }, []);

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

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

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
      const { error } = await supabase
        .from("videos")
        .update(payload as any)
        .eq("id", editing.id);

      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Vidéo mise à jour" });
    } else {
      const nextOrder = videos.length > 0 ? Math.max(...videos.map((v) => v.sort_order)) + 1 : 1;
      const { error } = await supabase.from("videos").insert({
        ...payload,
        sort_order: nextOrder,
      } as any);

      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Vidéo ajoutée" });
    }

    setDialogOpen(false);
    resetForm();
    fetchVideos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette vidéo ?")) return;

    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vidéo supprimée" });
    fetchVideos();
  };

  const moveVideo = async (index: number, direction: "up" | "down") => {
    const newVideos = [...videos];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newVideos.length) return;

    // Swap sort_order
    const tempOrder = newVideos[index].sort_order;
    newVideos[index].sort_order = newVideos[swapIndex].sort_order;
    newVideos[swapIndex].sort_order = tempOrder;

    await Promise.all([
      supabase.from("videos").update({ sort_order: newVideos[index].sort_order }).eq("id", newVideos[index].id),
      supabase.from("videos").update({ sort_order: newVideos[swapIndex].sort_order }).eq("id", newVideos[swapIndex].id),
    ]);

    fetchVideos();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - only when standalone */}
      {!embedded && (
        <div className="p-4 md:p-6 border-b border-border">
          <h2 className="text-lg md:text-xl font-semibold text-foreground">
            Gestion des Vidéos
          </h2>
        </div>
      )}

      <Tabs defaultValue="oracle" className="flex-1 flex flex-col overflow-hidden">
        {!embedded && (
          <div className="px-4 md:px-6 pt-3">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="oracle" className="text-xs">Vidéos Oracle</TabsTrigger>
              <TabsTrigger value="bonus" className="text-xs">Vidéos Bonus — Mercure Institut</TabsTrigger>
            </TabsList>
          </div>
        )}

        <TabsContent value="oracle" className="flex-1 overflow-hidden flex flex-col m-0 data-[state=inactive]:hidden">
          {/* Oracle sub-header */}
          <div className="px-4 md:px-6 py-3 border-b border-border flex items-center justify-between">
            <Badge variant="secondary" className="font-mono text-[10px] md:text-xs">
              {videos.length} vidéos
            </Badge>
            <Button size="sm" onClick={openCreateDialog} className="gap-1.5">
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
                    <p className="text-sm font-medium text-foreground truncate">{video.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{video.embed_url}</p>
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
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEditDialog(video)}>
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
                  Aucune vidéo. Cliquez sur "Ajouter" pour commencer.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {!embedded && (
          <TabsContent value="bonus" className="flex-1 overflow-hidden flex flex-col m-0 data-[state=inactive]:hidden">
            <BonusVideoManager />
          </TabsContent>
        )}

        {embedded && (
          <>
            {/* When embedded, show both Oracle + Bonus management inline */}
            <div className="border-t border-border mt-4">
              <div className="px-4 md:px-6 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Vidéos Bonus — Mercure Institut</h3>
              </div>
              <BonusVideoManager />
            </div>
          </>
        )}
      </Tabs>

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
