-- Table des trades Oracle
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_number INTEGER NOT NULL,
  trade_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  direction TEXT NOT NULL,
  direction_structure TEXT,
  entry_time TEXT,
  exit_time TEXT,
  trade_duration TEXT,
  rr DECIMAL(10,2),
  stop_loss_size TEXT,
  stop_loss_points TEXT,
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read trades (public data)
CREATE POLICY "Trades are viewable by authenticated users"
  ON public.trades
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX idx_trades_trade_number ON public.trades(trade_number);
CREATE INDEX idx_trades_direction ON public.trades(direction);
CREATE INDEX idx_trades_setup_type ON public.trades(setup_type);