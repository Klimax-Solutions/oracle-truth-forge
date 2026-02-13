-- Allow all authenticated users to view basic profile info (display_name, avatar_url)
-- This fixes the "Anonyme" bug in the chat where non-admin users couldn't see other users' profiles
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);
