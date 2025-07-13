-- Create habits_types table to define different scheduling behaviors
CREATE TABLE public.habits_types (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  name text NOT NULL,
  description text,
  scheduling_rule text NOT NULL, -- 'pull_back_15min', 'fixed_time', 'flexible'
  CONSTRAINT habits_types_pkey PRIMARY KEY (id),
  CONSTRAINT habits_types_name_key UNIQUE (name)
) TABLESPACE pg_default;

-- Insert default habit types
INSERT INTO public.habits_types (name, description, scheduling_rule) VALUES
('Pull Back 15 Minutes', 'Each day starts 15 minutes earlier if completed on time, stays same if not completed', 'pull_back_15min'),
('Fixed Time', 'Always starts at the same time regardless of completion', 'fixed_time'),
('Flexible', 'User can adjust time as needed without automatic changes', 'flexible');

-- Create habits_daily_logs table to track daily completions and times
CREATE TABLE public.habits_daily_logs (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  habit_id uuid NOT NULL,
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  scheduled_start_time time,
  actual_start_time time,
  actual_end_time time,
  is_completed boolean NOT NULL DEFAULT false,
  notes text,
  CONSTRAINT habits_daily_logs_pkey PRIMARY KEY (id),
  CONSTRAINT habits_daily_logs_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
  CONSTRAINT habits_daily_logs_unique_habit_date UNIQUE (habit_id, user_id, log_date)
) TABLESPACE pg_default;

-- Add habit_type_id to existing habits table
ALTER TABLE public.habits 
ADD COLUMN habit_type_id uuid REFERENCES public.habits_types(id),
ADD COLUMN default_start_time time,
ADD COLUMN current_start_time time;

-- Update existing habits to use 'Pull Back 15 Minutes' type for Morning/Shutdown routines
UPDATE public.habits 
SET habit_type_id = (SELECT id FROM public.habits_types WHERE name = 'Pull Back 15 Minutes')
WHERE name IN ('Morning Routine', 'Shutdown') OR is_visible = true;

-- Update default_start_time separately
UPDATE public.habits 
SET default_start_time = '06:00:00'::time
WHERE name = 'Morning Routine';

UPDATE public.habits 
SET default_start_time = '22:00:00'::time
WHERE name = 'Shutdown';

UPDATE public.habits 
SET default_start_time = '09:00:00'::time
WHERE is_visible = true AND name NOT IN ('Morning Routine', 'Shutdown');

-- Update current_start_time separately
UPDATE public.habits 
SET current_start_time = '06:00:00'::time
WHERE name = 'Morning Routine';

UPDATE public.habits 
SET current_start_time = '22:00:00'::time
WHERE name = 'Shutdown';

UPDATE public.habits 
SET current_start_time = '09:00:00'::time
WHERE is_visible = true AND name NOT IN ('Morning Routine', 'Shutdown');

-- Function to calculate next day's start time based on habit type
CREATE OR REPLACE FUNCTION calculate_next_start_time(
  p_habit_id uuid,
  p_user_id uuid,
  p_current_date date DEFAULT CURRENT_DATE
) RETURNS time AS $$
DECLARE
  v_habit_type text;
  v_current_start_time time;
  v_was_completed boolean;
  v_new_start_time time;
BEGIN
  -- Get habit type and current start time
  SELECT ht.scheduling_rule, h.current_start_time
  INTO v_habit_type, v_current_start_time
  FROM habits h
  JOIN habits_types ht ON h.habit_type_id = ht.id
  WHERE h.id = p_habit_id;
  
  -- Check if habit was completed on the given date
  SELECT COALESCE(is_completed, false)
  INTO v_was_completed
  FROM habits_daily_logs
  WHERE habit_id = p_habit_id 
    AND user_id = p_user_id 
    AND log_date = p_current_date;
  
  -- Calculate new start time based on habit type
  CASE v_habit_type
    WHEN 'pull_back_15min' THEN
      IF v_was_completed THEN
        v_new_start_time := v_current_start_time - INTERVAL '15 minutes'; -- Pull back 15 min if completed
      ELSE
        v_new_start_time := v_current_start_time; -- Keep same time if not completed
      END IF;
    WHEN 'fixed_time' THEN
      SELECT default_start_time INTO v_new_start_time 
      FROM habits WHERE id = p_habit_id;
    ELSE -- flexible
      v_new_start_time := v_current_start_time; -- No automatic change
  END CASE;
  
  RETURN v_new_start_time;
END;
$$ LANGUAGE plpgsql;

