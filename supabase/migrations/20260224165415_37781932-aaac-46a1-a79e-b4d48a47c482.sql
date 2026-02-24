
-- FIX: Allow 'member' role auto-assignment on signup, but protect all other roles
CREATE OR REPLACE FUNCTION public.enforce_role_change_by_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow the default 'member' role to be auto-assigned (by handle_new_user_role trigger)
  IF TG_OP = 'INSERT' AND NEW.role = 'member' THEN
    RETURN NEW;
  END IF;
  
  -- For everything else, require admin or super_admin
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or super_admin can modify roles';
  END IF;
  RETURN NEW;
END;
$$;
