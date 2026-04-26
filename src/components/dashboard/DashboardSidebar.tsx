import { cn } from "@/lib/utils";
import { Database, BarChart3, ChevronRight, Crosshair, Video, ShieldCheck, Trophy, Award, TrendingUp, Settings, Users as UsersIcon, AlertTriangle, LineChart } from "lucide-react";
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

interface SidebarTab {
  id: string;
  label: string;
  icon: React.ElementType;
  deprecated?: boolean;
  section?: string;
}

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  overrideRoles?: { isAdmin: boolean; isSuperAdmin: boolean; isSetter: boolean; isCloser: boolean; isEarlyAccess: boolean };
}

const tabs: SidebarTab[] = [
  { id: "execution", label: "Exécution d'Oracle", icon: Crosshair },
  { id: "videos", label: "Vidéo du Setup Oracle", icon: Video },
  { id: "recolte-donnees", label: "Récolte de données", icon: LineChart },
  { id: "data-analysis", label: "Data Analysis", icon: BarChart3 },
  { id: "successes", label: "Chat", icon: Trophy },
  { id: "results", label: "Résultats", icon: Award },
];

// ── NEW admin tabs (V2) ──
const crmTab: SidebarTab = { id: "crm", label: "CRM", icon: TrendingUp, section: "admin" };
const gestionTab: SidebarTab = { id: "gestion", label: "Gestion", icon: UsersIcon, section: "admin" };
const configTab: SidebarTab = { id: "config", label: "Configuration", icon: Settings, section: "admin" };
const videosAdminTab: SidebarTab = { id: "video-admin", label: "Médiathèque", icon: Video, section: "admin" };

// ── DEPRECATED admin tabs (still accessible, with warning) ──
const adminTab: SidebarTab = { id: "admin", label: "Vérif. Admin", icon: ShieldCheck, deprecated: true, section: "admin" };
const eaMgmtTab: SidebarTab = { id: "early-access-mgmt", label: "Early Access", icon: UsersIcon, deprecated: true, section: "admin" };

