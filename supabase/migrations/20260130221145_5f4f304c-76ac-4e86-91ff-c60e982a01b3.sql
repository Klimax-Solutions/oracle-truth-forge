-- Fix SECURITY DEFINER functions to add proper authorization checks
-- This prevents privilege escalation by validating that callers can only modify their own data

-- Update initialize_user_cycles to check authorization
CREATE OR REPLACE FUNCTION public.initialize_user_cycles(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cycle_record RECORD;
BEGIN
  -- Authorization check: only allow for own user or admins
  IF p_user_id != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: cannot initialize cycles for other users';
  END IF;

  -- Check if user already has cycles initialized
  IF EXISTS (SELECT 1 FROM user_cycles WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;
  
  -- Initialize all cycles for the user
  FOR cycle_record IN SELECT id, cycle_number FROM cycles ORDER BY cycle_number LOOP
    INSERT INTO user_cycles (user_id, cycle_id, status)
    VALUES (
      p_user_id, 
      cycle_record.id, 
      CASE 
        WHEN cycle_record.cycle_number = 0 THEN 'in_progress'::cycle_status
        ELSE 'locked'::cycle_status
      END
    );
  END LOOP;
END;
$$;

-- Update unlock_next_cycle to check authorization (admin only)
CREATE OR REPLACE FUNCTION public.unlock_next_cycle(p_user_id uuid, p_current_cycle_number integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_cycle_id UUID;
BEGIN
  -- Authorization check: only admins can unlock cycles for users
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only admins can unlock cycles';
  END IF;

  -- Get the next cycle id
  SELECT id INTO next_cycle_id 
  FROM cycles 
  WHERE cycle_number = p_current_cycle_number + 1;
  
  -- If there's a next cycle, unlock it
  IF next_cycle_id IS NOT NULL THEN
    UPDATE user_cycles 
    SET status = 'in_progress', started_at = now()
    WHERE user_id = p_user_id AND cycle_id = next_cycle_id;
  END IF;
END;
$$;

-- Update initialize_user_followups to check authorization (admin only for creating followups)
CREATE OR REPLACE FUNCTION public.initialize_user_followups(p_user_id uuid, p_start_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  day_num INTEGER;
BEGIN
  -- Authorization check: only admins can initialize followups
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: only admins can initialize followups';
  END IF;

  -- Create followup entries for days 1, 4, 7, 10... up to 80 (every 3 days)
  FOR day_num IN 1..80 BY 3 LOOP
    INSERT INTO user_followups (user_id, day_number, contact_date)
    VALUES (p_user_id, day_num, p_start_date + (day_num - 1))
    ON CONFLICT (user_id, day_number) DO NOTHING;
  END LOOP;
END;
$$;