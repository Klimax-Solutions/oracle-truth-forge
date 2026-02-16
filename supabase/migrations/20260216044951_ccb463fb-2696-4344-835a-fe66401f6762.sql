
-- Fix: exclude onboarding trades (1-15) from the max date calculation
-- so only real harvest trades control Oracle visibility
DROP POLICY IF EXISTS "Users can view trades based on execution progress" ON public.trades;

CREATE POLICY "Users can view trades based on execution progress" 
ON public.trades 
FOR SELECT 
USING (
  is_admin() 
  OR is_early_access() 
  OR (trade_number <= 15) 
  OR (trade_date <= (
    SELECT COALESCE(MAX(ue.trade_date), '1900-01-01'::date) 
    FROM user_executions ue 
    WHERE ue.user_id = auth.uid() 
      AND ue.trade_number > 15
  ))
);
