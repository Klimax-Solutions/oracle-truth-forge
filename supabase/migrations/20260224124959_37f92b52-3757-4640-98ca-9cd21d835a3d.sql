
-- Allow admins and setters to update ea_lead_notes
CREATE POLICY "Admins and setters can update ea_lead_notes"
ON public.ea_lead_notes
FOR UPDATE
USING (is_admin() OR is_setter())
WITH CHECK (is_admin() OR is_setter());
