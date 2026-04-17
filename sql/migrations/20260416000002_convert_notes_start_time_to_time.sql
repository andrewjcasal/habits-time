-- Convert cassian_notes.start_time from TIMESTAMPTZ to TIME.
--
-- After this migration:
--   - start_date (DATE, NOT NULL) holds the date portion.
--   - start_time (TIME, NULL)     holds the time portion. NULL means the note
--                                 is a whole-day note (no specific time), and
--                                 is what the mobile badge treats as "today's
--                                 note".
--
-- Only run this AFTER verifying the start_date values from the previous
-- migration look correct. This migration drops the original TIMESTAMPTZ
-- column — make sure start_date is populated first.

ALTER TABLE cassian_notes ADD COLUMN start_time_new TIME;

-- Backfill the time portion using each user's configured timezone, so the
-- TIME we store matches the wall-clock time the user originally entered.
UPDATE cassian_notes n
SET start_time_new = (n.start_time AT TIME ZONE COALESCE(s.week_ending_timezone, 'America/New_York'))::time
FROM cassian_user_settings s
WHERE s.user_id = n.user_id
  AND n.start_time IS NOT NULL;

-- Users without a settings row: use the app default timezone.
UPDATE cassian_notes
SET start_time_new = (start_time AT TIME ZONE 'America/New_York')::time
WHERE start_time_new IS NULL
  AND start_time IS NOT NULL;

-- Notes where the original start_time was NULL remain NULL — these become
-- "whole-day" notes under the new semantics.

ALTER TABLE cassian_notes DROP COLUMN start_time;
ALTER TABLE cassian_notes RENAME COLUMN start_time_new TO start_time;
