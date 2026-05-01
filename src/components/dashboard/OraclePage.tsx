import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { OracleDatabase } from "./OracleDatabase";
import { UserDataEntry } from "./UserDataEntry";
import { Database, PenLine, AlertTriangle, AlertCircle, CheckCircle2, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { deriveOracleCycleWindows } from "@/lib/oracle-cycle-windows";

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
  entry_time: string | null;
  rr: number | null;
}

interface OraclePageProps {
  trades: Trade[];
  initialFilters?: any;
  analyzedTradeNumbers?: number[];
  onAnalysisToggle?: (tradeNumber: number, checked: boolean) => void;
  isAdmin?: boolean;
  onBack?: () => void;
}

interface TradeComparison {
  userExecution: UserExecution;
  oracleTrade: Trade | null;
  timeDifferenceHours: number | null;
  status: 'match' | 'warning' | 'error' | 'no-match';
}

export const OraclePage = ({ trades, initialFilters, analyzedTradeNumbers, onAnalysisToggle, isAdmin, onBack }: OraclePageProps) => {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    try {
      const saved = localStorage.getItem("oracle_active_subtab");
      return saved === "saisie" ? "saisie" : "verification";
    } catch { return "verification"; }
  });
  const [userExecutions, setUserExecutions] = useState<UserExecution[]>([]);
  // Phase 7.3 (§0.3a) — gating Database par user_cycles.status (et non par count)
  const [unlockedCycleNumbers, setUnlockedCycleNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const handleSubTabChange = (value: string) => {
    setActiveSubTab(value);
    try { localStorage.setItem("oracle_active_subtab", value); } catch {}
  };


  // Fetch user executions for comparison
  useEffect(() => {
    const fetchUserExecutions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_executions")
        .select("id, trade_number, trade_date, direction, entry_time, rr")
        .eq("user_id", user.id)
        .order("trade_number", { ascending: true });

      if (data) {
        setUserExecutions(data as UserExecution[]);
      }
      setLoading(false);
    };

    // Phase 7.3 — fetch user_cycles débloqués (status != 'locked') pour gater Database (§0.3a)
    const fetchUnlockedCycles = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_cycles")
        .select("status, cycles(cycle_number)")
        .eq("user_id", user.id)
        .neq("status", "locked");
      if (data) {
        const nums = (data as any[])
          .map(row => row.cycles?.cycle_number)
          .filter((n): n is number => typeof n === "number");
        setUnlockedCycleNumbers(nums);
      }
    };

    fetchUserExecutions();
    fetchUnlockedCycles();

    // Subscribe to changes
    const channel = supabase
      .channel('user_executions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_executions' }, () => {
        fetchUserExecutions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_cycles' }, () => {
        fetchUnlockedCycles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compare user trades with Oracle trades
  const tradeComparisons: TradeComparison[] = useMemo(() => {
    return userExecutions.map(userExec => {
      // Find matching Oracle trade by trade_number
      const oracleTrade = trades.find(t => t.trade_number === userExec.trade_number);
      
      if (!oracleTrade) {
        return {
          userExecution: userExec,
          oracleTrade: null,
          timeDifferenceHours: null,
          status: 'no-match' as const,
        };
      }

      // Calculate time difference
      const userDateTime = new Date(`${userExec.trade_date}T${userExec.entry_time || '00:00'}:00`);
      const oracleDateTime = new Date(`${oracleTrade.trade_date}T${oracleTrade.entry_time || '00:00'}:00`);
      
      const timeDiffMs = Math.abs(userDateTime.getTime() - oracleDateTime.getTime());
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      let status: 'match' | 'warning' | 'error';
      if (timeDiffHours <= 5) {
        status = 'match';
      } else if (timeDiffHours <= 24) {
        status = 'warning';
      } else {
        status = 'error';
      }

      return {
        userExecution: userExec,
        oracleTrade,
        timeDifferenceHours: timeDiffHours,
        status,
      };
    });
  }, [userExecutions, trades]);

  // R4 — Fenêtres temporelles Oracle dérivées des trades réels
  const oracleCycleWindows = useMemo(
    () => deriveOracleCycleWindows(trades),
    [trades]
  );

  // Stats
  const comparisonStats = useMemo(() => {
    const total = tradeComparisons.length;
    const matches = tradeComparisons.filter(c => c.status === 'match').length;
    const warnings = tradeComparisons.filter(c => c.status === 'warning').length;
    const errors = tradeComparisons.filter(c => c.status === 'error').length;
    return { total, matches, warnings, errors };
  }, [tradeComparisons]);

  return (
    <div className="flex flex-col min-h-full">
      <Tabs value={activeSubTab} onValueChange={handleSubTabChange} className="flex-1 flex flex-col">

        {/* ── Header sticky ── */}
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm px-3 md:px-6 py-3">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">

            {/* Back chevron */}
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/8 transition-colors flex-shrink-0"
                style={{ color: "rgba(255,255,255,0.45)" }}
                title="Retour"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}

            {/* Toggle pill */}
            <div
              style={{
                display: "inline-flex",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                padding: "3px",
                gap: "2px",
              }}
            >
              {(["verification", "saisie"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => handleSubTabChange(tab)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "7px",
                    fontSize: "12px",
                    fontWeight: activeSubTab === tab ? 600 : 400,
                    letterSpacing: "-0.01em",
                    background: activeSubTab === tab ? "rgba(255,255,255,0.09)" : "transparent",
                    color: activeSubTab === tab ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.35)",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: activeSubTab === tab ? "0 1px 0 rgba(255,255,255,0.06) inset" : "none",
                  }}
                >
                  {tab === "verification"
                    ? <><Database className="w-3 h-3" style={{ opacity: 0.7 }} />Oracle Vérif</>
                    : <><PenLine className="w-3 h-3" style={{ opacity: 0.7 }} />Saisie</>
                  }
                </button>
              ))}
            </div>

            {/* Stats badge saisie */}
            {userExecutions.length > 0 && activeSubTab === "saisie" && (
              <div className="flex items-center gap-3 text-xs font-mono ml-1 flex-shrink-0">
                <span className="flex items-center gap-1 text-emerald-400/80">
                  <CheckCircle2 className="w-3.5 h-3.5" />{comparisonStats.matches}
                </span>
                {comparisonStats.warnings > 0 && (
                  <span className="flex items-center gap-1 text-orange-400/80">
                    <AlertTriangle className="w-3.5 h-3.5" />{comparisonStats.warnings}
                  </span>
                )}
                {comparisonStats.errors > 0 && (
                  <span className="flex items-center gap-1 text-red-400/80">
                    <AlertCircle className="w-3.5 h-3.5" />{comparisonStats.errors}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <TabsContent value="verification" className="flex-1 m-0 data-[state=inactive]:hidden">
          {/* R1 §0.3a — gating par user_cycles.status (Phase 7.3) */}
          <OracleDatabase
            trades={trades}
            initialFilters={initialFilters}
            analyzedTradeNumbers={analyzedTradeNumbers}
            onAnalysisToggle={onAnalysisToggle}
            isAdmin={isAdmin}
            unlockedCycleNumbers={isAdmin ? undefined : unlockedCycleNumbers}
          />
        </TabsContent>

        <TabsContent value="saisie" className="flex-1 m-0 data-[state=inactive]:hidden">
          {/* R2+R3+R4 — fenêtres Oracle passées pour guidage et validation */}
          <UserDataEntry
            tradeComparisons={tradeComparisons}
            oracleTrades={trades}
            oracleCycleWindows={oracleCycleWindows}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
