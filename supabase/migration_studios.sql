-- Studios table
CREATE TABLE IF NOT EXISTS studios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  plan       text NOT NULL DEFAULT 'starter',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Studio members (reuses existing member_role enum)
CREATE TABLE IF NOT EXISTS studio_members (
  studio_id  uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       member_role NOT NULL DEFAULT 'member',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (studio_id, user_id)
);

-- Link projects to studio
ALTER TABLE projects ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES studios(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_see_studio" ON studios FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM studio_members WHERE studio_id = studios.id AND user_id = auth.uid()
  ));

CREATE POLICY "owner_update_studio" ON studios FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM studio_members
    WHERE studio_id = studios.id AND user_id = auth.uid() AND role = 'owner'
  ));

CREATE POLICY "auth_create_studio" ON studios FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "members_see_peers" ON studio_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM studio_members sm
    WHERE sm.studio_id = studio_members.studio_id AND sm.user_id = auth.uid()
  ));

CREATE POLICY "admins_invite" ON studio_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM studio_members sm
    WHERE sm.studio_id = studio_members.studio_id
      AND sm.user_id = auth.uid()
      AND sm.role IN ('owner', 'admin')
  ));

CREATE POLICY "admins_remove" ON studio_members FOR DELETE TO authenticated
  USING (
    role != 'owner'
    AND EXISTS (
      SELECT 1 FROM studio_members sm
      WHERE sm.studio_id = studio_members.studio_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'admin')
    )
  );

-- create_studio: SECURITY DEFINER so it can insert into studio_members atomically
CREATE OR REPLACE FUNCTION create_studio(studio_name text, studio_plan text DEFAULT 'starter')
RETURNS uuid AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO studios (name, plan, created_by)
  VALUES (studio_name, studio_plan, auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO studio_members (studio_id, user_id, role)
  VALUES (new_id, auth.uid(), 'owner');

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- find_profile_by_email: SECURITY DEFINER to access auth.users
CREATE OR REPLACE FUNCTION find_profile_by_email(p_email text)
RETURNS TABLE(id uuid, full_name text) AS $$
  SELECT p.id, p.full_name
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Update is_project_member to also match via studio membership
CREATE OR REPLACE FUNCTION is_project_member(p_project_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM projects pr
    JOIN studio_members sm ON sm.studio_id = pr.studio_id
    WHERE pr.id = p_project_id AND sm.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_project_admin(p_project_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM projects pr
    JOIN studio_members sm ON sm.studio_id = pr.studio_id
    WHERE pr.id = p_project_id AND sm.user_id = auth.uid() AND sm.role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Update project SELECT policy to include studio membership
DROP POLICY IF EXISTS "Miembros ven sus proyectos" ON projects;
CREATE POLICY "Miembros ven sus proyectos" ON projects FOR SELECT TO authenticated
  USING (
    is_project_member(id)
    OR (studio_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM studio_members
      WHERE studio_id = projects.studio_id AND user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Cualquier usuario autenticado crea proyectos" ON projects;
CREATE POLICY "Studio admins can create projects" ON projects FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      studio_id IS NULL
      OR EXISTS (
        SELECT 1 FROM studio_members
        WHERE studio_id = projects.studio_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    )
  );
