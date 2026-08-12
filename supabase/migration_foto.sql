-- Add foto_url column to reports (for foto mode)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS foto_url text;
