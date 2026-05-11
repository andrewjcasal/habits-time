-- Consolidate work-hours config into a single JSONB column that can grow
-- to hold additional ranges (personal_hours, eventually per-day overrides,
-- etc.) without further schema churn.
--
-- Shape:
-- {
--   "work_hours":     { "start": "10:00", "end": "22:00" },
--   "personal_hours": { "start": "19:00", "end": "23:00" }
-- }
--
-- Times are HH:MM strings (no seconds, no timezone) for human readability
-- and easy round-tripping through <input type="time">. Hours are local to
-- the user's calendar; week_ending_timezone still controls day boundaries.
--
-- The legacy work_hours_start / work_hours_end columns are LEFT IN PLACE
-- for now so older clients keep working during rollout. A follow-up
-- migration can drop them once every read path has moved to hour_ranges.

ALTER TABLE public.cassian_user_settings
  ADD COLUMN IF NOT EXISTS hour_ranges JSONB
  NOT NULL
  DEFAULT jsonb_build_object(
    'work_hours',     jsonb_build_object('start', '10:00', 'end', '22:00'),
    'personal_hours', jsonb_build_object('start', '19:00', 'end', '23:00')
  );

-- Backfill: pull existing work_hours_start/end into the new column.
-- ::time cast handles either a real `time` column or a text 'HH:MM:SS'
-- column — both legacy shapes have been observed in this project.
-- Personal hours stays at the 19:00–23:00 default until the user
-- customises it.
UPDATE public.cassian_user_settings
SET hour_ranges = jsonb_build_object(
  'work_hours', jsonb_build_object(
    'start', to_char(work_hours_start::time, 'HH24:MI'),
    'end',   to_char(work_hours_end::time,   'HH24:MI')
  ),
  'personal_hours', COALESCE(
    hour_ranges -> 'personal_hours',
    jsonb_build_object('start', '19:00', 'end', '23:00')
  )
)
WHERE work_hours_start IS NOT NULL
  AND work_hours_end   IS NOT NULL;
