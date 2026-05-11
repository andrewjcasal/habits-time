-- Billable hours: dedicated calendar event type that replaces the
-- ad-hoc `is_billable` task flag + per-project hourly rate fallback
-- with a flat-rate ($100/hr default) auto-placed block on the
-- calendar. Each user has a target of 5 billable hours per day; the
-- placer fills free slots that don't conflict with habits, meetings,
-- or project_activity. `is_auto_placed` distinguishes auto-filled
-- blocks (placer may add more around them) from manually-edited
-- blocks (placer must respect them).

CREATE TABLE cassian_billable_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  rate DECIMAL(8, 2) NOT NULL DEFAULT 100.00,
  note TEXT,
  is_auto_placed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX cassian_billable_hours_user_start_idx
  ON cassian_billable_hours (user_id, start_time);

ALTER TABLE cassian_billable_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own billable hours"
  ON cassian_billable_hours FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
