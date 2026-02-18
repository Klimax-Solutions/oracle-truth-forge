
CREATE OR REPLACE FUNCTION public.add_complementary_trades_from_cycle(
  p_member_user_id uuid,
  p_cycle_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cycle RECORD;
  v_oracle_user_id uuid;
  v_next_trade_number integer;
  v_inserted integer := 0;
  v_exec RECORD;
  v_oracle_exists boolean;
  v_day_name text;
  v_days text[] := ARRAY['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
BEGIN
  -- Only admins can call this
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get cycle info
  SELECT trade_start, trade_end INTO v_cycle FROM cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Get the Oracle reference user (owner of existing trades)
  SELECT DISTINCT user_id INTO v_oracle_user_id FROM trades LIMIT 1;
  IF v_oracle_user_id IS NULL THEN RETURN 0; END IF;

  -- Get max trade_number for new entries
  SELECT COALESCE(MAX(trade_number), 0) INTO v_next_trade_number FROM trades;

  -- Loop through validated user executions with rr > 0
  FOR v_exec IN
    SELECT ue.*
    FROM user_executions ue
    WHERE ue.user_id = p_member_user_id
      AND ue.trade_number >= v_cycle.trade_start
      AND ue.trade_number <= v_cycle.trade_end
      AND (ue.rr IS NOT NULL AND ue.rr > 0)
    ORDER BY ue.trade_date
  LOOP
    -- Check if Oracle already has a trade on same date + same direction
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

      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;
