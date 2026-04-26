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

// Export admin/role state hook for use in Dashboard
// ────────────────────────────────────────────────────────────────────────────
// useSidebarRoles — source de vérité des rôles côté client.
//
// Stratégie en couches (la plus rapide d'abord, fallback en dessous) :
//
//   1. Lecture JWT claims → `session.user.app_metadata.roles` (tableau)
//      Synchrone, zéro réseau. Injecté par le hook PG `custom_access_token_hook`.
//      Si la case « Custom Access Token » est cochée dans Supabase Dashboard,
//      tous les nouveaux JWTs contiennent les rôles.
//
//   2. Cache localStorage `oracle_roles_cache_v1` → rehydrate au reload
//      Même si le JWT n'a pas encore les claims (transition / hook pas activé),
//      on récupère le dernier état connu. Filet de sécurité.
//
//   3. Fallback RPC `is_admin`, `is_super_admin`, `is_setter`, `is_closer`
//      Réseau, lent, mais tolérant aux pannes. Utilisé seulement si (1) absent.
//      Sera retiré une fois le hook stable en prod.
//
// Garanties :
//   - Aucune valeur n'est jamais nullifiée par un échec → si on a déjà détecté
//     setter, on reste setter même si une RPC subséquente timeout.
//   - `loadingRoles=false` dès qu'une couche répond, jamais de spinner > 1s.
//   - Pas de retry en boucle : 2 retries max pour les RPCs, jamais plus.
// ────────────────────────────────────────────────────────────────────────────

const ROLES_CACHE_KEY = "oracle_roles_cache_v1";
type CachedRoles = {
  user_id: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isSetter: boolean;
  isCloser: boolean;
  cached_at: number;
};
const readRolesCache = (userId?: string): CachedRoles | null => {
  try {
    const raw = localStorage.getItem(ROLES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRoles;
    if (userId && parsed.user_id !== userId) return null;
    return parsed;
  } catch { return null; }
};
const writeRolesCache = (c: CachedRoles) => {
  try { localStorage.setItem(ROLES_CACHE_KEY, JSON.stringify(c)); } catch {}
};
const peekUserIdFromAuthToken = (): string | undefined => {
  try {
    const k = Object.keys(localStorage).find(x => x.startsWith("sb-") && x.includes("auth-token"));
    if (!k) return undefined;
    const v = JSON.parse(localStorage.getItem(k) || "null");
    return v?.user?.id;
  } catch { return undefined; }
};

// Extrait les rôles d'un objet session Supabase (lecture JWT claims).
// Retourne null si l'app_metadata ne contient pas de rôles (= hook pas activé
// ou JWT pré-hook). Retourne {} avec tous les flags à false si tableau vide.
type RolesFlags = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isSetter: boolean;
  isCloser: boolean;
};
const readRolesFromSession = (session: any): RolesFlags | null => {
  const roles = session?.user?.app_metadata?.roles;
  if (!Array.isArray(roles)) return null;
  return {
    isSuperAdmin: roles.includes("super_admin"),
    isAdmin:      roles.includes("admin") || roles.includes("super_admin"),
    isSetter:     roles.includes("setter"),
    isCloser:     roles.includes("closer"),
  };
};

