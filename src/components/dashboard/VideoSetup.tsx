import { useState, useEffect } from "react";
import { Plus, Trash2, X, Video, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface VideoItem {
  id: string;
  title: string;
  embedCode: string;
  createdAt: Date;
}

export const VideoSetup = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEmbedCode, setNewEmbedCode] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check if current user is admin (for now, specific emails are admin)
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        // Admin check - you can customize this list
        const adminEmails = ["jules.philipon@gmail.com"];
        setIsAdmin(adminEmails.includes(user.email));
      }
    };
    checkAdmin();
  }, []);

  const extractVideoUrl = (embedCode: string): string | null => {
    // Try to extract src from iframe
    const srcMatch = embedCode.match(/src=["']([^"']+)["']/);
    if (srcMatch) {
      return srcMatch[1];
    }
    // If it's already a URL
    if (embedCode.includes("youtube.com") || embedCode.includes("youtu.be") || embedCode.includes("vimeo.com")) {
      // Convert YouTube watch URLs to embed format
      if (embedCode.includes("youtube.com/watch")) {
        const videoId = embedCode.match(/v=([^&]+)/)?.[1];
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }
      if (embedCode.includes("youtu.be/")) {
        const videoId = embedCode.split("youtu.be/")[1]?.split("?")[0];
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }
      return embedCode;
    }
    return null;
  };

  const handleAddVideo = () => {
    if (!newTitle.trim() || !newEmbedCode.trim()) return;
    
    const videoUrl = extractVideoUrl(newEmbedCode);
    if (!videoUrl) {
      alert("Code embed invalide. Veuillez utiliser un code iframe YouTube ou Vimeo.");
      return;
    }

    const newVideo: VideoItem = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      embedCode: videoUrl,
      createdAt: new Date(),
    };

    setVideos([newVideo, ...videos]);
    setNewTitle("");
    setNewEmbedCode("");
    setIsAddingVideo(false);
  };

  const handleDeleteVideo = (id: string) => {
    setVideos(videos.filter(v => v.id !== id));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">Vidéo du Setup Oracle</h2>
            <p className="text-sm text-muted-foreground font-mono">
              Bibliothèque de vidéos explicatives
              {!isAdmin && <span className="ml-2 text-muted-foreground/60">(Mode lecture seule)</span>}
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setIsAddingVideo(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter une vidéo
            </Button>
          )}
        </div>
      </div>

      {/* Add video modal - Admin only */}
      {isAddingVideo && isAdmin && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-6">
          <div className="bg-card border border-border rounded-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Ajouter une vidéo</h3>
              <button 
                onClick={() => setIsAddingVideo(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Titre de la vidéo</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Introduction au Setup Oracle"
                  className="w-full bg-background border border-border rounded-md px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Code Embed (YouTube, Vimeo)</label>
                <textarea
                  value={newEmbedCode}
                  onChange={(e) => setNewEmbedCode(e.target.value)}
                  placeholder={'Collez le code embed iframe ici, ou une URL YouTube...\n\nExemple: <iframe src="https://www.youtube.com/embed/..."></iframe>'}
                  rows={4}
                  className="w-full bg-background border border-border rounded-md px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none resize-none font-mono text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setIsAddingVideo(false)}
                  className="flex-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleAddVideo}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"
                >
                  Ajouter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Videos grid */}
      <div className="flex-1 p-6 overflow-auto scrollbar-hide">
        {videos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-accent border border-border flex items-center justify-center mb-6">
              <Video className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">Aucune vidéo</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              {isAdmin 
                ? "Ajoutez des vidéos explicatives du Setup Oracle pour les consulter à tout moment."
                : "Aucune vidéo n'a été ajoutée pour le moment. Revenez plus tard."}
            </p>
            {isAdmin && (
              <Button
                onClick={() => setIsAddingVideo(true)}
                variant="outline"
                className="border-border text-foreground hover:bg-accent rounded-md gap-2"
              >
                <Plus className="w-4 h-4" />
                Ajouter votre première vidéo
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="group border border-border bg-card rounded-lg overflow-hidden hover:border-ring transition-all"
              >
                {/* Video embed */}
                <div className="relative aspect-video bg-background">
                  <iframe
                    src={video.embedCode}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {/* Video info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-medium text-foreground truncate">{video.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ajouté le {video.createdAt.toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    {isAdmin ? (
                      <button
                        onClick={() => handleDeleteVideo(video.id)}
                        className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="p-2 text-muted-foreground/50">
                        <Lock className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
