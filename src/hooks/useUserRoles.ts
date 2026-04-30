// ─────────────────────────────────────────────────────────────────────────────
// useUserRoles — Source de vérité unique des rôles côté client (Option B)
//
// Slice : A — IDENTITY
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
//   Phase 3 — usePermissions consomme useUserRoles au lieu de useSidebarRoles.
//   Phase 4 — élimination des 22 appels RPC redondants dans les composants.
//   Phase 5 — useEarlyAccess simplifié (lit depuis useUserRoles).
//
// Audit : voir docs/audit-roles-architecture.md
// Décision Option B actée : 2026-04-30
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react";
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

const fetchRolesViaRpc = async (): Promise<UserRolesData> => {
  // `get_user_roles` retourne SETOF de 1 row (RETURNS TABLE).
  // Supabase JS retourne donc `data` en tant que tableau.
  const { data, error } = await supabase.rpc("get_user_roles" as any);
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

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useUserRoles = (): UseUserRolesReturn => {
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
      //    PAS DE TIMEOUT VOLONTAIRE — getSession est censé être synchrone (lecture
      //    localStorage) mais peut faire un refresh token réseau si proche expiry.
      //    Si ça hang vraiment, on reste en "loading" et l'user peut retry manuellement.
      const { data: { session } } = await supabase.auth.getSession();
      if (id !== requestIdRef.current || !mountedRef.current) return;

      if (!session) {
        setState({ status: "unauthenticated" });
        return;
      }

      // 2. Récupérer les rôles via la RPC consolidée.
      const rolesData = await fetchRolesViaRpc();
      if (id !== requestIdRef.current || !mountedRef.current) return;

      setState({ status: "ready", data: rolesData });
    } catch (err) {
      if (id !== requestIdRef.current || !mountedRef.current) return;
      // Tout échec (réseau, RPC, parsing) atterrit ici. L'UI affichera un écran
      // de retry. Pas de fallback silencieux vers des valeurs par défaut.
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

    // Re-fetch sur changements d'état d'authentification (login, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;
        if (!session) {
          setState({ status: "unauthenticated" });
          return;
        }
        if (
          ["SIGNED_IN", "INITIAL_SESSION", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)
        ) {
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

// ─── Helpers d'introspection (utilisés par usePermissions en Phase 3) ─────────

/**
 * Retourne un objet "RolesInput" plat (compatible avec permissions.ts) ou null
 * si l'état n'est pas ready. Conçu pour faciliter la migration de usePermissions.
 */
export const rolesDataToInput = (data: UserRolesData) => ({
  isAdmin: data.isAdmin,
  isSuperAdmin: data.isSuperAdmin,
  isSetter: data.isSetter,
  isCloser: data.isCloser,
  isEarlyAccess: data.isEarlyAccess,
});
