-- Ensure anonymous funnel form submissions can INSERT into early_access_requests.
-- The original policy from 20260221033709 may have been dropped on TEST (mkog).
-- This migration is idempotent — safe to apply multiple times.

ALTER TABLE public.early_access_requests ENABLE ROW LEVEL SECURITY;

-- Drop any existing variants to avoid duplicates
DROP POLICY IF EXISTS "Anyone can submit EA requests" ON public.early_access_requests;
DROP POLICY IF EXISTS "Public funnel insert" ON public.early_access_requests;

-- Recreate the public insert policy.
-- Anti-spam is enforced application-side (honeypot, time-trap, rate-limit on email/hour).
CREATE POLICY "Public funnel insert"
  ON public.early_access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
