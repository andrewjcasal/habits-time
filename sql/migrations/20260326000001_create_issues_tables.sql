-- Issues table: stores issue definitions
CREATE TABLE cassian_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_archived BOOLEAN DEFAULT false
);

ALTER TABLE cassian_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own issues" ON cassian_issues
  FOR ALL USING (auth.uid() = user_id);

-- Note-issues join table: links notes to issues with intensity rating
CREATE TABLE cassian_note_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES cassian_habits_notes(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES cassian_issues(id) ON DELETE CASCADE,
  intensity INTEGER NOT NULL CHECK (intensity >= 1 AND intensity <= 10),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(note_id, issue_id)
);

ALTER TABLE cassian_note_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own note issues" ON cassian_note_issues
  FOR ALL USING (auth.uid() = user_id);
