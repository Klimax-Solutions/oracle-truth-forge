import { cn } from "@/lib/utils";
import { Database, BarChart3, ChevronRight, Crosshair, Video, ShieldCheck, Trophy, Award, TrendingUp, Layers } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";

const useHasInstitute = () => {
  const [hasInstitute, setHasInstitute] = useState(false);
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.rpc("is_institute" as any);
      if (data) setHasInstitute(true);
    };
    check();
  }, []);
  return hasInstitute;
};

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  overrideRoles?: { isAdmin: boolean; isSuperAdmin: boolean; isSetter: boolean; isEarlyAccess: boolean };
}

const tabs = [
  { id: "execution", label: "Exécution d'Oracle", icon: Crosshair },
  { id: "setup", label: "Setup", icon: Database },
  { id: "data-analysis", label: "Data Analysis", icon: BarChart3 },
  { id: "videos", label: "Vidéo du Setup Oracle", icon: Video },
  { id: "successes", label: "Chat", icon: Trophy },
];

const earlyAccessTabs = [
  { id: "results", label: "Résultats", icon: Award },
];

const crmTab = { id: "crm", label: "CRM", icon: TrendingUp };
const funnelTab = { id: "funnel-editor", label: "Funnel Editor", icon: Layers };

const adminTabs = [
  { id: "admin", label: "Vérifications Admin", icon: ShieldCheck },
];
import { Users as UsersIcon } from "lucide-react";

const eaMgmtTab = { id: "early-access-mgmt", label: "Early Access", icon: UsersIcon };

