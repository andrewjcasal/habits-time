-- Create wins table to track achievements and positive moments
CREATE TABLE wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'habit_streak')),
  source_id UUID, -- references habits_notes.id or habits.id
  extracted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure uniqueness of wins per user based on content
  CONSTRAINT unique_user_win UNIQUE (user_id, title)
);

-- Create indexes for faster lookups
CREATE INDEX idx_wins_user_id ON wins(user_id);
CREATE INDEX idx_wins_source ON wins(source_type, source_id);

-- Enable RLS
ALTER TABLE wins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own wins" ON wins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wins" ON wins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wins" ON wins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wins" ON wins
  FOR DELETE USING (auth.uid() = user_id);