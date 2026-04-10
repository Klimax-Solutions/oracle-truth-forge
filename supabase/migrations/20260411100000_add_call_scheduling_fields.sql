-- Add call scheduling fields to early_access_requests for Agenda tab
-- These fields track when calls are scheduled and with which closer

ALTER TABLE public.early_access_requests
  ADD COLUMN IF NOT EXISTS call_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_scheduled_duration integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS closer_name text,
  ADD COLUMN IF NOT EXISTS call_meeting_url text,
  ADD COLUMN IF NOT EXISTS call_rescheduled_at timestamptz;
  -- call_debrief already added in 20260411000000_add_crm_fields.sql

-- Composite index for Agenda queries (call_booked + call_scheduled_at)
CREATE INDEX IF NOT EXISTS idx_ear_call_booked_scheduled
  ON public.early_access_requests (call_booked, call_scheduled_at)
  WHERE call_booked = true AND call_scheduled_at IS NOT NULL;

COMMENT ON COLUMN public.early_access_requests.call_scheduled_at IS 'When the call is/was scheduled (full timestamp)';
COMMENT ON COLUMN public.early_access_requests.call_scheduled_duration IS 'Call duration in minutes (default 30)';
COMMENT ON COLUMN public.early_access_requests.closer_name IS 'Name of the closer assigned to the call';
COMMENT ON COLUMN public.early_access_requests.call_meeting_url IS 'Meeting URL (Zoom, Cal.com, etc.)';
COMMENT ON COLUMN public.early_access_requests.call_rescheduled_at IS 'Original scheduled time if call was rescheduled';
