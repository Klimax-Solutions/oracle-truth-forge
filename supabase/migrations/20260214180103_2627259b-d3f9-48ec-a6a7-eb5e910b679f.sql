
-- Create results table for super_admin to upload result screenshots
CREATE TABLE public.results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  image_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view results
CREATE POLICY "Authenticated users can view results"
ON public.results FOR SELECT TO authenticated USING (true);

-- Only super_admins can insert/update/delete
CREATE POLICY "Super admins can insert results"
ON public.results FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update results"
ON public.results FOR UPDATE TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can delete results"
ON public.results FOR DELETE TO authenticated
USING (public.is_super_admin());

-- Create storage bucket for result screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('result-screenshots', 'result-screenshots', false);

-- Storage policies
CREATE POLICY "Authenticated can view result screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'result-screenshots');

CREATE POLICY "Super admins can upload result screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'result-screenshots' AND public.is_super_admin());

CREATE POLICY "Super admins can delete result screenshots"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'result-screenshots' AND public.is_super_admin());
