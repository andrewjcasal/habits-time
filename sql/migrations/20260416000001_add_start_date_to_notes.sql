-- Add start_date (DATE) to cassian_notes and backfill from the existing
-- start_time (TIMESTAMPTZ). This migration is non-destructive — start_time is
-- left alone so you can visually compare the two columns in Supabase before
-- applying the next migration that converts start_time to a TIME-only column.
--
-- Timezone handling: each note's timestamp is converted to the owning user's
-- week_ending_timezone (from cassian_user_settings). Users without a stored
-- timezone fall back to the app default 'America/New_York', matching the
-- defaults in useSettings.ts.

ALTER TABLE cassian_notes ADD COLUMN start_date DATE;

-- Backfill using each user's configured timezone.
UPDATE cassian_notes n
SET start_date = (n.start_time AT TIME ZONE COALESCE(s.week_ending_timezone, 'America/New_York'))::date
FROM cassian_user_settings s
WHERE s.user_id = n.user_id
  AND n.start_time IS NOT NULL;

-- Users without a settings row: use the app default timezone.
UPDATE cassian_notes
SET start_date = (start_time AT TIME ZONE 'America/New_York')::date
WHERE start_date IS NULL
  AND start_time IS NOT NULL;

-- Notes with no start_time at all: fall back to created_at.
UPDATE cassian_notes
SET start_date = (created_at AT TIME ZONE 'America/New_York')::date
WHERE start_date IS NULL;

-- All rows should now have start_date — enforce NOT NULL going forward.
ALTER TABLE cassian_notes ALTER COLUMN start_date SET NOT NULL;

-- Index for date-range queries (e.g. "notes for today").
CREATE INDEX cassian_notes_user_start_date_idx
  ON cassian_notes(user_id, start_date);
