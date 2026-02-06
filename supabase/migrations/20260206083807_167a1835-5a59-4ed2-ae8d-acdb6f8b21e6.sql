
-- Add a separate first_name column to profiles
ALTER TABLE public.profiles ADD COLUMN first_name TEXT;

-- Update the handle_new_user trigger to also store first_name from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, first_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'display_name'
  );
  RETURN NEW;
END;
$function$;
