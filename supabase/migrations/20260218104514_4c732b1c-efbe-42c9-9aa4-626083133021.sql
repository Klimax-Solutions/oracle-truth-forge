
-- Add trade_duration column to user_executions
ALTER TABLE public.user_executions ADD COLUMN IF NOT EXISTS trade_duration text;
