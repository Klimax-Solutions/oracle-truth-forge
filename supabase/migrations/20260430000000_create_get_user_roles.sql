-- ═══════════════════════════════════════════════════════════════════════════
-- Migration : get_user_roles() — RPC unique pour Option B (refacto auth 2026-04-30)
-- Date      : 2026-04-30
-- Slice     : A (IDENTITY) — niveau 0 sacré
-- Safe      : OUI
--   - Purement additive (CREATE OR REPLACE sur fonction inexistante)
--   - Aucune mutation de donnée
--   - Aucune suppression / modification d'objet existant
--   - Réutilise les is_*() existantes → cohérence garantie avec les 60 RLS policies
--   - Idempotent : safe à rejouer
-- ═══════════════════════════════════════════════════════════════════════════
--
-- POURQUOI :
--   Aujourd'hui le frontend appelle 4-6 RPCs séparées par chargement
--   (is_admin, is_super_admin, is_setter, is_closer, is_early_access, is_institute).
--   Cette nouvelle fonction renvoie tous les flags + le timer EA en UN SEUL
--   round-trip. Source de vérité unique pour la logique rôles côté client.
--
-- RÉFÉRENCES :
--   - Audit complet : docs au niveau projet (Slice A architecture)
--   - Décision Option B actée : 2026-04-30 (Charles + Claude)
--
-- DESIGN :
--   - RETURNS TABLE (1 row) → typing strict côté Supabase JS
--   - Réutilise les is_*() existantes au lieu d'inliner la logique :
--       garantit que si is_early_access() change un jour (ex: nouvelle condition
--       sur expires_at), get_user_roles() suit automatiquement.
--   - CTE ea_row : lit user_roles 1 seule fois pour expires_at + early_access_type.
--   - Retourne ea_expires_at MÊME si is_early_access est false (expiré) :
--       permet au frontend de distinguer "jamais eu accès" (NULL) vs
--       "a expiré" (date dans le passé). Critique pour EarlyAccessExpiredPopup.
--   - SECURITY DEFINER + auth.uid() = scoped au caller (cohérent avec is_*()).
--   - GRANT EXECUTE TO authenticated uniquement (pas d'anon).
--
-- ROLLBACK :
--   DROP FUNCTION IF EXISTS public.get_user_roles();
--   (sans impact sur le reste — c'est un ajout pur)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS TABLE (
  is_admin        boolean,
  is_super_admin  boolean,
  is_setter       boolean,
  is_closer       boolean,
  is_early_access boolean,
  is_institute    boolean,
  ea_expires_at   timestamptz,
  ea_type         text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ea_row AS (
    SELECT expires_at, early_access_type
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'early_access'
    LIMIT 1
  )
  SELECT
    public.is_admin(),
    public.is_super_admin(),
    public.is_setter(),
    public.is_closer(),
    public.is_early_access(),
    public.is_institute(),
    (SELECT expires_at FROM ea_row),
    (SELECT early_access_type FROM ea_row);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_roles() TO authenticated;

COMMENT ON FUNCTION public.get_user_roles() IS
'Single round-trip role check for Option B architecture (Slice A, 2026-04-30). Returns all role flags + EA timer in 1 RPC call. Reuses existing is_ functions for consistency with RLS policies. SECURITY DEFINER + auth.uid() = scoped to caller. Idempotent.';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATIONS POST-DÉPLOIEMENT (à exécuter manuellement après le push)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. La fonction est créée :
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name = 'get_user_roles';
-- → 1 row attendue
--
-- 2. Le GRANT est posé :
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_name = 'get_user_roles' AND routine_schema = 'public';
-- → authenticated | EXECUTE
--
-- 3. Test fonctionnel (depuis ton compte super_admin connecté) :
-- SELECT * FROM public.get_user_roles();
-- → 1 row : is_admin=true, is_super_admin=true, autres=false, ea_*=NULL
--
-- 4. Test sécurité (sans rôle admin, en tant que membre) :
-- → la fonction doit retourner is_admin=false (jamais une erreur 403)
-- ═══════════════════════════════════════════════════════════════════════════
