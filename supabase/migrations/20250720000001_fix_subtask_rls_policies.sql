/*
  # Fix Subtask RLS Policies

  The previous policies were too restrictive for subtask creation.
  This simplifies the policies to allow proper subtask creation.
*/

-- Simplify the INSERT policy for tasks
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
CREATE POLICY "Users can create their own tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Simplify the UPDATE policy for tasks  
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);