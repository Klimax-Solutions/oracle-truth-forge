import { useState, useEffect } from "react";
import { ExternalLink, Check, Eye, EyeOff, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  embed_url: string;
  open_url: string | null;
  sort_order: number;
}

export const VideoSetup = () => {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { isEarlyAccess } = useEarlyAccess();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [videosRes, viewsRes] = await Promise.all([
        supabase.from("videos").select("*").order("sort_order", { ascending: true }),
        supabase.from("user_video_views").select("video_id").eq("user_id", user.id),
      ]);

      if (videosRes.data) {
        setVideos(videosRes.data);
        if (videosRes.data.length > 0) {
          setSelectedVideo(videosRes.data[0]);
        }
      }

      if (viewsRes.data) {
        setViewedIds(new Set(viewsRes.data.map((v: any) => v.video_id)));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const markAsViewed = async (videoId: string) => {
    if (viewedIds.has(videoId)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_video_views").insert({
      user_id: user.id,
      video_id: videoId,
    });

    setViewedIds((prev) => new Set([...prev, videoId]));
  };

  const toggleViewed = async (videoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (viewedIds.has(videoId)) {
      await supabase
        .from("user_video_views")
        .delete()
        .eq("user_id", user.id)
        .eq("video_id", videoId);
      setViewedIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    } else {
      await supabase.from("user_video_views").insert({
        user_id: user.id,
        video_id: videoId,
      });
      setViewedIds((prev) => new Set([...prev, videoId]));
    }
  };

  const handleSelectVideo = (video: VideoData) => {
    setSelectedVideo(video);
    markAsViewed(video.id);
  };

  const viewedCount = viewedIds.size;
  const totalCount = videos.length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg md:text-xl font-semibold text-foreground">
              Vidéo du Setup Oracle
            </h2>
            <Badge variant="secondary" className="font-mono text-[10px] md:text-xs">
              {totalCount} vidéos
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {/* Bonus videos button */}
            <a
              href="https://mercurefx.webflow.io/utility/connexion"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-[10px] md:text-xs font-mono text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all bg-card"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Accéder aux vidéos bonus du Mercure Institute</span>
              <span className="sm:hidden">Vidéos bonus</span>
            </a>
            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <Eye className="w-3.5 h-3.5" />
                <span>
                  {viewedCount}/{totalCount} vues
                </span>
              </div>
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? (viewedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Split layout: Player + Playlist */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Left: Video player */}
        <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 overflow-auto scrollbar-hide">
          {selectedVideo ? (
            <>
              {/* Title */}
              <h3 className="text-base md:text-lg font-semibold text-foreground mb-3">
                {selectedVideo.title}
              </h3>

              {/* Video with animated border */}
              <div className="relative rounded-lg overflow-hidden video-glow-border">
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  {isEarlyAccess ? (
                    <div className="absolute inset-0 bg-muted/80 backdrop-blur-xl flex flex-col items-center justify-center rounded-md">
                      <Lock className="w-8 h-8 text-muted-foreground mb-3" />
                      <p className="text-sm font-semibold text-foreground mb-1">Contenu réservé</p>
                      <p className="text-xs text-muted-foreground">Accès Early Access — vidéos bientôt disponibles</p>
                    </div>
                  ) : (
                    <iframe
                      key={selectedVideo.id}
                      src={selectedVideo.embed_url}
                      className="absolute inset-0 w-full h-full rounded-md"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  )}
                </div>
              </div>

              {/* Description + open link */}
              <div className="mt-4 space-y-3">
                {selectedVideo.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedVideo.description}
                  </p>
                )}
                {selectedVideo.open_url && (
                  <a
                    href={selectedVideo.open_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ouvrir dans un nouvel onglet
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Aucune vidéo disponible
            </div>
          )}
        </div>

        {/* Right: Playlist */}
        <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card/50 flex flex-col">
          <div className="p-3 md:p-4 border-b border-border">
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Playlist · {totalCount} vidéos
            </h4>
          </div>
          <div className="flex-1 overflow-auto scrollbar-hide">
            {videos.map((video, index) => {
              const isActive = selectedVideo?.id === video.id;
              const isViewed = viewedIds.has(video.id);

              return (
                <button
                  key={video.id}
                  onClick={() => handleSelectVideo(video)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 md:px-4 py-3 text-left transition-all border-b border-border/50",
                    isActive
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-accent/50 border-l-2 border-l-transparent"
                  )}
                >
                  {/* Number / check */}
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-mono",
                      isViewed
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isViewed ? <Check className="w-3.5 h-3.5" /> : index + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        isActive ? "text-foreground" : "text-muted-foreground",
                        isEarlyAccess && "blur-sm select-none"
                      )}
                    >
                      {video.title}
                    </p>
                    {video.description && (
                      <p className={cn(
                        "text-[10px] text-muted-foreground/60 truncate mt-0.5",
                        isEarlyAccess && "blur-sm select-none"
                      )}>
                        {video.description}
                      </p>
                    )}
                  </div>

                  {/* View toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleViewed(video.id);
                    }}
                    className="p-1 rounded hover:bg-accent/50 transition-colors flex-shrink-0"
                    title={isViewed ? "Marquer comme non vue" : "Marquer comme vue"}
                  >
                    {isViewed ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground/50" />
                    )}
                  </button>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
