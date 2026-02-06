
-- Create a security definer function to get leaderboard data
-- This allows all authenticated users to see aggregated counts without exposing individual data
CREATE OR REPLACE FUNCTION public.get_leaderboard_data()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  success_count BIGINT,
  data_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    COALESCE(p.display_name, 'Anonyme') as display_name,
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
