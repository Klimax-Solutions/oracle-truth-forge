import { useState, useEffect } from "react";
import { ExternalLink, Check, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { useEarlyAccessSettings } from "@/hooks/useEarlyAccessSettings";
import { BonusVideoViewer } from "./BonusVideoViewer";
import { VideoManager } from "./VideoManager";
import { Button } from "@/components/ui/button";

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
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const { isEarlyAccess, isExpired: isEaExpired } = useEarlyAccess();
  const { settings: eaSettings } = useEarlyAccessSettings();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [videosRes, viewsRes, rolesRes] = await Promise.all([
        supabase.from("videos").select("*").order("sort_order", { ascending: true }),
        supabase.from("user_video_views").select("video_id").eq("user_id", user.id),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      if (videosRes.data) {
        setVideos(videosRes.data);
        // For Early Access: default to video with sort_order 5 if available
        const video5 = videosRes.data.find((v: VideoData) => v.sort_order === 5);
        if (isEarlyAccess && video5) {
          setSelectedVideo(video5);
        } else if (videosRes.data.length > 0) {
          setSelectedVideo(videosRes.data[0]);
        }
      }
      if (viewsRes.data) setViewedIds(new Set(viewsRes.data.map((v: any) => v.video_id)));
      if (rolesRes.data) {
        const roles = rolesRes.data.map((r: any) => r.role);
        setUserRoles(roles);
        setIsAdmin(roles.includes("admin") || roles.includes("super_admin"));
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const markAsViewed = async (videoId: string) => {
    if (viewedIds.has(videoId)) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_video_views").insert({ user_id: user.id, video_id: videoId });
    setViewedIds((prev) => new Set([...prev, videoId]));
  };

  const toggleViewed = async (videoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (viewedIds.has(videoId)) {
      await supabase.from("user_video_views").delete().eq("user_id", user.id).eq("video_id", videoId);
      setViewedIds((prev) => { const next = new Set(prev); next.delete(videoId); return next; });
    } else {
      await supabase.from("user_video_views").insert({ user_id: user.id, video_id: videoId });
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

  // All roles get tabbed interface now
  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="oracle" className="h-full flex flex-col">
        <div className="p-4 md:p-6 border-b border-border">
          <TabsList className={cn("w-full grid", isAdmin ? "grid-cols-3" : "grid-cols-2")}>
            <TabsTrigger value="oracle" className="text-xs">Vidéo du Setup Oracle</TabsTrigger>
            <TabsTrigger value="bonus" className="text-xs">Vidéos Bonus — Mercure Institut</TabsTrigger>
            {isAdmin && <TabsTrigger value="management" className="text-xs">Gestion des vidéos</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="oracle" className="flex-1 overflow-hidden flex flex-col m-0 data-[state=inactive]:hidden">
          <VideoOracleContent
            videos={videos}
            selectedVideo={selectedVideo}
            viewedIds={viewedIds}
            totalCount={totalCount}
            viewedCount={viewedCount}
            isEarlyAccess={isEarlyAccess}
            isEaExpired={isEaExpired}
            eaSettings={eaSettings}
            onSelectVideo={handleSelectVideo}
            onToggleViewed={toggleViewed}
          />
        </TabsContent>
        <TabsContent value="bonus" className="flex-1 overflow-hidden flex flex-col m-0 data-[state=inactive]:hidden">
          <BonusVideoViewer userRoles={userRoles} isEaExpired={isEaExpired} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="management" className="flex-1 overflow-hidden flex flex-col m-0 data-[state=inactive]:hidden">
            <VideoManager embedded />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

// Extracted Oracle video content
interface VideoOracleContentProps {
  videos: VideoData[];
  selectedVideo: VideoData | null;
  viewedIds: Set<string>;
  totalCount: number;
  viewedCount: number;
  isEarlyAccess: boolean;
  isEaExpired: boolean;
  eaSettings: { button_key: string; button_url: string }[];
  onSelectVideo: (video: VideoData) => void;
  onToggleViewed: (videoId: string) => void;
}

const VideoOracleContent = ({
  videos, selectedVideo, viewedIds, totalCount, viewedCount,
  isEarlyAccess, isEaExpired, eaSettings, onSelectVideo, onToggleViewed,
}: VideoOracleContentProps) => {
  const unlockBtn = eaSettings.find(s => s.button_key === "acceder_a_oracle");
  const unlockUrl = unlockBtn?.button_url;

  // For Early Access: only video with sort_order 5 is unlocked, but if expired ALL are locked
  const isVideoLocked = (video: VideoData) => {
    if (!isEarlyAccess) return false;
    if (isEaExpired) return true;
    return video.sort_order !== 5;
  };

  return (
  <>
    {/* Progress bar */}
    <div className="px-4 md:px-6 py-3 border-b border-border flex items-center justify-between">
      <Badge variant="secondary" className="font-mono text-[10px]">{totalCount} vidéos</Badge>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
          <Eye className="w-3.5 h-3.5" />
          <span>{viewedCount}/{totalCount} vues</span>
        </div>
        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (viewedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>

    {/* Split layout: Player + Playlist */}
    <div className="flex-1 overflow-auto flex flex-col lg:flex-row">
      {/* Left: Video player */}
      <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 lg:overflow-auto scrollbar-hide">
        {selectedVideo ? (
          <>
            <h3 className="text-base md:text-lg font-semibold text-foreground mb-3">
              {selectedVideo.title}
            </h3>
            <div className="relative rounded-lg overflow-hidden video-glow-border">
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                {isVideoLocked(selectedVideo) ? (
                  <div className="absolute inset-0 bg-muted/80 backdrop-blur-xl flex flex-col items-center justify-center rounded-md gap-3">
                    <Lock className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">{isEaExpired ? "Accès expiré" : "Contenu réservé"}</p>
                    <p className="text-xs text-muted-foreground text-center px-4">{isEaExpired ? "Votre période d'accès anticipé est terminée." : "Accès Early Access — vidéos bientôt disponibles"}</p>
                    {unlockUrl && (
                      <a href={unlockUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="gap-1.5 mt-1">
                          <Unlock className="w-3.5 h-3.5" />
                          Débloquer mon accès
                        </Button>
                      </a>
                    )}
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
            <div className="mt-4 space-y-3">
              {selectedVideo.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedVideo.description}
                </p>
              )}
              {selectedVideo.open_url && !isVideoLocked(selectedVideo) && (
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
                onClick={() => onSelectVideo(video)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 md:px-4 py-3 text-left transition-all border-b border-border/50",
                  isActive
                    ? "bg-primary/10 border-l-2 border-l-primary"
                    : "hover:bg-accent/50 border-l-2 border-l-transparent"
                )}
              >
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
                <div className="flex-1 min-w-0">
                  <p
                     className={cn(
                      "text-sm font-medium truncate",
                      isActive ? "text-foreground" : "text-muted-foreground",
                      isEarlyAccess && isVideoLocked(video) && "blur-sm select-none",
                      isEarlyAccess && !isVideoLocked(video) && "font-bold animate-pulse"
                    )}
                  >
                    {video.title}
                  </p>
                  {video.description && (
                    <p className={cn(
                      "text-[10px] text-muted-foreground/60 truncate mt-0.5",
                      isEarlyAccess && isVideoLocked(video) && "blur-sm select-none"
                    )}>
                      {video.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleViewed(video.id);
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
  </>
  );
};
