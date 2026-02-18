
-- Add new columns to trades table
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS sl_placement text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS tp_placement text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS context_timeframe text;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_timeframe text;

-- Add new columns to user_executions table
ALTER TABLE public.user_executions ADD COLUMN IF NOT EXISTS sl_placement text;
ALTER TABLE public.user_executions ADD COLUMN IF NOT EXISTS tp_placement text;
ALTER TABLE public.user_executions ADD COLUMN IF NOT EXISTS context_timeframe text;

-- Add new columns to user_personal_trades table
ALTER TABLE public.user_personal_trades ADD COLUMN IF NOT EXISTS sl_placement text;
ALTER TABLE public.user_personal_trades ADD COLUMN IF NOT EXISTS tp_placement text;
ALTER TABLE public.user_personal_trades ADD COLUMN IF NOT EXISTS context_timeframe text;

-- Allow admins to update ALL trades (for Data Générale editing)
CREATE POLICY "Admins can update all trades"
ON public.trades
FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());
