
-- Create custom_setups table for admin-created setups
CREATE TABLE public.custom_setups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  assigned_to UUID,
  asset TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_setups ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can view all custom setups" ON public.custom_setups FOR SELECT USING (is_admin());
CREATE POLICY "Admins can insert custom setups" ON public.custom_setups FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update custom setups" ON public.custom_setups FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete custom setups" ON public.custom_setups FOR DELETE USING (is_admin());

-- Assigned users can view their setups
CREATE POLICY "Users can view their assigned setups" ON public.custom_setups FOR SELECT USING (auth.uid() = assigned_to);
-- Assigned users can update the name (rename)
CREATE POLICY "Users can update their assigned setups" ON public.custom_setups FOR UPDATE USING (auth.uid() = assigned_to);

-- Add custom_setup_id to user_personal_trades to link trades to custom setups
ALTER TABLE public.user_personal_trades ADD COLUMN IF NOT EXISTS custom_setup_id UUID REFERENCES public.custom_setups(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_custom_setups_updated_at
  BEFORE UPDATE ON public.custom_setups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
