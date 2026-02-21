
ALTER TABLE public.bonus_videos 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'formation',
  ADD COLUMN IF NOT EXISTS accessible_roles text[] NOT NULL DEFAULT ARRAY['member', 'early_access', 'admin', 'super_admin']::text[];
