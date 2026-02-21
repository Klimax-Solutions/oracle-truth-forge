import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BonusVideo {
  id: string;
  title: string;
  embed_code: string;
  sort_order: number;
}

export const BonusVideoViewer = () => {
  const [videos, setVideos] = useState<BonusVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("bonus_videos" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (data) setVideos(data as any);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Aucune vidéo disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {videos.map((video) => (
          <div key={video.id} className="border border-border rounded-lg overflow-hidden bg-card">
            <div className="p-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground truncate">{video.title}</h3>
            </div>
            <div
              className="w-full aspect-video"
              dangerouslySetInnerHTML={{ __html: video.embed_code }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
