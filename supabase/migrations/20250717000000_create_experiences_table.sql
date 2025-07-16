/*
  # Experiences Table

  1. New Table
    - `experiences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `person_id` (uuid, foreign key)
      - `title` (text)
      - `description` (text, nullable)
      - `experience_date` (date)
      - `type` (text) - 'shared', 'individual', 'meeting', 'event', 'other'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on experiences table
    - Add policies for users to manage their own experiences
*/

-- Create experiences table
CREATE TABLE IF NOT EXISTS public.experiences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  experience_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('shared', 'individual', 'meeting', 'event', 'other')) DEFAULT 'shared',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_experiences_user_id ON public.experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_experiences_person_id ON public.experiences(person_id);
CREATE INDEX IF NOT EXISTS idx_experiences_date ON public.experiences(experience_date);
CREATE INDEX IF NOT EXISTS idx_experiences_type ON public.experiences(type);

-- Enable RLS
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;

-- Create policies for experiences
CREATE POLICY "Users can view their own experiences"
  ON public.experiences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own experiences"
  ON public.experiences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own experiences"
  ON public.experiences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own experiences"
  ON public.experiences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER set_experiences_updated_at
  BEFORE UPDATE ON public.experiences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();