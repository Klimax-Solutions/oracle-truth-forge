-- Add 'closer' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'closer';

-- Add is_closer() RPC function
CREATE OR REPLACE FUNCTION public.is_closer()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'closer'
  )
$$;

-- Update lead_comments RLS to include closer
DROP POLICY IF EXISTS "Setters can manage own comments" ON public.lead_comments;
DROP POLICY IF EXISTS "Setters can view all comments" ON public.lead_comments;

CREATE POLICY "Setters and closers can manage own comments" ON public.lead_comments
  FOR ALL USING (
    (public.is_setter() OR public.is_closer()) AND author_id = auth.uid()
  );

CREATE POLICY "Setters and closers can view all comments" ON public.lead_comments
  FOR SELECT USING (public.is_setter() OR public.is_closer());

-- Update lead_events RLS to include closer
DROP POLICY IF EXISTS "Setters can view lead events" ON public.lead_events;
CREATE POLICY "Setters and closers can view lead events" ON public.lead_events
  FOR SELECT USING (public.is_setter() OR public.is_closer());

-- Grant closer access to early_access_requests
DROP POLICY IF EXISTS "Closers can view leads" ON public.early_access_requests;
DROP POLICY IF EXISTS "Closers can update call fields" ON public.early_access_requests;

CREATE POLICY "Closers can view leads" ON public.early_access_requests
  FOR SELECT USING (public.is_closer());

CREATE POLICY "Closers can update call fields" ON public.early_access_requests
  FOR UPDATE USING (public.is_closer())
  WITH CHECK (public.is_closer());
