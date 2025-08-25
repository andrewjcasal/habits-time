-- Create category_buffers table for weekly time allocation system
CREATE TABLE IF NOT EXISTS category_buffers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES meeting_categories(id) ON DELETE CASCADE,
    weekly_hours DECIMAL(4,2) NOT NULL CHECK (weekly_hours > 0 AND weekly_hours <= 168), -- Max 168 hours in a week
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique buffer per category per user
    UNIQUE(user_id, category_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_category_buffers_user_id ON category_buffers(user_id);
CREATE INDEX IF NOT EXISTS idx_category_buffers_category_id ON category_buffers(category_id);
CREATE INDEX IF NOT EXISTS idx_category_buffers_user_category ON category_buffers(user_id, category_id);

-- Enable RLS
ALTER TABLE category_buffers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own category buffers"
    ON category_buffers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own category buffers"
    ON category_buffers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category buffers"
    ON category_buffers FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category buffers"
    ON category_buffers FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger for category_buffers updated_at
CREATE TRIGGER update_category_buffers_updated_at
    BEFORE UPDATE ON category_buffers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to get buffer utilization for a given week
CREATE OR REPLACE FUNCTION get_buffer_utilization(
    p_user_id UUID,
    p_week_start TIMESTAMPTZ,
    p_week_end TIMESTAMPTZ
)
RETURNS TABLE (
    buffer_id UUID,
    category_id UUID,
    category_name TEXT,
    category_color TEXT,
    weekly_hours DECIMAL(4,2),
    hours_spent DECIMAL(4,2),
    hours_remaining DECIMAL(4,2),
    utilization_percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH buffer_spending AS (
        SELECT 
            cb.id as buffer_id,
            cb.category_id,
            cb.weekly_hours,
            COALESCE(
                -- Calculate hours spent from meetings in this category during the week
                (
                    SELECT SUM(EXTRACT(EPOCH FROM (m.end_time - m.start_time)) / 3600.0)
                    FROM meetings m
                    WHERE m.user_id = p_user_id
                        AND m.category_id = cb.category_id
                        AND m.start_time >= p_week_start
                        AND m.start_time < p_week_end
                ), 0
            ) as hours_spent
        FROM category_buffers cb
        WHERE cb.user_id = p_user_id
    )
    SELECT 
        bs.buffer_id,
        bs.category_id,
        mc.name as category_name,
        mc.color as category_color,
        bs.weekly_hours,
        bs.hours_spent,
        GREATEST(0, bs.weekly_hours - bs.hours_spent) as hours_remaining,
        CASE 
            WHEN bs.weekly_hours > 0 THEN 
                ROUND((bs.hours_spent / bs.weekly_hours * 100)::DECIMAL, 2)
            ELSE 0
        END as utilization_percentage
    FROM buffer_spending bs
    JOIN meeting_categories mc ON mc.id = bs.category_id
    ORDER BY mc.name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_buffer_utilization(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;