# Task Completion System - Daily Acknowledgment & Retroactive Updates

## Problem Statement

The current task scheduling system generates tasks from today onwards, but lacks a mechanism to:
1. Acknowledge task completion on a daily basis
2. Maintain historical accuracy of work performed
3. Handle retroactive adjustments that affect future scheduling

Users need to track what they actually accomplished each day while maintaining the auto-scheduling system for incomplete work.

## Solution Overview

Implement a **Daily Task Completion Log** system with retroactive update capabilities that provides:
- Daily completion tracking separate from overall task completion
- Historical view of scheduled vs actual work performed
- Ability to adjust past work records and cascade changes to future scheduling

## Database Schema Changes

### New Table: tasks_daily_logs

```sql
CREATE TABLE tasks_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  
  -- Scheduled time (from auto-scheduling)
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  
  -- Actual time worked
  actual_start_time TIME,
  actual_end_time TIME,
  completed_at TIMESTAMP,
  
  time_spent_hours DECIMAL(4,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure one log per task per day per user
  UNIQUE(task_id, user_id, log_date)
);

CREATE INDEX idx_tasks_daily_logs_user_date ON tasks_daily_logs(user_id, log_date);
CREATE INDEX idx_tasks_daily_logs_task ON tasks_daily_logs(task_id);
```

### Enhanced Tasks Table

```sql
-- Add tracking columns to existing tasks table
ALTER TABLE tasks ADD COLUMN hours_completed DECIMAL(4,2) DEFAULT 0;
ALTER TABLE tasks ADD COLUMN hours_remaining DECIMAL(4,2);

-- Trigger to automatically calculate remaining hours
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
    hours_remaining = estimated_hours - hours_completed
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_hours
  AFTER INSERT OR UPDATE OR DELETE ON tasks_daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_task_hours();
```

## Implementation Details

### 1. Two-Level Completion System

#### Daily Completion (`tasks_daily_logs`)
- **Purpose**: "I worked on this task today"
- **Effect**: Visual indicator with actual time tracking
- **Scheduling**: Task chunks remain visible but marked as completed for that day

#### Task Completion (`tasks.is_complete`)
- **Purpose**: "This entire task is finished"
- **Effect**: Task disappears from all future scheduling
- **Scheduling**: Task is removed from the scheduling algorithm

### 2. Data Flow

#### When Task Chunk is Auto-Scheduled
```tsx
// In useCalendarData.ts - during task scheduling
const createDailyLog = async (taskId, date, startTime, endTime) => {
  await supabase.from('tasks_daily_logs').upsert({
    task_id: taskId,
    user_id: user.id,
    log_date: format(date, 'yyyy-MM-dd'),
    scheduled_start_time: formatTime(startTime),
    scheduled_end_time: formatTime(endTime)
  }, {
    onConflict: 'task_id,user_id,log_date'
  })
}
```

#### When User Completes Daily Work
```tsx
const handleMarkDayComplete = async (taskId, date, actualStart, actualEnd) => {
  const timeSpent = calculateHours(actualStart, actualEnd)
  
  await supabase.from('tasks_daily_logs').update({
    actual_start_time: actualStart,
    actual_end_time: actualEnd,
    completed_at: new Date().toISOString(),
    time_spent_hours: timeSpent
  }).match({ 
    task_id: taskId, 
    log_date: format(date, 'yyyy-MM-dd')
  })
  
  // Trigger will automatically update tasks.hours_completed & hours_remaining
}
```

### 3. Calendar UI Updates

#### Current Day & Future (Active Scheduling)
```tsx
const renderActiveTaskChunk = (task, date) => {
  const dailyLog = getDailyCompletion(task.id, date)
  const isCompleteToday = dailyLog?.completed_at
  
  return (
    <div 
      className={`task-block cursor-pointer ${isCompleteToday ? 'opacity-60 bg-green-50' : 'bg-yellow-50'}`}
      onClick={() => handleTaskClick(task)}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium truncate">{task.title}</span>
        {isCompleteToday && <CheckCircle className="w-3 h-3 text-green-500" />}
      </div>
      <div className="text-xs text-gray-600">
        {task.estimated_hours}h scheduled
      </div>
      {isCompleteToday && (
        <div className="text-xs text-green-600">
          ✓ {dailyLog.time_spent_hours}h completed
        </div>
      )}
    </div>
  )
}
```

#### Past Days (Historical View)
```tsx
const renderPastTaskChunk = (task, date) => {
  const dailyLog = getDailyCompletion(task.id, date)
  
  if (!dailyLog) return null // No log = wasn't scheduled
  
  const wasCompleted = dailyLog.completed_at
  const scheduledTime = `${dailyLog.scheduled_start_time}-${dailyLog.scheduled_end_time}`
  const actualTime = wasCompleted 
    ? `${dailyLog.actual_start_time}-${dailyLog.actual_end_time}`
    : null

  return (
    <div 
      className={`task-block cursor-pointer ${wasCompleted ? 'bg-green-100' : 'bg-red-100'}`}
      onClick={() => handleEditPastTask(task, date, dailyLog)}
    >
      <div className="font-medium">{task.title}</div>
      <div className="text-xs text-gray-600">
        Planned: {scheduledTime}
      </div>
      {wasCompleted ? (
        <div className="text-xs text-green-600">
          ✓ Actual: {actualTime} ({dailyLog.time_spent_hours}h)
        </div>
      ) : (
        <div className="text-xs text-red-600">✗ Not completed</div>
      )}
    </div>
  )
}
```

