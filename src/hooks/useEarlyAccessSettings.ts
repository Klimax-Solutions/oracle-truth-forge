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

      const { data } = await supabase
        .from("early_access_settings")
        .select("button_key, button_label, button_url")
        .eq("user_id", user.id);

      if (data) setSettings(data as EASetting[]);
      setLoading(false);
    };
    fetch();
  }, []);

  return { settings, loading };
};
