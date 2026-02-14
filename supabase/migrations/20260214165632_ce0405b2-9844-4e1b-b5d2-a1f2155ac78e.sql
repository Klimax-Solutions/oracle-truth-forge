-- Add early_access to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'early_access';