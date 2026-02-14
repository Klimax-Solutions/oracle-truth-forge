-- Drop the restrictive early access policy so early_access users can see ALL trades
-- The blur restriction will be handled purely in the UI (Oracle Database component)
DROP POLICY IF EXISTS "Early access users can view first 50 trades" ON public.trades;