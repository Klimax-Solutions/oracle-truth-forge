
-- Add result_date column to results table
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS result_date date;

-- Backfill: set result_date = created_at::date for existing rows
UPDATE public.results SET result_date = created_at::date WHERE result_date IS NULL;

-- Fix the enforce_role_change trigger to allow service role (auth.uid() IS NULL)
CREATE OR REPLACE FUNCTION public.enforce_role_change_by_admin()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow the default 'member' role to be auto-assigned (by handle_new_user_role trigger)
  IF TG_OP = 'INSERT' AND NEW.role = 'member' THEN
    RETURN NEW;
  END IF;
  
  -- Allow service role calls (auth.uid() is null when using service_role key, e.g. edge functions)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- For everything else, require admin or super_admin
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or super_admin can modify roles';
  END IF;
  RETURN NEW;
END;
$function$;

-- Same fix for role delete trigger
CREATE OR REPLACE FUNCTION public.enforce_role_delete_by_admin()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role calls
  IF auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;
  
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or super_admin can delete roles';
  END IF;
  RETURN OLD;
END;
$function$;

-- Same fix for pending profile trigger
CREATE OR REPLACE FUNCTION public.enforce_pending_status_on_create()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role calls
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$function$;

-- Same fix for status update trigger
CREATE OR REPLACE FUNCTION public.enforce_status_update_by_admin()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allow service role calls
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    
    IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'Unauthorized: only admin or super_admin can change profile status';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
