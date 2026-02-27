import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuestStepConfig {
  id: string;
  target_role: string;
  target_phase: string;
  step_order: number;
  step_label: string;
  step_description: string | null;
  video_embed: string | null;
  action_label: string | null;
  action_url: string | null;
}

export const useQuestStepConfigs = (targetRole: string, targetPhase: string) => {
  const [steps, setSteps] = useState<QuestStepConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSteps = async () => {
    const { data } = await supabase
      .from("quest_step_configs")
      .select("*")
      .eq("target_role", targetRole)
      .eq("target_phase", targetPhase)
      .order("step_order", { ascending: true });
    
    if (data) setSteps(data as QuestStepConfig[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchSteps();

    const channel = supabase
      .channel(`quest_configs_${targetRole}_${targetPhase}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quest_step_configs" }, () => fetchSteps())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [targetRole, targetPhase]);

  return { steps, loading };
};
