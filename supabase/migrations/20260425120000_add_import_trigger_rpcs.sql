-- =====================================================================
-- Migration : RPC functions disable/enable import triggers
-- =====================================================================
-- Contexte :
--   Pendant migration-execute (import des users payants depuis pggk vers mkog),
--   on doit désactiver les triggers auto-création sur auth.users pour éviter
--   les doublons sur profiles + user_roles (un trigger Lovable crée
--   automatiquement une row dans ces tables à chaque INSERT auth.users).
--
--   On utilise DISABLE TRIGGER USER qui désactive tous les triggers
--   user-defined sans toucher aux triggers internes Postgres.
--
-- Sécurité :
--   - SECURITY DEFINER : la fonction tourne avec les droits du créateur
--     (postgres role) car ALTER TABLE sur auth.* requiert des droits élevés.
--   - Garde explicite : seul le service_role peut appeler ces RPC.
--   - GRANT EXECUTE ... TO service_role uniquement.
--
-- Usage côté edge function (Lovable) :
--   await target.rpc('disable_import_triggers');
--   try {
--     // import logic
--   } finally {
--     await target.rpc('enable_import_triggers');
--   }
-- =====================================================================

CREATE OR REPLACE FUNCTION public.disable_import_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- Garde-fou : seul service_role
  IF current_setting('request.jwt.claims', true)::json->>'role' IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'disable_import_triggers: only service_role can call this function';
  END IF;

  -- Désactive tous les triggers user-defined sur auth.users
  -- (laisse intacts les triggers internes Postgres / Supabase Auth)
  ALTER TABLE auth.users DISABLE TRIGGER USER;

  RAISE NOTICE 'auth.users user-defined triggers DISABLED';
END;
$$;

CREATE OR REPLACE FUNCTION public.enable_import_triggers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- Garde-fou : seul service_role
  IF current_setting('request.jwt.claims', true)::json->>'role' IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'enable_import_triggers: only service_role can call this function';
  END IF;

  -- Réactive tous les triggers user-defined sur auth.users
  ALTER TABLE auth.users ENABLE TRIGGER USER;

  RAISE NOTICE 'auth.users user-defined triggers ENABLED';
END;
$$;

-- Permissions : uniquement service_role peut appeler ces RPC
REVOKE EXECUTE ON FUNCTION public.disable_import_triggers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enable_import_triggers()  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.disable_import_triggers() TO service_role;
GRANT  EXECUTE ON FUNCTION public.enable_import_triggers()  TO service_role;

COMMENT ON FUNCTION public.disable_import_triggers() IS
  'Désactive tous les triggers user-defined sur auth.users. Réservé service_role. Utilisé par migration-execute (import users pggk→mkog).';
COMMENT ON FUNCTION public.enable_import_triggers() IS
  'Réactive tous les triggers user-defined sur auth.users. Réservé service_role. À appeler en finally après migration-execute.';
