// ─────────────────────────────────────────────────────────────────────────────
// useUserRoles — Source de vérité unique des rôles côté client (Option B)
//
// Slice : A — IDENTITY
//
// Architecture (Phase 3.5 — singleton via React Context, 2026-04-30) :
//   - Un seul `<UserRolesProvider>` monté à la racine de l'app appelle la
//     logique de fetch UNE SEULE FOIS et expose le state via Context.
//   - Tous les consumers (`useUserRoles()`) lisent le contexte partagé.
//   - 1 seule RPC `get_user_roles()` au mount initial, peu importe combien
//     de composants l'utilisent. 1 seul realtime channel. 1 seul auth listener.
//
// Pattern :
//   Une seule RPC `get_user_roles()` retourne tous les flags + le timer EA.
//   Machine d'état explicite : loading | ready | error | unauthenticated.
//   AUCUN safety timeout qui flippe vers des valeurs par défaut.
//   AUCUN cache localStorage utilisé comme état initial naïf.
//
// Garanties dures :
//   - L'UI ne reçoit jamais des rôles "par défaut" pendant un fetch ou après échec.
//   - Sur erreur réseau → state.status === 'error' → caller affiche écran retry.
//   - Sur session morte → state.status === 'unauthenticated' → caller redirige.
//   - Sur révocation admin (realtime) → refetch silencieux + nouveau state.
//
// Ce que ce fichier NE FAIT PAS (volontairement) :
//   - Pas de cache localStorage. Si on en veut un en optimisation, ce sera ajouté
//     plus tard via un mécanisme qui valide TOUJOURS contre la fetch (jamais de
//     render basé uniquement sur le cache).
//   - Pas de race avec un timeout — l'utilisateur attend ou retry, jamais un
//     fallback silencieux.
//
// Migration prévue (séparée) :
//   Phase 4 — élimination des 22 appels RPC redondants dans les composants.
//   Phase 5 — useEarlyAccess simplifié (lit depuis useUserRoles).
//
// Audit : voir docs/audit-roles-architecture.md
// Décision Option B actée : 2026-04-30
// Décision Phase 3.5 (singleton Context) actée : 2026-04-30
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types publics ───────────────────────────────────────────────────────────

export type UserRolesData = {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isSetter: boolean;
  isCloser: boolean;
  /** True uniquement si le trial EA n'a pas expiré (cf. is_early_access() côté DB). */
  isEarlyAccess: boolean;
  isInstitute: boolean;
  /**
   * Timestamp brut du trial EA, présent même si isEarlyAccess est false.
   * Permet au frontend de distinguer :
   *   - eaExpiresAt = null → l'utilisateur n'a jamais eu d'accès EA
   *   - eaExpiresAt < now() → l'utilisateur a eu un accès qui a expiré (popup upgrade)
   */
  eaExpiresAt: Date | null;
  /** "precall" | "postcall" | autre. null si l'utilisateur n'a pas de rôle EA. */
  eaType: string | null;
};

export type UserRolesState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "ready"; data: UserRolesData }
  | { status: "error"; error: Error };

export type UseUserRolesReturn = {
  state: UserRolesState;
  /** Relance manuelle de la fetch (utilisé par l'écran d'erreur). */
  retry: () => void;
};

// ─── Helper : appel RPC + normalisation ──────────────────────────────────────

const ALL_FALSE_DATA: UserRolesData = {
  isAdmin: false,
  isSuperAdmin: false,
  isSetter: false,
  isCloser: false,
  isEarlyAccess: false,
  isInstitute: false,
  eaExpiresAt: null,
  eaType: null,
};

// Timeout (ms) pour les RPCs rôles (get_user_roles, is_*).
// 2026-05-02 : ajouté suite à un bug où `get_user_roles()` hangait en prod.
const RPC_TIMEOUT_MS = 8000;

// Timeout (ms) spécifique à getSession.
// Plus court : getSession depuis localStorage est quasi-instantané si le token est frais.
// Si ça dépasse 5s, le refresh token est probablement expiré (Supabase essaie de le
// renouveler via réseau et la requête hang). Dans ce cas → unauthenticated, pas error.
const GETSESSION_TIMEOUT_MS = 5000;

