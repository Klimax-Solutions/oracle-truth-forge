-- P6 — AUCUN AUTO-VALIDATE (décision actée 2026-04-30)
-- check_cycle_accuracy_and_auto_validate devient une fonction READ-ONLY
-- Elle calcule et retourne l'accuracy mais ne change PLUS aucun statut
-- Raison : tout cycle doit passer par un admin humain, sans exception
-- Voir slice-D-spec-produit-2026-04-30.md §6

CREATE OR REPLACE FUNCTION public.check_cycle_accuracy_and_auto_validate(
  p_user_id uuid,
  p_cycle_id uuid,
  p_user_cycle_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cycle RECORD;
  v_total_executions integer;
  v_matching_count integer;
  v_accuracy numeric;
BEGIN
  SELECT trade_start, trade_end, total_trades, cycle_number
  INTO v_cycle
  FROM cycles
  WHERE id = p_cycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found';
  END IF;

  -- Ébauche (cycle 0) : accuracy non calculée, toujours admin review
  IF v_cycle.cycle_number = 0 THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)
  INTO v_total_executions
  FROM user_executions
  WHERE user_id = p_user_id
    AND trade_number >= v_cycle.trade_start
    AND trade_number <= v_cycle.trade_end;

  IF v_total_executions = 0 THEN
    RETURN 0;
  END IF;

  -- Calcul accuracy : trades dont la date/heure correspond à ±5h du trade Oracle de référence
  SELECT COUNT(*)
  INTO v_matching_count
  FROM user_executions ue
  INNER JOIN trades t ON t.trade_number = ue.trade_number
  WHERE ue.user_id = p_user_id
    AND ue.trade_number >= v_cycle.trade_start
    AND ue.trade_number <= v_cycle.trade_end
    AND ABS(
      EXTRACT(EPOCH FROM (
        (ue.trade_date || 'T' || COALESCE(ue.entry_time, '00:00') || ':00')::timestamp
        -
        (t.trade_date || 'T' || COALESCE(t.entry_time, '00:00') || ':00')::timestamp
      ))
    ) / 3600.0 <= 5;

  v_accuracy := (v_matching_count::numeric / v_total_executions::numeric) * 100;

  -- P6 : AUCUNE action de validation ici, quelle que soit l'accuracy
  -- L'accuracy est retournée pour information uniquement (affichage au user + admin)
  -- La validation est EXCLUSIVEMENT du ressort d'un admin humain via GestionPanel

  RETURN v_accuracy;
END;
$function$;
