-- Remove the single aspect_id column from habits_notes if it exists
ALTER TABLE habits_notes DROP COLUMN IF EXISTS aspect_id;

-- Create note_aspects junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS note_aspects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES habits_notes(id) ON DELETE CASCADE,
  aspect_id UUID NOT NULL REFERENCES aspects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(note_id, aspect_id) -- Prevent duplicate aspect assignments
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_note_aspects_note_id ON note_aspects(note_id);
CREATE INDEX IF NOT EXISTS idx_note_aspects_aspect_id ON note_aspects(aspect_id);

-- Add RLS policies for note_aspects table
ALTER TABLE note_aspects ENABLE ROW LEVEL SECURITY;

-- Users can only see note_aspects for their own notes
CREATE POLICY "Users can view their note aspects" ON note_aspects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM habits_notes 
      WHERE habits_notes.id = note_aspects.note_id 
      AND habits_notes.user_id = auth.uid()
    )
  );

-- Users can only create note_aspects for their own notes
CREATE POLICY "Users can create note aspects for their notes" ON note_aspects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits_notes 
      WHERE habits_notes.id = note_aspects.note_id 
      AND habits_notes.user_id = auth.uid()
    )
  );

-- Users can only delete note_aspects for their own notes
CREATE POLICY "Users can delete their note aspects" ON note_aspects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM habits_notes 
      WHERE habits_notes.id = note_aspects.note_id 
      AND habits_notes.user_id = auth.uid()
    )
  );