-- Create categories table for meeting organization (separate from bolt_categories)
CREATE TABLE IF NOT EXISTS meeting_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6b7280', -- Default neutral gray
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_meeting_categories_user_id ON meeting_categories(user_id);

-- Enable RLS
ALTER TABLE meeting_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own meeting categories"
    ON meeting_categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meeting categories"
    ON meeting_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meeting categories"
    ON meeting_categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meeting categories"
    ON meeting_categories FOR DELETE
    USING (auth.uid() = user_id);

-- Add category_id column to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES meeting_categories(id) ON DELETE SET NULL;

-- Create index for meeting categories
CREATE INDEX IF NOT EXISTS idx_meetings_category_id ON meetings(category_id);

-- Create trigger for meeting_categories updated_at
CREATE TRIGGER update_meeting_categories_updated_at
    BEFORE UPDATE ON meeting_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();