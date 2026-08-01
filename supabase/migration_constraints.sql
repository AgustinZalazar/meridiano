-- Enforce one studio per user at DB level
ALTER TABLE studio_members ADD CONSTRAINT one_studio_per_user UNIQUE (user_id);

-- Make create_studio idempotent: if user is already in a studio, return that studio's id
-- This handles the race condition when a pending invite is accepted at signup
CREATE OR REPLACE FUNCTION create_studio(studio_name text, studio_plan text DEFAULT 'starter')
RETURNS uuid AS $$
DECLARE
  new_id     uuid;
  existing_id uuid;
BEGIN
  SELECT studio_id INTO existing_id
  FROM studio_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO studios (name, plan, created_by)
  VALUES (studio_name, studio_plan, auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO studio_members (studio_id, user_id, role)
  VALUES (new_id, auth.uid(), 'owner');

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
