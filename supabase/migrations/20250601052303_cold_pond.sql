-- Create new problems table without user-specific data
CREATE TABLE IF NOT EXISTS public.bolt_problems_new (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  category_id INTEGER REFERENCES public.bolt_categories(id),
  url TEXT,
  description TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create attempts table for user-specific data
CREATE TABLE IF NOT EXISTS public.bolt_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id INTEGER REFERENCES public.bolt_problems_new(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  last_attempted TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  level INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(problem_id, user_id)
);

-- Enable RLS
ALTER TABLE public.bolt_problems_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolt_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access on problems" 
  ON public.bolt_problems_new FOR SELECT 
  TO public 
  USING (true);

CREATE POLICY "Allow authenticated users to read their attempts" 
  ON public.bolt_attempts FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to insert their attempts" 
  ON public.bolt_attempts FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their attempts" 
  ON public.bolt_attempts FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their attempts" 
  ON public.bolt_attempts FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.bolt_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_problem_id ON public.bolt_attempts(problem_id);
CREATE INDEX IF NOT EXISTS idx_attempts_next_review ON public.bolt_attempts(next_review);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.bolt_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Migrate existing data
INSERT INTO public.bolt_problems_new (
  id,
  title,
  difficulty,
  category_id,
  url,
  description,
  tags,
  created_at
)
SELECT DISTINCT ON (title)
  id,
  title,
  difficulty,
  category_id,
  url,
  description,
  tags,
  created_at
FROM public.bolt_problems;

INSERT INTO public.bolt_attempts (
  problem_id,
  user_id,
  completed,
  last_attempted,
  next_review,
  level,
  notes,
  created_at
)
SELECT 
  id as problem_id,
  user_id,
  completed,
  last_attempted,
  next_review,
  level,
  notes,
  created_at
FROM public.bolt_problems;

-- Drop old table and rename new one
DROP TABLE public.bolt_problems;
ALTER TABLE public.bolt_problems_new RENAME TO bolt_problems;