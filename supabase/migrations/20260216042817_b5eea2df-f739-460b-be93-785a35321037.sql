
-- Drop the old cycle-based RLS policy
DROP POLICY IF EXISTS "Users can view trades based on cycle progress" ON public.trades;

-- Create new date-based RLS policy: unlock Oracle trades whose trade_date <= max trade_date of user's executions
-- Also keep the first 15 trades always visible (ébauche phase), admin/EA access
CREATE POLICY "Users can view trades based on execution progress"
ON public.trades
FOR SELECT
USING (
  is_admin() 
  OR is_early_access()
  OR trades.trade_number <= 15
  OR (
    trades.trade_date <= (
      SELECT COALESCE(MAX(ue.trade_date), '1900-01-01')
      FROM user_executions ue
      WHERE ue.user_id = auth.uid()
    )
  )
);
