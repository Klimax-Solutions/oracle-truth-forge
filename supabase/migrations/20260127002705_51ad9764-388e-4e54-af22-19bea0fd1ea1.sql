-- Create a table for user follow-up tracking over 80 days
CREATE TABLE public.user_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 80),
  contact_date DATE NOT NULL,
  message_sent BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  correct_actions BOOLEAN DEFAULT false,
  call_done BOOLEAN DEFAULT false,
  notes TEXT,
  contacted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_number)
);

-- Enable RLS
ALTER TABLE public.user_followups ENABLE ROW LEVEL SECURITY;

-- Admins can view all followups
CREATE POLICY "Admins can view all followups"
  ON public.user_followups FOR SELECT
  USING (is_admin());

-- Admins can insert followups
CREATE POLICY "Admins can insert followups"
  ON public.user_followups FOR INSERT
  WITH CHECK (is_admin());

-- Admins can update followups
CREATE POLICY "Admins can update followups"
  ON public.user_followups FOR UPDATE
  USING (is_admin());

-- Admins can delete followups
CREATE POLICY "Admins can delete followups"
  ON public.user_followups FOR DELETE
  USING (is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_user_followups_updated_at
  BEFORE UPDATE ON public.user_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_cycles_updated_at();

-- Function to initialize followup entries for a user (every 3 days for 80 days = ~27 checkpoints)
CREATE OR REPLACE FUNCTION public.initialize_user_followups(p_user_id UUID, p_start_date DATE DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  day_num INTEGER;
BEGIN
  -- Create followup entries for days 1, 4, 7, 10... up to 80 (every 3 days)
  FOR day_num IN 1..80 BY 3 LOOP
    INSERT INTO user_followups (user_id, day_number, contact_date)
    VALUES (p_user_id, day_num, p_start_date + (day_num - 1))
    ON CONFLICT (user_id, day_number) DO NOTHING;
  END LOOP;
END;
$$;