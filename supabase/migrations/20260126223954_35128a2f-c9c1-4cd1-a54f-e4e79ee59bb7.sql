-- Drop existing admin policies that reference auth.users
DROP POLICY IF EXISTS "Admins can view all user_cycles" ON public.user_cycles;
DROP POLICY IF EXISTS "Admins can update all user_cycles" ON public.user_cycles;
DROP POLICY IF EXISTS "Admins can view all verification requests" ON public.verification_requests;
DROP POLICY IF EXISTS "Admins can update verification requests" ON public.verification_requests;

-- Create a security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') = 'jules.philipon@gmail.com'
$$;

-- Recreate admin policies using the function
CREATE POLICY "Admins can view all user_cycles" 
ON public.user_cycles 
FOR SELECT 
USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admins can update all user_cycles" 
ON public.user_cycles 
FOR UPDATE 
USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admins can view all verification requests" 
ON public.verification_requests 
FOR SELECT 
USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Admins can update verification requests" 
ON public.verification_requests 
FOR UPDATE 
USING (public.is_admin());

-- Add DELETE policy for verification requests (admin only)
CREATE POLICY "Admins can delete verification requests"
ON public.verification_requests
FOR DELETE
USING (public.is_admin());

-- Create function to unlock next cycle after validation
CREATE OR REPLACE FUNCTION public.unlock_next_cycle(p_user_id UUID, p_current_cycle_number INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_cycle_id UUID;
BEGIN
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