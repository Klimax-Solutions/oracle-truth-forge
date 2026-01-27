-- Create table for personal user trades (Setup perso)
CREATE TABLE public.user_personal_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trade_number INTEGER NOT NULL,
  trade_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  direction TEXT NOT NULL,
  direction_structure TEXT,
  entry_time TEXT,
  exit_time TEXT,
  trade_duration TEXT,
  rr NUMERIC,
  stop_loss_size TEXT,
  setup_type TEXT,
  entry_timing TEXT,
  entry_model TEXT,
  target_timing TEXT,
  speculation_hl_valid BOOLEAN DEFAULT false,
  target_hl_valid BOOLEAN DEFAULT false,
  news_day BOOLEAN DEFAULT false,
  news_label TEXT,
  comment TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trade_number)
);

-- Enable RLS
ALTER TABLE public.user_personal_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own personal trades"
  ON public.user_personal_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personal trades"
  ON public.user_personal_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personal trades"
  ON public.user_personal_trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personal trades"
  ON public.user_personal_trades FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all for potential future features
CREATE POLICY "Admins can view all personal trades"
  ON public.user_personal_trades FOR SELECT
  USING (is_admin());