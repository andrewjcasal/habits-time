-- Create new problems table without user-specific data
CREATE TABLE IF NOT EXISTS public.bolt_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  category_id UUID REFERENCES public.bolt_categories(id),
  url TEXT,
  description TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create attempts table for user-specific data
CREATE TABLE IF NOT EXISTS public.bolt_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID REFERENCES public.bolt_problems(id) ON DELETE CASCADE,
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
ALTER TABLE public.bolt_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolt_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access on problems" 
  ON public.bolt_problems FOR SELECT 
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
INSERT INTO public.bolt_problems (
  title,
  difficulty,
  category_id,
  url,
  description,
  tags,
  created_at
)
SELECT DISTINCT ON (title)
  title,
  difficulty,
  category_id,
  url,
  description,
  tags,
  created_at
FROM public.bolt_problems_old;

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
  new.id as problem_id,
  old.user_id,
  old.completed,
  old.last_attempted,
  old.next_review,
  old.level,
  old.notes,
  old.created_at
FROM public.bolt_problems_old old
JOIN public.bolt_problems new ON old.title = new.title;

-- Drop old table
DROP TABLE IF EXISTS public.bolt_problems_old;

-- Rename current problems table to old
ALTER TABLE public.bolt_problems RENAME TO bolt_problems_old;

-- Rename new problems table to final name
ALTER TABLE public.bolt_problems_new RENAME TO bolt_problems;