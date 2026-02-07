
-- Add new columns for dual screenshots and chart link
ALTER TABLE public.user_personal_trades ADD COLUMN IF NOT EXISTS screenshot_context_url TEXT;
ALTER TABLE public.user_personal_trades ADD COLUMN IF NOT EXISTS screenshot_entry_url TEXT;
ALTER TABLE public.user_personal_trades ADD COLUMN IF NOT EXISTS chart_link TEXT;
