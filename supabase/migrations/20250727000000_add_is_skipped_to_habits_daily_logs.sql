-- Add is_skipped column to habits_daily_logs table
ALTER TABLE public.habits_daily_logs 
ADD COLUMN is_skipped boolean NOT NULL DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.habits_daily_logs.is_skipped IS 'Whether the habit was intentionally skipped for this day';