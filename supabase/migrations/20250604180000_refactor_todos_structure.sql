/*
  # Refactor Todos Structure

  1. Drop existing todos table
  2. Create todo_types table
  3. Create new todos table with company_id, todo_type_id, and script columns
  4. Populate todo_types
  5. Regenerate todos for existing applications
  6. Create new trigger/function
*/

-- Drop existing todos table and trigger
DROP TRIGGER IF EXISTS create_todo_on_application_insert ON public.bolt_applications;
DROP FUNCTION IF EXISTS create_application_todo();
DROP TABLE IF EXISTS public.todos;

-- Create todo_types table
CREATE TABLE IF NOT EXISTS public.todo_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  script TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create new todos table with company_id and todo_type_id
CREATE TABLE IF NOT EXISTS public.todos (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.bolt_companies(id) ON DELETE CASCADE,
  todo_type_id INTEGER NOT NULL REFERENCES public.todo_types(id) ON DELETE CASCADE,
  script TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_company_id ON public.todos(company_id);
CREATE INDEX IF NOT EXISTS idx_todos_todo_type_id ON public.todos(todo_type_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON public.todos(status);

-- Enable RLS
ALTER TABLE public.todo_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Create policies for todo_types (read-only for authenticated users)
CREATE POLICY "Anyone can view todo types"
  ON public.todo_types FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for todos
CREATE POLICY "Users can view their own todos"
  ON public.todos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own todos"
  ON public.todos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos"
  ON public.todos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos"
  ON public.todos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER set_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Populate todo_types
INSERT INTO public.todo_types (name, script) VALUES
  ('comment', 'Hi [Name], I just applied to the [Role] position at [Company] and wanted to reach out directly. I''m really excited about [something specific] and would love to learn more about your experience on the team. Let me know if you''re open to connecting!'),
  ('ask_for_intro', 'Hi [Name], I hope you''re doing well! I just applied for the [Role] position at [Company] and I''m really excited about the opportunity. I was wondering if you might be able to provide an introduction to someone on the hiring team or share any insights about the role? I''d really appreciate any guidance you could offer. Thanks so much!');

-- Regenerate todos for existing applications (3 per application: 1 comment + 2 intros)
WITH application_data AS (
  SELECT 
    ba.user_id,
    ba.company_id,
    ba.created_at
  FROM public.bolt_applications ba
  WHERE ba.user_id = 'b2610099-4341-47dc-8521-1f94d6ca9830'::uuid
),
todo_combinations AS (
  SELECT 
    ad.user_id,
    ad.company_id,
    ad.created_at,
    tt.id as todo_type_id,
    tt.script,
    ROW_NUMBER() OVER (PARTITION BY ad.company_id ORDER BY 
      CASE WHEN tt.name = 'comment' THEN 1 ELSE 2 END, 
      tt.id
    ) as rn
  FROM application_data ad
  CROSS JOIN public.todo_types tt
  WHERE tt.name IN ('comment', 'ask_for_intro')
)
INSERT INTO public.todos (user_id, company_id, todo_type_id, script, status, created_at)
SELECT 
  user_id,
  company_id,
  todo_type_id,
  script,
  'pending',
  created_at
FROM todo_combinations
WHERE (todo_type_id = (SELECT id FROM public.todo_types WHERE name = 'comment') AND rn = 1)
   OR (todo_type_id = (SELECT id FROM public.todo_types WHERE name = 'ask_for_intro') AND rn <= 3);

-- Create function to automatically create 3 todos when application is added
CREATE OR REPLACE FUNCTION create_application_todos()
RETURNS TRIGGER AS $$
DECLARE
  comment_type_id INTEGER;
  intro_type_id INTEGER;
  comment_script TEXT;
  intro_script TEXT;
BEGIN
  -- Get todo type IDs and scripts
  SELECT id, script INTO comment_type_id, comment_script
  FROM public.todo_types 
  WHERE name = 'comment';
  
  SELECT id, script INTO intro_type_id, intro_script
  FROM public.todo_types 
  WHERE name = 'ask_for_intro';
  
  -- Create 3 todos: 1 comment + 2 intro requests
  INSERT INTO public.todos (user_id, company_id, todo_type_id, script, status, created_at)
  VALUES 
    (NEW.user_id, NEW.company_id, comment_type_id, comment_script, 'pending', NEW.created_at),
    (NEW.user_id, NEW.company_id, intro_type_id, intro_script, 'pending', NEW.created_at),
    (NEW.user_id, NEW.company_id, intro_type_id, intro_script, 'pending', NEW.created_at);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run the function after application insert
CREATE TRIGGER create_todos_on_application_insert
  AFTER INSERT ON public.bolt_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_application_todos();

-- Grant necessary permissions
GRANT SELECT ON public.todo_types TO authenticated;
GRANT SELECT ON public.bolt_companies TO authenticated; 