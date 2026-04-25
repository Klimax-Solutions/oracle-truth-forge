-- Migration: add call_done_at to early_access_requests
-- Records the exact timestamp when a closer marks the call as done.
-- Distinct from call_done (boolean) and call_scheduled_at (planned time).

ALTER TABLE early_access_requests
  ADD COLUMN IF NOT EXISTS call_done_at TIMESTAMPTZ;

COMMENT ON COLUMN early_access_requests.call_done_at IS
  'Timestamp when the closer toggled call_done=true. Set once by LeadDetailModal.';
