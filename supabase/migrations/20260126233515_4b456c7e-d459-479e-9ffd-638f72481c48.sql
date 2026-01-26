-- Add exit_date and screenshot_url columns to user_executions
ALTER TABLE public.user_executions 
ADD COLUMN IF NOT EXISTS exit_date date,
ADD COLUMN IF NOT EXISTS screenshot_url text;