-- Migration: Smart day boundary - day doesn't end until sleep is logged
-- Date: 2025-07-13

-- Function to get the effective habit date (day doesn't end until sleep is logged)
CREATE OR REPLACE FUNCTION get_effective_habit_date(p_user_id uuid)
RETURNS date AS $$
DECLARE
  v_current_date date := CURRENT_DATE;
  v_yesterday date := CURRENT_DATE - INTERVAL '1 day';
  v_sleep_logged boolean := false;
BEGIN
  -- Check if sleep was logged for yesterday
  SELECT EXISTS(
    SELECT 1 FROM time_logs tl
    JOIN activity_types at ON tl.activity_type_id = at.id
    WHERE tl.user_id = p_user_id 
    AND at.label = 'sleep'
    AND DATE(tl.start_time) = v_yesterday
  ) INTO v_sleep_logged;
  
  -- If it's past midnight but yesterday's sleep wasn't logged,
  -- we're still in "yesterday" from a habits perspective
  IF EXTRACT(HOUR FROM NOW()) < 6 AND NOT v_sleep_logged THEN
    RETURN v_yesterday;
  ELSE
    RETURN v_current_date;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update today_habits view to use smart day boundary
CREATE OR REPLACE VIEW today_habits AS
SELECT 
  h.id,
  h.name,
  h.duration,
  h.current_start_time as scheduled_time,
  ht.name as habit_type,
  COALESCE(dhl.is_completed, false) as is_completed,
  dhl.actual_start_time,
  dhl.actual_end_time,
  dhl.notes,
  h.user_id
FROM habits h
LEFT JOIN habits_types ht ON h.habit_type_id = ht.id
LEFT JOIN habits_daily_logs dhl ON h.id = dhl.habit_id 
  AND dhl.log_date = get_effective_habit_date(h.user_id)
  AND dhl.user_id = h.user_id
WHERE h.is_visible = true
ORDER BY h.current_start_time;

-- Function to get today's habits for a specific user (using smart boundary)
CREATE OR REPLACE FUNCTION get_user_habits_for_today(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  duration integer,
  scheduled_time time,
  habit_type text,
  is_completed boolean,
  actual_start_time time,
  actual_end_time time,
  notes text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id,
    h.name,
    h.duration,
    h.current_start_time as scheduled_time,
    ht.name as habit_type,
    COALESCE(dhl.is_completed, false) as is_completed,
    dhl.actual_start_time,
    dhl.actual_end_time,
    dhl.notes
  FROM habits h
  LEFT JOIN habits_types ht ON h.habit_type_id = ht.id
  LEFT JOIN habits_daily_logs dhl ON h.id = dhl.habit_id 
    AND dhl.log_date = get_effective_habit_date(p_user_id)
    AND dhl.user_id = h.user_id
  WHERE h.is_visible = true 
    AND h.user_id = p_user_id
  ORDER BY h.current_start_time;
END;
$$ LANGUAGE plpgsql;