-- Add dedicated subtitle field for the Apply page VSL section
ALTER TABLE public.funnel_config ADD COLUMN IF NOT EXISTS apply_subtitle text DEFAULT '';
