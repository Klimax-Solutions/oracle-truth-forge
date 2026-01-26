-- Rename existing screenshot_url to screenshot_m15_m5 for macro context
ALTER TABLE public.trades RENAME COLUMN screenshot_url TO screenshot_m15_m5;

-- Add new column for M1 entry screenshot
ALTER TABLE public.trades ADD COLUMN screenshot_m1 text;