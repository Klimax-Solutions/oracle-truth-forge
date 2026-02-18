import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Trade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure: string;
  entry_time: string;
  exit_time: string;
  trade_duration: string;
  rr: number;
  stop_loss_size: string;
  setup_type: string;
  entry_timing: string;
  entry_model: string;
  target_timing: string;
  speculation_hl_valid: boolean;
  target_hl_valid: boolean;
  news_day: boolean;
  news_label: string;
  screenshot_m15_m5: string | null;
  screenshot_m1: string | null;
}

interface UserExecution {
  id: string;
  trade_number: number;
  trade_date: string;
  direction: string;
  direction_structure: string | null;
  entry_time: string | null;
  exit_time: string | null;
  rr: number | null;
  setup_type: string | null;
  entry_model: string | null;
  entry_timing: string | null;
  result: string | null;
  user_id: string;
  screenshot_url: string | null;
  screenshot_entry_url: string | null;
}

/**
 * Hook that builds "Data Générale" for admins/super-admins:
 * Combines Oracle 314 reference trades with validated user trades
 * that fill gaps (missing dates or different directions on same date).
 */
export const useDataGenerale = (oracleTrades: Trade[], isAdmin: boolean) => {
  const [allUserExecutions, setAllUserExecutions] = useState<UserExecution[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAllExecutions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_executions")
        .select("id, trade_number, trade_date, direction, direction_structure, entry_time, exit_time, rr, setup_type, entry_model, entry_timing, result, user_id, screenshot_url, screenshot_entry_url")
        .order("trade_date", { ascending: true });

      if (data) {
        setAllUserExecutions(data as UserExecution[]);
      }
      setLoading(false);
    };

    fetchAllExecutions();
  }, [isAdmin]);

  const dataGenerale = useMemo(() => {
    if (!isAdmin || allUserExecutions.length === 0) return [];

    // Build a map of Oracle trades by date+direction for quick lookup
    const oracleMap = new Map<string, Trade[]>();
    for (const t of oracleTrades) {
      const key = t.trade_date;
      if (!oracleMap.has(key)) oracleMap.set(key, []);
      oracleMap.get(key)!.push(t);
    }

    // Filter user executions: only winning trades (rr > 0)
    const winningUserTrades = allUserExecutions.filter(ue => (ue.rr || 0) > 0);

    // Group winning user trades by date+direction to deduplicate
    const userTradesByDateDir = new Map<string, UserExecution>();
    for (const ue of winningUserTrades) {
      const key = `${ue.trade_date}|${ue.direction}`;
      const existing = userTradesByDateDir.get(key);
      if (!existing || (ue.rr || 0) > (existing.rr || 0)) {
        userTradesByDateDir.set(key, ue);
      }
    }

    // Find complementary trades: dates not in Oracle OR same date different direction
    const complementaryTrades: Trade[] = [];
    let syntheticNumber = 10000;

    for (const [key, ue] of userTradesByDateDir) {
      const oracleOnDate = oracleMap.get(ue.trade_date);

      let isComplement = false;
      if (!oracleOnDate) {
        isComplement = true;
      } else {
        const sameDirectionExists = oracleOnDate.some(
          ot => ot.direction.toLowerCase() === ue.direction.toLowerCase()
        );
        if (!sameDirectionExists) {
          isComplement = true;
        }
      }

      if (isComplement) {
        const dayOfWeek = getDayOfWeek(ue.trade_date);
        complementaryTrades.push({
          id: ue.id,
          trade_number: syntheticNumber++,
          trade_date: ue.trade_date,
          day_of_week: dayOfWeek,
          direction: ue.direction,
          direction_structure: ue.direction_structure || "",
          entry_time: ue.entry_time || "",
          exit_time: ue.exit_time || "",
          trade_duration: "",
          rr: ue.rr || 0,
          stop_loss_size: "",
          setup_type: ue.setup_type || "",
          entry_timing: ue.entry_timing || "",
          entry_model: ue.entry_model || "",
          target_timing: "",
          speculation_hl_valid: false,
          target_hl_valid: false,
          news_day: false,
          news_label: "",
          screenshot_m15_m5: ue.screenshot_url || null,
          screenshot_m1: ue.screenshot_entry_url || null,
        });
      }
    }

    // Combine: Oracle trades + complementary user trades, sorted by date
    const combined = [...oracleTrades, ...complementaryTrades].sort(
      (a, b) => a.trade_date.localeCompare(b.trade_date)
    );

    return combined;
  }, [oracleTrades, allUserExecutions, isAdmin]);

  const stats = useMemo(() => {
    const total = dataGenerale.length;
    const oracleCount = oracleTrades.length;
    const complementCount = total - oracleCount;
    const totalRR = dataGenerale.reduce((s, t) => s + (t.rr || 0), 0);
    const avgRR = total > 0 ? totalRR / total : 0;
    const winRate = total > 0 ? (dataGenerale.filter(t => (t.rr || 0) > 0).length / total) * 100 : 0;
    return { total, oracleCount, complementCount, totalRR, avgRR, winRate };
  }, [dataGenerale, oracleTrades]);

  return { dataGenerale, stats, loading };
};

function getDayOfWeek(dateStr: string): string {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const d = new Date(dateStr + "T00:00:00");
  return days[d.getDay()] || "";
}