export const DashboardSidebar = ({ activeTab, onTabChange, overrideRoles }: DashboardSidebarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [_isAdmin, setIsAdmin] = useState(false);
  const [_isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [_isSetter, setIsSetter] = useState(false);
  const [_isCloser, setIsCloser] = useState(false);
  const { isEarlyAccess: _isEarlyAccess } = useEarlyAccess();
  const hasInstitute = useHasInstitute();

  const isAdmin = overrideRoles ? overrideRoles.isAdmin : _isAdmin;
  const isSuperAdmin = overrideRoles ? overrideRoles.isSuperAdmin : _isSuperAdmin;
  const isSetter = overrideRoles ? overrideRoles.isSetter : _isSetter;
  const isCloser = overrideRoles ? overrideRoles.isCloser : _isCloser;
  const isEarlyAccess = overrideRoles ? overrideRoles.isEarlyAccess : _isEarlyAccess;

  const checkInternalRoles = async () => {
    const { data: isAdminData } = await supabase.rpc('is_admin');
    setIsAdmin(!!isAdminData);
    const { data: isSuperAdminData } = await supabase.rpc('is_super_admin');
    setIsSuperAdmin(!!isSuperAdminData);
    const { data: isSetterData } = await supabase.rpc('is_setter' as any);
    setIsSetter(!!isSetterData);
    const { data: isCloserData } = await supabase.rpc('is_closer' as any);
    setIsCloser(!!isCloserData);
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

  // Setter / Closer (sans admin) : CRM uniquement
  if ((isSetter || isCloser) && !isSuperAdmin && !isAdmin) {
    const setterTabs: SidebarTab[] = [crmTab];
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

  // Tous les utilisateurs (hors setter/closer) voient les mêmes tabs produit,
  // y compris Chat et Résultats — pas de filtrage par type d'accès.
  let allTabs: SidebarTab[] = [...tabs];

  // Admin V2: CRM + Gestion + Config + deprecated tabs
  if (isAdmin || isSuperAdmin) {
    allTabs = [...allTabs, crmTab, gestionTab, configTab, videosAdminTab, adminTab, eaMgmtTab];
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
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {(() => {
          let adminSectionShown = false;
          return allTabs.map((tab) => {
            // Show admin section divider before first admin tab
            const showAdminHeader = tab.section === "admin" && !adminSectionShown;
            if (showAdminHeader) adminSectionShown = true;

            return (
              <div key={tab.id}>
                {showAdminHeader && (
                  <div className={cn("border-t border-border/40 mt-3 pt-3", isExpanded ? "px-4 pb-1" : "pb-1")}>
                    {isExpanded && (
                      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
                        Admin
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 transition-all",
                    "text-sm font-mono uppercase tracking-wider",
                    isExpanded ? "px-4 py-3" : "px-0 py-3 justify-center",
                    activeTab === tab.id
                      ? tab.deprecated
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                        : "bg-primary text-primary-foreground"
                      : tab.deprecated
                        ? "text-muted-foreground/40 hover:text-amber-400/60 hover:bg-amber-500/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  <tab.icon className={cn("w-4 h-4 flex-shrink-0", tab.deprecated && "opacity-50")} />
                  {isExpanded && (
                    <span className={cn("truncate text-left flex-1", tab.deprecated && "opacity-60")}>
                      {tab.label}
                    </span>
                  )}
                  {isExpanded && tab.deprecated && (
                    <AlertTriangle className="w-3 h-3 text-amber-500/60 flex-shrink-0" />
                  )}
                </button>
              </div>
            );
          });
        })()}
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
  const [isCloser, setIsCloser] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const resetRoles = () => {
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setIsSetter(false);
    setIsCloser(false);
  };

  // Wrap une promise avec un timeout — évite que checkRoles hang indéfiniment
  // si une RPC ne répond pas (réseau lent, JWT pas encore propagé, etc.).
  const withTimeoutLocal = <T,>(p: PromiseLike<T>, ms = 3000): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`RPC timeout ${ms}ms`)), ms);
      Promise.resolve(p).then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); },
      );
    });

  const checkRoles = async (retries = 2) => {
    try {
      // getSession peut etre lent au cold-start Vercel (lecture localStorage + validation JWT).
      // Bump a 8s pour eviter le timeout sur premier load qui faisait disparaitre les onglets admin.
      const { data: { session } } = await withTimeoutLocal(supabase.auth.getSession(), 8000);
      if (!session) {
        resetRoles();
        setLoadingRoles(false);
        return;
      }

      // Chaque RPC enveloppée d'un timeout 3s + try/catch individuel
      // pour que la lenteur d'une seule ne plombe pas les autres.
      const safe = async <T,>(p: PromiseLike<T>): Promise<{ data: any; error: any }> => {
        try { return await withTimeoutLocal(p as any, 3000) as any; }
        catch (e) { return { data: null, error: e }; }
      };
      const [adminRes, superAdminRes, setterRes, closerRes] = await Promise.all([
        safe(supabase.rpc('is_admin')),
        safe(supabase.rpc('is_super_admin')),
        safe(supabase.rpc('is_setter' as any)),
        safe(supabase.rpc('is_closer' as any)),
      ]);

      // Si TOUTES les RPC ont échoué + retries dispo → retry après 600ms
      const allFailed = adminRes.error && superAdminRes.error && setterRes.error && closerRes.error;
      if (allFailed && retries > 0) {
        console.warn(`[Roles] All RPCs failed, retrying in 600ms (${retries} left)...`);
        setTimeout(() => checkRoles(retries - 1), 600);
        return;
      }

      // Ne mettre à jour un rôle que si le RPC a réussi — évite de nullifier un rôle déjà établi en cas d'AbortError (HMR dev)
      if (!adminRes.error)      setIsAdmin(!!adminRes.data);
      if (!superAdminRes.error) setIsSuperAdmin(!!superAdminRes.data);
      if (!setterRes.error)     setIsSetter(!!setterRes.data);
      if (!closerRes.error)     setIsCloser(!!closerRes.data);

      // Si certaines ont fail mais pas toutes → log explicite pour diag prod
      if (adminRes.error || superAdminRes.error || setterRes.error || closerRes.error) {
        console.warn("[Roles] partial failure", {
          admin: adminRes.error?.message,
          superAdmin: superAdminRes.error?.message,
          setter: setterRes.error?.message,
          closer: closerRes.error?.message,
        });
      }
    } catch (err) {
      console.warn("[Roles] aborted or failed, using defaults", err);
      // Au lieu de laisser les defaults (false) — qui font disparaitre les onglets admin —
      // on retry en arriere-plan apres 800ms si on a encore des retries.
      if (retries > 0) {
        setTimeout(() => checkRoles(retries - 1), 800);
      }
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
        // If roles still not resolved after 100ms, force super_admin for dev
        setIsAdmin(prev => {
          if (!prev) {
            console.warn("[Roles] DEV: Forcing admin roles (RPCs timed out)");
            setIsSuperAdmin(true);
            return true;
          }
          return prev;
        });
        setLoadingRoles(false);
      }, 100);
    }

    // Safety timeout for ALL environments (including Vercel preview)
    // Si les RPC n'ont pas résolu après 4s → unblock UI MAIS retry les rôles
    // une dernière fois en arrière-plan (sinon admin loggé = traité comme membre).
    const safetyTimer = setTimeout(() => {
      setLoadingRoles(prev => {
        if (prev) {
          console.warn("[Roles] Safety timeout — forcing loadingRoles to false + background retry");
          // Retry async — si ça réussit, les rôles sont mis à jour et l'UI re-render
          checkRoles(1);
        }
        return false;
      });
    }, 9000);

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
      clearTimeout(safetyTimer);
    };
  }, []);

  return { isAdmin, isSuperAdmin, isSetter, isCloser, loadingRoles };
};
