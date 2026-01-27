-- Add custom_types table for user-defined variable types
CREATE TABLE public.user_variable_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type_key TEXT NOT NULL,
  type_label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, type_key)
);

-- Enable RLS
ALTER TABLE public.user_variable_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own variable types" 
ON public.user_variable_types 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own variable types" 
ON public.user_variable_types 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own variable types" 
ON public.user_variable_types 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own variable types" 
ON public.user_variable_types 
FOR DELETE 
USING (auth.uid() = user_id);