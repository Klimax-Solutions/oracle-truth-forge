import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/** Detect if embed_code is a Google Drive link */
const isGoogleDriveLink = (code: string): boolean => {
  return /drive\.google\.com\/file\/d\//i.test(code.trim());
};

/** Convert Google Drive share/view link to embeddable preview */
const getGoogleDriveEmbedUrl = (url: string): string => {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  return url;
};

/** Detect if embed_code contains a <script> tag */
const isScriptEmbed = (code: string): boolean => {
  return /<script[\s>]/i.test(code.trim());
};

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

/** Component that executes script-based embeds (VDO Cipher etc.) */
const ScriptEmbedPlayer = ({ embedCode, videoId }: { embedCode: string; videoId: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous content
    container.innerHTML = '';

    // Parse HTML from embed code, extract scripts, and inject
    const temp = document.createElement('div');
    temp.innerHTML = embedCode;

    // Append non-script elements first
    const nonScriptNodes = Array.from(temp.childNodes).filter(
      node => !(node instanceof HTMLScriptElement)
    );
    nonScriptNodes.forEach(node => container.appendChild(node.cloneNode(true)));

    // Execute script tags
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(origScript => {
      const newScript = document.createElement('script');
      // Copy attributes
      Array.from(origScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      // Copy inline content
      if (origScript.textContent) {
        newScript.textContent = origScript.textContent;
      }
      container.appendChild(newScript);
    });

    return () => {
      if (container) container.innerHTML = '';
    };
  }, [embedCode, videoId]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 [&_div]:!w-full [&_div]:!h-full [&_video]:!w-full [&_video]:!h-full"
      style={{ position: 'absolute', inset: 0 }}
    />
  );
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
  isEaExpired?: boolean;
}

export const BonusVideoViewer = ({ userRoles = [], isEaExpired = false }: BonusVideoViewerProps) => {
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

  const videos = allVideos.filter(v => (v.category || "formation") === activeCategory);

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

  if (isEaExpired) {
    return (
      <div className="h-full flex items-center justify-center p-4 md:p-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-destructive"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <p className="text-sm font-semibold text-foreground">Accès expiré</p>
          <p className="text-xs text-muted-foreground max-w-xs">Votre période d'accès anticipé est terminée. Les vidéos ne sont plus disponibles.</p>
        </div>
      </div>
    );
  }

  const formationCount = allVideos.filter(v => (v.category || "formation") === "formation").length;
  const liveCount = allVideos.filter(v => (v.category || "formation") === "live").length;
  const showCategoryTabs = formationCount > 0 && liveCount > 0;

  if (allVideos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Aucune vidéo disponible pour le moment.
      </div>
    );
  }

  const renderPlayer = (video: BonusVideo) => {
    const code = video.embed_code;

    // Google Drive link
    if (isGoogleDriveLink(code)) {
      const embedUrl = getGoogleDriveEmbedUrl(code);
      return (
        <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0 rounded-md"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      );
    }

    // Script embed (VDO Cipher etc.)
    if (isScriptEmbed(code)) {
      return (
        <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
          <ScriptEmbedPlayer embedCode={code} videoId={video.id} />
        </div>
      );
    }

    // Standard iframe embed
    return (
      <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
        <div
          className="absolute inset-0 [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!absolute [&_iframe]:!inset-0 [&_iframe]:!border-0 [&_iframe]:rounded-md [&_div]:!w-full [&_div]:!h-full"
          style={{ position: 'absolute', inset: 0 }}
          dangerouslySetInnerHTML={{ __html: makeEmbedResponsive(code) }}
        />
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Chrome-only warning banner */}
      <div className="px-4 md:px-6 py-2.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center gap-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-500 flex-shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        <p className="text-xs font-medium text-amber-200/90">
          <span className="font-semibold text-amber-400">Attention :</span> Les vidéos bonus du Mercure Institut sont consultables uniquement et exclusivement sur <span className="font-semibold text-amber-400">Google Chrome</span>, par souci de sécurité.
        </p>
      </div>
      {/* Category tabs — affichés uniquement si les deux catégories ont du contenu */}
      {showCategoryTabs && (
        <div className="px-4 md:px-6 py-3 border-b border-border flex items-center justify-between gap-3">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="h-8">
              <TabsTrigger value="formation" className="text-[10px] px-3 h-7">Formation ({formationCount})</TabsTrigger>
              <TabsTrigger value="live" className="text-[10px] px-3 h-7">Live ({liveCount})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Badge variant="secondary" className="font-mono text-[10px]">{videos.length} vidéos</Badge>
        </div>
      )}

      {/* Split layout: Player + Playlist */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Left: Video player */}
        <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 overflow-auto scrollbar-hide">
          {selectedVideo ? (
            <>
              <h3 className="text-base md:text-lg font-semibold text-foreground mb-3">
                {selectedVideo.title}
              </h3>
              {renderPlayer(selectedVideo)}
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
