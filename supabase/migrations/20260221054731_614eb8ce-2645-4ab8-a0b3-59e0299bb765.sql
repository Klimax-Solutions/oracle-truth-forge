CREATE POLICY "Users can delete their own created setups"
ON public.custom_setups
FOR DELETE
USING (auth.uid() = created_by);