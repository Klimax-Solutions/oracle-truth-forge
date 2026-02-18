-- Allow early_access users to view all executions (read-only) for Data Générale
CREATE POLICY "Early access can view all executions"
ON public.user_executions
FOR SELECT
USING (is_early_access());
