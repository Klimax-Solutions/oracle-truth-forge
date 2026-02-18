-- Add supplementary_note column to admin_trade_notes for additional notes beyond validation/refusal justification
ALTER TABLE public.admin_trade_notes ADD COLUMN supplementary_note text DEFAULT NULL;

-- Add unique constraint on verification_request_id + execution_id if not exists (needed for upsert)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_trade_notes_request_execution_unique'
  ) THEN
    ALTER TABLE public.admin_trade_notes 
      ADD CONSTRAINT admin_trade_notes_request_execution_unique 
      UNIQUE (verification_request_id, execution_id);
  END IF;
END $$;