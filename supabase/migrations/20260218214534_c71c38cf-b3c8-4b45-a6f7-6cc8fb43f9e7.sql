
-- Table for the featured trade content shown to EA users
-- Super admins configure this: either a screenshot with trade details or a video link
CREATE TABLE public.ea_featured_trade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL DEFAULT 'screenshot' CHECK (content_type IN ('screenshot', 'video')),
  image_path TEXT,
  video_url TEXT,
  direction TEXT,
  trade_date DATE,
  rr NUMERIC,
  entry_time TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ea_featured_trade ENABLE ROW LEVEL SECURITY;

-- Super admins can manage
CREATE POLICY "Super admins can manage EA featured trade"
  ON public.ea_featured_trade FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- EA users can view
CREATE POLICY "EA users can view featured trade"
  ON public.ea_featured_trade FOR SELECT
  USING (is_early_access());

-- Admins can view
CREATE POLICY "Admins can view featured trade"
  ON public.ea_featured_trade FOR SELECT
  USING (is_admin());
