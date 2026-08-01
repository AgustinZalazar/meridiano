-- Fix: members_see_peers is self-referential → PostgreSQL skips the recursive
-- subquery → EXISTS returns false → studios join fails → useStudio returns null.
-- Replace with a simple non-recursive policy.

DROP POLICY IF EXISTS "members_see_peers" ON studio_members;

-- Users can only see their own membership row (non-recursive, always works)
CREATE POLICY "members_see_own" ON studio_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- get_studio_members: SECURITY DEFINER bypasses RLS, manual auth check inside
CREATE OR REPLACE FUNCTION get_studio_members(p_studio_id uuid)
RETURNS TABLE(user_id uuid, role member_role, full_name text) AS $$
  SELECT sm.user_id, sm.role, p.full_name
  FROM public.studio_members sm
  JOIN public.profiles p ON p.id = sm.user_id
  WHERE sm.studio_id = p_studio_id
    AND EXISTS (
      SELECT 1 FROM public.studio_members caller
      WHERE caller.studio_id = p_studio_id AND caller.user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
