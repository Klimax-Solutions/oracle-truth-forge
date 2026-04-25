-- =====================================================================
-- Migration : ensure 'institute' value exists in app_role enum
-- =====================================================================
-- Contexte :
--   Le recon de migration (pggk → mkog) a identifié 55 users avec le
--   rôle 'institute' à importer. Bien que la valeur soit probablement
--   déjà présente dans l'enum app_role (héritée du schéma Lovable de base),
--   on l'ajoute proactivement avec IF NOT EXISTS pour garantir que les
--   INSERT dans user_roles ne casseront pas pendant migration-execute.
--
-- Idempotent : si la valeur existe déjà, ALTER TYPE est un no-op.
-- =====================================================================

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'institute';
