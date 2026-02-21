import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EASetting {
  button_key: string;
  button_label: string;
  button_url: string;
}

export const useEarlyAccessSettings = () => {
  const [settings, setSettings] = useState<EASetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Check if user is precall or postcall
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("early_access_type" as any)
        .eq("user_id", user.id)
        .eq("role", "early_access")
        .maybeSingle();

      const eaType = (roleData as any)?.early_access_type;

      if (eaType === "precall") {
        // Use global settings
        const { data: globalData } = await supabase
          .from("ea_global_settings" as any)
          .select("setting_key, setting_value");

        if (globalData) {
          const mapped: EASetting[] = (globalData as any[]).map((g: any) => {
            // Map global key to button_key
            const buttonKey = g.setting_key.replace("precall_", "");
            const labels: Record<string, string> = {
              continuer_ma_recolte: "Continuer ma récolte vidéo",
              video_bonus_mercure_institut: "Bonus Mercure Institut",
              acceder_a_oracle: "Accéder à Oracle",
            };
            return {
              button_key: buttonKey,
              button_label: labels[buttonKey] || buttonKey,
              button_url: g.setting_value || "",
            };
          });
          setSettings(mapped);
        }
      } else {
        // Postcall: per-user settings
        const { data } = await supabase
          .from("early_access_settings")
          .select("button_key, button_label, button_url")
          .eq("user_id", user.id);

        if (data) setSettings(data as EASetting[]);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  return { settings, loading };
};
