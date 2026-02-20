
-- Drop the old restrictive CHECK constraint on variable_type
ALTER TABLE public.user_custom_variables 
DROP CONSTRAINT user_custom_variables_variable_type_check;

-- Add an updated CHECK constraint that includes sl_placement, tp_placement, entry_timeframe
ALTER TABLE public.user_custom_variables
ADD CONSTRAINT user_custom_variables_variable_type_check 
CHECK (variable_type = ANY (ARRAY[
  'direction_structure'::text,
  'setup_type'::text,
  'entry_model'::text,
  'entry_timing'::text,
  'entry_timeframe'::text,
  'sl_placement'::text,
  'tp_placement'::text
]));
