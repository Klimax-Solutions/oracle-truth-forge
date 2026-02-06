
-- Create the update function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Table for storing videos (managed by super admins)
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  embed_url TEXT NOT NULL,
  open_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Table for tracking which videos users have watched
CREATE TABLE public.user_video_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_video_views ENABLE ROW LEVEL SECURITY;

-- Videos: everyone can read, super admins can CRUD
CREATE POLICY "Authenticated users can view videos"
ON public.videos FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can insert videos"
ON public.videos FOR INSERT
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update videos"
ON public.videos FOR UPDATE
USING (is_super_admin());

CREATE POLICY "Super admins can delete videos"
ON public.videos FOR DELETE
USING (is_super_admin());

-- Video views: users manage their own
CREATE POLICY "Users can view their own video views"
ON public.user_video_views FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own video views"
ON public.user_video_views FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video views"
ON public.user_video_views FOR DELETE
USING (auth.uid() = user_id);

-- Seed existing videos
INSERT INTO public.videos (title, description, embed_url, open_url, sort_order) VALUES
('Vidéo 1', 'Introduction au Setup Oracle', 'https://drive.google.com/file/d/10arf22qRiQYTvyVJ4c1U_nmp1CHL-MAb/preview', 'https://drive.google.com/file/d/10arf22qRiQYTvyVJ4c1U_nmp1CHL-MAb/view', 1),
('Vidéo 2', 'Approfondissement du Setup Oracle', 'https://drive.google.com/file/d/15xmlQWBHktdMBjp2OD_W9zWoTAiaNw0Y/preview', 'https://drive.google.com/file/d/15xmlQWBHktdMBjp2OD_W9zWoTAiaNw0Y/view', 2),
('Vidéo 3', 'Mise en pratique', 'https://drive.google.com/file/d/1unscbvtLd725xbkq0iOOjdBneER2e8F4/preview', 'https://drive.google.com/file/d/1unscbvtLd725xbkq0iOOjdBneER2e8F4/view', 3),
('Vidéo Finale', 'Conclusion et synthèse complète', 'https://drive.google.com/file/d/1B0ILsD0tBgwrEjWIz4Xhdl4HN4KCsR32/preview', 'https://drive.google.com/file/d/1B0ILsD0tBgwrEjWIz4Xhdl4HN4KCsR32/view', 4);

-- Trigger for updated_at
CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
