-- Create table for storing AI-analyzed Todoist task priorities
CREATE TABLE todoist_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  todoist_task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  ai_category TEXT CHECK (ai_category IN ('easy', 'high_priority', 'normal')),
  ai_reasoning TEXT,
  content_hash TEXT, -- Hash of title+description to detect changes
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, todoist_task_id)
);

-- Add RLS policies
ALTER TABLE todoist_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own todoist tasks" 
ON todoist_tasks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own todoist tasks" 
ON todoist_tasks FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todoist tasks" 
ON todoist_tasks FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todoist tasks" 
ON todoist_tasks FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_todoist_tasks_user_id ON todoist_tasks(user_id);
CREATE INDEX idx_todoist_tasks_task_id ON todoist_tasks(user_id, todoist_task_id);