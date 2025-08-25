-- Sample data for testing the buffer system (this migration can be rolled back in production)
-- This migration adds sample categories and buffers for development/testing

DO $$ 
DECLARE 
    sample_user_id UUID;
    relationship_category_id UUID;
    fitness_category_id UUID;
    learning_category_id UUID;
BEGIN
    -- Get a sample user (this would be a real user ID in production)
    SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
    
    -- Only proceed if we have at least one user
    IF sample_user_id IS NOT NULL THEN
        
        -- Insert sample meeting categories if they don't exist
        INSERT INTO meeting_categories (user_id, name, description, color)
        VALUES 
            (sample_user_id, 'Relationship & Social', 'Time for dates, social activities, and quality time with loved ones', '#ef4444'),
            (sample_user_id, 'Health & Fitness', 'Time for gym sessions, walks, and other physical activities', '#22c55e'),
            (sample_user_id, 'Learning & Development', 'Time for reading, courses, skill development, and personal growth', '#3b82f6')
        ON CONFLICT (user_id, name) DO NOTHING
        RETURNING id;
        
        -- Get the category IDs
        SELECT id INTO relationship_category_id FROM meeting_categories 
        WHERE user_id = sample_user_id AND name = 'Relationship & Social';
        
        SELECT id INTO fitness_category_id FROM meeting_categories 
        WHERE user_id = sample_user_id AND name = 'Health & Fitness';
        
        SELECT id INTO learning_category_id FROM meeting_categories 
        WHERE user_id = sample_user_id AND name = 'Learning & Development';
        
        -- Insert sample category buffers
        INSERT INTO category_buffers (user_id, category_id, weekly_hours)
        VALUES 
            (sample_user_id, relationship_category_id, 10.0),
            (sample_user_id, fitness_category_id, 5.0),
            (sample_user_id, learning_category_id, 8.0)
        ON CONFLICT (user_id, category_id) DO NOTHING;
        
        RAISE NOTICE 'Sample buffer data created for user %', sample_user_id;
    ELSE
        RAISE NOTICE 'No users found - skipping sample data creation';
    END IF;
END $$;