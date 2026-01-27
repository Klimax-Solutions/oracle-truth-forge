-- Drop the old policy if it exists and recreate it properly
DROP POLICY IF EXISTS "Super admins can view all trades" ON public.trades;

-- Create the policy with explicit TO clause
CREATE POLICY "Super admins can view all trades"
ON public.trades
FOR SELECT
TO authenticated
USING (is_super_admin());