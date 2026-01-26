import { useState } from "react";
import { Plus, Play, Trash2, X, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      <div className="p-6 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">Vidéo du Setup Oracle</h2>
            <p className="text-sm text-neutral-500 font-mono">Bibliothèque de vidéos explicatives</p>
          </div>
          <Button
            onClick={() => setIsAddingVideo(true)}
            className="bg-white text-black hover:bg-neutral-200 rounded-md gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter une vidéo
          </Button>
        </div>
      </div>

      {/* Add video modal */}
      {isAddingVideo && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Ajouter une vidéo</h3>
              <button 
                onClick={() => setIsAddingVideo(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-neutral-400 block mb-2">Titre de la vidéo</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Introduction au Setup Oracle"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-4 py-3 text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
                />
              </div>
              
              <div>
                <label className="text-sm text-neutral-400 block mb-2">Code Embed (YouTube, Vimeo)</label>
                <textarea
                  value={newEmbedCode}
                  onChange={(e) => setNewEmbedCode(e.target.value)}
                  placeholder={'Collez le code embed iframe ici, ou une URL YouTube...\n\nExemple: <iframe src="https://www.youtube.com/embed/..."></iframe>'}
                  rows={4}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-4 py-3 text-white placeholder:text-neutral-500 focus:border-white focus:outline-none resize-none font-mono text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setIsAddingVideo(false)}
                  className="flex-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleAddVideo}
                  className="flex-1 bg-white text-black hover:bg-neutral-200 rounded-md"
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
            <div className="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-6">
              <Video className="w-10 h-10 text-neutral-600" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Aucune vidéo</h3>
            <p className="text-neutral-500 max-w-md mb-6">
              Ajoutez des vidéos explicatives du Setup Oracle pour les consulter à tout moment.
            </p>
            <Button
              onClick={() => setIsAddingVideo(true)}
              variant="outline"
              className="border-neutral-700 text-white hover:bg-neutral-800 rounded-md gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter votre première vidéo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div
                key={video.id}
                className="group border border-neutral-800 bg-neutral-950 rounded-lg overflow-hidden hover:border-neutral-700 transition-all"
              >
                {/* Video embed */}
                <div className="relative aspect-video bg-black">
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
                      <h4 className="text-base font-medium text-white truncate">{video.title}</h4>
                      <p className="text-xs text-neutral-500 mt-1">
                        Ajouté le {video.createdAt.toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteVideo(video.id)}
                      className="p-2 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
