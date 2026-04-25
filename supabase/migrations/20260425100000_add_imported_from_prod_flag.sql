-- =====================================================================
-- Migration : add imported_from_prod flag on profiles
-- =====================================================================
-- Objectif : distinguer les users importés depuis pggk (Lovable prod)
-- des users de test existants sur mkog (équipe dev, comptes cycle-test, etc.)
--
-- Utilisation :
--   - Pendant l'import via edge function migration-execute,
--     SET imported_from_prod = true + imported_at = now()
--   - Filtre dans GestionPanel : afficher "Source : Test / Importé prod"
--   - SELECT count(*) FROM profiles WHERE imported_from_prod = true;
-- =====================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS imported_from_prod BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NULL;

-- Index partiel : optimise les filtres "show only migrated users"
CREATE INDEX IF NOT EXISTS idx_profiles_imported_from_prod
  ON profiles(imported_from_prod)
  WHERE imported_from_prod = true;

COMMENT ON COLUMN profiles.imported_from_prod IS
  'TRUE si le user a été importé depuis le projet prod (pggk) via la migration anonymisée. FALSE pour les users créés directement sur mkog (équipe, tests).';

COMMENT ON COLUMN profiles.imported_at IS
  'Timestamp de l''import depuis prod. NULL pour les users non importés.';
