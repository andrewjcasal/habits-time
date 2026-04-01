CREATE TABLE cassian_meeting_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES cassian_meetings(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES cassian_habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meeting_id, habit_id)
);

ALTER TABLE cassian_meeting_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own meeting habits" ON cassian_meeting_habits
  FOR ALL USING (auth.uid() = user_id);
