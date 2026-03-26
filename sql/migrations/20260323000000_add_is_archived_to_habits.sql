-- Add is_archived column to habits table
ALTER TABLE habits ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
