-- Fix PUBLIC_DATA_EXPOSURE on profiles table
-- Remove the overly permissive policy that allows everyone to see all profiles

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a new restrictive policy: users can only view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Admins already have a policy to view all profiles via "Admins can update all profiles"
-- But we need a SELECT policy for admins too
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin());