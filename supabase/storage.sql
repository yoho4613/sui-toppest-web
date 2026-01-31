-- =====================================================
-- Supabase Storage Setup for Toppest
-- =====================================================

-- Create avatars bucket (public access for reading)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to avatars
CREATE POLICY "Public read access for avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow authenticated uploads (service role)
CREATE POLICY "Service role upload access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

-- Allow service role to update/delete
CREATE POLICY "Service role update access"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');

CREATE POLICY "Service role delete access"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars');
