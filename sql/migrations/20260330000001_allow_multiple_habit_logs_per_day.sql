-- Drop the old unique constraint (one log per habit per day)
ALTER TABLE cassian_habits_daily_logs DROP CONSTRAINT habits_daily_logs_unique_habit_date;

-- Add new unique constraint that allows multiple blocks per day (differentiated by start time)
ALTER TABLE cassian_habits_daily_logs ADD CONSTRAINT habits_daily_logs_unique_habit_date_time
  UNIQUE (habit_id, user_id, log_date, scheduled_start_time);
