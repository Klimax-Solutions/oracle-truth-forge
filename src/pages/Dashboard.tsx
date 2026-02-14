import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { DashboardSidebar, useSidebarRoles } from "@/components/dashboard/DashboardSidebar";
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DataSourceSelector, DataSource } from "@/components/dashboard/DataSourceSelector";
import { usePersonalTrades } from "@/hooks/usePersonalTrades";
import { useQuestData } from "@/hooks/useQuestData";
import { ProfileSettingsDialog } from "@/components/dashboard/ProfileSettingsDialog";
import { DataAnalysisPage } from "@/components/dashboard/DataAnalysisPage";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { EarlyAccessTimer } from "@/components/dashboard/EarlyAccessTimer";

import { SetupPage } from "@/components/dashboard/SetupPage";
import { OracleExecution } from "@/components/dashboard/OracleExecution";
import { VideoSetup } from "@/components/dashboard/VideoSetup";
import { VideoManager } from "@/components/dashboard/VideoManager";
import { AdminVerification } from "@/components/dashboard/AdminVerification";
import { RoleManagement } from "@/components/dashboard/admin/RoleManagement";
import { BatchImportPage } from "@/components/dashboard/BatchImportPage";
import { SuccessPage } from "@/components/dashboard/SuccessPage";
import { QuestFloatingBubble } from "@/components/dashboard/QuestFloatingBubble";

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
  const [dataSource, setDataSource] = useState<DataSource>("all");
  const [displayName, setDisplayName] = useState<string>("");
  const { trades: personalTrades } = usePersonalTrades();
  const { isAdmin, isSuperAdmin } = useSidebarRoles();
  const questData = useQuestData();
  const { isEarlyAccess, expiresAt } = useEarlyAccess();
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserAccess = async (uid: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, status")
        .eq("user_id", uid)
        .single();
      
      if (data?.display_name) setDisplayName(data.display_name);
      
      const status = (data as any)?.status;
      if (status === "pending" || status === "frozen" || status === "banned") {
        await supabase.auth.signOut();
        navigate("/auth");
        return false;
      }

      // Verify device session token matches one of this user's sessions
      const localToken = localStorage.getItem("oracle_session_token");
      if (localToken) {
        const { data: sessions } = await supabase
          .from("user_sessions")
          .select("session_token")
          .eq("user_id", uid);
        
        const tokenExists = (sessions || []).some(s => s.session_token === localToken);
        if (!tokenExists) {
          await supabase.auth.signOut();
          localStorage.removeItem("oracle_session_token");
          navigate("/auth");
          return false;
        }
      }
      return true;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        } else {
          setUser(session.user);
          checkUserAccess(session.user.id);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkUserAccess(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    fetchTrades();
    
    const channel = supabase
      .channel('trades_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, () => {
        fetchTrades();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const handleNavigateToOracleScreenshots = () => {
      const screenshotFilters = {
        direction: [],
        direction_structure: [],
        setup_type: [],
        entry_model: [],
        entry_timing: [],
        trade_duration: [],
        rr_range: [],
        stop_loss_size: [],
        day_of_week: [],
        quarter: [],
        year: [],
        hasScreenshots: true,
      };
      setDatabaseFilters(screenshotFilters);
      setActiveTab("setup");
    };

    window.addEventListener('navigate-oracle-screenshots', handleNavigateToOracleScreenshots);
    return () => {
      window.removeEventListener('navigate-oracle-screenshots', handleNavigateToOracleScreenshots);
    };
  }, []);

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
    localStorage.removeItem("oracle_session_token");
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleNavigateToDatabase = (filters: TimingFilters) => {
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
    setActiveTab("setup");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getDisplayTrades = () => {
    const personalTradesFormatted = personalTrades.map(pt => ({
      id: pt.id,
      trade_number: pt.trade_number + 1000,
      trade_date: pt.trade_date,
      day_of_week: pt.day_of_week,
      direction: pt.direction,
      direction_structure: pt.direction_structure || "",
      entry_time: pt.entry_time || "",
      exit_time: pt.exit_time || "",
      trade_duration: pt.trade_duration || "",
      rr: pt.rr || 0,
      stop_loss_size: pt.stop_loss_size || "",
      setup_type: pt.setup_type || "",
      entry_timing: pt.entry_timing || "",
      entry_model: pt.entry_model || "",
      target_timing: "",
      speculation_hl_valid: false,
      target_hl_valid: false,
      news_day: false,
      news_label: "",
      screenshot_m15_m5: null,
      screenshot_m1: null,
    }));

    if (dataSource === "perso") {
      return personalTradesFormatted;
    }
    if (dataSource === "oracle") {
      return trades;
    }
    return [...trades, ...personalTradesFormatted];
  };

  const displayTrades = getDisplayTrades();
  const showDataSourceSelector = ["data-analysis"].includes(activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case "execution":
        return <OracleExecution trades={trades} onNavigateToVideos={() => setActiveTab("videos")} onNavigateToSetup={() => setActiveTab("setup")} questData={questData} />;
      case "setup":
        return <SetupPage trades={trades} initialFilters={databaseFilters} analyzedTradeNumbers={questData.analyzedTradeNumbers} onAnalysisToggle={questData.toggleTradeAnalysis} ebaucheComplete={questData.ebaucheComplete} />;
      case "data-analysis":
        return <DataAnalysisPage trades={displayTrades} onNavigateToDatabase={handleNavigateToDatabase} />;
      case "videos":
        return <VideoSetup />;
      case "successes":
        return <SuccessPage />;
      case "batch-import":
        return <BatchImportPage />;
      case "admin":
        return <AdminVerification />;
      case "video-manager":
        return <VideoManager />;
      case "roles":
        return <RoleManagement />;
      default:
        return <OracleExecution trades={trades} onNavigateToSetup={() => setActiveTab("setup")} questData={questData} />;
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Early Access Timer Banner */}
      {isEarlyAccess && expiresAt && <EarlyAccessTimer expiresAt={expiresAt} />}
      
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
      {/* Mobile Header */}
      <MobileHeader
        userEmail={displayName || user?.email?.split("@")[0] || ""}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        dataSourceSelector={showDataSourceSelector ? (
          <DataSourceSelector value={dataSource} onChange={setDataSource} />
        ) : undefined}
      />

      {/* Desktop Sidebar */}
      <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Desktop Header - hidden on mobile */}
        <header className="hidden md:block border-b border-border bg-card">
          <div className="px-6 py-4 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              {displayName || user?.email?.split("@")[0] || ""}
            </span>
            <div className="flex items-center gap-3">
              {showDataSourceSelector && (
                <DataSourceSelector value={dataSource} onChange={setDataSource} />
              )}
              <ProfileSettingsDialog onDisplayNameChange={setDisplayName} />
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
        <main className="flex-1 overflow-auto bg-background">
          <div className="h-full">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Quest Floating Bubble */}
      <QuestFloatingBubble
        questData={questData}
        onNavigateToVideos={() => setActiveTab("videos")}
        onNavigateToSetup={() => setActiveTab("setup")}
        onNavigateToExecution={() => setActiveTab("execution")}
      />
    </div>
    </div>
  );
};

export default Dashboard;
