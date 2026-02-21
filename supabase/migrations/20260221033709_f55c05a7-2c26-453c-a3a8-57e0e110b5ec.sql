
-- Add early_access_type to user_roles (nullable, only relevant for early_access role)
ALTER TABLE public.user_roles ADD COLUMN early_access_type text;

-- Create early_access_requests table for public signup
CREATE TABLE public.early_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'en_attente',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

ALTER TABLE public.early_access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (public page, no auth required)
CREATE POLICY "Anyone can submit EA requests"
  ON public.early_access_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins can view
CREATE POLICY "Admins can view EA requests"
  ON public.early_access_requests FOR SELECT
  USING (is_admin());

-- Super admins can update (approve/reject)
CREATE POLICY "Super admins can update EA requests"
  ON public.early_access_requests FOR UPDATE
  USING (is_super_admin());

-- Super admins can delete
CREATE POLICY "Super admins can delete EA requests"
  ON public.early_access_requests FOR DELETE
  USING (is_super_admin());

-- Create ea_global_settings for universal precall URLs
CREATE TABLE public.ea_global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.ea_global_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read global settings (EA members need to read their button URLs)
CREATE POLICY "Authenticated can view global EA settings"
  ON public.ea_global_settings FOR SELECT
  TO authenticated
  USING (true);

-- Super admins can manage
CREATE POLICY "Super admins can manage global EA settings"
  ON public.ea_global_settings FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Seed the three precall button settings
INSERT INTO public.ea_global_settings (setting_key, setting_value) VALUES
  ('precall_continuer_ma_recolte', ''),
  ('precall_video_bonus_mercure_institut', ''),
  ('precall_acceder_a_oracle', '');