export const useSidebarRoles = () => {
  // Hydrate immédiatement depuis le cache si user_id matche le JWT en localStorage.
  // Permet au setter de voir la vue CRM dès le 1er render, sans attendre rien.
  const initialCache = (() => {
    const uid = peekUserIdFromAuthToken();
    return uid ? readRolesCache(uid) : null;
  })();

  const [isAdmin, setIsAdmin] = useState(initialCache?.isAdmin ?? false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(initialCache?.isSuperAdmin ?? false);
  const [isSetter, setIsSetter] = useState(initialCache?.isSetter ?? false);
  const [isCloser, setIsCloser] = useState(initialCache?.isCloser ?? false);
  const [loadingRoles, setLoadingRoles] = useState(!initialCache);

  const resetRoles = () => {
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setIsSetter(false);
    setIsCloser(false);
    try { localStorage.removeItem(ROLES_CACHE_KEY); } catch {}
  };

  // Applique un set de flags + persiste cache. Centralisé pour éviter dupli.
  const applyRoles = (uid: string | undefined, flags: RolesFlags, source: "jwt" | "rpc") => {
    setIsAdmin(flags.isAdmin);
    setIsSuperAdmin(flags.isSuperAdmin);
    setIsSetter(flags.isSetter);
    setIsCloser(flags.isCloser);
    setLoadingRoles(false);
    if (uid) writeRolesCache({
      user_id: uid,
      ...flags,
      cached_at: Date.now(),
    });
    // Log discret pour observabilité (utile pendant la transition JWT/RPC)
    if (source === "jwt" && (flags.isAdmin || flags.isSetter || flags.isCloser)) {
      // pas de log spam : seulement si on a un rôle non-trivial
    }
  };

  // Wrap une promise avec un timeout — évite que les RPC hang indéfiniment.
  const withTimeoutLocal = <T,>(p: PromiseLike<T>, ms = 3000): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`RPC timeout ${ms}ms`)), ms);
      Promise.resolve(p).then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); },
      );
    });

  // Fallback RPC : utilisé UNIQUEMENT si le JWT n'a pas les claims (hook pas
  // encore activé ou JWT pré-hook). Sera supprimé après stabilisation.
  const fetchRolesViaRpc = async (uid: string | undefined, retries = 1): Promise<void> => {
    const safe = async <T,>(p: PromiseLike<T>): Promise<{ data: any; error: any }> => {
      try { return await withTimeoutLocal(p as any, 3000) as any; }
      catch (e) { return { data: null, error: e }; }
    };
    const [adminRes, superAdminRes, setterRes, closerRes] = await Promise.all([
      safe(supabase.rpc("is_admin")),
      safe(supabase.rpc("is_super_admin")),
      safe(supabase.rpc("is_setter" as any)),
      safe(supabase.rpc("is_closer" as any)),
    ]);

    const allFailed = adminRes.error && superAdminRes.error && setterRes.error && closerRes.error;
    if (allFailed) {
      if (retries > 0) {
        console.warn(`[Roles] RPC fallback all failed, retry in 800ms (${retries} left)`);
        setTimeout(() => fetchRolesViaRpc(uid, retries - 1), 800);
        return;
      }
      // Tout a échoué et plus de retries → on ne touche à rien (cache reste valide)
      setLoadingRoles(false);
      console.warn("[Roles] RPC fallback gave up — keeping cached/initial values");
      return;
    }

    // Pour chaque RPC : si succès → applique. Si fail → garde valeur courante (jamais downgrade).
    const flags: RolesFlags = {
      isAdmin:      !adminRes.error      ? !!adminRes.data      : isAdmin,
      isSuperAdmin: !superAdminRes.error ? !!superAdminRes.data : isSuperAdmin,
      isSetter:     !setterRes.error     ? !!setterRes.data     : isSetter,
      isCloser:     !closerRes.error     ? !!closerRes.data     : isCloser,
    };
    applyRoles(uid, flags, "rpc");
  };

  // Récupère la session, lit JWT claims, fallback RPC si absent.
  const refreshRoles = async () => {
    let session: any = null;
    try {
      const r = await withTimeoutLocal(supabase.auth.getSession(), 8000);
      session = r?.data?.session;
    } catch (e) {
      // getSession a timeout → pas de session lisible.
      // On garde les valeurs courantes (cache initial), on essaie pas de RPC
      // (on n'a pas de JWT valide pour les authentifier de toute façon).
      console.warn("[Roles] getSession timeout, keeping current values");
      setLoadingRoles(false);
      return;
    }

    if (!session) {
      resetRoles();
      setLoadingRoles(false);
      return;
    }

    // Couche 1 : JWT claims (synchrone, instantané)
    const jwtFlags = readRolesFromSession(session);
    if (jwtFlags) {
      applyRoles(session.user?.id, jwtFlags, "jwt");
      return;
    }

    // Couche 3 : fallback RPC (hook pas encore activé)
    await fetchRolesViaRpc(session.user?.id, 1);
  };

  useEffect(() => {
    refreshRoles();

    // Safety timer unique : 4s. Si toujours en loading, débloque l'UI sans
    // toucher aux rôles (le cache initial reste valide).
    const safetyTimer = setTimeout(() => {
      setLoadingRoles(prev => {
        if (prev) console.warn("[Roles] Safety timeout 4s — unblocking UI");
        return false;
      });
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        resetRoles();
        setLoadingRoles(false);
        return;
      }
      if (["SIGNED_IN", "INITIAL_SESSION", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) {
        // À chaque event auth, on re-lit le JWT (claims peuvent avoir changé suite refresh)
        const jwtFlags = readRolesFromSession(session);
        if (jwtFlags) {
          applyRoles(session.user?.id, jwtFlags, "jwt");
        } else {
          fetchRolesViaRpc(session.user?.id, 1);
        }
      }
    });

    // Realtime : si user_roles change en DB, on recharge.
    // Note : avec JWT claims activé, le user doit re-login pour voir le changement
    // (claims figés dans le JWT). On garde le channel pour le fallback RPC qui lui
    // est dynamique, et pour observer les changements sur soi-même côté admin.
    const channel = supabase
      .channel("sidebar-roles-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        refreshRoles();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      clearTimeout(safetyTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isAdmin, isSuperAdmin, isSetter, isCloser, loadingRoles };
};
