import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

import { OracleDatabase } from "@/components/dashboard/OracleDatabase";
import { TradingJournal } from "@/components/dashboard/TradingJournal";
import { RRDistributionChart } from "@/components/dashboard/RRDistributionChart";
import { TimingAnalysis } from "@/components/dashboard/TimingAnalysis";
import { OracleExecution } from "@/components/dashboard/OracleExecution";
import { VideoSetup } from "@/components/dashboard/VideoSetup";

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

interface TimingFilters {
  day_of_week?: string[];
  quarter?: string[];
  year?: string[];
  hour?: string;
  week?: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState("execution");
  const [databaseFilters, setDatabaseFilters] = useState<any>(null);
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
    fetchTrades();
  }, [user]);

  const fetchTrades = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .order("trade_number", { ascending: true });

    if (data) {
      setTrades(data as Trade[]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleNavigateToDatabase = (filters: TimingFilters) => {
    // Convert timing filters to database filters format
    const newFilters: any = {
      direction: [],
      direction_structure: [],
      setup_type: [],
      entry_model: [],
      entry_timing: [],
      trade_duration: [],
      rr_range: [],
      stop_loss_size: [],
      day_of_week: filters.day_of_week || [],
      quarter: filters.quarter || [],
      year: filters.year || [],
    };
    
    setDatabaseFilters(newFilters);
    setActiveTab("oracle");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "execution":
        return <OracleExecution trades={trades} />;
      case "oracle":
        return <OracleDatabase trades={trades} initialFilters={databaseFilters} />;
      case "journal":
        return <TradingJournal trades={trades} />;
      case "distribution":
        return <RRDistributionChart trades={trades} />;
      case "timing":
        return <TimingAnalysis trades={trades} onNavigateToDatabase={handleNavigateToDatabase} />;
      case "videos":
        return <VideoSetup />;
      default:
        return <OracleExecution trades={trades} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="px-6 py-4 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {user?.email}
            </span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground hover:bg-transparent"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-hidden bg-background">
          <div className="h-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
