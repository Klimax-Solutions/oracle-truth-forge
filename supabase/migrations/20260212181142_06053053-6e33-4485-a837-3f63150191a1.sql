
-- Function to check accuracy and auto-validate a cycle
-- Returns: accuracy percentage (0-100). If >= 90, auto-validates the cycle.
CREATE OR REPLACE FUNCTION public.check_cycle_accuracy_and_auto_validate(
  p_user_id uuid,
  p_cycle_id uuid,
  p_user_cycle_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cycle RECORD;
  v_total_executions integer;
  v_matching_count integer;
  v_accuracy numeric;
BEGIN
  -- Get cycle details
  SELECT trade_start, trade_end, total_trades, cycle_number
  INTO v_cycle
  FROM cycles
  WHERE id = p_cycle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle not found';
  END IF;

  -- Skip auto-validation for ébauche (cycle 0)
  IF v_cycle.cycle_number = 0 THEN
    RETURN 0;
  END IF;

  -- Count user executions for this cycle
  SELECT COUNT(*)
  INTO v_total_executions
  FROM user_executions
  WHERE user_id = p_user_id
    AND trade_number >= v_cycle.trade_start
    AND trade_number <= v_cycle.trade_end;

  IF v_total_executions = 0 THEN
    RETURN 0;
  END IF;

  -- Count "matching" executions (within 5 hours of Oracle trade)
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

  -- Calculate accuracy
  v_accuracy := (v_matching_count::numeric / v_total_executions::numeric) * 100;

  -- If >= 90% accuracy, auto-validate
  IF v_accuracy >= 90 THEN
    -- Update user_cycle to validated
    UPDATE user_cycles
    SET status = 'validated',
        completed_at = now(),
        verified_at = now(),
        completed_trades = v_total_executions,
        admin_feedback = 'Auto-validé : ' || ROUND(v_accuracy, 1) || '% de précision'
    WHERE id = p_user_cycle_id
      AND user_id = p_user_id;

    -- Auto-approve the verification request
    UPDATE verification_requests
    SET status = 'approved',
        reviewed_at = now(),
        admin_comments = 'Auto-validé : ' || ROUND(v_accuracy, 1) || '% de précision (' || v_matching_count || '/' || v_total_executions || ' trades corrects)'
    WHERE user_cycle_id = p_user_cycle_id
      AND user_id = p_user_id
      AND status = 'pending';

    -- Unlock next cycle
    PERFORM unlock_next_cycle(p_user_id, v_cycle.cycle_number);
  END IF;

  RETURN v_accuracy;
END;
$$;
