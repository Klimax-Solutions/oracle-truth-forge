import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useQuestPhaseVideo = (role: string, phase: string) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = `quest_video_${role}_${phase}`;
    const fetch = async () => {
      const { data } = await supabase
        .from("ea_global_settings")
        .select("setting_value")
        .eq("setting_key", key)
        .maybeSingle();
      
      setVideoUrl(data?.setting_value && data.setting_value.trim() ? data.setting_value : null);
      setLoading(false);
    };
    fetch();
  }, [role, phase]);

  return { videoUrl, loading };
};
