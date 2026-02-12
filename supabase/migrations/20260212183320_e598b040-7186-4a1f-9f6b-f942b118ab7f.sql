
-- Drop the unique constraint on user_id to allow multiple devices
ALTER TABLE public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_id_key;

-- Add a unique constraint on user_id + device fingerprint
ALTER TABLE public.user_sessions ADD COLUMN device_fingerprint text;
ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_device_unique UNIQUE (user_id, device_fingerprint);

-- Create index for fast lookups
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions (user_id);

-- Create a security alerts table for admin visibility
CREATE TABLE public.security_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  alert_type text NOT NULL DEFAULT 'third_device',
  device_info text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all security alerts"
ON public.security_alerts FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can update security alerts"
ON public.security_alerts FOR UPDATE
USING (is_admin());

CREATE POLICY "Users can insert their own alerts"
ON public.security_alerts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own alerts"
ON public.security_alerts FOR SELECT
USING (auth.uid() = user_id);
