import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, ExternalLink } from "lucide-react";
import { EAApprovalNotification } from "@/components/dashboard/EAApprovalNotification";
import { DashboardSidebar, useSidebarRoles } from "@/components/dashboard/DashboardSidebar";
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DataSourceSelector, DataSource } from "@/components/dashboard/DataSourceSelector";
import { useDataGenerale } from "@/hooks/useDataGenerale";
import { usePersonalTrades } from "@/hooks/usePersonalTrades";
import { useQuestData } from "@/hooks/useQuestData";
import { ProfileSettingsDialog } from "@/components/dashboard/ProfileSettingsDialog";
import { DataAnalysisPage } from "@/components/dashboard/DataAnalysisPage";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { EarlyAccessTimer } from "@/components/dashboard/EarlyAccessTimer";
import { useEarlyAccessSettings } from "@/hooks/useEarlyAccessSettings";
import { useEaActivityTracking, trackEaButtonClick } from "@/hooks/useEaActivityTracking";
import { RoleSwitcher, SimulatedRole, getEffectiveRoles } from "@/components/dashboard/RoleSwitcher";
import { HeaderClock } from "@/components/dashboard/HeaderClock";
import { useUserTimezone } from "@/hooks/useUserTimezone";

import { SetupPage } from "@/components/dashboard/SetupPage";
import { OracleExecution } from "@/components/dashboard/OracleExecution";
import { VideoSetup } from "@/components/dashboard/VideoSetup";
import { AdminVerification } from "@/components/dashboard/AdminVerification";
// RoleManagement is now embedded in AdminVerification
import { BatchImportPage } from "@/components/dashboard/BatchImportPage";
import { SuccessPage } from "@/components/dashboard/SuccessPage";
import { QuestFloatingBubble } from "@/components/dashboard/QuestFloatingBubble";
import { ResultsPage } from "@/components/dashboard/ResultsPage";
import { AdminVerificationPopup } from "@/components/dashboard/AdminVerificationPopup";
import { EarlyAccessManagement } from "@/components/dashboard/EarlyAccessManagement";
import { CycleReportPopup } from "@/components/dashboard/CycleReportPopup";
import { EarlyAccessLoginPopup } from "@/components/dashboard/EarlyAccessLoginPopup";
import { EAPendingPopup } from "@/components/dashboard/EAPendingPopup";
import { ResultNotificationPopup } from "@/components/dashboard/ResultNotificationPopup";
import { EarlyAccessExpiredPopup } from "@/components/dashboard/EarlyAccessExpiredPopup";
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
  const [activeTab, setActiveTab] = useState(() => "execution");
  const [databaseFilters, setDatabaseFilters] = useState<any>(null);
  const [dataSource, setDataSource] = useState<DataSource>("all");
  const [displayName, setDisplayName] = useState<string>("");
  const { trades: personalTrades } = usePersonalTrades();
  const { isAdmin: realIsAdmin, isSuperAdmin: realIsSuperAdmin, isSetter: realIsSetter, loadingRoles } = useSidebarRoles();
  const questData = useQuestData();
  const { isEarlyAccess: realIsEarlyAccess, expiresAt } = useEarlyAccess();
  const { settings: eaSettings } = useEarlyAccessSettings();
  const navigate = useNavigate();
  const { timezone, setTimezone: setUserTimezone } = useUserTimezone();
  
  // Role switching for super admins
  const [simulatedRole, setSimulatedRole] = useState<SimulatedRole>("none");
  const { effectiveIsAdmin, effectiveIsSuperAdmin, effectiveIsEarlyAccess, effectiveIsSetter } = 
    getEffectiveRoles(realIsSuperAdmin, simulatedRole);
  
  // Use effective roles throughout the dashboard
  const isAdmin = effectiveIsAdmin;
  const isSuperAdmin = effectiveIsSuperAdmin;
  const isSetter = effectiveIsSetter;
  const isSetterOnly = isSetter && !isSuperAdmin && !isAdmin;
  const isEarlyAccess = simulatedRole !== "none" ? effectiveIsEarlyAccess : realIsEarlyAccess;
  // When simulating EA, create a fake expiresAt 3 days from now for demo
  const effectiveExpiresAt = simulatedRole === "early_access" 
    ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    : expiresAt;
  
  useEaActivityTracking(activeTab, realIsEarlyAccess);
  const showDataGenerale = simulatedRole !== "none" 
    ? (effectiveIsAdmin || effectiveIsSuperAdmin)
    : (realIsAdmin || realIsSuperAdmin);
  const needsDataGenerale = showDataGenerale || isEarlyAccess;
  const { dataGenerale } = useDataGenerale(trades, needsDataGenerale);

  // Force tab change when role changes
  useEffect(() => {
    if (isSetterOnly) {
      setActiveTab("early-access-mgmt");
    } else if (simulatedRole !== "none") {
      // Reset to a valid tab for the simulated role
      setActiveTab("execution");
    }
  }, [isSetterOnly, simulatedRole]);
  const isEarlyAccessExpired = useMemo(() => {
    if (!isEarlyAccess || !expiresAt) return false;
    return new Date(expiresAt).getTime() <= Date.now();
  }, [isEarlyAccess, expiresAt]);

  useEffect(() => {
    const checkUserAccess = async (uid: string, userMeta?: any) => {
      // Check if password has been set — if not, redirect to setup
      if (!userMeta?.password_set) {
        navigate("/setup-password");
        return false;
      }

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
          checkUserAccess(session.user.id, session.user.user_metadata);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkUserAccess(session.user.id, session.user.user_metadata);
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

  if (loading || loadingRoles) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }



  const getDisplayTrades = () => {
    if (dataSource === "data-generale" && showDataGenerale) {
      return dataGenerale;
    }

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
  const showDataSourceSelector = ["data-analysis"].includes(activeTab) && !isEarlyAccess && !isSetterOnly;

  const renderContent = () => {
    if (isSetterOnly) return <EarlyAccessManagement />;
    switch (activeTab) {
      case "execution":
        return <OracleExecution trades={trades} dataGeneraleTrades={isEarlyAccess ? dataGenerale : undefined} onNavigateToVideos={() => setActiveTab("videos")} onNavigateToSetup={() => setActiveTab("setup")} questData={questData} />;
      case "setup":
        return <SetupPage trades={trades} initialFilters={databaseFilters} analyzedTradeNumbers={questData.analyzedTradeNumbers} onAnalysisToggle={questData.toggleTradeAnalysis} ebaucheComplete={questData.ebaucheComplete} />;
      case "data-analysis":
        return <DataAnalysisPage trades={isEarlyAccess ? dataGenerale : displayTrades} onNavigateToDatabase={handleNavigateToDatabase} isEarlyAccess={isEarlyAccess} isExpired={isEarlyAccessExpired} />;
      case "videos":
        return <VideoSetup />;
      case "successes":
        return <SuccessPage />;
      case "results":
        return <ResultsPage isAdmin={isAdmin || isSuperAdmin} />;
      case "batch-import":
        return <BatchImportPage />;
      case "admin":
        return <AdminVerification />;
      case "roles":
        return <AdminVerification />;
      case "early-access-mgmt":
        return <EarlyAccessManagement />;
      default:
        return <OracleExecution trades={trades} dataGeneraleTrades={isEarlyAccess ? dataGenerale : undefined} onNavigateToSetup={() => setActiveTab("setup")} questData={questData} />;
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
      {/* Mobile Header */}
      <MobileHeader
        userEmail={displayName || user?.email?.split("@")[0] || ""}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        isSetter={isSetter}
        overrideIsEarlyAccess={simulatedRole !== "none" ? isEarlyAccess : undefined}
        dataSourceSelector={showDataSourceSelector ? (
          <DataSourceSelector value={dataSource} onChange={setDataSource} showDataGenerale={showDataGenerale} />
        ) : undefined}
        earlyAccessTimer={isEarlyAccess && effectiveExpiresAt ? <EarlyAccessTimer expiresAt={effectiveExpiresAt} /> : undefined}
      />

      {/* Desktop Sidebar */}
      <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} overrideRoles={simulatedRole !== "none" ? { isAdmin, isSuperAdmin, isSetter, isEarlyAccess } : undefined} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden md:block border-b border-border bg-card">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                {displayName || user?.email?.split("@")[0] || ""}
              </span>
              {realIsSuperAdmin && (
                <RoleSwitcher current={simulatedRole} onChange={setSimulatedRole} />
              )}
            </div>
            {/* Early Access Timer centered */}
            {isEarlyAccess && effectiveExpiresAt && (
              <div className="flex-1 flex items-center justify-center gap-3">
                <EarlyAccessTimer expiresAt={effectiveExpiresAt} />
                {(() => {
                  const oracleBtn = eaSettings.find(s => s.button_key === "acceder_a_oracle");
                  const oracleUrl = oracleBtn?.button_url;
                  return oracleUrl ? (
                    <a href={oracleUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackEaButtonClick("acceder_a_oracle")}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs border-foreground/30 text-foreground hover:bg-accent">
                        <ExternalLink className="w-3 h-3" />
                        Accéder à Oracle
                      </Button>
                    </a>
                  ) : null;
                })()}
              </div>
            )}
            <div className="flex items-center gap-3">
              <HeaderClock timezone={timezone} onTimezoneChange={setUserTimezone} />
              {showDataSourceSelector && (
                <DataSourceSelector value={dataSource} onChange={setDataSource} showDataGenerale={showDataGenerale} />
              )}
              <EAApprovalNotification />
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

      {/* Admin Verification Popup */}
      {(isAdmin || isSuperAdmin) && (
        <AdminVerificationPopup onNavigateToAdmin={() => setActiveTab("admin")} />
      )}
      
      {/* EA Pending Popup - super admin only */}
      {isSuperAdmin && (
        <EAPendingPopup onNavigateToEA={() => setActiveTab("admin")} />
      )}
      
      {/* Cycle Report Popup for members */}
      <CycleReportPopup />
      
      {/* Early Access Login Popup */}
      <EarlyAccessLoginPopup />
      {!isSetter && <ResultNotificationPopup onNavigateToResults={() => setActiveTab("results")} />}
      {isEarlyAccess && isEarlyAccessExpired && <EarlyAccessExpiredPopup />}
    </div>
    </div>
  );
};

export default Dashboard;
