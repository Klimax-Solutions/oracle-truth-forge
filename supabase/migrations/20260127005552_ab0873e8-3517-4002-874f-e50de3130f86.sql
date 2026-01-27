-- Create user status enum
CREATE TYPE public.user_status AS ENUM ('active', 'frozen', 'banned');

-- Add status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN status user_status NOT NULL DEFAULT 'active';

-- Add frozen_at, banned_at, frozen_by, banned_by columns for tracking
ALTER TABLE public.profiles
ADD COLUMN frozen_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN banned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN frozen_by UUID REFERENCES auth.users(id),
ADD COLUMN banned_by UUID REFERENCES auth.users(id),
ADD COLUMN status_reason TEXT;

-- Update RLS policy for profiles to allow admin updates
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin());

-- Create function to check if user is frozen or banned
CREATE OR REPLACE FUNCTION public.get_user_status(_user_id uuid)
RETURNS user_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status FROM public.profiles WHERE user_id = _user_id),
    'active'::user_status
  )
$$;

-- Create function to check if current user can access (not frozen or banned)
CREATE OR REPLACE FUNCTION public.can_user_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_status(auth.uid()) = 'active'
$$;