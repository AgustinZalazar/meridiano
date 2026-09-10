-- ============================================================
-- Migration: hitos (checkpoints dentro de un rubro)
-- Pegar en Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS hitos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubro_id    uuid NOT NULL REFERENCES rubros(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  date        date,
  material_id uuid REFERENCES materials(id) ON DELETE SET NULL,
  qty_used    numeric,
  done        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hitos_rubro_id_idx ON hitos(rubro_id);

ALTER TABLE hitos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven hitos"
  ON hitos FOR SELECT TO authenticated
  USING (is_project_member(project_id));

CREATE POLICY "Miembros crean hitos"
  ON hitos FOR INSERT TO authenticated
  WITH CHECK (is_project_member(project_id));

CREATE POLICY "Miembros actualizan hitos"
  ON hitos FOR UPDATE TO authenticated
  USING (is_project_member(project_id));

CREATE POLICY "Miembros eliminan hitos"
  ON hitos FOR DELETE TO authenticated
  USING (is_project_member(project_id));
