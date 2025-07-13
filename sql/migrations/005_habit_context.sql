-- Add context column to habits table
ALTER TABLE habits ADD COLUMN context JSONB DEFAULT '{"background": "", "wins": "", "consequences": ""}';

-- Create index for context searches
CREATE INDEX idx_habits_context ON habits USING GIN (context);

-- Update existing habits to have empty context structure
UPDATE habits SET context = '{"background": "", "wins": "", "consequences": ""}' WHERE context IS NULL;