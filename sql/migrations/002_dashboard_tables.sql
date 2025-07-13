-- Migration: Add dashboard tables for behaviors, notes, and reflections
-- Date: 2025-07-13

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

-- Updated at trigger function (create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for behaviors
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

-- Trigger for habits_notes
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
    reddit_links JSONB, -- Store Reddit post links
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

-- Sample behaviors data (run after applying migration)
-- INSERT INTO behaviors (user_id, name, description, category) VALUES
-- (auth.uid(), 'Deep breathing', 'Taking intentional deep breaths throughout the day', 'mindfulness'),
-- (auth.uid(), 'Gratitude practice', 'Reflecting on things you are grateful for', 'mindfulness'),
-- (auth.uid(), 'Regular sleep schedule', 'Going to bed and waking up at consistent times', 'health'),
-- (auth.uid(), 'Mindful eating', 'Eating without distractions and paying attention to hunger cues', 'health'),
-- (auth.uid(), 'Daily movement', 'Any form of physical activity, even just walking', 'health'),
-- (auth.uid(), 'Digital boundaries', 'Setting limits on screen time and social media', 'productivity'),
-- (auth.uid(), 'Single-tasking', 'Focusing on one task at a time instead of multitasking', 'productivity'),
-- (auth.uid(), 'Connection with others', 'Reaching out to friends, family, or community', 'social');