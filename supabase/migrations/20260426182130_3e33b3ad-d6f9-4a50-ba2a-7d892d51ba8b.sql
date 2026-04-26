CREATE OR REPLACE FUNCTION public.get_team_emails()
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_super_admin()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id AS user_id, u.email::text AS email
  FROM auth.users u;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_emails() TO authenticated;