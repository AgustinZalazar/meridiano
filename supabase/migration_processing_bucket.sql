-- Private bucket for raw video uploads (server deletes after processing)
INSERT INTO storage.buckets (id, name, public)
VALUES ('processing', 'processing', false)
ON CONFLICT (id) DO NOTHING;

-- Studio members with write access can upload videos
CREATE POLICY "members_upload_processing" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'processing'
    AND EXISTS (
      SELECT 1 FROM studio_members sm
      WHERE sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'admin', 'member')
        AND (storage.objects.name LIKE sm.studio_id::text || '/%')
    )
  );

-- Studio members can read their own studio's videos
CREATE POLICY "members_read_processing" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'processing'
    AND EXISTS (
      SELECT 1 FROM studio_members sm
      WHERE sm.user_id = auth.uid()
        AND (storage.objects.name LIKE sm.studio_id::text || '/%')
    )
  );

-- Enable Realtime on reports table so the app can listen for status changes
ALTER PUBLICATION supabase_realtime ADD TABLE reports;
