-- ═══════════════════════════════════════════════════════════════════
-- Migration : Fix retract_verification_request — atomicité complète
-- Date      : 2026-04-30
-- Module    : Slice D — Cycle State Machine
-- Safe      : OUI — CREATE OR REPLACE, transaction complète
-- ═══════════════════════════════════════════════════════════════════
--
-- PROBLÈME CORRIGÉ :
--
--   La migration 20260429210000_add_retract_verification_rpc.sql créait
--   une version incomplète du RPC retract_verification_request :
--   → Elle annulait bien verification_requests.status = 'cancelled'
--   → MAIS elle ne resetait PAS user_cycles.status → 'in_progress'
--
--   Résultat observé en prod (SQL audit 2026-04-30) :
--   → 1 verification_request avec status='pending'
--   → 0 user_cycles avec status='pending_review'
--   → Le cycle du user est coincé dans un état incohérent :
--     pas de pending_review → mais la VR qui permettrait de passer
--     à validated/rejected est cancelled → deadlock.
--
-- SOLUTION :
--   Réécriture atomique du RPC :
--   1. UPDATE verification_requests status → 'cancelled'
--   2. UPDATE user_cycles status → 'in_progress' (si pending_review)
--   Les deux UPDATE sont dans la même transaction plpgsql → atomique.
--   Si l'un échoue, l'autre est rollbacké automatiquement.
--
-- IMPACT DATA :
--   Zéro donnée perdue. user_cycles.status revient à 'in_progress'
--   (état dans lequel il était AVANT que l'user soumette la demande).
--   La contrainte UNIQUE PARTIAL se libère → nouvelle soumission possible.
--
-- CORRECTIF PROD IMMÉDIAT (exécuter en SQL Editor pggk AVANT le push) :
--   Corriger les cycles coincés en exécutant §7.2 de slice-D-master-2026-04-30.md
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.retract_verification_request(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Annuler la verification_request pending
  UPDATE public.verification_requests
  SET
    status      = 'cancelled',
    reviewed_at = NOW()
  WHERE user_id  = auth.uid()
    AND cycle_id = p_cycle_id
    AND status   = 'pending';

  -- 2. Reset le user_cycle correspondant en in_progress
  --    (si le cycle est en pending_review — état cohérent avec une VR pending)
  --    Sans ce UPDATE, le cycle reste coincé en pending_review alors que
  --    la VR est cancelled → l'user ne peut plus soumettre ni l'admin voir la demande.
  UPDATE public.user_cycles
  SET
    status       = 'in_progress',
    completed_at = NULL
  WHERE user_id  = auth.uid()
    AND cycle_id = p_cycle_id
    AND status   = 'pending_review';

  -- Si aucune row mise à jour dans les deux cas : idempotent (déjà rétracté = OK)
END;
$$;

-- ─── Correctif immédiat pour les incohérences existantes ───────────────────
-- Ce bloc corrige les user_cycles coincés en pending_review sans VR pending.
-- Il ne s'exécute QUE si des incohérences existent — safe si aucune.

DO $$
DECLARE
  corrected_count INT;
BEGIN
  -- Identifier et corriger les cycles coincés :
  -- pending_review dans user_cycles mais PAS de VR 'pending' associée
  UPDATE public.user_cycles uc
  SET
    status       = 'in_progress',
    completed_at = NULL
  WHERE uc.status = 'pending_review'
    AND NOT EXISTS (
      SELECT 1 FROM public.verification_requests vr
      WHERE vr.user_id  = uc.user_id
        AND vr.cycle_id = uc.cycle_id
        AND vr.status   = 'pending'
    );

  GET DIAGNOSTICS corrected_count = ROW_COUNT;

  IF corrected_count > 0 THEN
    RAISE NOTICE 'Correctif: % user_cycle(s) coincés en pending_review sans VR pending → reset en in_progress', corrected_count;
  ELSE
    RAISE NOTICE 'Aucun cycle coincé détecté. Base cohérente.';
  END IF;
END $$;

-- ─── Vérification post-migration ──────────────────────────────────────────
-- Exécuter ces requêtes dans SQL Editor pour confirmer :
--
-- 1. Confirmer que la fonction est mise à jour :
--    SELECT proname, prosrc FROM pg_proc WHERE proname = 'retract_verification_request';
--    → La source doit contenir "user_cycles" et "in_progress"
--
-- 2. Confirmer l'absence d'incohérences :
--    SELECT vr.user_id, vr.cycle_id, uc.status AS cycle_status
--    FROM verification_requests vr
--    JOIN user_cycles uc ON uc.user_id = vr.user_id AND uc.cycle_id = vr.cycle_id
--    WHERE vr.status = 'pending' AND uc.status != 'pending_review';
--    → Doit retourner 0 rows
--
-- 3. Confirmer l'absence de cycles coincés :
--    SELECT COUNT(*) FROM user_cycles uc
--    WHERE uc.status = 'pending_review'
--    AND NOT EXISTS (
--      SELECT 1 FROM verification_requests vr
--      WHERE vr.user_id = uc.user_id AND vr.cycle_id = uc.cycle_id AND vr.status = 'pending'
--    );
--    → Doit retourner 0

COMMIT;
