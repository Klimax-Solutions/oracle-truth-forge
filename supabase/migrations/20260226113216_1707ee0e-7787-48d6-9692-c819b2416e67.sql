-- Add user_id column to early_access_requests for direct matching
ALTER TABLE public.early_access_requests ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill existing approved requests with user_ids from auth.users
UPDATE public.early_access_requests r
SET user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(r.email)
  AND r.status = 'approuvée'
  AND r.user_id IS NULL;