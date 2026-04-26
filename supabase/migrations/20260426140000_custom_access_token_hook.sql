-- ────────────────────────────────────────────────────────────────────────────
-- custom_access_token_hook
-- Auth Hook Supabase qui injecte les rôles user dans le JWT claims.
--
-- Pourquoi : avant ce hook, chaque page faisait un RPC `is_admin()`,
-- `is_setter()`, etc. à chaque load. Sur réseau lent (Slow 4G, cold-start
-- Vercel), ces RPCs timeout → tous les rôles tombent à false → un setter
-- voit la vue membre par défaut. Bug racey, UX cassée.
--
-- Avec ce hook, les rôles sont gravés dans le JWT à l'émission. Le client
-- les lit synchroniquement depuis `session.user.app_metadata.roles` → zéro
-- réseau, zéro race condition.
--
-- ⚠️ ACTIVATION MANUELLE REQUISE :
-- Cette fonction doit être enregistrée comme Auth Hook dans le dashboard
-- Supabase :
--   Authentication → Hooks → Custom Access Token → Enable + Select
--   `public.custom_access_token_hook`
-- Sans cette case cochée, la fonction est dormante et le JWT reste vide.
--
-- Sécurité :
--   - SECURITY DEFINER + search_path = public pour bypass RLS
--   - exception handling : si le SELECT plante, on renvoie l'event tel quel
--     (JWT émis sans claims → fallback côté client sur RPC `is_*`)
--   - GRANT EXECUTE seulement à supabase_auth_admin (rôle qui exécute le hook)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_uuid uuid;
  roles_array text[];
  claims jsonb;
  app_meta jsonb;
BEGIN
  user_uuid := (event->>'user_id')::uuid;

  -- Tableau des rôles. NULL si user n'a aucune ligne user_roles (impossible
  -- normalement vu le trigger handle_new_user, mais on protège).
  BEGIN
    SELECT array_agg(DISTINCT role::text)
    INTO roles_array
    FROM public.user_roles
    WHERE user_id = user_uuid;
  EXCEPTION WHEN OTHERS THEN
    -- En cas d'erreur DB, on laisse roles_array NULL et on retourne event tel
    -- quel pour ne pas bloquer l'émission du JWT.
    roles_array := NULL;
  END;

  claims := event->'claims';
  app_meta := COALESCE(claims->'app_metadata', '{}'::jsonb);

  -- Injecte le tableau des rôles. Format : ["setter"], ["admin","super_admin"]
  app_meta := jsonb_set(
    app_meta,
    '{roles}',
    to_jsonb(COALESCE(roles_array, ARRAY[]::text[]))
  );

  claims := jsonb_set(claims, '{app_metadata}', app_meta);

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Le rôle supabase_auth_admin doit pouvoir exécuter le hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

-- Le hook doit pouvoir lire user_roles (search_path + SECURITY DEFINER suffisent
-- mais on ajoute un GRANT explicite pour clarté en cas d'audit RLS).
GRANT SELECT ON public.user_roles TO supabase_auth_admin;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Auth Hook : injecte user_roles.role[] dans JWT claims app_metadata.roles. '
  'Activer manuellement dans Supabase Dashboard → Authentication → Hooks.';
