import { useState, useEffect } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/** Strip fixed width/height from embed codes to make them fully responsive */
const makeEmbedResponsive = (code: string): string => {
  return code
    .replace(/\s*width\s*=\s*["']\d+["']/gi, '')
    .replace(/\s*height\s*=\s*["']\d+["']/gi, '')
    .replace(/width:\s*\d+px\s*;?/gi, 'width:100%;')
    .replace(/height:\s*\d+px\s*;?/gi, 'height:100%;')
    .replace(/max-width:\s*\d+px\s*;?/gi, '')
    .replace(/style\s*=\s*["'][^"']*["']/gi, (match) => {
      return match
        .replace(/width:\s*\d+px/gi, 'width:100%')
        .replace(/height:\s*\d+px/gi, 'height:100%');
    });
};

interface BonusVideo {
  id: string;
  title: string;
  description: string | null;
  embed_code: string;
  sort_order: number;
  category: string;
  accessible_roles: string[];
}

interface BonusVideoViewerProps {
  userRoles?: string[];
}

export const BonusVideoViewer = ({ userRoles = [] }: BonusVideoViewerProps) => {
  const [allVideos, setAllVideos] = useState<BonusVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<BonusVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("formation");

  useEffect(() => {
    const fetchVideos = async () => {
      const { data } = await supabase
        .from("bonus_videos")
        .select("*")
        .order("sort_order", { ascending: true });
      if (data) {
        // Filter by user roles
        const accessible = (data as any[]).filter((v: BonusVideo) => {
          const roles = v.accessible_roles || [];
          return userRoles.some(r => roles.includes(r));
        });
        setAllVideos(accessible);
      }
      setLoading(false);
    };
    fetchVideos();
  }, [userRoles]);

  // Filter by category
  const videos = allVideos.filter(v => (v.category || "formation") === activeCategory);

  // Auto-select first video when category changes
  useEffect(() => {
    if (videos.length > 0 && (!selectedVideo || !videos.find(v => v.id === selectedVideo.id))) {
      setSelectedVideo(videos[0]);
    } else if (videos.length === 0) {
      setSelectedVideo(null);
    }
  }, [activeCategory, allVideos]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formationCount = allVideos.filter(v => (v.category || "formation") === "formation").length;
  const liveCount = allVideos.filter(v => (v.category || "formation") === "live").length;

  if (allVideos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Aucune vidéo disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Category tabs + count */}
      <div className="px-4 md:px-6 py-3 border-b border-border flex items-center justify-between gap-3">
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="h-8">
            <TabsTrigger value="formation" className="text-[10px] px-3 h-7">Formation ({formationCount})</TabsTrigger>
            <TabsTrigger value="live" className="text-[10px] px-3 h-7">Live ({liveCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Badge variant="secondary" className="font-mono text-[10px]">{videos.length} vidéos</Badge>
      </div>

      {/* Split layout: Player + Playlist */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Left: Video player */}
        <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 overflow-auto scrollbar-hide">
          {selectedVideo ? (
            <>
              <h3 className="text-base md:text-lg font-semibold text-foreground mb-3">
                {selectedVideo.title}
              </h3>
              <div className="relative rounded-lg overflow-hidden video-glow-border">
                <div
                  className="relative w-full"
                  style={{ paddingBottom: "56.25%" }}
                >
                  <div
                    className="absolute inset-0 [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!absolute [&_iframe]:!inset-0 [&_iframe]:!border-0 [&_iframe]:rounded-md [&_div]:!w-full [&_div]:!h-full [&_div]:!position-relative"
                    style={{ position: 'absolute', inset: 0 }}
                    dangerouslySetInnerHTML={{ __html: makeEmbedResponsive(selectedVideo.embed_code) }}
                  />
                </div>
              </div>
              {selectedVideo.description && (
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  {selectedVideo.description}
                </p>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Aucune vidéo dans cette catégorie.
            </div>
          )}
        </div>

        {/* Right: Playlist */}
        <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card/50 flex flex-col">
          <div className="p-3 md:p-4 border-b border-border">
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Playlist · {videos.length} vidéos
            </h4>
          </div>
          <div className="flex-1 overflow-auto scrollbar-hide">
            {videos.map((video, index) => {
              const isActive = selectedVideo?.id === video.id;
              return (
                <button
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 md:px-4 py-3 text-left transition-all border-b border-border/50",
                    isActive
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-accent/50 border-l-2 border-l-transparent"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-mono",
                    "bg-muted text-muted-foreground"
                  )}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {video.title}
                    </p>
                    {video.description && (
                      <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
                        {video.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
            {videos.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Aucune vidéo dans cette catégorie.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
