-- Add Oracle-matching fields to user_executions table
ALTER TABLE public.user_executions
ADD COLUMN IF NOT EXISTS entry_model text NULL,
ADD COLUMN IF NOT EXISTS direction_structure text NULL,
ADD COLUMN IF NOT EXISTS entry_timing text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.user_executions.entry_model IS 'Entry model used (e.g., BOS, MSS, OB, FVG, etc.)';
COMMENT ON COLUMN public.user_executions.direction_structure IS 'Market structure (Continuation or Retracement)';
COMMENT ON COLUMN public.user_executions.entry_timing IS 'Entry timing window (e.g., 7h-8h, 8h-9h, etc.)';