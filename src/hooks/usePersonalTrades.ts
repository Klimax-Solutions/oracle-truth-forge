import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PersonalTrade {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string;
  direction: string;
  direction_structure: string | null;
  entry_time: string | null;
  exit_time: string | null;
  trade_duration: string | null;
  rr: number | null;
  stop_loss_size: string | null;
  setup_type: string | null;
  entry_timing: string | null;
  entry_model: string | null;
  // Extended fields
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  result: string | null;
  screenshot_url: string | null;
  comment: string | null;
  exit_date: string | null;
}

export const usePersonalTrades = () => {
  const [trades, setTrades] = useState<PersonalTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_personal_trades")
        .select("*")
        .eq("user_id", user.id)
        .order("trade_number", { ascending: true });

      if (data) {
        setTrades(data as PersonalTrade[]);
      }
      setLoading(false);
    };

    fetchTrades();

    // Subscribe to changes
    const channel = supabase
      .channel('personal_trades_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_personal_trades' }, () => {
        fetchTrades();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { trades, loading };
};
