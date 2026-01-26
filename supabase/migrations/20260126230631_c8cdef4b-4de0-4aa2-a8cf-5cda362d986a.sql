-- Table for user-entered execution data (separate from master verification trades)
CREATE TABLE public.user_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trade_number INTEGER NOT NULL,
  trade_date DATE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('Long', 'Short')),
  entry_time TEXT,
  exit_time TEXT,
  entry_price NUMERIC,
  exit_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  rr NUMERIC,
  result TEXT CHECK (result IN ('Win', 'Loss', 'BE')),
  setup_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trade_number)
);

-- Enable RLS
ALTER TABLE public.user_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own executions"
ON public.user_executions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own executions"
ON public.user_executions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own executions"
ON public.user_executions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own executions"
ON public.user_executions
FOR DELETE
USING (auth.uid() = user_id);

-- Admin can view all executions for verification
CREATE POLICY "Admins can view all executions"
ON public.user_executions
FOR SELECT
USING (public.is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_user_executions_updated_at
BEFORE UPDATE ON public.user_executions
FOR EACH ROW
EXECUTE FUNCTION public.update_user_cycles_updated_at();