-- Migration: add contacted_at to early_access_requests
-- Records the exact timestamp when a setter first contacted a lead.
-- Distinct from contacted (boolean) and derniere_interaction (last touch).

ALTER TABLE early_access_requests
  ADD COLUMN IF NOT EXISTS contacted_at TIMESTAMPTZ;

-- Backfill: if contacted=true but contacted_at is null, use created_at as a safe fallback
-- (better than null, acknowledges we don't know the exact date)
UPDATE early_access_requests
SET contacted_at = created_at
WHERE contacted = true AND contacted_at IS NULL;

COMMENT ON COLUMN early_access_requests.contacted_at IS
  'First contact timestamp by setter (WA / email). Set once, never overwritten.';
