-- Add timestamp columns for pipeline timeline sync
-- Each stage of the funnel gets a date for the timeline
ALTER TABLE public.early_access_requests ADD COLUMN IF NOT EXISTS contacted_at timestamptz;
ALTER TABLE public.early_access_requests ADD COLUMN IF NOT EXISTS call_done_at timestamptz;
