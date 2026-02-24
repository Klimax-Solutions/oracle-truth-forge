
ALTER TABLE public.early_access_requests
  ADD COLUMN IF NOT EXISTS contacted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_method text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS form_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_booked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_done boolean NOT NULL DEFAULT false;
