
-- Table for super admins to store custom URLs per button per Early Access member
CREATE TABLE public.early_access_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  button_key TEXT NOT NULL,
  button_label TEXT NOT NULL DEFAULT '',
  button_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, button_key)
);

ALTER TABLE public.early_access_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all settings
CREATE POLICY "Super admins can view all EA settings" ON public.early_access_settings FOR SELECT USING (is_super_admin());
CREATE POLICY "Super admins can insert EA settings" ON public.early_access_settings FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "Super admins can update EA settings" ON public.early_access_settings FOR UPDATE USING (is_super_admin());
CREATE POLICY "Super admins can delete EA settings" ON public.early_access_settings FOR DELETE USING (is_super_admin());

-- EA users can read their own settings (to get their custom URLs)
CREATE POLICY "Users can view their own EA settings" ON public.early_access_settings FOR SELECT USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_early_access_settings_updated_at
  BEFORE UPDATE ON public.early_access_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
