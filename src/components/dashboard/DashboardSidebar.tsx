import { cn } from "@/lib/utils";
import { Database, BarChart3, ChevronRight, Crosshair, Video, ShieldCheck, Trophy, Award, TrendingUp, Settings, Users as UsersIcon, AlertTriangle, LineChart } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEarlyAccess } from "@/hooks/useEarlyAccess";
import { useUserRoles } from "@/hooks/useUserRoles";

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
  const { isEarlyAccess: _isEarlyAccess } = useEarlyAccess();
  const hasInstitute = useHasInstitute();

  // Source unique de rôles : `overrideRoles` (passé par Dashboard via useSidebarRoles).
  // Si absent → tout false (membre par défaut). On a supprimé l'ancien système
  // de double role-check en interne qui faisait 4 RPCs + 1 realtime channel
  // redondants à chaque render et créait des race conditions.
  const isAdmin       = overrideRoles?.isAdmin       ?? false;
  const isSuperAdmin  = overrideRoles?.isSuperAdmin  ?? false;
  const isSetter      = overrideRoles?.isSetter      ?? false;
  const isCloser      = overrideRoles?.isCloser      ?? false;
  const isEarlyAccess = overrideRoles?.isEarlyAccess ?? _isEarlyAccess;

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

// ────────────────────────────────────────────────────────────────────────────
// useSidebarRoles — wrapper rétrocompat sur useUserRoles (Option B, 2026-04-30)
//
// Phase 3 du refacto auth : la logique réelle vit désormais dans
// `src/hooks/useUserRoles.ts` (machine d'état explicite, zéro safety timeout,
// zéro fallback render). Cet export est conservé pour préserver l'API publique
// utilisée par Dashboard.tsx, AdminVerification, SetupPage, SetupOracleLanding,
// GestionPanel, et usePermissions.
//
// Comportement préservé :
//   - { isAdmin, isSuperAdmin, isSetter, isCloser, loadingRoles }
//   - loadingRoles=true tant que useUserRoles est en 'loading'
//   - tous les flags à false en 'unauthenticated' ou 'error'
//     → les guards des consumers (if isAdmin, etc.) ne donnent jamais de
//       capability accordée par défaut. Le vrai gating UX (splash/erreur/retry)
//       est fait par Dashboard.tsx en Phase 3 commit B.
//
// Migration future :
//   - Phase 4 : composants migrés un par un vers useUserRoles ou usePermissions
//     directement, ce wrapper deviendra inutile.
//   - Quand plus aucun consumer → suppression définitive.
// ────────────────────────────────────────────────────────────────────────────

export const useSidebarRoles = () => {
  const { state } = useUserRoles();

  if (state.status === "ready") {
    return {
      isAdmin: state.data.isAdmin,
      isSuperAdmin: state.data.isSuperAdmin,
      isSetter: state.data.isSetter,
      isCloser: state.data.isCloser,
      loadingRoles: false,
    };
  }

  // loading | error | unauthenticated → tous flags false, loadingRoles reflète
  // l'état actuel. Les vrais écrans (splash, retry, redirect) sont gérés en aval
  // par Dashboard.tsx (commit B de la Phase 3).
  return {
    isAdmin: false,
    isSuperAdmin: false,
    isSetter: false,
    isCloser: false,
    loadingRoles: state.status === "loading",
  };
};
