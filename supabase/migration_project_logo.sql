-- Add logo_url column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url text;