### 4. Retroactive Updates

#### Update Handler
```tsx
const handleRetroactiveTimeAdjustment = async (
  taskId: string, 
  date: Date, 
  newActualHours: number
) => {
  const dateStr = format(date, 'yyyy-MM-dd')
  
  // 1. Update the historical record
  await supabase.from('tasks_daily_logs').update({
    time_spent_hours: newActualHours,
    // Recalculate end time based on start time + new hours
    actual_end_time: calculateEndTime(dailyLog.actual_start_time, newActualHours)
  }).match({ task_id: taskId, log_date: dateStr })
  
  // 2. Database trigger automatically updates tasks.hours_remaining
  
  // 3. Clear future scheduling cache to force rescheduling
  setTasksScheduled(false)
  setScheduledTasksCache(new Map())
  
  // 4. useCalendarData will automatically reschedule based on new hours_remaining
  
  // 5. Show user feedback
  toast.success(`Updated ${taskTitle} - future scheduling adjusted`)
}
```

#### Modified Scheduling Logic
```tsx
// In useCalendarData.ts - use remaining hours instead of estimated hours
const unscheduledTasks = allTasks.filter(task => 
  !task.parent_task_id &&
  task.status !== 'completed' &&
  task.hours_remaining > 0 // Key change: use remaining hours
)

// Schedule based on remaining work
const scheduledChunks = scheduleTaskInAvailableSlots(
  task.hours_remaining, // Not task.estimated_hours
  dayColumn.date,
  { ...task, isAutoScheduled: true },
  allScheduledChunks
)
```

### 5. New UI Components

#### Enhanced CalendarTaskModal
```tsx
const CalendarTaskModal = ({ task, date, onClose }) => {
  const [actualStartTime, setActualStartTime] = useState('')
  const [actualEndTime, setActualEndTime] = useState('')
  const [timeSpent, setTimeSpent] = useState(0)
  
  const isPastDate = date < new Date()
  const dailyLog = getDailyCompletion(task.id, date)
  
  return (
    <Modal>
      <h3>{task.title}</h3>
      <p>Estimated: {task.estimated_hours}h</p>
      
      {isPastDate ? (
        // Past task editing
        <PastTaskEditor 
          task={task} 
          date={date} 
          dailyLog={dailyLog}
          onUpdate={handleRetroactiveTimeAdjustment}
        />
      ) : (
        // Current/future task completion
        <ActiveTaskForm
          task={task}
          date={date}
          onComplete={handleMarkDayComplete}
        />
      )}
    </Modal>
  )
}
```

#### PastTaskEditor Component
```tsx
const PastTaskEditor = ({ task, date, dailyLog, onUpdate }) => {
  const [editingHours, setEditingHours] = useState(dailyLog?.time_spent_hours || 0)
  const [notes, setNotes] = useState(dailyLog?.notes || '')
  
  const handleSave = async () => {
    await onUpdate(task.id, date, editingHours)
    // Update notes as well
    await supabase.from('tasks_daily_logs').update({
      notes: notes
    }).match({ task_id: task.id, log_date: format(date, 'yyyy-MM-dd') })
  }
  
  return (
    <div className="space-y-4">
      <div>
        <label>Time Actually Spent:</label>
        <input 
          type="number" 
          value={editingHours}
          onChange={e => setEditingHours(Number(e.target.value))}
          step="0.25"
          min="0"
          className="border rounded px-2 py-1 ml-2"
        />
        <span className="text-sm text-gray-500 ml-1">hours</span>
      </div>
      
      <div>
        <label>Notes:</label>
        <textarea 
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="border rounded px-2 py-1 w-full mt-1"
          rows={3}
          placeholder="What happened? Any blockers or insights?"
        />
      </div>
      
      {dailyLog?.time_spent_hours && (
        <div className="text-sm text-gray-600">
          Originally logged: {dailyLog.time_spent_hours}h
        </div>
      )}
      
      <div className="flex gap-2">
        <button onClick={handleSave} className="btn-primary">
          Update & Reschedule Future
        </button>
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  )
}
```

## Migration Strategy

### Phase 1: Database Setup
1. Create `tasks_daily_logs` table
2. Add columns to `tasks` table
3. Create database triggers
4. Migrate existing task data

### Phase 2: Basic Daily Logging
1. Update calendar to create daily logs during scheduling
2. Add completion UI for current/future tasks
3. Visual indicators for completed daily work

### Phase 3: Historical View
1. Render past task chunks with completion status
2. Add basic editing capabilities for past entries

### Phase 4: Retroactive Updates
1. Implement cascade rescheduling logic
2. Enhanced past task editor
3. User feedback and notifications

## Benefits

1. **Daily Acknowledgment**: Clear way to mark daily progress
2. **Historical Accuracy**: Precise record of actual work performed
3. **Flexible Adjustments**: Retroactive changes cascade to future scheduling
4. **Analytics Ready**: Rich data for productivity insights
5. **Seamless Integration**: Works with existing auto-scheduling system
6. **User Control**: Balance between automation and manual oversight

## Technical Considerations

- **Performance**: Use database triggers to minimize real-time calculations
- **Caching**: Clear scheduling cache when retroactive changes are made
- **Validation**: Ensure time adjustments don't create negative remaining hours
- **Conflict Resolution**: Handle edge cases where multiple chunks exist per day
- **Data Integrity**: Cascade deletes when tasks are removed entirely

This system provides the daily task acknowledgment you need while maintaining the power of your existing auto-scheduling system.