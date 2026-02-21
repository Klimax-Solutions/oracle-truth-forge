import { useState, useEffect } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BonusVideo {
  id: string;
  title: string;
  embed_code: string;
  sort_order: number;
}

export const BonusVideoManager = () => {
  const [videos, setVideos] = useState<BonusVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [embedCode, setEmbedCode] = useState("");

  const fetchVideos = async () => {
    const { data } = await supabase
      .from("bonus_videos" as any)
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) setVideos(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleAdd = async () => {
    if (!title.trim() || !embedCode.trim()) {
      toast({ title: "Erreur", description: "Titre et code embed requis", variant: "destructive" });
      return;
    }

    const nextOrder = videos.length > 0 ? Math.max(...videos.map(v => v.sort_order)) + 1 : 1;
    const { error } = await supabase.from("bonus_videos" as any).insert({
      title: title.trim(),
      embed_code: embedCode.trim(),
      sort_order: nextOrder,
    } as any);

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Vidéo bonus ajoutée" });
    setTitle("");
    setEmbedCode("");
    fetchVideos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette vidéo bonus ?")) return;
    const { error } = await supabase.from("bonus_videos" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vidéo supprimée" });
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
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Add form */}
      <div className="border border-border rounded-lg p-4 space-y-4 bg-card">
        <h3 className="text-sm font-semibold text-foreground">Ajouter une vidéo bonus</h3>
        <div className="space-y-2">
          <Label>Titre de la vidéo *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Module 1 — Introduction"
          />
        </div>
        <div className="space-y-2">
          <Label>Code Embed / iFrame *</Label>
          <Textarea
            value={embedCode}
            onChange={(e) => setEmbedCode(e.target.value)}
            placeholder='<iframe src="https://..." ...></iframe>'
            rows={5}
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Compatible VDO Cipher, YouTube, ou tout code embed iFrame
          </p>
        </div>
        <Button onClick={handleAdd} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Ajouter la vidéo
        </Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground">Vidéos ajoutées</h3>
          <Badge variant="secondary" className="font-mono text-[10px]">{videos.length}</Badge>
        </div>
        {videos.map((video) => (
          <div key={video.id} className="flex items-center gap-3 p-3 border border-border bg-card rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{video.title}</p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {video.embed_code.substring(0, 80)}…
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-destructive hover:text-destructive"
              onClick={() => handleDelete(video.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        {videos.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">
            Aucune vidéo bonus ajoutée.
          </p>
        )}
      </div>
    </div>
  );
};
