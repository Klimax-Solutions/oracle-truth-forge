-- Add booking_event_id to track Cal.com booking UIDs
-- Used for cancel/reschedule matching
-- Safe: nullable, IF NOT EXISTS, no impact on existing leads

ALTER TABLE early_access_requests
  ADD COLUMN IF NOT EXISTS booking_event_id text;

-- Index for fast lookup by booking UID
CREATE INDEX IF NOT EXISTS idx_ear_booking_event_id
  ON early_access_requests (booking_event_id)
  WHERE booking_event_id IS NOT NULL;
