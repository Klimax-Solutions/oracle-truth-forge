import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks the current active tab and button clicks for EA members.
 * Sends a heartbeat every 30 seconds to keep the active_tab up to date.
 */
export const useEaActivityTracking = (activeTab: string, isEarlyAccess: boolean) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isEarlyAccess) return;

    const upsertHeartbeat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("ea_activity_tracking" as any)
        .upsert(
          {
            user_id: user.id,
            active_tab: activeTab,
            last_heartbeat: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "user_id" }
        );
    };

    upsertHeartbeat();
    intervalRef.current = setInterval(upsertHeartbeat, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTab, isEarlyAccess]);
};

/** Track a button click for EA members */
export const trackEaButtonClick = async (buttonKey: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get current clicks
  const { data: existing } = await supabase
    .from("ea_activity_tracking" as any)
    .select("button_clicks")
    .eq("user_id", user.id)
    .single();

  const currentClicks = (existing as any)?.button_clicks || {};
  const newClicks = { ...currentClicks, [buttonKey]: (currentClicks[buttonKey] || 0) + 1 };

  await supabase
    .from("ea_activity_tracking" as any)
    .upsert(
      {
        user_id: user.id,
        button_clicks: newClicks,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id" }
    );
};
