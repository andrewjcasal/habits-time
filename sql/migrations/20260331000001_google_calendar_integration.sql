-- User calendars: stores connected external calendar sources
CREATE TABLE cassian_user_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL DEFAULT 'google',
  calendar_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  is_enabled BOOLEAN DEFAULT true,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cassian_user_calendars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own calendars" ON cassian_user_calendars
  FOR ALL USING (auth.uid() = user_id);

-- Add Google Calendar columns to meetings
ALTER TABLE cassian_meetings ADD COLUMN google_event_id TEXT;
ALTER TABLE cassian_meetings ADD COLUMN user_calendar_id UUID REFERENCES cassian_user_calendars(id) ON DELETE SET NULL;
ALTER TABLE cassian_meetings ADD COLUMN is_ignored BOOLEAN DEFAULT false;

-- Index for dedup on sync
CREATE UNIQUE INDEX meetings_google_event_id_calendar_idx ON cassian_meetings (google_event_id, user_calendar_id) WHERE google_event_id IS NOT NULL;
