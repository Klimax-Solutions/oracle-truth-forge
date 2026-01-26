import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OracleDatabase } from "./OracleDatabase";
import { UserDataEntry } from "./UserDataEntry";
import { Database, PenLine, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
}

interface TradeComparison {
  userExecution: UserExecution;
  oracleTrade: Trade | null;
  timeDifferenceHours: number | null;
  status: 'match' | 'warning' | 'error' | 'no-match';
}

export const OraclePage = ({ trades, initialFilters }: OraclePageProps) => {
  const [activeSubTab, setActiveSubTab] = useState("verification");
  const [userExecutions, setUserExecutions] = useState<UserExecution[]>([]);
  const [loading, setLoading] = useState(true);

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

    fetchUserExecutions();

    // Subscribe to changes
    const channel = supabase
      .channel('user_executions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_executions' }, () => {
        fetchUserExecutions();
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

  // Stats
  const comparisonStats = useMemo(() => {
    const total = tradeComparisons.length;
    const matches = tradeComparisons.filter(c => c.status === 'match').length;
    const warnings = tradeComparisons.filter(c => c.status === 'warning').length;
    const errors = tradeComparisons.filter(c => c.status === 'error').length;
    return { total, matches, warnings, errors };
  }, [tradeComparisons]);

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="flex-1 flex flex-col">
        {/* Sub-tabs header */}
        <div className="border-b border-border bg-card px-6 py-3">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="verification" className="gap-2 data-[state=active]:bg-background">
                <Database className="w-4 h-4" />
                Oracle Vérification
              </TabsTrigger>
              <TabsTrigger value="saisie" className="gap-2 data-[state=active]:bg-background">
                <PenLine className="w-4 h-4" />
                Saisie des Trades
              </TabsTrigger>
            </TabsList>

            {/* Comparison status badge */}
            {userExecutions.length > 0 && activeSubTab === "saisie" && (
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-muted-foreground">{comparisonStats.matches} OK</span>
                </div>
                {comparisonStats.warnings > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-orange-500">{comparisonStats.warnings} &gt;5h</span>
                  </div>
                )}
                {comparisonStats.errors > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-red-500">{comparisonStats.errors} &gt;1j</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <TabsContent value="verification" className="flex-1 m-0 data-[state=inactive]:hidden">
          <OracleDatabase trades={trades} initialFilters={initialFilters} />
        </TabsContent>

        <TabsContent value="saisie" className="flex-1 m-0 data-[state=inactive]:hidden">
          <UserDataEntry tradeComparisons={tradeComparisons} oracleTrades={trades} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
