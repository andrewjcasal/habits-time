-- Clean up billable-hour rows that were placed inside the end-of-day
-- buffer window (5:30-6:30 PM ET) before the auto-placer learned to
-- respect buffers. Targets future rows whose local start time is at
-- or after 17:30 ET — anything that early in the work day is fine to
-- keep, anything past 17:30 belongs in the buffer.
DELETE FROM cassian_billable_hours
WHERE start_time > NOW()
  AND (start_time AT TIME ZONE 'America/New_York')::time >= '17:30';
