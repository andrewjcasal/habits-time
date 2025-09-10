-- Add calendar_notes table for pinning notes to specific dates/times in calendar
CREATE TABLE calendar_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pinned_date timestamptz NOT NULL,
  note_id uuid NOT NULL REFERENCES habits_notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT NOW() NOT NULL,
  updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Add RLS policies
ALTER TABLE calendar_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar notes"
  ON calendar_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar notes"
  ON calendar_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar notes"
  ON calendar_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar notes"
  ON calendar_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX calendar_notes_user_id_idx ON calendar_notes(user_id);
CREATE INDEX calendar_notes_pinned_date_idx ON calendar_notes(pinned_date);
CREATE INDEX calendar_notes_note_id_idx ON calendar_notes(note_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_calendar_notes_updated_at 
    BEFORE UPDATE ON calendar_notes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();