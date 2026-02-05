import { useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VideoData {
  id: string;
  title: string;
  url: string;
  openUrl: string;
}

const VIDEOS: VideoData[] = [
  {
    id: "1",
    title: "Vidéo 1",
    url: "https://drive.google.com/file/d/10arf22qRiQYTvyVJ4c1U_nmp1CHL-MAb/preview",
    openUrl: "https://drive.google.com/file/d/10arf22qRiQYTvyVJ4c1U_nmp1CHL-MAb/view",
  },
  {
    id: "2",
    title: "Vidéo 2",
    url: "https://drive.google.com/file/d/15xmlQWBHktdMBjp2OD_W9zWoTAiaNw0Y/preview",
    openUrl: "https://drive.google.com/file/d/15xmlQWBHktdMBjp2OD_W9zWoTAiaNw0Y/view",
  },
  {
    id: "3",
    title: "Vidéo 3",
    url: "https://drive.google.com/file/d/1unscbvtLd725xbkq0iOOjdBneER2e8F4/preview",
    openUrl: "https://drive.google.com/file/d/1unscbvtLd725xbkq0iOOjdBneER2e8F4/view",
  },
  {
    id: "4",
    title: "Vidéo Finale",
    url: "https://drive.google.com/file/d/1B0ILsD0tBgwrEjWIz4Xhdl4HN4KCsR32/preview",
    openUrl: "https://drive.google.com/file/d/1B0ILsD0tBgwrEjWIz4Xhdl4HN4KCsR32/view",
  },
];

export const VideoSetup = () => {
  const [search, setSearch] = useState("");

  const filtered = VIDEOS.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-foreground">
            Vidéo du Setup Oracle
          </h2>
          <Badge variant="secondary" className="font-mono text-[10px] md:text-xs">
            {VIDEOS.length} vidéos
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une vidéo…"
            className="w-full bg-background border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
        </div>
      </div>

      {/* Video list */}
      <div className="flex-1 p-4 md:p-6 overflow-auto scrollbar-hide">
        {filtered.length === 0 ? (
          <div className="h-40 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Aucun résultat pour "{search}"</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:gap-6 max-w-4xl mx-auto">
            {filtered.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const VideoCard = ({ video }: { video: VideoData }) => (
  <div className="border border-border bg-card rounded-lg overflow-hidden">
    {/* Title */}
    <div className="px-4 pt-4 pb-2 md:px-5 md:pt-5">
      <h3 className="text-sm md:text-base font-medium text-foreground">{video.title}</h3>
    </div>

    {/* 16:9 iframe */}
    <div className="px-4 md:px-5">
      <div className="relative w-full rounded-md overflow-hidden" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={video.url}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>

    {/* Open in new tab */}
    <div className="px-4 py-3 md:px-5 md:py-4">
      <a
        href={video.openUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Ouvrir dans un nouvel onglet
      </a>
    </div>
  </div>
);
