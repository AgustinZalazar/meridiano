-- Pending studio invites
CREATE TABLE IF NOT EXISTS studio_invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id  uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       member_role NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (studio_id, email)
);

ALTER TABLE studio_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_see_invites" ON studio_invites FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM studio_members
    WHERE studio_id = studio_invites.studio_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));

CREATE POLICY "admins_create_invites" ON studio_invites FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM studio_members
    WHERE studio_id = studio_invites.studio_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));

CREATE POLICY "admins_delete_invites" ON studio_invites FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM studio_members
    WHERE studio_id = studio_invites.studio_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ));

-- Update handle_new_user: after inserting profile, auto-join from pending invite
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  inv RECORD;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );

  SELECT * INTO inv
  FROM public.studio_invites
  WHERE lower(email) = lower(new.email)
    AND expires_at > now()
  LIMIT 1;

  IF inv.id IS NOT NULL THEN
    INSERT INTO public.studio_members (studio_id, user_id, role)
    VALUES (inv.studio_id, new.id, inv.role)
    ON CONFLICT DO NOTHING;

    DELETE FROM public.studio_invites WHERE id = inv.id;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
