-- Make project_id nullable so todoist tasks don't need a project
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;

-- Add todoist tracking columns to tasks
ALTER TABLE tasks ADD COLUMN todoist_task_id TEXT;
ALTER TABLE tasks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

-- Unique constraint for dedup on todoist sync
CREATE UNIQUE INDEX tasks_todoist_task_id_key ON tasks (todoist_task_id) WHERE todoist_task_id IS NOT NULL;

-- Add review status to tasks_daily_logs for end-of-day modal
ALTER TABLE tasks_daily_logs ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending';
