
-- Create is_setter() function
CREATE OR REPLACE FUNCTION public.is_setter()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'setter')
$$;

-- Create ea_lead_notes table
CREATE TABLE public.ea_lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  author_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ea_lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and setters can view ea_lead_notes"
  ON public.ea_lead_notes FOR SELECT
  USING (is_admin() OR is_setter());

CREATE POLICY "Admins and setters can insert ea_lead_notes"
  ON public.ea_lead_notes FOR INSERT
  WITH CHECK (is_admin() OR is_setter());

CREATE POLICY "Admins and setters can delete ea_lead_notes"
  ON public.ea_lead_notes FOR DELETE
  USING (is_admin() OR is_setter());

-- Setter RLS policies on existing tables
CREATE POLICY "Setters can view EA requests"
  ON public.early_access_requests FOR SELECT
  USING (is_setter());

CREATE POLICY "Setters can update EA requests"
  ON public.early_access_requests FOR UPDATE
  USING (is_setter());

CREATE POLICY "Setters can view all profiles"
  ON public.profiles FOR SELECT
  USING (is_setter());

CREATE POLICY "Setters can view all roles"
  ON public.user_roles FOR SELECT
  USING (is_setter());

CREATE POLICY "Setters can view all sessions"
  ON public.user_sessions FOR SELECT
  USING (is_setter());

CREATE POLICY "Setters can view all executions"
  ON public.user_executions FOR SELECT
  USING (is_setter());

CREATE POLICY "Setters can view all tracking"
  ON public.ea_activity_tracking FOR SELECT
  USING (is_setter());
