-- Add avatar_url to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Public bucket for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload/update their own avatar (path: {user_id}/avatar.*)
CREATE POLICY "users_upload_avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.objects.name LIKE auth.uid()::text || '/%')
  );

CREATE POLICY "users_update_avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.objects.name LIKE auth.uid()::text || '/%')
  );

-- Anyone can read avatars
CREATE POLICY "public_read_avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- RPC to delete the currently signed-in user (called from client)
-- Security: DEFINER so it runs with elevated privileges; validates auth.uid() itself
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Allow any authenticated user to call this on their own account
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
