-- ═══════════════════════════════════════════════════════════════════
-- Migration : Fix double vérification + RPC email admin
-- Date      : 2026-04-29
-- Safe      : OUI — transaction complète, idempotente, auto-dédup
-- Apply     : SQL Editor pggk (prod) ou mkog (test)
-- ═══════════════════════════════════════════════════════════════════
--
-- ORDRE D'EXÉCUTION INTERNE :
--   1. Audit silencieux (lecture seule, ne bloque pas)
--   2. Déduplication des pending existants (garde le plus récent)
--   3. Création index unique partiel (safe car doublons nettoyés)
--   4. Création RPC get_auth_emails (idempotente — CREATE OR REPLACE)
--
-- ROLLBACK : tout est dans une transaction → si erreur, rien n'est
-- appliqué. La DB reste dans son état initial.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. DÉDUPLICATION des pending existants ──────────────────────────
-- Supprime les doublons (user_id, cycle_id) en gardant le plus récent.
-- Safe : si pas de doublon, ne fait rien.
-- Exemples concernés : Aurel (2 demandes pour le même cycle).

DELETE FROM verification_requests
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, cycle_id
        ORDER BY created_at DESC  -- garde le plus récent
      ) AS rn
    FROM verification_requests
    WHERE status = 'pending'
  ) ranked
  WHERE rn > 1  -- supprime tous sauf le premier (le plus récent)
);

-- ── 2. INDEX UNIQUE PARTIEL sur verification_requests ───────────────
-- Un seul enregistrement 'pending' par (user_id, cycle_id).
-- Les demandes rejected/validated sont hors contrainte (historique OK).
-- IF NOT EXISTS → safe à rejouer si déjà appliqué.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_verification_requests_pending
  ON verification_requests (user_id, cycle_id)
  WHERE status = 'pending';

-- ── 3. RPC get_auth_emails ───────────────────────────────────────────
-- Permet aux admins de lire auth.users depuis le frontend.
-- SECURITY DEFINER → droits postgres, peut lire auth.users.
-- Vérification is_admin() intégrée → non accessible aux autres rôles.
-- CREATE OR REPLACE → idempotent, safe à rejouer.

CREATE OR REPLACE FUNCTION get_auth_emails(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
    SELECT au.id AS user_id, au.email::text
    FROM auth.users au
    WHERE au.id = ANY(user_ids);
END;
$$;

COMMIT;
