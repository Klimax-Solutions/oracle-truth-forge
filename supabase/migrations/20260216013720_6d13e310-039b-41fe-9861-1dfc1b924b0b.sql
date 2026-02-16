
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all trades" ON public.trades;

-- Create a new policy that restricts trades based on user cycle progression
-- Users can see trades for cycles they have unlocked (in_progress, pending_review, validated)
-- Ébauche (cycle 0) gives access to first 15 trades for all members
-- Admins/super_admins see everything via their existing policies
CREATE POLICY "Users can view trades based on cycle progress"
ON public.trades
FOR SELECT
USING (
  -- Admins see everything
  is_admin()
  OR
  -- Early access users see all trades (blurred after 50 handled in frontend)
  is_early_access()
  OR
  -- Regular users: check their cycle progress
  EXISTS (
    SELECT 1 
    FROM user_cycles uc
    JOIN cycles c ON c.id = uc.cycle_id
    WHERE uc.user_id = auth.uid()
      AND uc.status IN ('in_progress', 'pending_review', 'validated')
      AND trades.trade_number >= c.trade_start
      AND trades.trade_number <= c.trade_end
  )
);