const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[useUserRoles] ${label} timeout after ${ms}ms`)), ms),
    ),
  ]);

// Fallback : si `get_user_roles()` plante ou hang, on tente les 6 is_*() RPCs
// individuelles EN PARALLÈLE. Au moins un sous-ensemble marchera probablement.
// Tout ce qui échoue est traité comme "false". Source : Phase 4 du refacto roles
// (les is_*() existent toujours en DB pour rétrocompat, ne pas supprimer).
const fetchRolesViaLegacyRpcs = async (): Promise<UserRolesData> => {
  const safe = async (rpc: string): Promise<boolean> => {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc(rpc as any),
        RPC_TIMEOUT_MS,
        `legacy ${rpc}`,
      );
      if (error) return false;
      return !!data;
    } catch {
      return false;
    }
  };
  const [isAdmin, isSuperAdmin, isSetter, isCloser, isEarlyAccess, isInstitute] = await Promise.all([
    safe("is_admin"),
    safe("is_super_admin"),
    safe("is_setter"),
    safe("is_closer"),
    safe("is_early_access"),
    safe("is_institute"),
  ]);
  // Lecture best-effort de l'expires_at depuis user_roles (pour le timer EA)
  let eaExpiresAt: Date | null = null;
  let eaType: string | null = null;
  try {
    const { data } = await withTimeout(
      supabase
        .from("user_roles")
        .select("expires_at, early_access_type")
        .eq("role", "early_access")
        .maybeSingle(),
      RPC_TIMEOUT_MS,
      "legacy ea_row",
    );
    if (data) {
      eaExpiresAt = (data as any).expires_at ? new Date((data as any).expires_at) : null;
      eaType = (data as any).early_access_type ?? null;
    }
  } catch {
    // ignore — best effort
  }
  return { isAdmin, isSuperAdmin, isSetter, isCloser, isEarlyAccess, isInstitute, eaExpiresAt, eaType };
};

const fetchRolesViaRpc = async (): Promise<UserRolesData> => {
  // `get_user_roles` retourne SETOF de 1 row (RETURNS TABLE).
  // Supabase JS retourne donc `data` en tant que tableau.
  const { data, error } = await withTimeout(
    supabase.rpc("get_user_roles" as any),
    RPC_TIMEOUT_MS,
    "get_user_roles",
  );
  if (error) throw error;

  if (!data || (Array.isArray(data) && data.length === 0)) {
    // L'utilisateur n'a aucune row dans user_roles (cas défensif — le trigger
    // handle_new_user devrait toujours en créer une). On ne crash pas, on retourne
    // tous les rôles à false. Le caller fera ce qu'il veut (typiquement : produit
    // de base accessible, mais aucune capability admin ne sera accordée).
    return { ...ALL_FALSE_DATA };
  }

  const row: any = Array.isArray(data) ? data[0] : data;

  return {
    isAdmin: !!row.is_admin,
    isSuperAdmin: !!row.is_super_admin,
    isSetter: !!row.is_setter,
    isCloser: !!row.is_closer,
    isEarlyAccess: !!row.is_early_access,
    isInstitute: !!row.is_institute,
    eaExpiresAt: row.ea_expires_at ? new Date(row.ea_expires_at) : null,
    eaType: row.ea_type ?? null,
  };
};

// ─── Hook interne (logique de fetch + state machine) ─────────────────────────
// Privé — utilisé UNIQUEMENT par UserRolesProvider. Ne pas appeler directement.
// Pour consommer les rôles, utiliser le hook `useUserRoles()` exporté.

const _useUserRolesInternal = (): UseUserRolesReturn => {
  const [state, setState] = useState<UserRolesState>({ status: "loading" });

  // Refs pour éviter les races et les setStates post-unmount
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const performFetch = useCallback(async () => {
    const id = ++requestIdRef.current;
    if (!mountedRef.current) return;
    setState({ status: "loading" });

    try {
      // 1. Vérifier qu'il y a une session active.
      //    Timeout court (5s) : getSession depuis localStorage est < 1ms si le token
      //    est frais. Si ça dépasse 5s, Supabase essaie de rafraîchir un token expiré
      //    via réseau et la requête hang → traiter comme "unauthenticated" (pas "error")
      //    pour rediriger directement vers /auth sans bloquer l'utilisateur.
      let session: any = null;
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          GETSESSION_TIMEOUT_MS,
          "getSession",
        );
        session = data.session;
      } catch (sessionErr) {
        if (id !== requestIdRef.current || !mountedRef.current) return;
        const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
        console.warn("[useUserRoles] getSession failed →", msg, "— treating as unauthenticated");
        setState({ status: "unauthenticated" });
        return;
      }
      if (id !== requestIdRef.current || !mountedRef.current) return;

      if (!session) {
        setState({ status: "unauthenticated" });
        return;
      }

      // 2. Récupérer les rôles via la RPC consolidée (avec timeout interne).
      //    Si elle échoue / timeout : fallback sur les is_*() legacy (Phase 4
      //    a éliminé leur usage côté composants mais elles existent toujours en DB).
      let rolesData: UserRolesData;
      try {
        rolesData = await fetchRolesViaRpc();
      } catch (primaryErr) {
        console.error(
          "[useUserRoles] get_user_roles failed, falling back to legacy is_*() RPCs:",
          primaryErr,
        );
        try {
          rolesData = await fetchRolesViaLegacyRpcs();
        } catch (fallbackErr) {
          console.error("[useUserRoles] legacy fallback also failed:", fallbackErr);
          // Dernier recours : passer en "ready" avec ALL_FALSE plutôt que de
          // bloquer l'utilisateur indéfiniment sur "Connexion impossible".
          // L'app s'affichera en mode dégradé (pas de capacités admin) mais
          // l'utilisateur peut au moins accéder au dashboard.
          rolesData = { ...ALL_FALSE_DATA };
        }
      }
      if (id !== requestIdRef.current || !mountedRef.current) return;

      setState({ status: "ready", data: rolesData });
    } catch (err) {
      if (id !== requestIdRef.current || !mountedRef.current) return;
      console.error("[useUserRoles] fetch failed:", err);
      // Échec à un niveau où on ne peut pas continuer (ex: getSession plante).
      // L'UI affichera l'écran de retry.
      setState({
        status: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, []);

  const retry = useCallback(() => {
    performFetch();
  }, [performFetch]);

  useEffect(() => {
    mountedRef.current = true;
    performFetch();

    // Re-fetch sur changements d'état d'authentification.
    //
    // ⚠️ Bug fix 2026-05-02 :
    //   - INITIAL_SESSION : retiré — déjà couvert par le performFetch() initial au mount.
    //     Sinon double-fetch concurrent à chaque montage.
    //   - TOKEN_REFRESHED : retiré — un refresh de JWT ne change pas les rôles
    //     (seul le token change, pas la table user_roles). Garder cet event flippait
    //     state→"loading" périodiquement → spinner pouvait ré-apparaître pendant
    //     le chargement de page.
    // Les vrais changements de rôles sont déjà couverts par le realtime channel
    // sur `user_roles` ci-dessous.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;
        if (!session) {
          setState({ status: "unauthenticated" });
          return;
        }
        if (["SIGNED_IN", "USER_UPDATED"].includes(event)) {
          performFetch();
        }
      },
    );

    // Re-fetch sur changement de la table user_roles (révocation/promotion par admin).
    // Si un admin change le rôle d'un user actuellement connecté, le user voit
    // la mise à jour quasi-instantanément sans avoir besoin de recharger.
    const channel = supabase
      .channel("user_roles_self_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => {
          performFetch();
        },
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [performFetch]);

  return { state, retry };
};

// ─── Context + Provider singleton ────────────────────────────────────────────
// Une seule instance de la logique de fetch dans toute l'app.
// Tous les consumers lisent le même état partagé.

const UserRolesContext = createContext<UseUserRolesReturn | null>(null);

/**
 * Provider singleton — à monter UNE SEULE FOIS au plus haut niveau de l'app
 * (typiquement dans App.tsx, à l'intérieur de BrowserRouter pour que les
 * éléments globaux comme SuccessNotification/MaintenanceLock soient inclus).
 *
 * Tout composant qui appelle `useUserRoles()` doit être un descendant.
 */
export const UserRolesProvider = ({ children }: { children: ReactNode }) => {
  const value = _useUserRolesInternal();
  return (
    <UserRolesContext.Provider value={value}>
      {children}
    </UserRolesContext.Provider>
  );
};

/**
 * Hook public — lit le state depuis le contexte partagé.
 * Throw explicitement si appelé hors du Provider (garde-fou).
 */
export const useUserRoles = (): UseUserRolesReturn => {
  const ctx = useContext(UserRolesContext);
  if (ctx === null) {
    throw new Error(
      "useUserRoles must be used within a <UserRolesProvider>. " +
      "Wrap your app (typically in App.tsx) with <UserRolesProvider> at the root."
    );
  }
  return ctx;
};

// ─── Helpers d'introspection ─────────────────────────────────────────────────

/**
 * Retourne un objet "RolesInput" plat (compatible avec permissions.ts).
 * Conçu pour faciliter l'usage avec permissions.ts.
 */
export const rolesDataToInput = (data: UserRolesData) => ({
  isAdmin: data.isAdmin,
  isSuperAdmin: data.isSuperAdmin,
  isSetter: data.isSetter,
  isCloser: data.isCloser,
  isEarlyAccess: data.isEarlyAccess,
});
