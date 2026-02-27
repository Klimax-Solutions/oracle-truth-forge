
-- 1. EA timer: add duration column and activation function
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS ea_timer_duration_minutes integer;

CREATE OR REPLACE FUNCTION activate_ea_timer()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE user_roles 
  SET expires_at = now() + (ea_timer_duration_minutes * interval '1 minute')
  WHERE user_id = auth.uid() 
    AND role = 'early_access' 
    AND expires_at IS NULL 
    AND ea_timer_duration_minutes IS NOT NULL;
END;
$$;

-- 2. Timezone on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Paris';

-- 3. Global settings for ébauche video
INSERT INTO ea_global_settings (setting_key, setting_value)
SELECT 'ebauche_video_embed', '' WHERE NOT EXISTS (SELECT 1 FROM ea_global_settings WHERE setting_key = 'ebauche_video_embed');

INSERT INTO ea_global_settings (setting_key, setting_value)
SELECT 'ebauche_video_title', 'Regardez cette vidéo pour entamer le protocole' WHERE NOT EXISTS (SELECT 1 FROM ea_global_settings WHERE setting_key = 'ebauche_video_title');

INSERT INTO ea_global_settings (setting_key, setting_value)
SELECT 'ebauche_action_label', 'Récolter mes 15 premières data' WHERE NOT EXISTS (SELECT 1 FROM ea_global_settings WHERE setting_key = 'ebauche_action_label');

INSERT INTO ea_global_settings (setting_key, setting_value)
SELECT 'ebauche_action_url', 'https://fxreplay.com' WHERE NOT EXISTS (SELECT 1 FROM ea_global_settings WHERE setting_key = 'ebauche_action_url');
