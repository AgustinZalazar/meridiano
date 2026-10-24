-- Add 'informe_dia' as a new source value to distinguish daily report items
ALTER TYPE pending_source ADD VALUE IF NOT EXISTS 'informe_dia';
