-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : options custom — modèle à 2 pools (global admin + perso user)
--
-- Architecture finale (dans le marbre) :
--   - Options fixes    : hardcodées dans le code, non modifiables
--   - Options communes : user_id IS NULL — créées par l'admin, vues par TOUS
--   - Options perso    : user_id = user.id — créées par l'user, vues par LUI SEUL
--
-- Suppression d'une option commune → n'affecte PAS les trades existants
--   (valeurs stockées en texte dans user_executions, pas en FK)
--
-- Slice : A (permissions) + D (formulaire trades)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Index unique pour les options personnelles ────────────────────────────
-- (l'index global WHERE user_id IS NULL existe déjà depuis la migration précédente)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_personal_custom_variables
  ON public.user_custom_variables(user_id, variable_type, variable_value)
  WHERE user_id IS NOT NULL;

-- ── 2. Mettre à jour les policies RLS ────────────────────────────────────────

-- Supprimer les policies actuelles
DROP POLICY IF EXISTS "All authenticated users can read global variables" ON public.user_custom_variables;
DROP POLICY IF EXISTS "Admins can insert global variables"               ON public.user_custom_variables;
DROP POLICY IF EXISTS "Admins can delete global variables"               ON public.user_custom_variables;

-- SELECT : chaque user voit ses options perso + les options communes
CREATE POLICY "Users can read own and global variables"
  ON public.user_custom_variables FOR SELECT
  TO authenticated
  USING (
    user_id IS NULL          -- options communes (admin) visibles par tous
    OR user_id = auth.uid()  -- options perso visibles uniquement par leur propriétaire
  );

-- INSERT :
--   - Tout utilisateur peut ajouter ses propres options (user_id = auth.uid())
--   - Les admins peuvent ajouter des options communes (user_id IS NULL)
CREATE POLICY "Users insert own, admins insert global"
  ON public.user_custom_variables FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = auth.uid())                                               -- option perso
    OR (user_id IS NULL AND (is_admin() OR is_super_admin()))            -- option commune (admin)
  );

-- DELETE :
--   - Tout utilisateur peut supprimer SES options perso
--   - Les admins peuvent supprimer les options communes
CREATE POLICY "Users delete own, admins delete global"
  ON public.user_custom_variables FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid())                                               -- sa propre option perso
    OR (user_id IS NULL AND (is_admin() OR is_super_admin()))            -- option commune (admin)
  );

COMMIT;
