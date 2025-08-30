-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#3B82F6', -- Default blue color
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create note_tags junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS note_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES habits_notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(note_id, tag_id) -- Prevent duplicate tag assignments
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Add RLS policies for tags table
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Users can see all tags (tags are global)
CREATE POLICY "Users can view all tags" ON tags
  FOR SELECT USING (true);

-- Users can create tags
CREATE POLICY "Users can create tags" ON tags
  FOR INSERT WITH CHECK (true);

-- Add RLS policies for note_tags table
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

-- Users can only see note_tags for their own notes
CREATE POLICY "Users can view their note tags" ON note_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM habits_notes 
      WHERE habits_notes.id = note_tags.note_id 
      AND habits_notes.user_id = auth.uid()
    )
  );

-- Users can only create note_tags for their own notes
CREATE POLICY "Users can create note tags for their notes" ON note_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits_notes 
      WHERE habits_notes.id = note_tags.note_id 
      AND habits_notes.user_id = auth.uid()
    )
  );

-- Users can only delete note_tags for their own notes
CREATE POLICY "Users can delete their note tags" ON note_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM habits_notes 
      WHERE habits_notes.id = note_tags.note_id 
      AND habits_notes.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for tags table
CREATE TRIGGER update_tags_updated_at 
  BEFORE UPDATE ON tags 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();