-- Create storage bucket for trade screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-screenshots', 'trade-screenshots', true);

-- Allow authenticated users to view screenshots
CREATE POLICY "Trade screenshots are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'trade-screenshots');

-- Allow authenticated users to upload screenshots
CREATE POLICY "Authenticated users can upload screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'trade-screenshots' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their screenshots
CREATE POLICY "Authenticated users can update screenshots"
ON storage.objects FOR UPDATE
USING (bucket_id = 'trade-screenshots' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete screenshots
CREATE POLICY "Authenticated users can delete screenshots"
ON storage.objects FOR DELETE
USING (bucket_id = 'trade-screenshots' AND auth.role() = 'authenticated');