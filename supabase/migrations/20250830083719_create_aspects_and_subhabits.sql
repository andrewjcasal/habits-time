-- Create aspects table
CREATE TABLE IF NOT EXISTS aspects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subhabits table
CREATE TABLE IF NOT EXISTS subhabits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  aspect_id UUID REFERENCES aspects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add aspect_id to habits_notes table
ALTER TABLE habits_notes ADD COLUMN IF NOT EXISTS aspect_id UUID REFERENCES aspects(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subhabits_habit_id ON subhabits(habit_id);
CREATE INDEX IF NOT EXISTS idx_subhabits_aspect_id ON subhabits(aspect_id);
CREATE INDEX IF NOT EXISTS idx_habits_notes_aspect_id ON habits_notes(aspect_id);

-- Add RLS policies for aspects table
ALTER TABLE aspects ENABLE ROW LEVEL SECURITY;

-- Users can see all aspects (aspects are global)
CREATE POLICY "Users can view all aspects" ON aspects
  FOR SELECT USING (true);

-- Users can create aspects
CREATE POLICY "Users can create aspects" ON aspects
  FOR INSERT WITH CHECK (true);

-- Users can update aspects
CREATE POLICY "Users can update aspects" ON aspects
  FOR UPDATE USING (true);

-- Add RLS policies for subhabits table
ALTER TABLE subhabits ENABLE ROW LEVEL SECURITY;

-- Users can only see subhabits for their own habits
CREATE POLICY "Users can view their subhabits" ON subhabits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM habits 
      WHERE habits.id = subhabits.habit_id 
      AND habits.user_id = auth.uid()
    )
  );

-- Users can only create subhabits for their own habits
CREATE POLICY "Users can create subhabits for their habits" ON subhabits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits 
      WHERE habits.id = subhabits.habit_id 
      AND habits.user_id = auth.uid()
    )
  );

-- Users can only update subhabits for their own habits
CREATE POLICY "Users can update their subhabits" ON subhabits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM habits 
      WHERE habits.id = subhabits.habit_id 
      AND habits.user_id = auth.uid()
    )
  );

-- Users can only delete subhabits for their own habits
CREATE POLICY "Users can delete their subhabits" ON subhabits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM habits 
      WHERE habits.id = subhabits.habit_id 
      AND habits.user_id = auth.uid()
    )
  );

-- Add trigger for aspects table
CREATE TRIGGER update_aspects_updated_at 
  BEFORE UPDATE ON aspects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for subhabits table
CREATE TRIGGER update_subhabits_updated_at 
  BEFORE UPDATE ON subhabits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default aspects
INSERT INTO aspects (title) VALUES 
  ('Cat Care'),
  ('Health & Wellness'),
  ('Work & Productivity'),
  ('Personal Development'),
  ('Home & Environment'),
  ('Social & Relationships')
ON CONFLICT DO NOTHING;