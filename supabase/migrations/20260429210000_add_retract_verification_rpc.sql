-- ═══════════════════════════════════════════════════════════════════
-- Migration : RPC retract_verification_request
-- Date      : 2026-04-29
-- Module    : 3 — Cycle State Machine
-- Safe      : OUI — transaction complète, CREATE OR REPLACE
-- ═══════════════════════════════════════════════════════════════════
--
-- PROBLÈME CORRIGÉ :
--
--   Bug #5 — Annulation cycle non propagée / atomique
--   → Il n'existe aucun moyen pour l'user de rétracter une demande
--     de vérification pending.
--   → Si soumission par erreur ou changement d'avis : l'user est bloqué.
--   → L'admin voit des demandes "pending" fantômes.
--
-- SOLUTION :
--   RPC retract_verification_request(p_cycle_id)
--   → UPDATE verification_requests SET status='cancelled'
--     WHERE user_id = auth.uid() AND cycle_id = p_cycle_id AND status = 'pending'
--   → Opération atomique (single UPDATE)
--   → SECURITY DEFINER : un user ne peut rétracter QUE ses propres demandes
--   → Status 'cancelled' (pas DELETE) : préserve l'historique
--   → RLS côté admin filtre déjà sur status='pending' → les cancelled
--     n'apparaissent plus dans la file admin automatiquement
--
-- IMPACT DATA :
--   Zéro perte de données. Statut passe de 'pending' à 'cancelled'.
--   La contrainte unique DB (uniq_verification_requests_pending) couvre
--   WHERE status='pending' uniquement — une nouvelle soumission reste possible.
--
-- ROLLBACK : transaction complète → si erreur, rien n'est appliqué.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.retract_verification_request(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.verification_requests
  SET
    status     = 'cancelled',
    reviewed_at = NOW()
  WHERE user_id  = auth.uid()
    AND cycle_id = p_cycle_id
    AND status   = 'pending';

  -- Si aucune row mise à jour : la demande n'existe pas ou n'est plus pending
  -- → on ne lève pas d'exception (idempotent — déjà annulée = OK)
END;
$$;

-- Vérification post-migration :
-- SELECT proname FROM pg_proc WHERE proname = 'retract_verification_request';
-- → Doit retourner 1 row

COMMIT;
