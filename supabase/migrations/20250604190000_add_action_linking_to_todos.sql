/*
  # Add Action Linking to Todos

  1. Add action_id column to todos table
  2. Create function to handle todo completion with action creation
  3. Update RLS policies if needed
*/

-- Add action_id column to todos table
ALTER TABLE public.todos 
  ADD COLUMN action_id INTEGER REFERENCES public.actions(id) ON DELETE SET NULL;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_todos_action_id ON public.todos(action_id);

-- Create function to complete todo and create action
CREATE OR REPLACE FUNCTION complete_todo_with_action(
  p_todo_id INTEGER,
  p_contact_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_todo RECORD;
  v_company_name TEXT;
  v_todo_type_name TEXT;
  v_action_id INTEGER;
  v_note TEXT;
  v_action_taken TEXT;
BEGIN
  -- Get todo details with company and todo type
  SELECT 
    t.*,
    c.name as company_name,
    tt.name as todo_type_name
  INTO v_todo
  FROM public.todos t
  JOIN public.bolt_companies c ON t.company_id = c.id
  JOIN public.todo_types tt ON t.todo_type_id = tt.id
  WHERE t.id = p_todo_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Todo not found';
  END IF;
  
  -- Check if user owns this todo
  IF v_todo.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Build note and action_taken text
  v_note := v_todo.company_name || ' - ' || v_todo.todo_type_name;
  v_action_taken := v_todo.todo_type_name;
  
  -- Create the action
  INSERT INTO public.actions (
    user_id,
    action_taken,
    note,
    contact_id,
    follow_up_date,
    created_at
  ) VALUES (
    v_todo.user_id,
    v_action_taken,
    v_note,
    p_contact_id,
    NULL,
    NOW()
  ) RETURNING id INTO v_action_id;
  
  -- Update todo status and link to action
  UPDATE public.todos 
  SET 
    status = 'completed',
    action_id = v_action_id,
    updated_at = NOW()
  WHERE id = p_todo_id;
  
  -- Return success with action details
  RETURN json_build_object(
    'success', true,
    'todo_id', p_todo_id,
    'action_id', v_action_id,
    'note', v_note,
    'action_taken', v_action_taken
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION complete_todo_with_action TO authenticated;

-- Create a simpler function for completing todos without contact (for backwards compatibility)
CREATE OR REPLACE FUNCTION complete_todo(p_todo_id INTEGER)
RETURNS JSON AS $$
BEGIN
  RETURN complete_todo_with_action(p_todo_id, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION complete_todo TO authenticated; 