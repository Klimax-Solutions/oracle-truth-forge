/**
 * useEarlyAccess — wrapper léger de useUserRoles (Phase 5, 2026-04-30)
 *
 * AVANT (Phase 4 et avant) :
 *   - 1 RPC `is_early_access()` au mount
 *   - 1 query manuelle `user_roles` pour récupérer expires_at + early_access_type
 *   - 1 channel realtime `ea-role-sync` dédié (postgres_changes user_roles)
 *   → 15 composants consommateurs × 2 fetchs = jusqu'à 30 RPCs redondants par page
 *
 * APRÈS (Phase 5) :
 *   - 0 fetch propre — lecture du singleton useUserRoles (1 seul fetch pour toute la session)
 *   - Le channel realtime user_roles est déjà géré par UserRolesProvider, pas besoin de doublon
 *   - L'API publique du hook est strictement préservée → aucun consommateur à modifier
 *
 * Slice A — frontend uniquement, aucun impact data.
 */

import { useUserRoles } from "./useUserRoles";

export const useEarlyAccess = () => {
  const { state } = useUserRoles();

  if (state.status === "ready") {
    const { isEarlyAccess, eaExpiresAt, eaType } = state.data;
    const expiresAt = eaExpiresAt ? eaExpiresAt.toISOString() : null;
    const isExpired = !!(isEarlyAccess && eaExpiresAt && eaExpiresAt <= new Date());
    return {
      isEarlyAccess,
      isExpired,
      expiresAt,
      earlyAccessType: eaType,
      loading: false,
    };
  }

  // status === "loading" → on attend la résolution du singleton
  // status === "error" | "unauthenticated" → valeurs sûres par défaut
  return {
    isEarlyAccess: false,
    isExpired: false,
    expiresAt: null,
    earlyAccessType: null,
    loading: state.status === "loading",
  };
};
