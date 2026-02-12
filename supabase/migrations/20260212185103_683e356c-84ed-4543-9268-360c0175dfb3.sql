
-- Add message and linked trade to user_successes
ALTER TABLE public.user_successes 
ADD COLUMN message text,
ADD COLUMN linked_trade_id uuid REFERENCES public.user_personal_trades(id) ON DELETE SET NULL;
