ALTER TABLE early_access_requests ADD COLUMN IF NOT EXISTS form_answers jsonb DEFAULT '{}';
