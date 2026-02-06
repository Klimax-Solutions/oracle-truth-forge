
-- Table for user success uploads (image-only feed)
CREATE TABLE public.user_successes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_successes ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view all successes
CREATE POLICY "Authenticated users can view all successes"
  ON public.user_successes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can insert their own successes
CREATE POLICY "Users can insert their own successes"
  ON public.user_successes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own successes
CREATE POLICY "Users can delete their own successes"
  ON public.user_successes FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for live feed updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_successes;

-- Storage bucket for success screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('success-screenshots', 'success-screenshots', false);

-- Storage RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload success screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'success-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage RLS: authenticated users can view all success screenshots
CREATE POLICY "Authenticated users can view success screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'success-screenshots' AND auth.uid() IS NOT NULL);

-- Storage RLS: users can delete their own success screenshots
CREATE POLICY "Users can delete own success screenshots"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'success-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
