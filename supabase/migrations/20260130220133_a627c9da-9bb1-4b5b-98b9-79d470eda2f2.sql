-- Make trade-screenshots bucket private to prevent public access
UPDATE storage.buckets 
SET public = false 
WHERE id = 'trade-screenshots';

-- Add RLS policies for storage.objects to ensure users can only access their own files
-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload their own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all screenshots" ON storage.objects;

-- Allow users to upload to their own folder
CREATE POLICY "Users can upload their own screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trade-screenshots' 
  AND auth.uid() IS NOT NULL
  AND (
    -- User files are stored in {user_id}/ folder
    (storage.foldername(name))[1] = auth.uid()::text
    -- OR admin uploading to oracle/ folder
    OR (is_admin() AND (storage.foldername(name))[1] = 'oracle')
  )
);

-- Allow users to view their own screenshots
CREATE POLICY "Users can view their own screenshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins to view all screenshots (for verification)
CREATE POLICY "Admins can view all screenshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trade-screenshots'
  AND is_admin()
);

-- Allow users to update their own screenshots
CREATE POLICY "Users can update their own screenshots"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own screenshots
CREATE POLICY "Users can delete their own screenshots"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trade-screenshots'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);