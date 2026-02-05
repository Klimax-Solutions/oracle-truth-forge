-- Add exit_date column to user_personal_trades for multi-day trade support
ALTER TABLE public.user_personal_trades 
ADD COLUMN IF NOT EXISTS exit_date date;