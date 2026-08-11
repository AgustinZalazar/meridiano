-- Security fixes

-- H-2: increment_video_usage must verify studio membership before updating
CREATE OR REPLACE FUNCTION increment_video_usage(p_studio_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM studio_members
    WHERE studio_id = p_studio_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE studios
  SET videos_used_this_period = videos_used_this_period + 1
  WHERE id = p_studio_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- H-3: find_profile_by_email must require authenticated session
--      Revoke public execute, grant only to authenticated role
REVOKE ALL ON FUNCTION find_profile_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_profile_by_email(text) TO authenticated;

-- C-2: create_studio must always assign 'starter' plan regardless of client input
CREATE OR REPLACE FUNCTION create_studio(studio_name text, studio_plan text DEFAULT 'starter')
RETURNS uuid AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO studios (name, plan, created_by)
  VALUES (studio_name, 'starter', auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO studio_members (studio_id, user_id, role)
  VALUES (new_id, auth.uid(), 'owner');

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
