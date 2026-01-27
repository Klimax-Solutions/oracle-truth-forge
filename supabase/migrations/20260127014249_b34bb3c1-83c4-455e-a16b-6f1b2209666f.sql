-- Allow all authenticated users to view the first 15 reference trades (Ébauche phase)
CREATE POLICY "Authenticated users can view first 15 trades"
ON public.trades
FOR SELECT
TO authenticated
USING (trade_number <= 15);