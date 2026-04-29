-- ═══════════════════════════════════════════════════════════════════
-- Migration : Fix user logic — is_closer() + RLS audit fixes
-- Date      : 2026-04-29
-- Safe      : OUI — transaction complète, DROP IF EXISTS partout
-- ═══════════════════════════════════════════════════════════════════
--
-- PROBLÈMES CORRIGÉS :
--
--   1. is_closer() manquante en prod
--      → ALTER TYPE 'closer' avait été appliqué mais CREATE FUNCTION
--        avait échoué en même transaction (comportement Lovable auto-deploy)
--      → Les 2 policies RLS "Closers can view/update leads" n'existent pas
--      → Les closers ont ZÉRO accès au CRM
--
--   2. "Early access can view all executions" (user_executions)
--      → Policy orpheline dangereuse : EA peut lire les exécutions de TOUS les
--        users. Créée pour Data Générale mais cette feature est admin-only.
--      → DROP
--
--   3. "Setters can view all executions" (user_executions)
--      → Trop large : setter voit les trades de tous les membres payants.
--      → Remplacée par une policy ciblée : seulement les exécutions de users
--        qui ont un lead actif dans early_access_requests (leads EA uniquement)
--
--   4. Closer : même accès restreint aux exécutions que setter (CRM checklist)
--
-- ROLLBACK : transaction complète → si erreur, rien n'est appliqué.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. CRÉER is_closer()
-- ─────────────────────────────────────────────────────────────────────
-- La fonction vérifie si l'utilisateur courant a le rôle 'closer'
-- dans user_roles (sans vérifier expires_at — le rôle closer est permanent).
-- SECURITY DEFINER + search_path = public pour bypasser RLS sur user_roles.

CREATE OR REPLACE FUNCTION public.is_closer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'closer'
  )
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. POLICIES RLS pour les closers sur early_access_requests
-- ─────────────────────────────────────────────────────────────────────
-- DROP IF EXISTS pour gérer les deux cas :
--   (a) policies jamais créées (is_closer() manquante → CREATE avait échoué)
--   (b) policies créées mais cassées (is_closer() disparue)

DROP POLICY IF EXISTS "Closers can view leads"         ON public.early_access_requests;
DROP POLICY IF EXISTS "Closers can update call fields" ON public.early_access_requests;

-- Closer peut voir TOUS les leads (comme setter) — nécessaire pour le CRM
CREATE POLICY "Closers can view leads"
  ON public.early_access_requests
  FOR SELECT
  USING (public.is_closer());

-- Closer peut mettre à jour uniquement les champs call
-- (call_done, call_done_at, call_outcome, call_debrief, paid_amount,
--  paid_at, checkout_unlocked, raison_perdu, rappel_date, rappel_note,
--  call_no_show, raison_non_closing)
-- Note : pas de restriction par colonne au niveau RLS (Supabase ne supporte pas
-- le column-level RLS). La restriction par champ est gérée côté applicatif
-- (LeadDetailModal.tsx — seuls les champs Call sont éditables pour un closer).
CREATE POLICY "Closers can update call fields"
  ON public.early_access_requests
  FOR UPDATE
  USING (public.is_closer())
  WITH CHECK (public.is_closer());

-- ─────────────────────────────────────────────────────────────────────
-- 3. SUPPRIMER la policy EA "view all executions" (orpheline, dangereuse)
-- ─────────────────────────────────────────────────────────────────────
-- Raison : Data Générale (seul endroit qui lit toutes les exécutions) est
-- admin-only dans le code (useDataGenerale.ts: `if (!isAdmin) return`).
-- Cette policy donnait aux EA actifs la capacité de lire les exécutions
-- de TOUS les membres via l'API Supabase directement (bypass frontend).
-- Suppression sans impact produit — aucune feature EA n'en dépend.

DROP POLICY IF EXISTS "Early access can view all executions" ON public.user_executions;

-- ─────────────────────────────────────────────────────────────────────
-- 4. REMPLACER "Setters can view all executions" par une policy ciblée
-- ─────────────────────────────────────────────────────────────────────
-- Problème : setter pouvait lire les trades de TOUS les membres payants.
-- Or, le CRM n'a besoin que du COUNT d'exécutions pour les leads EA
-- (colonne execMap dans CRMDashboard.tsx, ligne ~613).
--
-- Nouvelle policy : setter/closer peuvent lire uniquement les exécutions
-- des users qui ont un lead dans early_access_requests (leads EA/CRM).
-- Les membres payants sans lead EA sont hors scope.

DROP POLICY IF EXISTS "Setters can view all executions" ON public.user_executions;

CREATE POLICY "Setters and closers can view crm lead executions"
  ON public.user_executions
  FOR SELECT
  USING (
    (public.is_setter() OR public.is_closer())
    AND EXISTS (
      SELECT 1
      FROM public.early_access_requests ear
      WHERE ear.user_id = user_executions.user_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 5. VÉRIFICATIONS POST-MIGRATION (à exécuter manuellement pour confirmer)
-- ─────────────────────────────────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname = 'is_closer';
-- → Doit retourner 1 row
--
-- SELECT policyname FROM pg_policies
-- WHERE tablename = 'early_access_requests' AND policyname LIKE '%loser%';
-- → Doit retourner "Closers can view leads" et "Closers can update call fields"
--
-- SELECT policyname FROM pg_policies
-- WHERE tablename = 'user_executions' AND policyname LIKE '%xecutions%';
-- → Ne doit PAS contenir "Early access can view all executions"
-- → Doit contenir "Setters and closers can view crm lead executions"

COMMIT;
