-- Add user_id column to trades table
ALTER TABLE public.trades 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing trades to belong to the first authenticated user (if any exist)
-- This is safe for single-user apps, for multi-user you'd need manual assignment
UPDATE public.trades 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id NOT NULL after populating
ALTER TABLE public.trades 
ALTER COLUMN user_id SET NOT NULL;

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Trades are viewable by authenticated users" ON public.trades;

-- Create proper RLS policies for user-specific access
CREATE POLICY "Users can view their own trades"
ON public.trades
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades"
ON public.trades
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
ON public.trades
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades"
ON public.trades
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);