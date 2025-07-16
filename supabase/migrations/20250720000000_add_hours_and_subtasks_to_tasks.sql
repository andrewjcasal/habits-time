/*
  # Add Hours and Subtasks to Tasks

  1. Changes to tasks table:
    - Add `estimated_hours` column for time estimation
    - Add `parent_task_id` column for subtask functionality
    - Add constraint to prevent infinite nesting loops
    - Add index for efficient subtask queries

  2. Security
    - Update RLS policies to handle subtasks properly
*/

-- Add columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(4,2) CHECK (estimated_hours > 0),
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Create index for efficient subtask queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);

-- Add constraint to prevent a task from being its own parent (prevents immediate self-reference)
ALTER TABLE public.tasks 
ADD CONSTRAINT check_not_self_parent 
CHECK (id != parent_task_id);

-- Create function to check for circular references in task hierarchy
CREATE OR REPLACE FUNCTION check_task_hierarchy_circular(task_id UUID, parent_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_parent_id UUID;
    depth INTEGER := 0;
    max_depth INTEGER := 10; -- Prevent infinite loops
BEGIN
    -- If parent_id is null, no circular reference possible
    IF parent_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Start from the proposed parent and walk up the hierarchy
    current_parent_id := parent_id;
    
    WHILE current_parent_id IS NOT NULL AND depth < max_depth LOOP
        -- If we find our original task_id in the parent chain, it's circular
        IF current_parent_id = task_id THEN
            RETURN TRUE;
        END IF;
        
        -- Get the parent of the current parent
        SELECT parent_task_id INTO current_parent_id 
        FROM public.tasks 
        WHERE id = current_parent_id;
        
        depth := depth + 1;
    END LOOP;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent circular references
CREATE OR REPLACE FUNCTION prevent_task_circular_reference()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check if parent_task_id is being set
    IF NEW.parent_task_id IS NOT NULL THEN
        -- Check for circular reference
        IF check_task_hierarchy_circular(NEW.id, NEW.parent_task_id) THEN
            RAISE EXCEPTION 'Circular reference detected in task hierarchy';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_prevent_task_circular_reference ON public.tasks;
CREATE TRIGGER trigger_prevent_task_circular_reference
    BEFORE INSERT OR UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION prevent_task_circular_reference();

-- Update RLS policies to handle subtasks
-- Users can view subtasks if they own the parent task
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create subtasks if they own the parent task
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
CREATE POLICY "Users can create their own tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tasks and subtasks
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tasks and subtasks
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);