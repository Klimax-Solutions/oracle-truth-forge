-- Add new columns to user_personal_trades for extended trade data
ALTER TABLE public.user_personal_trades
ADD COLUMN IF NOT EXISTS entry_price numeric(15, 5),
ADD COLUMN IF NOT EXISTS exit_price numeric(15, 5),
ADD COLUMN IF NOT EXISTS stop_loss numeric(15, 5),
ADD COLUMN IF NOT EXISTS take_profit numeric(15, 5),
ADD COLUMN IF NOT EXISTS result text CHECK (result IN ('Win', 'Loss', 'BE'));