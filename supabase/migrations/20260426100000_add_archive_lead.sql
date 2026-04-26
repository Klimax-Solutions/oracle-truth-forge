-- ============================================
-- Archive lead — soft-hide from CRM pipeline
-- ============================================
-- Permet de retirer un lead du pipeline (faux compte, doublon non détecté,
-- lead non pertinent) sans suppression définitive. Récupérable via filtre.
--
-- Sémantique :
--   - archived_at IS NULL  → lead actif, visible dans le pipeline par défaut
--   - archived_at IS NOT NULL → lead archivé, masqué (sauf filtre "Archivés")
--
-- Indépendant de `status` : on peut archiver un lead 'en_attente' (faux compte)
-- ou 'closed_won' (membre parti) sans perdre la sémantique du statut.
-- ============================================

ALTER TABLE public.early_access_requests
  ADD COLUMN IF NOT EXISTS archived_at  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by  uuid        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text      NULL;

-- Index partiel : optimise la requête par défaut (active leads only)
CREATE INDEX IF NOT EXISTS early_access_requests_active_idx
  ON public.early_access_requests (created_at DESC)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN public.early_access_requests.archived_at  IS 'Timestamp d''archivage. NULL = lead actif dans le pipeline.';
COMMENT ON COLUMN public.early_access_requests.archived_by  IS 'User qui a archivé le lead.';
COMMENT ON COLUMN public.early_access_requests.archive_reason IS 'Raison libre saisie par l''admin (faux compte, doublon, etc.).';
