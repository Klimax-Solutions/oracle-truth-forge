
-- SECURITY: Trigger to enforce that ONLY admin/super_admin can modify user_roles
-- This is a backend safeguard on top of RLS policies
CREATE OR REPLACE FUNCTION public.enforce_role_change_by_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow role changes by admin or super_admin
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or super_admin can modify roles';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger on INSERT and UPDATE for user_roles
DROP TRIGGER IF EXISTS trg_enforce_role_change ON public.user_roles;
CREATE TRIGGER trg_enforce_role_change
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_role_change_by_admin();

-- Also protect DELETE
CREATE OR REPLACE FUNCTION public.enforce_role_delete_by_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or super_admin can delete roles';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_role_delete ON public.user_roles;
CREATE TRIGGER trg_enforce_role_delete
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_role_delete_by_admin();

-- SECURITY: Trigger to enforce profile creation always starts as 'pending'
-- Prevents bypass of approval flow
CREATE OR REPLACE FUNCTION public.enforce_pending_status_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If not called by admin, force status to pending on INSERT
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pending_profile ON public.profiles;
CREATE TRIGGER trg_enforce_pending_profile
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pending_status_on_create();

-- SECURITY: Prevent non-admins from changing profile status
CREATE OR REPLACE FUNCTION public.enforce_status_update_by_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If status is being changed and caller is not admin, reject
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only admin or super_admin can change profile status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_status_update ON public.profiles;
CREATE TRIGGER trg_enforce_status_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_status_update_by_admin();

-- Update RLS: ensure admins can also INSERT/UPDATE/DELETE roles (not just super_admins)
CREATE POLICY "Admins can insert roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update roles"
  ON public.user_roles
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete roles"
  ON public.user_roles
  FOR DELETE
  USING (is_admin());
