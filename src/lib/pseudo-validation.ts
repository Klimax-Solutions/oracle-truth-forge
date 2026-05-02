// ─────────────────────────────────────────────────────────────────────────────
// pseudo-validation.ts — Source de vérité frontend pour la validation des pseudos
//
// Spec : docs/pseudo-uniqueness.md
// Slice : A (Identity)
//
// Règles enforced en DB par :
//   - Index UNIQUE partiel `uniq_profiles_display_name_ci` (case-insensitive)
//   - CHECK constraint `chk_display_name_format` (longueur, regex, réservés)
//   - Trigger `handle_new_user` (sanitize + auto-suffix au signup)
//
// Frontend valide en avance pour l'UX, mais la DB reste la barrière finale.
// Toujours catch erreur Postgres `23505` au save effectif (race condition).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

// ─── Constantes (synchronisées avec le CHECK constraint en DB) ──────────────

export const PSEUDO_MIN_LENGTH = 2;
export const PSEUDO_MAX_LENGTH = 24;

/** Regex synchronisée avec le CHECK constraint Postgres `[A-Za-zÀ-ÿ0-9._-]+` */
export const PSEUDO_ALLOWED_REGEX = /^[A-Za-zÀ-ÿ0-9._-]+$/;

/** Noms réservés (synchronisés avec le CHECK constraint). Comparaison case-insensitive. */
export const PSEUDO_RESERVED_NAMES = [
  "everyone",
  "here",
  "admin",
  "administrator",
  "system",
  "oracle",
  "support",
  "staff",
  "mod",
  "moderator",
] as const;

/** Cooldown entre deux renames volontaires (sans le 1er). */
export const PSEUDO_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

// ─── Types ──────────────────────────────────────────────────────────────────

export type PseudoValidationResult =
  | { valid: true }
  | { valid: false; reason: PseudoValidationError };

export type PseudoValidationError =
  | "empty"
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "reserved";

export type PseudoAvailabilityResult =
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken" }
  | { status: "error"; message: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Normalisation utilisée pour comparaisons d'unicité (DB et frontend). */
export const normalizePseudo = (pseudo: string): string =>
  pseudo.toLowerCase().trim();

/**
 * Validation de format SYNCHRONE — sans network.
 * Doit échouer pour la même raison que le CHECK constraint Postgres.
 */
export const validatePseudoFormat = (pseudo: string): PseudoValidationResult => {
  const trimmed = pseudo.trim();
  if (trimmed.length === 0) return { valid: false, reason: "empty" };
  if (trimmed.length < PSEUDO_MIN_LENGTH) return { valid: false, reason: "too_short" };
  if (trimmed.length > PSEUDO_MAX_LENGTH) return { valid: false, reason: "too_long" };
  if (!PSEUDO_ALLOWED_REGEX.test(trimmed)) return { valid: false, reason: "invalid_chars" };
  if ((PSEUDO_RESERVED_NAMES as readonly string[]).includes(trimmed.toLowerCase())) {
    return { valid: false, reason: "reserved" };
  }
  return { valid: true };
};

/** Message user-friendly pour chaque code d'erreur. */
export const formatValidationError = (error: PseudoValidationError): string => {
  switch (error) {
    case "empty": return "Le pseudo ne peut pas être vide.";
    case "too_short": return `Le pseudo doit contenir au moins ${PSEUDO_MIN_LENGTH} caractères.`;
    case "too_long": return `Le pseudo ne peut pas dépasser ${PSEUDO_MAX_LENGTH} caractères.`;
    case "invalid_chars": return "Caractères autorisés : lettres (avec accents), chiffres, point, tiret, underscore. Pas d'espaces.";
    case "reserved": return "Ce pseudo est réservé, choisis-en un autre.";
  }
};

/**
 * Vérification d'unicité ASYNC — query DB.
 * Compare via `ilike` (Postgres case-insensitive natif).
 *
 * @param pseudo Le pseudo à tester
 * @param currentUserId UUID du user courant (exclu de la query — un user peut "garder" son propre pseudo)
 * @returns "available" | "taken" | "error"
 */
export const checkPseudoAvailability = async (
  pseudo: string,
  currentUserId: string,
): Promise<PseudoAvailabilityResult> => {
  const trimmed = pseudo.trim();
  if (trimmed.length === 0) return { status: "available" }; // pas de query si vide

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("display_name", trimmed) // case-insensitive natif
      .neq("user_id", currentUserId)
      .maybeSingle();

    if (error) {
      // .maybeSingle() retourne error si > 1 row — sécurité après index UNIQUE c'est impossible
      // mais on log au cas où.
      console.warn("[pseudo-validation] availability check error:", error);
      return { status: "error", message: error.message };
    }

    return data ? { status: "taken" } : { status: "available" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[pseudo-validation] availability check threw:", message);
    return { status: "error", message };
  }
};

// ─── Cooldown helpers ───────────────────────────────────────────────────────

export type CooldownStatus =
  | { canChange: true }
  | { canChange: false; nextAllowedAt: Date };

/**
 * Détermine si le user peut renommer son pseudo MAINTENANT.
 *
 * Règle : NULL = jamais changé volontairement → 1er rename gratuit.
 * Sinon : besoin d'attendre 30j depuis le dernier rename.
 *
 * @param displayNameChangedAt Valeur de `profiles.display_name_changed_at` (ISO string ou null)
 */
export const computeCooldown = (displayNameChangedAt: string | null): CooldownStatus => {
  if (!displayNameChangedAt) return { canChange: true };

  const lastChange = new Date(displayNameChangedAt);
  const elapsed = Date.now() - lastChange.getTime();

  if (elapsed >= PSEUDO_COOLDOWN_MS) return { canChange: true };

  const nextAllowedAt = new Date(lastChange.getTime() + PSEUDO_COOLDOWN_MS);
  return { canChange: false, nextAllowedAt };
};

/** Format user-friendly d'une date de cooldown. */
export const formatCooldownMessage = (nextAllowedAt: Date): string => {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Tu pourras changer ton pseudo à nouveau le ${formatter.format(nextAllowedAt)}.`;
};

// ─── Catch handler pour erreur 23505 (race condition) ───────────────────────

/**
 * Détecte si une erreur Postgres correspond à une violation de l'index UNIQUE
 * sur display_name. À utiliser dans les catch après UPDATE/INSERT.
 */
export const isDisplayNameUniqueViolation = (error: { code?: string; message?: string } | null | undefined): boolean => {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /uniq_profiles_display_name_ci|duplicate key|already exists/i.test(error.message ?? "");
};
