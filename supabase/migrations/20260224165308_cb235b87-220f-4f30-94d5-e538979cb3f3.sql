
-- CRITICAL FIX: get_user_status must return 'pending' for missing profiles, NOT 'active'
CREATE OR REPLACE FUNCTION public.get_user_status(_user_id uuid)
 RETURNS user_status
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT status FROM public.profiles WHERE user_id = _user_id),
    'pending'::user_status
  )
$$;

-- Create profile for sirgalileooo and ban them
INSERT INTO profiles (user_id, display_name, status)
VALUES ('1709feea-c4c8-44b1-bf0f-91a5bb6d3bf1', 'sirgalileooo', 'banned')
ON CONFLICT (user_id) DO UPDATE SET status = 'banned', banned_at = now();

-- Create profiles for known admin accounts that are missing profiles
-- hachemi.belkhamsa@gmail.com (main admin)
INSERT INTO profiles (user_id, display_name, status)
VALUES ('18427cd6-1aec-4984-a917-48dff44fa4d0', 'Hachemi', 'active')
ON CONFLICT (user_id) DO NOTHING;

-- clement.metery@gmail.com (admin)
INSERT INTO profiles (user_id, display_name, status)
VALUES ('b11409c1-3e5b-4339-95b3-25fffe090918', 'Clement', 'active')
ON CONFLICT (user_id) DO NOTHING;

-- clement.metery@icloud.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('a9b7ed7a-97af-4eb0-84ad-74ff1ae90294', 'Clement', 'active')
ON CONFLICT (user_id) DO NOTHING;

-- Ban all other profileless users (test accounts and unknowns)
-- test@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('faa0cc1a-f4e2-4042-8cb9-b9edf6091563', 'test', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- m@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('5d2a5e92-4e04-44ed-895d-347baa9f96a5', 'm', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- c@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('016e1fb1-6c1a-4c3d-838e-f8859c223ee7', 'c', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- j@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('8d4d00c9-7040-4e56-a253-e211302b559e', 'j', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- testing@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('3bf3b236-c333-4236-99bb-b584d95a37a5', 'testing', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- charles@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('e7804547-39d5-4c4a-a753-5a0118d87443', 'charles', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- dauptain.c@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('614988ca-fa19-4444-bd74-62cdc28d6859', 'dauptain', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- yassin.payet@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('1b541f52-22f8-419b-955b-ece5a18191c2', 'yassin', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- mateo.bottoms@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('ecf79841-63bb-43f8-9282-b892e99d3abc', 'mateo', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- p.bemhenni22@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('17a3dc88-1eca-4d82-9ac0-ee56bc6a63a3', 'bemhenni', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- sacha.delbouis@outlook.fr
INSERT INTO profiles (user_id, display_name, status)
VALUES ('3d4f4342-7f77-4b2f-a809-a0e6fa4634bb', 'sacha', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- fonteneautpro@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('37627c9b-71d5-4911-87dd-56e1a5dffd56', 'fonteneau', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- adrien.bulmanski@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('b287e0d6-0a48-43fc-9c32-ed6f95616fb8', 'adrien', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- capellari-s@live.fr
INSERT INTO profiles (user_id, display_name, status)
VALUES ('ce2c6f78-1d39-40a6-a52e-a61ea6817bdb', 'capellari', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- johnkleinpro@gmail.com
INSERT INTO profiles (user_id, display_name, status)
VALUES ('974dcb9a-427b-438e-9072-edc29abe7e11', 'johnklein', 'banned')
ON CONFLICT (user_id) DO NOTHING;

-- Strengthen can_user_access to also verify the user has at least one role
CREATE OR REPLACE FUNCTION public.can_user_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT public.get_user_status(auth.uid()) = 'active'
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
$$;

-- Add RLS policy: admins can also update EA requests (currently only setters and super_admins)
-- Already exists for admins on SELECT, adding for UPDATE
CREATE POLICY "Admins can update EA requests"
  ON public.early_access_requests
  FOR UPDATE
  USING (is_admin());
