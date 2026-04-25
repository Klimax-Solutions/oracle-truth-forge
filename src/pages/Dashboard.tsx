import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { SetupOracleLanding } from "@/components/dashboard/SetupOracleLanding";
import RecolteDonneesPage from "@/components/dashboard/RecolteDonneesPage";
import { OracleExecution } from "@/components/dashboard/OracleExecution";
import { OracleHomePage } from "@/components/dashboard/OracleHomePage";
import { OraclePage } from "@/components/dashboard/OraclePage";
import { VideoSetup } from "@/components/dashboard/VideoSetup";
import { VideoManager } from "@/components/dashboard/VideoManager";
import { AdminVerification } from "@/components/dashboard/AdminVerification";
// RoleManagement is now embedded in AdminVerification
import { BatchImportPage } from "@/components/dashboard/BatchImportPage";
import { SuccessPage } from "@/components/dashboard/SuccessPage";
import { ResultsPage } from "@/components/dashboard/ResultsPage";
import { AdminVerificationPopup } from "@/components/dashboard/AdminVerificationPopup";
import { EarlyAccessManagement } from "@/components/dashboard/EarlyAccessManagement";
import CRMDashboard from "@/components/dashboard/admin/CRMDashboard";
import FunnelEditorPage from "@/components/dashboard/admin/FunnelEditorPage";
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

const DASHBOARD_DEFAULT_TAB = "execution";
const DASHBOARD_DATA_SOURCE_VALUES: DataSource[] = ["all", "perso", "oracle", "data-generale"];
const DASHBOARD_STATE_VERSION = 1;

const getDashboardStateStorageKey = () => {
  try {
    const sessionToken = localStorage.getItem("oracle_session_token") || "anonymous";
    return `oracle_dashboard_state_${sessionToken}`;
  } catch {
    return "oracle_dashboard_state_anonymous";
  }
};

const readDashboardState = (): {
  activeTab?: string;
  databaseFilters?: any;
  dataSource?: DataSource;
} => {
  try {
    const rawState = localStorage.getItem(getDashboardStateStorageKey());
    if (!rawState) return {};

    const parsedState = JSON.parse(rawState);
    if (parsedState?.version !== DASHBOARD_STATE_VERSION) return {};

    const persistedDataSource = DASHBOARD_DATA_SOURCE_VALUES.includes(parsedState?.dataSource)
      ? (parsedState.dataSource as DataSource)
      : "all";

    return {
      activeTab: typeof parsedState?.activeTab === "string" ? parsedState.activeTab : DASHBOARD_DEFAULT_TAB,
      databaseFilters: parsedState?.databaseFilters ?? null,
      dataSource: persistedDataSource,
    };
  } catch {
    return {};
  }
};

// ─── Access control ──────────────────────────────────────────────────────────
// Single source of truth for which tabs each role can access.
// Used both for redirection (useEffect) and render guard (renderContent).
const getAllowedTabs = (opts: {
  isAdmin: boolean; isSuperAdmin: boolean;
  isSetter: boolean; isCloser: boolean;
  isEarlyAccess: boolean; isSetterOnly: boolean;
}): Set<string> => {
  const { isAdmin, isSuperAdmin, isEarlyAccess, isSetterOnly } = opts;

  // Setter / Closer sans admin → uniquement CRM
  if (isSetterOnly) return new Set(["crm"]);

  // Tabs produit accessibles à tous (membres, EA, admins)
  const t = new Set([
    "execution", "videos", "recolte-donnees", "data-analysis",
    "successes", "results", "setup", "batch-import",
  ]);

  // Tabs admin
  if (isAdmin || isSuperAdmin) {
    ["crm", "gestion", "config", "video-admin", "admin", "roles",
     "funnel-editor", "early-access-mgmt"].forEach(id => t.add(id));
  }

  return t;
};