-- Function to update habit start times for the next day
CREATE OR REPLACE FUNCTION update_habit_start_times(
  p_user_id uuid,
  p_date date DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
  habit_record RECORD;
  new_time time;
BEGIN
  FOR habit_record IN 
    SELECT id FROM habits 
    WHERE user_id = p_user_id 
      AND is_visible = true
      AND habit_type_id IS NOT NULL
  LOOP
    -- Calculate new start time
    SELECT calculate_next_start_time(habit_record.id, p_user_id, p_date) 
    INTO new_time;
    
    -- Update the habit's current start time
    UPDATE habits 
    SET current_start_time = new_time
    WHERE id = habit_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Query to get today's habits with their scheduled times
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
  dhl.notes
FROM habits h
LEFT JOIN habits_types ht ON h.habit_type_id = ht.id
LEFT JOIN habits_daily_logs dhl ON h.id = dhl.habit_id 
  AND dhl.log_date = CURRENT_DATE
  AND dhl.user_id = h.user_id
WHERE h.is_visible = true
ORDER BY h.current_start_time;

-- Query to log habit completion
CREATE OR REPLACE FUNCTION log_habit_completion(
  p_habit_id uuid,
  p_user_id uuid,
  p_is_completed boolean,
  p_actual_start_time time DEFAULT NULL,
  p_actual_end_time time DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_log_date date DEFAULT CURRENT_DATE
) RETURNS void AS $$
BEGIN
  INSERT INTO habits_daily_logs (
    habit_id, 
    user_id, 
    log_date, 
    scheduled_start_time,
    actual_start_time,
    actual_end_time,
    is_completed, 
    notes
  )
  VALUES (
    p_habit_id,
    p_user_id,
    p_log_date,
    (SELECT current_start_time FROM habits WHERE id = p_habit_id),
    p_actual_start_time,
    p_actual_end_time,
    p_is_completed,
    p_notes
  )
  ON CONFLICT (habit_id, user_id, log_date) 
  DO UPDATE SET
    actual_start_time = EXCLUDED.actual_start_time,
    actual_end_time = EXCLUDED.actual_end_time,
    is_completed = EXCLUDED.is_completed,
    notes = EXCLUDED.notes;
END;
$$ LANGUAGE plpgsql;

-- Query to get habit completion history
CREATE OR REPLACE VIEW habit_completion_history AS
SELECT 
  h.name as habit_name,
  dhl.log_date,
  dhl.scheduled_start_time,
  dhl.actual_start_time,
  dhl.actual_end_time,
  dhl.is_completed,
  dhl.notes,
  CASE 
    WHEN dhl.actual_start_time IS NOT NULL AND dhl.actual_end_time IS NOT NULL 
    THEN dhl.actual_end_time - dhl.actual_start_time
    ELSE NULL 
  END as actual_duration
FROM habits_daily_logs dhl
JOIN habits h ON dhl.habit_id = h.id
ORDER BY dhl.log_date DESC, dhl.scheduled_start_time;

-- Example usage queries:

-- 1. Get today's habits for a user
-- SELECT * FROM today_habits WHERE user_id = 'your-user-id';

-- 2. Mark a habit as completed
-- SELECT log_habit_completion('habit-id', 'user-id', true, '06:05:00', '06:35:00', 'Felt great today!');

-- 3. Update all habit start times for tomorrow (run this daily)
-- SELECT update_habit_start_times('user-id');

-- 4. Get completion history for the last 7 days
-- SELECT * FROM habit_completion_history 
-- WHERE log_date >= CURRENT_DATE - INTERVAL '7 days'
-- ORDER BY log_date DESC;

-- 5. Get habits that were completed yesterday (will start earlier today)
-- SELECT h.name, h.current_start_time, 
--        h.current_start_time - INTERVAL '15 minutes' as new_time
-- FROM habits h
-- LEFT JOIN habits_daily_logs dhl ON h.id = dhl.habit_id 
--   AND dhl.log_date = CURRENT_DATE - INTERVAL '1 day'
--   AND dhl.user_id = h.user_id
-- WHERE h.habit_type_id = (SELECT id FROM habits_types WHERE scheduling_rule = 'pull_back_15min')
--   AND dhl.is_completed = true;

-- Add behaviors table for dashboard
CREATE TABLE IF NOT EXISTS behaviors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- e.g., 'health', 'productivity', 'mindfulness', 'social'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE behaviors ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own behaviors" ON behaviors
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own behaviors" ON behaviors
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own behaviors" ON behaviors
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own behaviors" ON behaviors
    FOR DELETE USING (auth.uid() = user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_behaviors_updated_at 
    BEFORE UPDATE ON behaviors 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add habits_notes table for reflections
CREATE TABLE IF NOT EXISTS habits_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_date DATE NOT NULL DEFAULT CURRENT_DATE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, note_date)
);

-- Enable RLS for habits_notes
ALTER TABLE habits_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for habits_notes
CREATE POLICY "Users can view their own notes" ON habits_notes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON habits_notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON habits_notes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON habits_notes
    FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_habits_notes_updated_at 
    BEFORE UPDATE ON habits_notes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Daily reflections table
CREATE TABLE IF NOT EXISTS daily_reflections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reflection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    content TEXT NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, reflection_date)
);

-- Enable RLS for daily_reflections
ALTER TABLE daily_reflections ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_reflections
CREATE POLICY "Users can view their own reflections" ON daily_reflections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reflections" ON daily_reflections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reflections" ON daily_reflections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reflections" ON daily_reflections
    FOR DELETE USING (auth.uid() = user_id);