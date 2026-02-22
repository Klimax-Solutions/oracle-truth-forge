
-- Table to track EA members' current active tab and button clicks
CREATE TABLE public.ea_activity_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  active_tab text DEFAULT NULL,
  last_heartbeat timestamptz DEFAULT now(),
  button_clicks jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.ea_activity_tracking ENABLE ROW LEVEL SECURITY;

-- Users can upsert their own tracking
CREATE POLICY "Users can insert their own tracking" ON public.ea_activity_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracking" ON public.ea_activity_tracking
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own tracking" ON public.ea_activity_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all tracking" ON public.ea_activity_tracking
  FOR SELECT USING (is_admin());
