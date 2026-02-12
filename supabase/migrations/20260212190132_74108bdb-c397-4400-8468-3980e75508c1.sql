
-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create avatars storage bucket (public for display)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Notifications table for @everyone and other mentions
CREATE TABLE public.user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sender_id uuid,
  type text NOT NULL DEFAULT 'mention',
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.user_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.user_notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.user_notifications FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications"
ON public.user_notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- Update get_leaderboard_data to include avatar_url
CREATE OR REPLACE FUNCTION public.get_leaderboard_data()
RETURNS TABLE(user_id uuid, display_name text, success_count bigint, data_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.user_id,
    COALESCE(p.display_name, 'Anonyme') as display_name,
    COALESCE(s.cnt, 0) as success_count,
    COALESCE(e.cnt, 0) as data_count
  FROM profiles p
  LEFT JOIN (
    SELECT us.user_id, COUNT(*) as cnt 
    FROM user_successes us 
    GROUP BY us.user_id
  ) s ON s.user_id = p.user_id
  LEFT JOIN (
    SELECT ue.user_id, COUNT(*) as cnt 
    FROM user_executions ue 
    GROUP BY ue.user_id
  ) e ON e.user_id = p.user_id
  WHERE COALESCE(s.cnt, 0) > 0 OR COALESCE(e.cnt, 0) > 0
  ORDER BY (COALESCE(s.cnt, 0) + COALESCE(e.cnt, 0)) DESC
  LIMIT 10;
$$;
