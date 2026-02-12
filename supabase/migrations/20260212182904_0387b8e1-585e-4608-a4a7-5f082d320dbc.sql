
-- Add 'pending' to user_status enum
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'pending';

-- Create user_sessions table for single-device enforcement
CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  session_token uuid NOT NULL DEFAULT gen_random_uuid(),
  device_info text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own session
CREATE POLICY "Users can view their own session"
ON public.user_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Users can upsert their own session
CREATE POLICY "Users can insert their own session"
ON public.user_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session"
ON public.user_sessions FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
ON public.user_sessions FOR SELECT
USING (is_admin());

-- Super admins can delete sessions
CREATE POLICY "Super admins can delete sessions"
ON public.user_sessions FOR DELETE
USING (is_super_admin());

-- Update handle_new_user to set status='pending' for new accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, first_name, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'display_name',
    'pending'
  );
  RETURN NEW;
END;
$function$;

-- Update can_user_access to also block pending users
CREATE OR REPLACE FUNCTION public.can_user_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_user_status(auth.uid()) = 'active'
$function$;
