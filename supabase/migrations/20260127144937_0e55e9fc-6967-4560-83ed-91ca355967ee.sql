-- Allow super admins to view all trades
CREATE POLICY "Super admins can view all trades"
ON public.trades
FOR SELECT
TO authenticated
USING (public.is_super_admin());