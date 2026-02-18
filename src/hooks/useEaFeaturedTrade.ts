import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EaFeaturedTrade {
  id: string;
  content_type: "screenshot" | "video";
  image_path: string | null;
  video_url: string | null;
  direction: string | null;
  trade_date: string | null;
  rr: number | null;
  entry_time: string | null;
}

export const useEaFeaturedTrade = () => {
  const [featured, setFeatured] = useState<EaFeaturedTrade | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFeatured = async () => {
    const { data } = await supabase
      .from("ea_featured_trade")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setFeatured(data as EaFeaturedTrade);
    setLoading(false);
  };

  useEffect(() => {
    fetchFeatured();
  }, []);

  return { featured, loading, refetch: fetchFeatured };
};
