/*
  # Add positions table and update applications

  1. New Tables
    - `bolt_positions`
      - `id` (uuid, primary key)
      - `title` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Update `bolt_applications` table to use position_id instead of position
    - Add foreign key constraint
    - Add sample positions

  3. Security
    - Enable RLS
    - Add policies for public read access
*/

-- Create positions table
CREATE TABLE IF NOT EXISTS public.bolt_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add position_id to applications
ALTER TABLE public.bolt_applications 
  ADD COLUMN position_id UUID REFERENCES public.bolt_positions(id);

-- Copy existing position data
INSERT INTO public.bolt_positions (title)
SELECT DISTINCT position 
FROM public.bolt_applications 
WHERE position IS NOT NULL;

-- Update applications with position_id
UPDATE public.bolt_applications a
SET position_id = p.id
FROM public.bolt_positions p
WHERE a.position = p.title;

-- Make position_id required and drop old column
ALTER TABLE public.bolt_applications 
  ALTER COLUMN position_id SET NOT NULL,
  DROP COLUMN position;

-- Enable RLS
ALTER TABLE public.bolt_positions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to positions"
  ON public.bolt_positions FOR SELECT
  TO public
  USING (true);

-- Create updated_at trigger
CREATE TRIGGER set_positions_updated_at
  BEFORE UPDATE ON public.bolt_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert sample positions
INSERT INTO public.bolt_positions (title) VALUES
  ('Sr. Full Stack Engineer'),
  ('Full Stack Engineer'),
  ('Senior Frontend Engineer'),
  ('Frontend Engineer'),
  ('Senior Backend Engineer'),
  ('Backend Engineer'),
  ('Software Engineer'),
  ('Senior Software Engineer'),
  ('Staff Engineer'),
  ('Principal Engineer'),
  ('Engineering Manager'),
  ('Tech Lead'),
  ('DevOps Engineer'),
  ('Senior DevOps Engineer'),
  ('Cloud Engineer'),
  ('Senior Cloud Engineer'),
  ('React Developer'),
  ('Senior React Developer'),
  ('Node.js Developer'),
  ('Senior Node.js Developer')
ON CONFLICT (title) DO NOTHING;