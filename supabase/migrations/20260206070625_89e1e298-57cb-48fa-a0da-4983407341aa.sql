
-- Table to track which of the 15 first trades have been analyzed and understood
CREATE TABLE public.user_trade_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trade_number INTEGER NOT NULL,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trade_number)
);

-- Table to track one-time quest flags (e.g., FX Replay connected)
CREATE TABLE public.user_quest_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  flag_key TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, flag_key)
);

-- Enable RLS
ALTER TABLE public.user_trade_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quest_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_trade_analyses
CREATE POLICY "Users can view their own trade analyses"
ON public.user_trade_analyses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade analyses"
ON public.user_trade_analyses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trade analyses"
ON public.user_trade_analyses FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for user_quest_flags
CREATE POLICY "Users can view their own quest flags"
ON public.user_quest_flags FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quest flags"
ON public.user_quest_flags FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quest flags"
ON public.user_quest_flags FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all (for admin panel)
CREATE POLICY "Admins can view all trade analyses"
ON public.user_trade_analyses FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can view all quest flags"
ON public.user_quest_flags FOR SELECT
USING (public.is_admin());

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_trade_analyses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_quest_flags;
