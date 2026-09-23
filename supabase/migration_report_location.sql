-- ============================================================
-- Meridiano — Add location field to reports
-- ============================================================

ALTER TABLE reports ADD COLUMN IF NOT EXISTS location text;

COMMENT ON COLUMN reports.location IS
  'Formatted location string, e.g. "Piso 3 · Depto 4B" or "Sector A · Módulo 2"';
