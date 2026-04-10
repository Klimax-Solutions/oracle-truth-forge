-- ============================================
-- CRM fields for pipeline management
-- Branch: crm-integration
-- Apply on DEV DB only (mkogljvoqqcnqrgcnfau)
-- DO NOT apply on Lovable Cloud
-- ============================================

ALTER TABLE public.early_access_requests
  ADD COLUMN IF NOT EXISTS setter_name text,
  ADD COLUMN IF NOT EXISTS call_outcome text,
  ADD COLUMN IF NOT EXISTS call_debrief text,
  ADD COLUMN IF NOT EXISTS call_no_show boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_amount text,
  ADD COLUMN IF NOT EXISTS checkout_unlocked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Update seed data to test all columns
UPDATE public.early_access_requests SET setter_name = 'Mimi' WHERE email IN ('thomas@test.com', 'lucas@test.com', 'julien@test.com', 'camille@test.com');
UPDATE public.early_access_requests SET setter_name = 'Saram' WHERE email IN ('marie@test.com', 'emma@test.com', 'hugo@test.com', 'lea@test.com');

UPDATE public.early_access_requests SET call_outcome = 'contracted', offer_amount = '2997€', checkout_unlocked = true, paid_amount = 2997, paid_at = now() WHERE email = 'julien@test.com';
UPDATE public.early_access_requests SET call_outcome = 'contracted', offer_amount = '4997€', checkout_unlocked = true, paid_amount = 4997, paid_at = now() WHERE email = 'camille@test.com';
UPDATE public.early_access_requests SET call_outcome = 'closing_in_progress', offer_amount = '2997€' WHERE email = 'hugo@test.com';
UPDATE public.early_access_requests SET call_outcome = 'not_closed' WHERE email = 'lea@test.com';
UPDATE public.early_access_requests SET call_no_show = true WHERE email = 'antoine@test.com';
