-- Add pre-call question field to early_access_requests
-- Filled by the lead on the FunnelFinal page after booking
ALTER TABLE public.early_access_requests ADD COLUMN IF NOT EXISTS precall_question text;
