-- ============================================================
-- Meridiano — Informe del día schema
-- ============================================================

-- 1. Extend report_status enum with daily-report states
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'abierto';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'cerrado';

-- 2. Add date column to reports (day the report belongs to)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS date date;

-- 3. report_media: individual media items added to a daily report
CREATE TABLE IF NOT EXISTS report_media (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid        NOT NULL REFERENCES reports ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('foto', 'video')),
  uri         text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by report
CREATE INDEX IF NOT EXISTS report_media_report_id_idx ON report_media (report_id);

-- 4. RLS
ALTER TABLE report_media ENABLE ROW LEVEL SECURITY;

-- Project members can read/write media for their reports
CREATE POLICY "report_media_select" ON report_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reports r
      JOIN project_members pm ON pm.project_id = r.project_id
      WHERE r.id = report_media.report_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "report_media_insert" ON report_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reports r
      JOIN project_members pm ON pm.project_id = r.project_id
      WHERE r.id = report_media.report_id
        AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "report_media_delete" ON report_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM reports r
      JOIN project_members pm ON pm.project_id = r.project_id
      WHERE r.id = report_media.report_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin', 'member')
    )
  );
