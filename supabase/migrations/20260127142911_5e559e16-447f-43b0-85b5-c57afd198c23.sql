-- Create table for user custom variables
CREATE TABLE public.user_custom_variables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  variable_type text NOT NULL CHECK (variable_type IN ('direction_structure', 'setup_type', 'entry_model', 'entry_timing')),
  variable_value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, variable_type, variable_value)
);

-- Enable RLS
ALTER TABLE public.user_custom_variables ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own variables"
  ON public.user_custom_variables FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own variables"
  ON public.user_custom_variables FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own variables"
  ON public.user_custom_variables FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own variables"
  ON public.user_custom_variables FOR DELETE
  USING (auth.uid() = user_id);