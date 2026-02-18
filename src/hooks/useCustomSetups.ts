import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomSetup {
  id: string;
  name: string;
  created_by: string;
  assigned_to: string | null;
  asset: string | null;
  created_at: string;
  updated_at: string;
}

export const useCustomSetups = () => {
  const [setups, setSetups] = useState<CustomSetup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSetups = async () => {
    const { data, error } = await supabase
      .from("custom_setups")
      .select("*")
      .order("created_at", { ascending: true });

    if (data) {
      setSetups(data as CustomSetup[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSetups();

    const channel = supabase
      .channel("custom_setups_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_setups" }, () => {
        fetchSetups();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { setups, loading, refetch: fetchSetups };
};
