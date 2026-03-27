-- Add todoist filter config to habits
ALTER TABLE cassian_habits ADD COLUMN todoist_filter_labels TEXT[];
ALTER TABLE cassian_habits ADD COLUMN todoist_task_duration INTEGER DEFAULT 3;

-- Ephemeral table for imported todoist tasks per habit
CREATE TABLE cassian_habit_todoist_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES cassian_habits(id) ON DELETE CASCADE,
  todoist_task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 3,
  sort_order INTEGER DEFAULT 0,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(habit_id, todoist_task_id)
);

ALTER TABLE cassian_habit_todoist_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own habit todoist tasks" ON cassian_habit_todoist_tasks
  FOR ALL USING (auth.uid() = user_id);
