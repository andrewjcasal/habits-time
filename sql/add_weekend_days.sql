-- Add weekend_days column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN weekend_days text[] DEFAULT ARRAY['saturday', 'sunday']::text[];

-- Add constraint to ensure valid day names
ALTER TABLE public.user_settings 
ADD CONSTRAINT user_settings_weekend_days_check 
CHECK (
  weekend_days <@ ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']::text[]
);

-- Add comment for documentation
COMMENT ON COLUMN public.user_settings.weekend_days IS 'Array of days when user is not working (e.g., {saturday, sunday})';