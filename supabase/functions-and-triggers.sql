-- =============================================
-- Time Log Management Functions and Triggers
-- =============================================

-- Function to automatically update or merge time logs
-- This function runs after each INSERT on time_logs table
CREATE OR REPLACE FUNCTION update_or_merge_log()
RETURNS TRIGGER AS $$
DECLARE
  prev_log RECORD;
  time_diff INTERVAL;
BEGIN
  RAISE NOTICE 'Checking for previous log for user_id: %', NEW.user_id;

  -- Find the most recent previous log for the same user
  SELECT * INTO prev_log
  FROM time_logs
  WHERE user_id = NEW.user_id
    AND id <> NEW.id
    AND start_time < NEW.start_time
  ORDER BY start_time DESC
  LIMIT 1;

  IF prev_log IS NOT NULL THEN
    time_diff := NEW.start_time - prev_log.start_time;
    RAISE NOTICE 'Found previous log % (%), duration = %', prev_log.id, prev_log.activity_type_id, time_diff;

    -- If the time difference is less than 1 minute, delete the previous log
    -- This handles cases where logs are created very close together
    IF time_diff < INTERVAL '1 minute' THEN
      RAISE NOTICE 'Deleting previous log because it is < 1 min';
      DELETE FROM time_logs WHERE id = prev_log.id;
    ELSE
      -- Otherwise, set the end_time of the previous log to the start_time of the new log
      RAISE NOTICE 'Updating end_time on previous log to %', NEW.start_time;
      UPDATE time_logs
      SET end_time = NEW.start_time
      WHERE id = prev_log.id;
    END IF;
  ELSE
    RAISE NOTICE 'No previous log found for user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trg_update_or_merge ON time_logs;

-- Create the trigger that fires after each INSERT
CREATE TRIGGER trg_update_or_merge
  AFTER INSERT ON time_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_or_merge_log();

-- =============================================
-- Notes on Split Log Functionality
-- =============================================

-- IMPORTANT: When implementing split log functionality in the application,
-- the trigger function above does NOT need to be updated because:
--
-- 1. Split operations work on EXISTING logs, not new INSERTs
-- 2. The split process:
--    a) UPDATEs the original log's end_time (trigger doesn't fire on UPDATE)
--    b) INSERTs a new log with a specific start_time and end_time
-- 3. When the new log is inserted, the trigger will:
--    - Find the previous log (the original log that was just updated)
--    - See that the time difference is 0 (they are adjacent)
--    - Update the previous log's end_time to match the new log's start_time
--    - This is actually the correct behavior and maintains continuity
--
-- Example split scenario:
-- Original log: 9:00 AM - 11:00 AM (2 hours)
-- After split:
--   Log 1: 9:00 AM - 10:00 AM (1 hour) <- UPDATE operation
--   Log 2: 10:00 AM - 11:00 AM (1 hour) <- INSERT operation (trigger fires)
--
-- The trigger will ensure Log 1 ends exactly when Log 2 starts, maintaining
-- perfect time continuity even if there are minor timing discrepancies.

-- =============================================
-- Additional Helper Functions (Future)
-- =============================================

-- Future enhancement: Function to validate time log continuity
-- CREATE OR REPLACE FUNCTION validate_time_log_continuity(user_uuid UUID)
-- RETURNS TABLE(gap_start TIMESTAMPTZ, gap_end TIMESTAMPTZ, gap_duration INTERVAL) AS $$
-- -- Implementation would find gaps in time coverage
-- $$ LANGUAGE plpgsql;

-- Future enhancement: Function to merge adjacent logs with same activity
-- CREATE OR REPLACE FUNCTION merge_adjacent_same_activity_logs(user_uuid UUID)
-- RETURNS INTEGER AS $$
-- -- Implementation would merge consecutive logs with same activity_type_id
-- $$ LANGUAGE plpgsql; 