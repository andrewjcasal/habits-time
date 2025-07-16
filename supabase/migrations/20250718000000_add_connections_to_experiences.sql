/*
  # Add Connection Fields to Experiences Table

  1. New Columns
    - `location` (text, nullable) - where the experience took place
    - `attendees` (text, nullable) - other people who were present
    - `outcome` (text, nullable) - results or decisions from the experience
    - `follow_up_needed` (boolean) - whether follow-up is required
    - `follow_up_date` (date, nullable) - when to follow up
    - `connection_strength` (text) - impact on relationship ('strengthened', 'maintained', 'weakened')
    - `topics_discussed` (text[], nullable) - array of topics covered
    - `next_steps` (text, nullable) - agreed upon next actions

  2. Indexes
    - Add indexes for follow-up tracking and connection analysis
*/

-- Add new columns to experiences table
ALTER TABLE public.experiences 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS attendees TEXT,
ADD COLUMN IF NOT EXISTS outcome TEXT,
ADD COLUMN IF NOT EXISTS follow_up_needed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS follow_up_date DATE,
ADD COLUMN IF NOT EXISTS connection_strength TEXT CHECK (connection_strength IN ('strengthened', 'maintained', 'weakened', 'neutral')) DEFAULT 'neutral',
ADD COLUMN IF NOT EXISTS topics_discussed TEXT[],
ADD COLUMN IF NOT EXISTS next_steps TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_experiences_follow_up_needed ON public.experiences(follow_up_needed) WHERE follow_up_needed = true;
CREATE INDEX IF NOT EXISTS idx_experiences_follow_up_date ON public.experiences(follow_up_date) WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_experiences_connection_strength ON public.experiences(connection_strength);
CREATE INDEX IF NOT EXISTS idx_experiences_location ON public.experiences(location) WHERE location IS NOT NULL;

-- Create a GIN index for topics_discussed array
CREATE INDEX IF NOT EXISTS idx_experiences_topics_discussed ON public.experiences USING GIN(topics_discussed) WHERE topics_discussed IS NOT NULL;