const Dashboard = () => {
  const persistedState = useMemo(() => readDashboardState(), []);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || persistedState.activeTab || DASHBOARD_DEFAULT_TAB);
  const [databaseFilters, setDatabaseFilters] = useState<any>(() => persistedState.databaseFilters ?? null);
  const [dataSource, setDataSource] = useState<DataSource>(() => persistedState.dataSource || "oracle");
  const [displayName, setDisplayName] = useState<string>("");
  const { trades: personalTrades } = usePersonalTrades();
  const { isAdmin: realIsAdmin, isSuperAdmin: realIsSuperAdmin, isSetter: realIsSetter, isCloser: realIsCloser, loadingRoles } = useSidebarRoles();
  const questData = useQuestData();
  const { isEarlyAccess: realIsEarlyAccess, expiresAt } = useEarlyAccess();
  const { settings: eaSettings } = useEarlyAccessSettings();
  const navigate = useNavigate();
  const { timezone, setTimezone: setUserTimezone } = useUserTimezone();
  
  // Role switching for super admins
  const [simulatedRole, setSimulatedRole] = useState<SimulatedRole>("none");
  const { effectiveIsAdmin, effectiveIsSuperAdmin, effectiveIsEarlyAccess, effectiveIsSetter, effectiveIsCloser } =
    getEffectiveRoles(realIsSuperAdmin, simulatedRole, realIsSetter, realIsCloser);
  
  // Sync activeTab → URL (?tab=crm, ?tab=agenda, etc.)
  // Only depend on activeTab — not searchParams (would cause infinite loop)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== activeTab) {
      params.set('tab', activeTab);
      window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
    }
  }, [activeTab]);

  // Use effective roles throughout the dashboard
  const isAdmin = effectiveIsAdmin;
  const isSuperAdmin = effectiveIsSuperAdmin;
  const isSetter = effectiveIsSetter;
  const isCloser = effectiveIsCloser;
  const isSetterOnly = (isSetter || isCloser) && !isSuperAdmin && !isAdmin;
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

  // ── Tab access enforcement ──────────────────────────────────────────────────
  // Runs when roles load (loadingRoles→false) and on any role/tab change.
  // Covers both role-based redirects and direct URL access (?tab=admin for a member).
  useEffect(() => {
    if (loadingRoles) return; // Wait until roles are known before enforcing

    const allowed = getAllowedTabs({ isAdmin, isSuperAdmin, isSetter, isCloser, isEarlyAccess, isSetterOnly });

    // Setter/Closer sans admin → force CRM
    if (isSetterOnly) {
      if (activeTab !== "crm") setActiveTab("crm");
      return;
    }

    // Role simulation → force a sensible default
    if (simulatedRole !== "none") {
      const isSalesRole = simulatedRole === "setter" || simulatedRole === "closer" || simulatedRole === "setter+closer";
      const target = isSalesRole ? "crm" : "execution";
      if (!allowed.has(activeTab)) setActiveTab(target);
      return;
    }

    // URL access control: if the tab is not in allowed set, redirect to default
    if (!allowed.has(activeTab)) {
      setActiveTab("execution");
    }
  }, [loadingRoles, isSetterOnly, simulatedRole, isAdmin, isSuperAdmin, isSetter, isCloser, isEarlyAccess, activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(
        getDashboardStateStorageKey(),
        JSON.stringify({
          version: DASHBOARD_STATE_VERSION,
          activeTab,
          databaseFilters,
          dataSource,
        }),
      );
    } catch (error) {
      console.warn("Unable to persist dashboard state", error);
    }
  }, [activeTab, databaseFilters, dataSource]);

  const isEarlyAccessExpired = useMemo(() => {
    if (!isEarlyAccess || !expiresAt) return false;
    return new Date(expiresAt).getTime() <= Date.now();
  }, [isEarlyAccess, expiresAt]);

  useEffect(() => {
    let authChecked = false;
    
    const checkUserAccess = async (uid: string, session?: any) => {
      if (authChecked) return true;
      authChecked = true;
      
      const userMeta = session?.user?.user_metadata;
      const hasPasswordFlag = userMeta?.password_set === true;
      const signedInWithPassword = (session?.user as any)?.amr?.some((a: any) => a.method === "password");
      
      // Check if password has been set — if not, redirect to setup
      if (!hasPasswordFlag && !signedInWithPassword) {
        navigate("/setup-password");
        return false;
      }
      
      // Auto-fix missing flag
      if (!hasPasswordFlag && signedInWithPassword) {
        supabase.auth.updateUser({ data: { password_set: true } });
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
        const { data: sessions, error: sessionsError } = await supabase
          .from("user_sessions")
          .select("session_token")
          .eq("user_id", uid);

        if (sessionsError) {
          console.warn("Unable to verify user session token", sessionsError);
          return true;
        }

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
      async (event, session) => {
        if (!session) {
          navigate("/auth");
          setLoading(false);
          return;
        }

        // Only update user state if the user ID actually changed to avoid unnecessary re-renders
        setUser((prev: any) => prev?.id === session.user.id ? prev : session.user);

        if (["SIGNED_IN", "INITIAL_SESSION", "USER_UPDATED"].includes(event)) {
          await checkUserAccess(session.user.id, session);
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        setLoading(false);
      } else {
        setUser(session.user);
        // DEV: Don't let checkUserAccess hang forever — race with a short timeout
        if (window.location.hostname === 'localhost') {
          Promise.race([
            checkUserAccess(session.user.id, session),
            new Promise(resolve => setTimeout(resolve, 500)),
          ]).then(() => setLoading(false));
        } else {
          await checkUserAccess(session.user.id, session);
          setLoading(false);
        }
      }
    });

    // Safety timeout: if auth check hangs (AbortError in dev), force loading to false
    // DEV: 800ms — RPCs abort instantly in Vite HMR, no point waiting 3s
    const devMode = window.location.hostname === 'localhost';
    const safetyTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn("[Dashboard] Auth loading timeout — forcing render");
        return false;
      });
    }, devMode ? 200 : 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [navigate]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
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
  }, [userId]);

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
    localStorage.removeItem(getDashboardStateStorageKey());
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

  // Loading gate removed — dashboard always renders.
  // Individual tabs handle their own loading states.



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
      session_id: (pt as any).session_id || null,
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
  const isRegularMember = !isAdmin && !isSuperAdmin && !isEarlyAccess && !isSetterOnly;
  // data-analysis now uses the new in-page SessionAnalysisSelector; the legacy DataSourceSelector is hidden there.
  const showDataSourceSelector = false && ["data-analysis"].includes(activeTab) && !isEarlyAccess && !isSetterOnly && (isAdmin || isSuperAdmin);

  const renderContent = () => {
    // Setter / Closer sans admin → uniquement CRM
    if (isSetterOnly) return <CRMDashboard overrideRoles={{ isAdmin, isSuperAdmin, isSetter, isCloser }} />;

    // Belt-and-suspenders: block any tab that is not in the allowed set
    // (catches URL manipulation that bypasses the useEffect redirect)
    if (!loadingRoles) {
      const allowed = getAllowedTabs({ isAdmin, isSuperAdmin, isSetter, isCloser, isEarlyAccess, isSetterOnly });
      if (!allowed.has(activeTab)) {
        return <OracleHomePage onNavigateToVideos={() => setActiveTab("videos")} onNavigateToRecolte={() => setActiveTab("recolte-donnees")} />;
      }
    }
    switch (activeTab) {
      case "execution":
        return <OracleHomePage onNavigateToVideos={() => setActiveTab("videos")} onNavigateToRecolte={() => setActiveTab("recolte-donnees")} />;
      case "recolte-donnees":
        return <OraclePage trades={trades} initialFilters={databaseFilters} analyzedTradeNumbers={questData.analyzedTradeNumbers} onAnalysisToggle={questData.toggleTradeAnalysis} isAdmin={isAdmin || isSuperAdmin} />;
      case "setup":
        return <SetupOracleLanding trades={trades} initialFilters={databaseFilters} analyzedTradeNumbers={questData.analyzedTradeNumbers} onAnalysisToggle={questData.toggleTradeAnalysis} ebaucheComplete={questData.ebaucheComplete} onBack={() => setActiveTab("recolte-donnees")} onNavigateToAnalysis={() => setActiveTab("data-analysis")} />;
      case "data-analysis": {
        // All non-EA users now use the unified dataSource-driven displayTrades (so regular members
        // can also analyse Setup Oracle, not only their own perso trades).
        const dataAnalysisTrades = isEarlyAccess ? dataGenerale : displayTrades;
        return (
          <DataAnalysisPage
            trades={dataAnalysisTrades}
            onNavigateToDatabase={handleNavigateToDatabase}
            isEarlyAccess={isEarlyAccess}
            isExpired={isEarlyAccessExpired}
            isPersoOnly={false}
            onNavigateToRecolte={() => setActiveTab("recolte-donnees")}
            dataSource={dataSource}
            onDataSourceChange={setDataSource}
            showDataGenerale={showDataGenerale}
          />
        );
      }
      case "videos":
        return <VideoSetup overrideIsEarlyAccess={simulatedRole !== "none" ? isEarlyAccess : undefined} />;
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
      case "crm":
        return <CRMDashboard overrideRoles={simulatedRole !== "none" ? { isAdmin: effectiveIsAdmin, isSuperAdmin: effectiveIsSuperAdmin, isSetter: effectiveIsSetter, isCloser: effectiveIsCloser } : undefined} />;
      case "video-admin":
        return <VideoManager />;
      case "funnel-editor":
        return <FunnelEditorPage />;
      case "early-access-mgmt":
        return <EarlyAccessManagement />;
      case "gestion": {
        const GestionPanel = React.lazy(() => import("@/components/dashboard/admin/GestionPanel"));
        return <React.Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}><GestionPanel /></React.Suspense>;
      }
      case "config": {
        const ConfigPanel = React.lazy(() => import("@/components/dashboard/admin/ConfigPanel"));
        return <React.Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}><ConfigPanel /></React.Suspense>;
      }
      default:
        return <OracleHomePage onNavigateToVideos={() => setActiveTab("videos")} onNavigateToRecolte={() => setActiveTab("recolte-donnees")} />;
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
      <DashboardSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        overrideRoles={
          simulatedRole !== "none"
            ? { isAdmin, isSuperAdmin, isSetter, isCloser, isEarlyAccess }
            : { isAdmin: realIsAdmin, isSuperAdmin: realIsSuperAdmin, isSetter: realIsSetter, isCloser: realIsCloser, isEarlyAccess: realIsEarlyAccess }
        }
      />

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


      {/* Admin Verification Popup */}
      {(isAdmin || isSuperAdmin) && (
        <AdminVerificationPopup onNavigateToAdmin={() => setActiveTab("admin")} />
      )}
      
      {/* EA Pending Popup - super admin only */}
      {isSuperAdmin && (
        <EAPendingPopup onNavigateToEA={() => setActiveTab("admin")} />
      )}
      
      {/* Cycle Report Popup for members */}
      {!isSetterOnly && <CycleReportPopup />}
      
      {/* Early Access Login Popup */}
      {!isSetterOnly && <EarlyAccessLoginPopup />}
      {!isSetterOnly && <ResultNotificationPopup onNavigateToResults={() => setActiveTab("results")} />}
      {isEarlyAccess && isEarlyAccessExpired && <EarlyAccessExpiredPopup />}
    </div>
    </div>
  );
};

export default Dashboard;
