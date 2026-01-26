import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { OracleLanding } from "@/components/dashboard/OracleLanding";
import { OracleDatabase } from "@/components/dashboard/OracleDatabase";
import { TradingJournal } from "@/components/dashboard/TradingJournal";
import { WinRateChart } from "@/components/dashboard/WinRateChart";
import { RRDistributionChart } from "@/components/dashboard/RRDistributionChart";
import { TimingAnalysis } from "@/components/dashboard/TimingAnalysis";

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
}

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState("oracle");
  const [showOracleData, setShowOracleData] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchTrades = async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .order("trade_number", { ascending: true });

      if (data) {
        setTrades(data as Trade[]);
      }
    };

    if (user) {
      fetchTrades();
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Reset showOracleData when switching away from oracle tab
  useEffect(() => {
    if (activeTab !== "oracle") {
      setShowOracleData(false);
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);

  const renderContent = () => {
    switch (activeTab) {
      case "oracle":
        return showOracleData ? (
          <OracleDatabase trades={trades} />
        ) : (
          <OracleLanding 
            onEnterDatabase={() => setShowOracleData(true)}
            totalTrades={trades.length}
            totalRR={totalRR}
          />
        );
      case "journal":
        return <TradingJournal trades={trades} />;
      case "winrate":
        return <WinRateChart trades={trades} />;
      case "distribution":
        return <RRDistributionChart trades={trades} />;
      case "timing":
        return <TimingAnalysis trades={trades} />;
      default:
        return <OracleLanding 
          onEnterDatabase={() => setShowOracleData(true)}
          totalTrades={trades.length}
          totalRR={totalRR}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-neutral-800 bg-neutral-950">
          <div className="px-6 py-4 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-neutral-500 hover:text-white hover:bg-transparent"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-hidden bg-black">
          <div className="h-full grid-pattern">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
