// ─────────────────────────────────────────────────────────────────────────────
// permissions.ts — Source de vérité unique pour les capabilities
//
// Slice : A — IDENTITY (cross-cutting frontend concern)
// Impact DB : ZÉRO — frontend uniquement
//
// Principe :
//   On traduit des RÔLES → CAPABILITIES (ce que l'utilisateur peut faire/voir).
//   Les composants utilisent can('capability'), pas isAdmin/isSetter en dur.
//   Changer une règle métier = modifier ce fichier uniquement.
//
// La DB (RLS) reste le vrai garde-fou sécurité.
// Ce fichier contrôle uniquement la PRÉSENTATION (qui voit quoi dans l'UI).
// ─────────────────────────────────────────────────────────────────────────────

export type Capability =
  // ── Tabs ──────────────────────────────────────────────────────────────────
  | "tab.crm"              // voir le pipeline CRM
  | "tab.gestion"          // voir la section Gestion (membres payants)
  | "tab.config"           // voir la configuration
  | "tab.video-admin"      // médiathèque admin
  | "tab.admin"            // vérifications admin (deprecated)
  | "tab.early-access-mgmt"// gestion EA (deprecated)
  | "tab.funnel-editor"    // éditeur de funnels
  | "tab.member-product"   // espace membre (execution, videos, recolte, etc.)
  // ── CRM actions ───────────────────────────────────────────────────────────
  | "crm.edit.setting"     // modifier les champs Setting (setter)
  | "crm.edit.call"        // modifier les champs Call (closer)
  | "crm.approve"          // approuver un lead
  | "crm.delete"           // supprimer un lead (super_admin only)
  // ── Cycles ────────────────────────────────────────────────────────────────
  | "cycles.validate"      // valider/rejeter une vérification de cycle
  // ── Config ────────────────────────────────────────────────────────────────
  | "config.roles"         // gérer les rôles de l'équipe

export type RolesInput = {
  isAdmin: boolean
  isSuperAdmin: boolean
  isSetter: boolean
  isCloser: boolean
  isEarlyAccess?: boolean
}

// Mapping tab → capabilities requises (toutes doivent être présentes)
const TAB_REQUIRED_CAPS: Record<string, Capability[]> = {
  // Tabs staff uniquement
  crm:                ["tab.crm"],
  gestion:            ["tab.gestion"],
  config:             ["tab.config"],
  "video-admin":      ["tab.video-admin"],
  admin:              ["tab.admin"],
  roles:              ["tab.admin"],
  "early-access-mgmt":["tab.early-access-mgmt"],
  "funnel-editor":    ["tab.funnel-editor"],
  // Tabs produit membre (tous les non-staff)
  execution:          ["tab.member-product"],
  videos:             ["tab.member-product"],
  "recolte-donnees":  ["tab.member-product"],
  "data-analysis":    ["tab.member-product"],
  successes:          ["tab.member-product"],
  results:            ["tab.member-product"],
  setup:              ["tab.member-product"],
  "batch-import":     ["tab.member-product"],
}

/**
 * Calcule l'ensemble des capabilities d'un utilisateur d'après ses rôles.
 * C'est la fonction centrale — modifier ici pour changer les règles métier.
 */
export function getRolesCapabilities(roles: RolesInput): Set<Capability> {
  const caps = new Set<Capability>()
  const { isAdmin, isSuperAdmin, isSetter, isCloser } = roles
  const isStaff = isAdmin || isSuperAdmin

  // ── Super Admin — tout ──────────────────────────────────────────────────
  if (isSuperAdmin) {
    caps.add("tab.crm")
    caps.add("tab.gestion")
    caps.add("tab.config")
    caps.add("tab.video-admin")
    caps.add("tab.admin")
    caps.add("tab.early-access-mgmt")
    caps.add("tab.funnel-editor")
    caps.add("tab.member-product")
    caps.add("crm.edit.setting")
    caps.add("crm.edit.call")
    caps.add("crm.approve")
    caps.add("crm.delete")
    caps.add("cycles.validate")
    caps.add("config.roles")
    return caps
  }

  // ── Admin ──────────────────────────────────────────────────────────────
  if (isAdmin) {
    caps.add("tab.crm")
    caps.add("tab.gestion")
    caps.add("tab.config")
    caps.add("tab.video-admin")
    caps.add("tab.admin")
    caps.add("tab.early-access-mgmt")
    caps.add("tab.funnel-editor")
    caps.add("tab.member-product")
    caps.add("crm.edit.setting")
    caps.add("crm.edit.call")
    caps.add("crm.approve")
    caps.add("cycles.validate")
    return caps
  }

  // ── Setter (sans admin) — CRM setting uniquement ───────────────────────
  if (isSetter) {
    caps.add("tab.crm")
    caps.add("crm.edit.setting")
    return caps
  }

  // ── Closer (sans admin) — CRM call uniquement ──────────────────────────
  if (isCloser) {
    caps.add("tab.crm")
    caps.add("crm.edit.call")
    return caps
  }

  // ── Membre / EA — espace produit ────────────────────────────────────────
  caps.add("tab.member-product")
  return caps
}

/**
 * Retourne l'ensemble des tabs accessibles pour un utilisateur.
 * Utilisé par Dashboard.tsx pour valider les tab changes et les URLs entrantes.
 */
export function getAllowedTabs(roles: RolesInput): Set<string> {
  const caps = getRolesCapabilities(roles)
  const allowed = new Set<string>()

  for (const [tabId, requiredCaps] of Object.entries(TAB_REQUIRED_CAPS)) {
    if (requiredCaps.every(c => caps.has(c))) {
      allowed.add(tabId)
    }
  }

  return allowed
}

/**
 * Tab par défaut selon le rôle.
 * Setter/Closer sans admin → CRM. Tout le monde → execution.
 */
export function getDefaultTab(roles: RolesInput): string {
  const isSetterOnly =
    (roles.isSetter || roles.isCloser) && !roles.isAdmin && !roles.isSuperAdmin
  return isSetterOnly ? "crm" : "execution"
}
