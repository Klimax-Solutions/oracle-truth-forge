// ─────────────────────────────────────────────────────────────────────────────
// usePermissions — Hook consommable dans n'importe quel composant
//
// Slice : A — IDENTITY
// Source des rôles : useUserRoles (Option B — single RPC get_user_roles)
//
// Usage :
//   const { can, allowedTabs, isLoading } = usePermissions()
//   { can('tab.crm') && <CRMTab /> }
//   { can('crm.edit.call') && <CallEditButton /> }
//
// Comportement :
//   - state ready    → can() retourne la vraie capability
//   - state loading  → can() retourne false (pas de permission par défaut)
//   - state error    → can() retourne false (sécurité par défaut, le caller
//                      est responsable d'afficher un écran d'erreur)
//   - state unauth   → can() retourne false (le caller est responsable du
//                      redirect /auth)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react"
import { useUserRoles } from "@/hooks/useUserRoles"
import {
  type Capability,
  type RolesInput,
  getRolesCapabilities,
  getAllowedTabs,
  getDefaultTab,
} from "@/lib/permissions"

export type { Capability }

const EMPTY_ROLES: RolesInput = {
  isAdmin: false,
  isSuperAdmin: false,
  isSetter: false,
  isCloser: false,
}

export function usePermissions() {
  const { state } = useUserRoles()

  const roles: RolesInput = state.status === "ready"
    ? {
        isAdmin: state.data.isAdmin,
        isSuperAdmin: state.data.isSuperAdmin,
        isSetter: state.data.isSetter,
        isCloser: state.data.isCloser,
      }
    : EMPTY_ROLES

  const capabilities = useMemo(() => getRolesCapabilities(roles), [
    roles.isAdmin,
    roles.isSuperAdmin,
    roles.isSetter,
    roles.isCloser,
  ])

  const allowedTabs = useMemo(() => getAllowedTabs(roles), [
    roles.isAdmin,
    roles.isSuperAdmin,
    roles.isSetter,
    roles.isCloser,
  ])

  const defaultTab = useMemo(() => getDefaultTab(roles), [
    roles.isAdmin,
    roles.isSuperAdmin,
    roles.isSetter,
    roles.isCloser,
  ])

  const can = (capability: Capability): boolean => {
    // Sécurité par défaut : aucune capability accordée hors de l'état 'ready'.
    // Le caller (typiquement Dashboard.tsx) doit gérer les états 'loading',
    // 'error', 'unauthenticated' avec ses propres gates UI.
    if (state.status !== "ready") return false
    return capabilities.has(capability)
  }

  return {
    can,
    allowedTabs,
    defaultTab,
    isLoading: state.status === "loading",
  }
}
