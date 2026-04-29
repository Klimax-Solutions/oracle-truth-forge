-- ═══════════════════════════════════════════════════════════════════
-- Migration : Fix double vérification + RPC email admin
-- Date      : 2026-04-29
-- Auteur    : Claude
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. CONTRAINTE UNIQUE partielle sur verification_requests ────────
-- Un seul enregistrement 'pending' par (user_id, cycle_id).
-- Empêche les doublons même en cas de race condition côté client.
-- Les demandes rejected/validated restent (historique conservé).

CREATE UNIQUE INDEX IF NOT EXISTS uniq_verification_requests_pending
  ON verification_requests (user_id, cycle_id)
  WHERE status = 'pending';

-- ── 2. RPC get_auth_emails ──────────────────────────────────────────
-- Permet aux admins de récupérer l'email depuis auth.users
-- pour les comptes créés sans passer par early_access_requests.
-- SECURITY DEFINER → tourne avec les droits du owner (postgres),
-- donc peut lire auth.users. La vérification is_admin() garantit
-- que seuls les admins peuvent appeler cette fonction.

CREATE OR REPLACE FUNCTION get_auth_emails(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
    SELECT au.id AS user_id, au.email::text
    FROM auth.users au
    WHERE au.id = ANY(user_ids);
END;
$$;
