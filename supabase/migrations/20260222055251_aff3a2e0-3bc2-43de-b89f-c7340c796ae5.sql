
-- Add accessible_roles to videos table (for Oracle videos role-based access)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS accessible_roles text[] NOT NULL DEFAULT ARRAY['member', 'early_access', 'admin', 'super_admin'];

-- Add popup customization fields to ea_global_settings if not already present
-- (popup_title, popup_subtitle_precall, popup_subtitle_postcall, popup_next_steps_precall, popup_next_steps_postcall)
INSERT INTO public.ea_global_settings (setting_key, setting_value)
VALUES 
  ('popup_title', 'Accès Anticipé'),
  ('popup_subtitle_precall', 'Candidatez maintenant pour débloquer votre accès complet à Oracle'),
  ('popup_subtitle_postcall', 'Finalisez votre paiement pour débloquer votre accès complet à Oracle'),
  ('next_steps_precall', 'Candidatez dès maintenant pour rejoindre Oracle et accéder à toutes les fonctionnalités.'),
  ('next_steps_postcall', 'Finalisez votre inscription pour débloquer l''ensemble des outils Oracle.')
ON CONFLICT DO NOTHING;
