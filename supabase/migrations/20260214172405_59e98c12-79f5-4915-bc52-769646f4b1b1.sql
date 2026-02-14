
-- Add expiration date column to user_roles for early_access countdown timer
ALTER TABLE public.user_roles ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.user_roles.expires_at IS 'Expiration timestamp for early_access role countdown timer, set per-user at role assignment';
