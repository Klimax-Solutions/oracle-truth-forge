-- ═══════════════════════════════════════════════════════════════════
-- Migration : retract_verification_request — GAP-03
--             Bloquer le retrait si l'admin a déjà commencé l'examen
-- Date      : 2026-04-30
-- Module    : Slice D — Cycle State Machine
-- Safe      : OUI — CREATE OR REPLACE, SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════════════
--
-- CONTEXTE :
--   Depuis GAP-05, quand l'admin sauvegarde sa première note admin_trade_note,
--   verification_requests.status passe de 'pending' → 'in_review'.
--   Côté user (OracleExecution.tsx), le bouton "Retirer" est déjà masqué
--   dès que vrStatusByCycle[cycle.id] !== 'pending'.
--   Cette migration ajoute la protection au niveau DB pour couvrir les cas
--   de race condition ou de stale state côté frontend.
--
-- COMPORTEMENT :
--   1. VR inexistante → RAISE EXCEPTION 'no_pending_vr'
--   2. VR en in_review ou on_hold → RAISE EXCEPTION 'admin_started'
--      (l'admin a commencé l'examen — le retrait est bloqué)
--   3. VR pending + admin_trade_notes déjà présentes → RAISE EXCEPTION 'notes_exist'
--      (double protection : notes existent mais status pas encore mis à jour)
--   4. VR pending + 0 notes → procède normalement (cancel + reset user_cycle)
--
-- IMPACT DATA : Zéro donnée perdue.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.retract_verification_request(p_cycle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vr_id     uuid;
  v_vr_status text;
  v_notes_cnt int;
BEGIN
  -- 1. Récupérer la VR active pour ce (user, cycle)
  SELECT id, status
  INTO v_vr_id, v_vr_status
  FROM public.verification_requests
  WHERE user_id  = auth.uid()
    AND cycle_id = p_cycle_id
    AND status   IN ('pending', 'in_review', 'on_hold')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_vr_id IS NULL THEN
    RAISE EXCEPTION 'no_pending_vr'
      USING MESSAGE = 'Aucune demande de vérification active trouvée pour ce cycle.';
  END IF;

  -- 2. GAP-03 : bloquer si l''admin a commencé l''examen (in_review / on_hold)
  IF v_vr_status IN ('in_review', 'on_hold') THEN
    RAISE EXCEPTION 'admin_started'
      USING MESSAGE = 'L''admin a déjà commencé l''examen de ce cycle. Le retrait n''est plus possible.';
  END IF;

  -- 3. Double protection : vérifier l''absence de notes admin même si status = 'pending'
  SELECT COUNT(*) INTO v_notes_cnt
  FROM public.admin_trade_notes
  WHERE verification_request_id = v_vr_id;

  IF v_notes_cnt > 0 THEN
    RAISE EXCEPTION 'notes_exist'
      USING MESSAGE = 'L''admin a déjà noté des trades pour ce cycle. Le retrait n''est plus possible.';
  END IF;

  -- 4. Tout est clean → annuler la VR
  UPDATE public.verification_requests
  SET
    status      = 'cancelled',
    reviewed_at = NOW()
  WHERE id = v_vr_id;

  -- 5. Reset le user_cycle → in_progress (atomique)
  UPDATE public.user_cycles
  SET
    status       = 'in_progress',
    completed_at = NULL
  WHERE user_id  = auth.uid()
    AND cycle_id = p_cycle_id
    AND status   = 'pending_review';

END;
$$;

-- ─── Vérification post-migration ──────────────────────────────────────────
-- SELECT prosrc FROM pg_proc WHERE proname = 'retract_verification_request';
-- → Doit contenir 'admin_started' et 'notes_exist'

COMMIT;
