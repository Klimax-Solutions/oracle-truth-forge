
CREATE TABLE public.quest_step_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_role text NOT NULL,
  target_phase text NOT NULL DEFAULT 'default',
  step_order integer NOT NULL DEFAULT 0,
  step_label text NOT NULL DEFAULT '',
  step_description text,
  video_embed text,
  action_label text,
  action_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.quest_step_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quest configs" ON public.quest_step_configs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage quest configs" ON public.quest_step_configs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.quest_step_configs;
