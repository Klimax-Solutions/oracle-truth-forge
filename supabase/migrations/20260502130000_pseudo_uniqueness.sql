-- ═══════════════════════════════════════════════════════════════════════════
-- 20260502130000_pseudo_uniqueness.sql
-- Pseudo uniqueness — schema enforcement uniquement (T2)
--
-- Spec : docs/pseudo-uniqueness.md
-- Slice : A (IDENTITY)
-- Niveau : 0 (SACRÉ — touche profiles)
--
-- ⚠️ Cette migration est la PARTIE SCHÉMA UNIQUEMENT (T2).
--    La partie data (T1 — renommage des 28 collisions + 12 non-conformes)
--    a été appliquée manuellement le 2026-05-02 via SQL Editor Lovable
--    avec backups CSV dans docs/db-audit/2026-05-02_pseudo_*.csv.
--    Ces UPDATE one-shot N'APPARAISSENT PAS ici (ne pas re-replay).
--
-- Idempotente : safe à rejouer (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
-- Lovable auto-deploy : ce fichier sera re-rejoué à chaque push, ne change rien.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Colonne cooldown
--    NULL = jamais changé volontairement → 1er rename gratuit
--    Set à NOW() à chaque UPDATE volontaire côté frontend
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS display_name_changed_at timestamptz;

COMMENT ON COLUMN profiles.display_name_changed_at IS
'Timestamp du dernier rename volontaire par le user via Profile Settings. NULL = jamais changé. Frontend bloque le rename si NOW() - display_name_changed_at < 30 days. Voir docs/pseudo-uniqueness.md §3.5';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Index UNIQUE partiel case-insensitive trim-aware
-- ──────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profiles_display_name_ci
ON public.profiles (LOWER(TRIM(display_name)))
WHERE display_name IS NOT NULL AND TRIM(display_name) <> '';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. CHECK constraint format pseudo
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_display_name_format;

ALTER TABLE profiles ADD CONSTRAINT chk_display_name_format CHECK (
  display_name IS NULL OR TRIM(display_name) = '' OR (
    LENGTH(TRIM(display_name)) BETWEEN 2 AND 24
    AND display_name ~ '^[A-Za-zÀ-ÿ0-9._-]+$'
    AND LOWER(TRIM(display_name)) NOT IN (
      'everyone', 'here', 'admin', 'administrator',
      'system', 'oracle', 'support', 'staff', 'mod', 'moderator'
    )
  )
);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Trigger handle_new_user durci
--    - Sanitize : enlève caractères hors whitelist
--    - Fallback Membre_xxxxxx si trop court après sanitize
--    - Tronque à 22 chars max (laisse 2 chars pour suffixe numérique)
--    - Retry loop : sur unique_violation, incrémente suffixe jusqu'à 100 essais
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_name text;
  candidate text;
  suffix int := 1;
  attempt int := 0;
BEGIN
  base_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    split_part(NEW.email, '@', 1)
  );

  base_name := REGEXP_REPLACE(base_name, '[^A-Za-zÀ-ÿ0-9._-]', '', 'g');

  IF base_name IS NULL OR LENGTH(base_name) < 2 THEN
    base_name := 'Membre_' || SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 6);
  END IF;

  IF LENGTH(base_name) > 22 THEN
    base_name := SUBSTRING(base_name, 1, 22);
  END IF;

  candidate := base_name;

  LOOP
    BEGIN
      INSERT INTO public.profiles (user_id, display_name, first_name, status)
      VALUES (
        NEW.id,
        candidate,
        NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
        'pending'
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
      IF attempt >= 100 THEN
        RAISE EXCEPTION '[handle_new_user] 100 tentatives échouées pour user %', NEW.id;
      END IF;
      suffix := suffix + 1;
      candidate := base_name || suffix::text;
      IF LENGTH(candidate) > 24 THEN
        base_name := SUBSTRING(base_name, 1, 24 - LENGTH(suffix::text));
        candidate := base_name || suffix::text;
      END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMIT;
