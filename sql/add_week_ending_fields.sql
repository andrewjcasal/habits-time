-- Add week ending fields to user_settings table
-- This migration adds fields to configure when a user's week ends for weekly goals and habits tracking

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS week_ending_day VARCHAR(20) DEFAULT 'sunday' 
  CHECK (week_ending_day IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
ADD COLUMN IF NOT EXISTS week_ending_time TIME DEFAULT '20:30:00',
ADD COLUMN IF NOT EXISTS week_ending_timezone VARCHAR(50) DEFAULT 'America/New_York';

-- Update existing records to have default values if they don't already
UPDATE user_settings 
SET 
  week_ending_day = 'sunday',
  week_ending_time = '20:30:00',
  week_ending_timezone = 'America/New_York'
WHERE 
  week_ending_day IS NULL 
  OR week_ending_time IS NULL 
  OR week_ending_timezone IS NULL;

-- Add comments to describe the columns
COMMENT ON COLUMN user_settings.week_ending_day IS 'Day of the week when the user''s week ends (sunday, monday, etc.)';
COMMENT ON COLUMN user_settings.week_ending_time IS 'Time when the user''s week ends (HH:MM:SS format)';
COMMENT ON COLUMN user_settings.week_ending_timezone IS 'Timezone for week ending time (e.g., America/New_York)';