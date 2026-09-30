-- Add created_by to pending_items
ALTER TABLE pending_items
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Backfill from the report's created_by where source = 'ai'
UPDATE pending_items pi
SET    created_by = r.created_by
FROM   reports r
WHERE  pi.report_id = r.id
  AND  pi.created_by IS NULL
  AND  r.created_by IS NOT NULL;
