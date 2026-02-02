-- Add UPDATE policy for super admins on trades table
-- This allows super admins to update all Oracle trades, including screenshot paths
CREATE POLICY "Super admins can update all trades"
ON public.trades
FOR UPDATE
USING (is_super_admin())
WITH CHECK (is_super_admin());