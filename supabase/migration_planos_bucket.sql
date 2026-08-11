-- Storage bucket policies for 'planos' (private bucket)
-- Run after creating the bucket in the Supabase dashboard

CREATE POLICY "Miembros suben planos al storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'planos'
    AND is_project_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Miembros ven planos del storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'planos'
    AND is_project_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Admins eliminan planos del storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'planos'
    AND is_project_admin((storage.foldername(name))[1]::uuid)
  );
