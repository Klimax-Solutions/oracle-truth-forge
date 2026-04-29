-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : user_custom_variables → options globales gérées par les admins
--
-- Avant : chaque user stocke ses propres options (user_id NOT NULL)
--         → chaque membre voyait sa propre liste, complètement isolée
--
-- Après : options globales (user_id IS NULL)
--         → tous les membres voient la même liste
--         → seuls les admins peuvent ajouter / supprimer des options
--         → supprimer une option n'affecte PAS rétrospectivement les trades
--           (les valeurs sont stockées en texte dans user_executions, pas en FK)
--
-- Slice : A (Identity/permissions) + D (Cycles - formulaire trades)
-- Impact data : ZÉRO sur user_executions / user_personal_trades
-- Rollback : remettre user_id NOT NULL + recréer les anciennes policies
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Rendre user_id nullable ───────────────────────────────────────────────
ALTER TABLE public.user_custom_variables
  ALTER COLUMN user_id DROP NOT NULL;

-- ── 2. Migrer les options existantes vers le scope global ────────────────────
-- (pré-launch : pas d'utilisateurs réels, toutes les options deviennent globales)
UPDATE public.user_custom_variables SET user_id = NULL;

-- ── 3. Dédoublonner avant de créer l'index unique ───────────────────────────
-- Plusieurs users peuvent avoir créé la même valeur → doublons après mise à NULL.
-- On garde la ligne la plus ancienne (created_at ASC), on supprime les autres.
DELETE FROM public.user_custom_variables a
USING public.user_custom_variables b
WHERE a.variable_type  = b.variable_type
  AND a.variable_value = b.variable_value
  AND a.created_at     > b.created_at;

-- ── 5. Supprimer l'ancienne contrainte UNIQUE ────────────────────────────────
-- L'ancienne contrainte (user_id, variable_type, variable_value) ne couvre pas
-- correctement les NULL en PostgreSQL (NULL != NULL dans les contraintes UNIQUE).
ALTER TABLE public.user_custom_variables
  DROP CONSTRAINT IF EXISTS user_custom_variables_user_id_variable_type_variable_value_key;

-- ── 6. Nouveau index unique partiel pour les options globales ────────────────
-- Garantit l'unicité de (variable_type, variable_value) quand user_id IS NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_global_custom_variables
  ON public.user_custom_variables(variable_type, variable_value)
  WHERE user_id IS NULL;

-- ── 7. Supprimer toutes les anciennes policies ───────────────────────────────
DROP POLICY IF EXISTS "Users can view their own variables"       ON public.user_custom_variables;
DROP POLICY IF EXISTS "Users can insert their own variables"     ON public.user_custom_variables;
DROP POLICY IF EXISTS "Users can update their own variables"     ON public.user_custom_variables;
DROP POLICY IF EXISTS "Users can delete their own variables"     ON public.user_custom_variables;
DROP POLICY IF EXISTS "Super admins can delete user_custom_variables" ON public.user_custom_variables;

-- ── 8. Nouvelles policies ────────────────────────────────────────────────────

-- SELECT : tous les utilisateurs authentifiés peuvent lire les options globales
CREATE POLICY "All authenticated users can read global variables"
  ON public.user_custom_variables FOR SELECT
  TO authenticated
  USING (user_id IS NULL);

-- INSERT : admins uniquement (admin + super_admin)
CREATE POLICY "Admins can insert global variables"
  ON public.user_custom_variables FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NULL
    AND (is_admin() OR is_super_admin())
  );

-- DELETE : admins uniquement
CREATE POLICY "Admins can delete global variables"
  ON public.user_custom_variables FOR DELETE
  TO authenticated
  USING (
    user_id IS NULL
    AND (is_admin() OR is_super_admin())
  );

-- Pas de policy UPDATE : les options n'ont pas besoin d'être modifiées
-- (supprimer + recréer si besoin de renommer une valeur)

COMMIT;
