-- One-time cleanup: drop future billable-hour blocks whose start_time
-- is at or after 16:00 America/New_York. Auto-placement now respects
-- end-of-day buffers, but rows inserted before that fix can still sit
-- on top of the 5:30 PM ET buffer window. Deleting them lets the
-- placer re-fill those days inside the work window only.
DELETE FROM cassian_billable_hours
WHERE start_time > NOW()
  AND EXTRACT(HOUR FROM (start_time AT TIME ZONE 'America/New_York')) >= 16;
