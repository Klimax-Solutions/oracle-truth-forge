
-- Add missing columns to user_executions for form parity
ALTER TABLE public.user_executions ADD COLUMN IF NOT EXISTS stop_loss_size text;
ALTER TABLE public.user_executions ADD COLUMN IF NOT EXISTS news_day boolean DEFAULT false;
ALTER TABLE public.user_executions ADD COLUMN IF NOT EXISTS news_label text;
