import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserTimezone = () => {
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("profiles")
        .select("timezone" as any)
        .eq("user_id", user.id)
        .single();

      if (data && (data as any).timezone) {
        setTimezone((data as any).timezone);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  return { timezone, setTimezone, loading };
};

/**
 * Convert an HH:MM time string from a source timezone to a target timezone.
 * Uses a reference date to handle DST properly.
 */
export const convertTime = (
  time: string,
  fromTimezone: string,
  toTimezone: string,
  referenceDate?: string
): string => {
  if (!time || fromTimezone === toTimezone) return time;
  
  try {
    const dateStr = referenceDate || new Date().toISOString().split("T")[0];
    const source = new Date(`${dateStr}T${time.length === 5 ? time + ":00" : time}`);
    
    // Get the offset difference
    const fromOffset = getTimezoneOffset(fromTimezone, source);
    const toOffset = getTimezoneOffset(toTimezone, source);
    const diffMs = (toOffset - fromOffset) * 60 * 1000;
    
    const converted = new Date(source.getTime() + diffMs);
    return converted.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return time;
  }
};

function getTimezoneOffset(tz: string, date: Date): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: tz });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}
