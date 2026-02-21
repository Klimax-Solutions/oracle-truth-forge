
CREATE TABLE public.bonus_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  embed_code TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_videos ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view bonus videos
CREATE POLICY "Authenticated users can view bonus videos"
  ON public.bonus_videos FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Super admins can manage bonus videos
CREATE POLICY "Super admins can insert bonus videos"
  ON public.bonus_videos FOR INSERT
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update bonus videos"
  ON public.bonus_videos FOR UPDATE
  USING (is_super_admin());

CREATE POLICY "Super admins can delete bonus videos"
  ON public.bonus_videos FOR DELETE
  USING (is_super_admin());
