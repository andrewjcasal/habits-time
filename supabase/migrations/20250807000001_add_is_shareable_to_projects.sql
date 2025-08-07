-- Add is_shareable column to projects table
ALTER TABLE projects ADD COLUMN is_shareable BOOLEAN DEFAULT FALSE;

-- Add comment to document the purpose
COMMENT ON COLUMN projects.is_shareable IS 'Whether the project can be shared publicly';