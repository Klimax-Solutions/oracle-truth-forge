import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuestData {
  // Onboarding
  totalVideos: number;
  viewedVideos: number;
  allVideosWatched: boolean;
  ebaucheTradesEntered: number;
  ebaucheTradesRequired: number;
  ebaucheComplete: boolean;
  ebaucheStatus: string | null; // user_cycles status for cycle 0
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
}

export const useQuestData = () => {
  const [totalVideos, setTotalVideos] = useState(0);
  const [viewedVideos, setViewedVideos] = useState(0);
  const [ebaucheTradesEntered, setEbaucheTradesEntered] = useState(0);
  const [ebaucheStatus, setEbaucheStatus] = useState<string | null>(null);
  const [todayExecutions, setTodayExecutions] = useState(0);
  const [todayWinningExecutions, setTodayWinningExecutions] = useState(0);
  const [executionsByDate, setExecutionsByDate] = useState<Record<string, { count: number; wins: number; rr: number }>>({});
  const [loading, setLoading] = useState(true);

  const dailyGoal = 5;
  const ebaucheTradesRequired = 15;

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const today = new Date().toISOString().split("T")[0];

    const [videosRes, viewsRes, execsRes, cyclesRes, cycleDefsRes] = await Promise.all([
      supabase.from("videos").select("id", { count: "exact", head: true }),
      supabase.from("user_video_views").select("video_id").eq("user_id", user.id),
      supabase.from("user_executions").select("id, trade_number, rr, created_at, trade_date").eq("user_id", user.id),
      supabase.from("user_cycles").select("status, cycle_id").eq("user_id", user.id),
      supabase.from("cycles").select("id, cycle_number").eq("cycle_number", 0).single(),
    ]);

    // Videos
    setTotalVideos(videosRes.count || 0);
    setViewedVideos(viewsRes.data?.length || 0);

    // Ebauche
    const ebaucheId = cycleDefsRes.data?.id;
    if (ebaucheId && cyclesRes.data) {
      const ebUc = cyclesRes.data.find((uc: any) => uc.cycle_id === ebaucheId);
      setEbaucheStatus(ebUc?.status || null);
    }

    // User executions
    if (execsRes.data) {
      // Ebauche trades (1-15)
      const ebTrades = execsRes.data.filter((e: any) => e.trade_number >= 1 && e.trade_number <= 15);
      setEbaucheTradesEntered(ebTrades.length);

      // Today's executions
      const todayExecs = execsRes.data.filter((e: any) => {
        const createdDate = e.created_at?.split("T")[0];
        return createdDate === today;
      });
      setTodayExecutions(todayExecs.length);
      setTodayWinningExecutions(todayExecs.filter((e: any) => (e.rr || 0) > 0).length);

      // Calendar tracker - group by created_at date
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

    // Real-time updates
    const channel = supabase
      .channel("quest_tracking")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_executions" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_video_views" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_cycles" }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const allVideosWatched = totalVideos > 0 && viewedVideos >= totalVideos;
  const ebaucheComplete = ebaucheTradesEntered >= ebaucheTradesRequired;
  const onboardingComplete = ebaucheStatus === "validated" || ebaucheStatus === "pending_review";
  const dailyGoalMet = todayWinningExecutions >= dailyGoal;

  return {
    totalVideos,
    viewedVideos,
    allVideosWatched,
    ebaucheTradesEntered,
    ebaucheTradesRequired,
    ebaucheComplete,
    ebaucheStatus,
    todayExecutions,
    todayWinningExecutions,
    dailyGoal,
    dailyGoalMet,
    executionsByDate,
    loading,
    onboardingComplete,
  };
};
