
-- Create a function to check if user has institute role
CREATE OR REPLACE FUNCTION public.is_institute()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'institute')
$$;

-- Create a trigger function to cleanup early_access_settings when early_access role is removed
CREATE OR REPLACE FUNCTION public.cleanup_early_access_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.role = 'early_access' THEN
    DELETE FROM public.early_access_settings WHERE user_id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Create trigger on user_roles delete
DROP TRIGGER IF EXISTS on_early_access_role_removed ON public.user_roles;
CREATE TRIGGER on_early_access_role_removed
  AFTER DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_early_access_settings();

-- Update the leaderboard function to show "Membre Oracle" for non-institute users
CREATE OR REPLACE FUNCTION public.get_leaderboard_data()
RETURNS TABLE(user_id uuid, display_name text, success_count bigint, data_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles ur 
        WHERE ur.user_id = p.user_id AND ur.role = 'institute'
      ) THEN COALESCE(p.display_name, 'Anonyme')
      ELSE 'Membre Oracle'
    END as display_name,
    COALESCE(s.cnt, 0) as success_count,
    COALESCE(e.cnt, 0) as data_count
  FROM profiles p
  LEFT JOIN (
    SELECT us.user_id, COUNT(*) as cnt 
    FROM user_successes us 
    GROUP BY us.user_id
  ) s ON s.user_id = p.user_id
  LEFT JOIN (
    SELECT ue.user_id, COUNT(*) as cnt 
    FROM user_executions ue 
    GROUP BY ue.user_id
  ) e ON e.user_id = p.user_id
  WHERE COALESCE(s.cnt, 0) > 0 OR COALESCE(e.cnt, 0) > 0
  ORDER BY (COALESCE(s.cnt, 0) + COALESCE(e.cnt, 0)) DESC
  LIMIT 10;
$$;
