# Habits Page Documentation

## Current Functionalities

### Core Features

- **Habit Display**: Shows list of user's habits with current completion status
- **Habit Completion Tracking**: Toggle habits between completed/incomplete states
- **Dynamic Start Times**: Habits start 15 minutes earlier if completed on time, maintain same time if not completed
- **Time Editing**: Click on habit times to manually adjust start times
- **Update Times Button**: Manually trigger recalculation of habit start times based on completion history

### UI Components

- **Habit Cards**: Each habit displays in a card with completion checkbox, name, duration, and start time
- **Completion Status**: Visual indicators (green checkmark for completed, circle for incomplete)
- **Time Display**: 12-hour format time display with AM/PM
- **Inline Time Editing**: Click time to edit with time input field
- **Status Messages**: Loading states and error handling

### Data Management

- **Real-time Updates**: Local state updates immediately on completion/time changes
- **Supabase Integration**: Persists habit logs and time updates to database
- **Daily Logs**: Tracks completion with actual start/end times and notes
- **User-specific**: Habits filtered by user ID or visible public habits

### Business Logic

- **Adaptive Scheduling**: Early completion (on time) moves next day's start time 15 minutes earlier
- **Completion Tracking**: Records actual start/end times when marking complete
- **Time Persistence**: Manual time changes are saved to user's habit preferences

## Requested Changes

### 1. Auto-uncheck Habits After Sleep Start

- **Requirement**: Automatically uncheck all habits immediately when sleep starts
- **Implementation**:
  - Query most recent sleep log from habits_time_logs (activity_type_id = '951bc26a-a863-4996-8a02-f4da2d148aa9')
  - Check if current time is past the sleep start_time
  - If true, automatically reset all habit completion status for the day
  - Add this check to the habits loading/display logic

### 2. 7-Day Morning and Shutdown Routine Table

- **Requirement**: Display table showing last 7 days of morning routine and shutdown completion times
- **Data Source**: habits_daily_logs table
- **Columns Needed**:
  - Date
  - Morning routine completion time (from habits_daily_logs where habit is morning routine)
  - Shutdown routine completion time (from habits_daily_logs where habit is shutdown)
- **Implementation Needed**:
  - Query last 7 days of habits_daily_logs for morning and shutdown habits
  - Create table component showing completion times
  - Format actual_start_time or actual_end_time appropriately
