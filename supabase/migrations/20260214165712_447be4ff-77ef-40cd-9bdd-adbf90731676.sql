-- Create a helper function to check early_access role
CREATE OR REPLACE FUNCTION public.is_early_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'early_access')
$$;

-- Update trades RLS: early_access users can see first 50 trades
CREATE POLICY "Early access users can view first 50 trades"
  ON public.trades
  FOR SELECT
  USING (is_early_access() AND trade_number <= 50);