/*
  # Populate Todos for Existing Applications and Create Trigger

  1. Populate todos for existing applications
  2. Create trigger function to automatically create todos for new applications
  3. Create trigger to run the function on application inserts
*/

-- Insert todos for existing applications (3 per application)
WITH application_todos AS (
  SELECT 
    ba.user_id,
    bc.name as company_name,
    ba.created_at,
    unnest(ARRAY[
      CONCAT('Comment - ', bc.name),
      CONCAT('Ask for intro - ', bc.name),
      CONCAT('Ask for intro - ', bc.name)
    ]) as note
  FROM public.bolt_applications ba
  JOIN public.bolt_companies bc ON ba.company_id = bc.id
  WHERE ba.user_id = 'b2610099-4341-47dc-8521-1f94d6ca9830'::uuid
)
INSERT INTO public.todos (user_id, note, status, created_at)
SELECT 
  user_id,
  note,
  'pending' as status,
  created_at
FROM application_todos
WHERE NOT EXISTS (
  SELECT 1 FROM public.todos t 
  WHERE t.user_id = application_todos.user_id 
  AND t.note LIKE CONCAT('%', application_todos.company_name, '%')
);

-- Create function to automatically create 3 todos when application is added
CREATE OR REPLACE FUNCTION create_application_todo()
RETURNS TRIGGER AS $$
DECLARE
  company_name TEXT;
BEGIN
  -- Get company name
  SELECT bc.name INTO company_name
  FROM public.bolt_companies bc
  WHERE bc.id = NEW.company_id;
  
  -- Create 3 todos: 1 comment + 2 intro requests
  INSERT INTO public.todos (user_id, note, status, created_at)
  VALUES 
    (NEW.user_id, CONCAT('Comment - ', company_name), 'pending', NEW.created_at),
    (NEW.user_id, CONCAT('Ask for intro - ', company_name), 'pending', NEW.created_at),
    (NEW.user_id, CONCAT('Ask for intro - ', company_name), 'pending', NEW.created_at);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run the function after application insert
CREATE TRIGGER create_todo_on_application_insert
  AFTER INSERT ON public.bolt_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_application_todo();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.bolt_companies TO authenticated;
GRANT SELECT ON public.bolt_positions TO authenticated; 