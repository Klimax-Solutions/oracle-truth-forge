// ─────────────────────────────────────────────────────────────────────────────
// usePermissions — Hook consommable dans n'importe quel composant
//
// Slice : A — IDENTITY
// Source des rôles : useSidebarRoles (JWT → cache → RPC)
//
// Usage :
//   const { can, allowedTabs, isLoading } = usePermissions()
//   { can('tab.crm') && <CRMTab /> }
//   { can('crm.edit.call') && <CallEditButton /> }
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react"
import { useSidebarRoles } from "@/components/dashboard/DashboardSidebar"
import {
  type Capability,
  type RolesInput,
  getRolesCapabilities,
  getAllowedTabs,
  getDefaultTab,
} from "@/lib/permissions"

export type { Capability }

export function usePermissions() {
  const { isAdmin, isSuperAdmin, isSetter, isCloser, loadingRoles } =
    useSidebarRoles()

  const roles: RolesInput = { isAdmin, isSuperAdmin, isSetter, isCloser }

  const capabilities = useMemo(() => getRolesCapabilities(roles), [
    isAdmin,
    isSuperAdmin,
    isSetter,
    isCloser,
  ])

  const allowedTabs = useMemo(() => getAllowedTabs(roles), [
    isAdmin,
    isSuperAdmin,
    isSetter,
    isCloser,
  ])

  const defaultTab = useMemo(() => getDefaultTab(roles), [
    isAdmin,
    isSuperAdmin,
    isSetter,
    isCloser,
  ])

  const can = (capability: Capability): boolean => {
    // Pendant le chargement des rôles : on ne donne AUCUNE permission
    // Évite d'afficher des actions non autorisées pendant la résolution async
    if (loadingRoles) return false
    return capabilities.has(capability)
  }

  return {
    can,
    allowedTabs,
    defaultTab,
    isLoading: loadingRoles,
  }
}
