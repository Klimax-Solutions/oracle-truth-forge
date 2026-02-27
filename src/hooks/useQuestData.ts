import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuestData {
  // Onboarding
  totalVideos: number;
  viewedVideos: number;
  allVideosWatched: boolean;
  ebaucheTradesAnalyzed: number;
  ebaucheTradesRequired: number;
  ebaucheComplete: boolean;
  ebaucheStatus: string | null;
  // FX Replay connection flag
  fxReplayConnected: boolean;
  // Daily
  todayExecutions: number;
  todayWinningExecutions: number;
  dailyGoal: number;
  dailyGoalMet: boolean;
  // Calendar tracker
  executionsByDate: Record<string, { count: number; wins: number; rr: number }>;
  // Loading
  loading: boolean;
  // Onboarding completed (ebauche validated)
  onboardingComplete: boolean;
  // Current cycle number (1-8, or 0 for ebauche)
  currentCycleNumber: number | null;
  // Analyzed trade numbers (for checkbox state)
  analyzedTradeNumbers: number[];
  // Optimistic toggle for trade analysis
  toggleTradeAnalysis: (tradeNumber: number, checked: boolean) => void;
  // Optimistic toggle for FX Replay flag
  setFxReplayFlag: () => void;
}

export const useQuestData = () => {
  const [totalVideos, setTotalVideos] = useState(0);
  const [viewedVideos, setViewedVideos] = useState(0);
  const [ebaucheTradesAnalyzed, setEbaucheTradesAnalyzed] = useState(0);
  const [analyzedTradeNumbers, setAnalyzedTradeNumbers] = useState<number[]>([]);
  const [ebaucheStatus, setEbaucheStatus] = useState<string | null>(null);
  const [fxReplayConnected, setFxReplayConnected] = useState(false);
  const [todayExecutions, setTodayExecutions] = useState(0);
  const [todayWinningExecutions, setTodayWinningExecutions] = useState(0);
  const [executionsByDate, setExecutionsByDate] = useState<Record<string, { count: number; wins: number; rr: number }>>({});
  const [currentCycleNumber, setCurrentCycleNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const dailyGoal = 5;
  const ebaucheTradesRequired = 15;

  // Optimistic toggle for trade analysis checkbox
  const toggleTradeAnalysis = useCallback(async (tradeNumber: number, checked: boolean) => {
    // Optimistic update immediately
    if (checked) {
      setAnalyzedTradeNumbers(prev => {
        if (prev.includes(tradeNumber)) return prev;
        const next = [...prev, tradeNumber];
        setEbaucheTradesAnalyzed(next.filter(n => n >= 1 && n <= 15).length);
        return next;
      });
    } else {
      setAnalyzedTradeNumbers(prev => {
        const next = prev.filter(n => n !== tradeNumber);
        setEbaucheTradesAnalyzed(next.filter(n => n >= 1 && n <= 15).length);
        return next;
      });
    }

    // Persist to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (checked) {
        const { error } = await supabase.from("user_trade_analyses").insert({
          user_id: user.id,
          trade_number: tradeNumber,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_trade_analyses")
          .delete()
          .eq("user_id", user.id)
          .eq("trade_number", tradeNumber);
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error toggling analysis:", error);
      // Revert on error
      if (checked) {
        setAnalyzedTradeNumbers(prev => {
          const next = prev.filter(n => n !== tradeNumber);
          setEbaucheTradesAnalyzed(next.filter(n => n >= 1 && n <= 15).length);
          return next;
        });
      } else {
        setAnalyzedTradeNumbers(prev => {
          const next = [...prev, tradeNumber];
          setEbaucheTradesAnalyzed(next.filter(n => n >= 1 && n <= 15).length);
          return next;
        });
      }
    }
  }, []);

  // Optimistic FX Replay flag
  const setFxReplayFlag = useCallback(async () => {
    // Optimistic update immediately
    setFxReplayConnected(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("user_quest_flags").insert({
        user_id: user.id,
        flag_key: "fxreplay_connected",
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error saving FX Replay flag:", error);
      // Revert on error
      setFxReplayConnected(false);
    }
  }, []);

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];

    const [videosRes, viewsRes, execsRes, cyclesRes, cycleDefsRes, analysesRes, flagsRes] = await Promise.all([
      supabase.from("videos").select("id", { count: "exact", head: true }),
      supabase.from("user_video_views").select("video_id").eq("user_id", user.id),
      supabase.from("user_executions").select("id, trade_number, rr, created_at, trade_date").eq("user_id", user.id),
      supabase.from("user_cycles").select("status, cycle_id").eq("user_id", user.id),
      supabase.from("cycles").select("id, cycle_number").eq("cycle_number", 0).single(),
      supabase.from("user_trade_analyses").select("trade_number").eq("user_id", user.id),
      supabase.from("user_quest_flags").select("flag_key").eq("user_id", user.id),
    ]);

    // Videos
    setTotalVideos(videosRes.count || 0);
    setViewedVideos(viewsRes.data?.length || 0);

    // Ebauche status
    const ebaucheId = cycleDefsRes.data?.id;
    if (ebaucheId && cyclesRes.data) {
      const ebUc = cyclesRes.data.find((uc: any) => uc.cycle_id === ebaucheId);
      setEbaucheStatus(ebUc?.status || null);
    }

    // Trade analyses (checkboxes for trades 1-15)
    if (analysesRes.data) {
      const analyzedNumbers = analysesRes.data.map((a: any) => a.trade_number);
      setAnalyzedTradeNumbers(analyzedNumbers);
      setEbaucheTradesAnalyzed(analyzedNumbers.filter((n: number) => n >= 1 && n <= 15).length);
    }

    // Quest flags
    if (flagsRes.data) {
      setFxReplayConnected(flagsRes.data.some((f: any) => f.flag_key === "fxreplay_connected"));
    }

    // User executions
    if (execsRes.data) {
      // Today's executions
      const todayExecs = execsRes.data.filter((e: any) => {
        const createdDate = e.created_at?.split("T")[0];
        return createdDate === today;
      });
      setTodayExecutions(todayExecs.length);
      setTodayWinningExecutions(todayExecs.filter((e: any) => (e.rr || 0) > 0).length);

      // Calendar tracker
      const byDate: Record<string, { count: number; wins: number; rr: number }> = {};
      execsRes.data.forEach((e: any) => {
        const date = e.created_at?.split("T")[0];
        if (!date) return;
        if (!byDate[date]) byDate[date] = { count: 0, wins: 0, rr: 0 };
        byDate[date].count++;
        if ((e.rr || 0) > 0) byDate[date].wins++;
        byDate[date].rr += e.rr || 0;
      });
      setExecutionsByDate(byDate);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("quest_tracking")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_executions" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_video_views" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_cycles" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_trade_analyses" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_quest_flags" }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const allVideosWatched = totalVideos > 0 && viewedVideos >= totalVideos;
  const ebaucheComplete = ebaucheTradesAnalyzed >= ebaucheTradesRequired;
  const onboardingComplete = ebaucheStatus === "validated" || ebaucheStatus === "pending_review";
  const dailyGoalMet = todayWinningExecutions >= dailyGoal;

  return {
    totalVideos,
    viewedVideos,
    allVideosWatched,
    ebaucheTradesAnalyzed,
    ebaucheTradesRequired,
    ebaucheComplete,
    ebaucheStatus,
    fxReplayConnected,
    todayExecutions,
    todayWinningExecutions,
    dailyGoal,
    dailyGoalMet,
    executionsByDate,
    loading,
    onboardingComplete,
    analyzedTradeNumbers,
    toggleTradeAnalysis,
    setFxReplayFlag,
  };
};
