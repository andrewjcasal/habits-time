-- Create tasks_daily_logs table for task completion tracking
CREATE TABLE tasks_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  
  -- Scheduled time (from auto-scheduling)
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  estimated_hours DECIMAL(4,2), -- Duration of this chunk
  
  -- Actual time worked (filled when user completes)
  actual_start_time TIME,
  actual_end_time TIME,
  completed_at TIMESTAMP,
  time_spent_hours DECIMAL(4,2),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Allow multiple chunks per task per day
  UNIQUE(task_id, user_id, log_date, scheduled_start_time)
);

-- Create indexes for performance
CREATE INDEX idx_tasks_daily_logs_user_date ON tasks_daily_logs(user_id, log_date);
CREATE INDEX idx_tasks_daily_logs_task ON tasks_daily_logs(task_id);
CREATE INDEX idx_tasks_daily_logs_incomplete ON tasks_daily_logs(user_id, log_date) WHERE completed_at IS NULL;

-- Add tracking columns to existing tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hours_completed DECIMAL(4,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hours_remaining DECIMAL(4,2);

-- Update existing tasks to set hours_remaining = estimated_hours
UPDATE tasks 
SET hours_remaining = estimated_hours 
WHERE hours_remaining IS NULL AND estimated_hours IS NOT NULL;

-- Create function to automatically calculate remaining hours
CREATE OR REPLACE FUNCTION update_task_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tasks 
  SET 
    hours_completed = (
      SELECT COALESCE(SUM(time_spent_hours), 0) 
      FROM tasks_daily_logs 
      WHERE task_id = COALESCE(NEW.task_id, OLD.task_id) 
        AND completed_at IS NOT NULL
    ),
    hours_remaining = GREATEST(0, estimated_hours - (
      SELECT COALESCE(SUM(time_spent_hours), 0) 
      FROM tasks_daily_logs 
      WHERE task_id = COALESCE(NEW.task_id, OLD.task_id) 
        AND completed_at IS NOT NULL
    ))
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update task hours
DROP TRIGGER IF EXISTS trigger_update_task_hours ON tasks_daily_logs;
CREATE TRIGGER trigger_update_task_hours
  AFTER INSERT OR UPDATE OR DELETE ON tasks_daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_task_hours();

-- Enable RLS on tasks_daily_logs
ALTER TABLE tasks_daily_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tasks_daily_logs
CREATE POLICY "Users can view their own task logs" ON tasks_daily_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task logs" ON tasks_daily_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task logs" ON tasks_daily_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task logs" ON tasks_daily_logs
  FOR DELETE USING (auth.uid() = user_id);