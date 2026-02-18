
-- Add assigned_to column to verification_requests for pre-assigning an admin
ALTER TABLE public.verification_requests ADD COLUMN assigned_to uuid DEFAULT NULL;

-- Add asset column to user_personal_trades for tracking which asset a trade belongs to
ALTER TABLE public.user_personal_trades ADD COLUMN asset text DEFAULT NULL;
