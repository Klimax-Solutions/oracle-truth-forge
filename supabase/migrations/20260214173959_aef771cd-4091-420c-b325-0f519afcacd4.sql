-- Drop the restrictive policy that limits authenticated users to 15 trades
DROP POLICY IF EXISTS "Authenticated users can view first 15 trades" ON public.trades;

-- Create a new policy allowing all authenticated users to view all trades
CREATE POLICY "Authenticated users can view all trades"
ON public.trades
FOR SELECT
TO authenticated
USING (true);