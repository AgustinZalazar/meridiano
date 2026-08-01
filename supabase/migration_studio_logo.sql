-- Add logo_url to studios
ALTER TABLE studios ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Public bucket: logos are shown in reports (no auth needed to read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-logos', 'studio-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Only admins/owners can upload to their studio's folder
CREATE POLICY "admins_upload_logo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'studio-logos'
    AND EXISTS (
      SELECT 1 FROM studio_members sm
      WHERE sm.user_id = auth.uid()
        AND (sm.role = 'owner' OR sm.role = 'admin')
        AND (storage.objects.name LIKE sm.studio_id::text || '/%')
    )
  );

CREATE POLICY "admins_update_logo" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'studio-logos'
    AND EXISTS (
      SELECT 1 FROM studio_members sm
      WHERE sm.user_id = auth.uid()
        AND (sm.role = 'owner' OR sm.role = 'admin')
        AND (storage.objects.name LIKE sm.studio_id::text || '/%')
    )
  );

-- Anyone can read logos (needed for PDF export and external viewing)
CREATE POLICY "public_read_logo" ON storage.objects
  FOR SELECT USING (bucket_id = 'studio-logos');
