
CREATE OR REPLACE FUNCTION public.check_cycle_accuracy_and_auto_validate(p_user_id uuid, p_cycle_id uuid, p_user_cycle_id uuid)
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
  v_oracle_user_id uuid;
  v_next_trade_number integer;
  v_exec RECORD;
  v_oracle_exists boolean;
  v_day_name text;
  v_days text[] := ARRAY['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
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

    -- Auto-add complementary trades to Data Générale
    SELECT DISTINCT user_id INTO v_oracle_user_id FROM trades LIMIT 1;
    IF v_oracle_user_id IS NOT NULL THEN
      SELECT COALESCE(MAX(trade_number), 0) INTO v_next_trade_number FROM trades;

      FOR v_exec IN
        SELECT ue.*
        FROM user_executions ue
        WHERE ue.user_id = p_user_id
          AND ue.trade_number >= v_cycle.trade_start
          AND ue.trade_number <= v_cycle.trade_end
          AND (ue.rr IS NOT NULL AND ue.rr > 0)
        ORDER BY ue.trade_date
      LOOP
        SELECT EXISTS(
          SELECT 1 FROM trades t
          WHERE t.trade_date = v_exec.trade_date
            AND LOWER(t.direction) = LOWER(v_exec.direction)
        ) INTO v_oracle_exists;

        IF NOT v_oracle_exists THEN
          v_next_trade_number := v_next_trade_number + 1;
          v_day_name := v_days[EXTRACT(DOW FROM v_exec.trade_date)::integer + 1];

          INSERT INTO trades (
            trade_number, trade_date, day_of_week, direction, direction_structure,
            entry_time, exit_time, rr, setup_type, entry_timing, entry_model,
            screenshot_m15_m5, screenshot_m1, user_id
          ) VALUES (
            v_next_trade_number,
            v_exec.trade_date,
            v_day_name,
            v_exec.direction,
            COALESCE(v_exec.direction_structure, ''),
            v_exec.entry_time,
            v_exec.exit_time,
            v_exec.rr,
            v_exec.setup_type,
            v_exec.entry_timing,
            v_exec.entry_model,
            v_exec.screenshot_url,
            v_exec.screenshot_entry_url,
            v_oracle_user_id
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN v_accuracy;
END;
$$;