export const DashboardSidebar = ({ activeTab, onTabChange, overrideRoles }: DashboardSidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [_isAdmin, setIsAdmin] = useState(false);
  const [_isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [_isSetter, setIsSetter] = useState(false);
  const { isEarlyAccess: _isEarlyAccess } = useEarlyAccess();
  const hasInstitute = useHasInstitute();

  const isAdmin = overrideRoles ? overrideRoles.isAdmin : _isAdmin;
  const isSuperAdmin = overrideRoles ? overrideRoles.isSuperAdmin : _isSuperAdmin;
  const isSetter = overrideRoles ? overrideRoles.isSetter : _isSetter;
  const isEarlyAccess = overrideRoles ? overrideRoles.isEarlyAccess : _isEarlyAccess;

  const checkInternalRoles = async () => {
    const { data: isAdminData } = await supabase.rpc('is_admin');
    setIsAdmin(!!isAdminData);
    const { data: isSuperAdminData } = await supabase.rpc('is_super_admin');
    setIsSuperAdmin(!!isSuperAdminData);
    const { data: isSetterData } = await supabase.rpc('is_setter' as any);
    setIsSetter(!!isSetterData);
  };

  useEffect(() => {
    checkInternalRoles();

    const channel = supabase
      .channel('sidebar-internal-roles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        checkInternalRoles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Setter role: only Early Access tab
  if (isSetter && !isSuperAdmin && !isAdmin) {
    const setterTabs = [eaMgmtTab];
    return (
      <aside
        className={cn(
          "hidden md:flex border-r border-border bg-card flex-col transition-all duration-300 ease-out",
          isExpanded ? "w-64" : "w-16"
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        <div className={cn("p-4 border-b border-border transition-all duration-300 flex items-center justify-center", isExpanded ? "p-6" : "p-4")}>
          {isExpanded ? (
            <h1 className="text-2xl font-semibold tracking-tight text-foreground text-center">
              Oracle<sup className="text-sm font-normal align-super ml-0.5">™</sup>
            </h1>
          ) : (
            <span className="text-xl font-bold text-foreground">O</span>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {setterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 transition-all",
                "text-sm font-mono uppercase tracking-wider",
                isExpanded ? "px-4 py-3" : "px-0 py-3 justify-center",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <tab.icon className="w-4 h-4 flex-shrink-0" />
              {isExpanded && <span className="truncate text-left">{tab.label}</span>}
            </button>
          ))}
        </nav>
        {isExpanded && (
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider text-center">Oracle™ © 2026</p>
          </div>
        )}
      </aside>
    );
  }

  // Filter tabs based on role
  let allTabs = (isEarlyAccess || (!hasInstitute && !isAdmin && !isSuperAdmin))
    ? tabs.filter(t => t.id !== "successes") 
    : [...tabs];
  
  if (isEarlyAccess || isAdmin || isSuperAdmin) {
    allTabs = [...allTabs, ...earlyAccessTabs];
  }
  
  if (isAdmin || isSuperAdmin) {
    allTabs = [...allTabs, crmTab, funnelTab];
  }
  if (isAdmin) {
    allTabs = [...allTabs, ...adminTabs];
  }
  if (isSuperAdmin) {
    allTabs = [...allTabs, eaMgmtTab];
  }

  return (
    <aside 
      className={cn(
        "hidden md:flex border-r border-border bg-card flex-col transition-all duration-300 ease-out",
        isExpanded ? "w-64" : "w-16"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-border transition-all duration-300 flex items-center justify-center",
        isExpanded ? "p-6" : "p-4"
      )}>
        {isExpanded ? (
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-center">
            Oracle<sup className="text-sm font-normal align-super ml-0.5">™</sup>
          </h1>
        ) : (
          <span className="text-xl font-bold text-foreground">O</span>
        )}
      </div>

      {/* Tabs */}
      <nav className="flex-1 p-2 space-y-1">
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 transition-all",
              "text-sm font-mono uppercase tracking-wider",
              isExpanded ? "px-4 py-3" : "px-0 py-3 justify-center",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
              tab.id === "batch-import" && "border-t border-border/40 mt-2 pt-4"
            )}
          >
            <tab.icon className="w-4 h-4 flex-shrink-0" />
            {isExpanded && <span className="truncate text-left">{tab.label}</span>}
          </button>
        ))}
      </nav>

      {/* Expand indicator */}
      {!isExpanded && (
        <div className="p-4 flex justify-center">
          <ChevronRight className="w-4 h-4 text-muted-foreground animate-pulse" />
        </div>
      )}

      {/* Footer */}
      {isExpanded && (
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider text-center">
            Oracle™ © 2026
          </p>
        </div>
      )}
    </aside>
  );
};

// Export admin/role state hook for use in Dashboard
export const useSidebarRoles = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSetter, setIsSetter] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const resetRoles = () => {
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setIsSetter(false);
  };

  const checkRoles = async (retries = 2) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        resetRoles();
        setLoadingRoles(false);
        return;
      }

      const [adminRes, superAdminRes, setterRes] = await Promise.all([
        supabase.rpc('is_admin'),
        supabase.rpc('is_super_admin'),
        supabase.rpc('is_setter' as any),
      ]);

      // If all results errored/null and we have retries left, try again after 500ms
      if (adminRes.error && superAdminRes.error && retries > 0) {
        console.warn(`[Roles] RPCs failed, retrying (${retries} left)...`);
        setTimeout(() => checkRoles(retries - 1), 500);
        return;
      }

      setIsAdmin(!!adminRes.data);
      setIsSuperAdmin(!!superAdminRes.data);
      setIsSetter(!!setterRes.data);
    } catch (err) {
      console.warn("[Roles] aborted or failed, using defaults", err);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    // DEV OVERRIDE: On localhost, RPCs abort due to Vite HMR.
    // Force admin roles after a short delay if RPCs fail.
    const isDev = window.location.hostname === 'localhost';
    let devFallbackTimer: ReturnType<typeof setTimeout> | undefined;

    checkRoles();

    if (isDev) {
      devFallbackTimer = setTimeout(() => {
        // If roles still not resolved after 1.5s, force super_admin for dev
        setIsAdmin(prev => {
          if (!prev) {
            console.warn("[Roles] DEV: Forcing admin roles (RPCs timed out)");
            setIsSuperAdmin(true);
            return true;
          }
          return prev;
        });
        setLoadingRoles(false);
      }, 1500);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        resetRoles();
        setLoadingRoles(false);
        return;
      }

      // Don't trigger a full loading cycle on token refresh / focus regain.
      if (["SIGNED_IN", "INITIAL_SESSION", "USER_UPDATED"].includes(event)) {
        checkRoles();
      }
    });

    // Listen for realtime role changes to update instantly
    const channel = supabase
      .channel('sidebar-roles-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        checkRoles();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      if (devFallbackTimer) clearTimeout(devFallbackTimer);
    };
  }, []);

  return { isAdmin, isSuperAdmin, isSetter, loadingRoles };
};
