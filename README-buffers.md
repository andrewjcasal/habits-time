# Buffer System

## Overview

The Buffer System is a weekly time allocation feature that allows users to reserve blocks of time for specific categories throughout the week. Buffers automatically fill remaining whitespace in the calendar up to the week ending time, and dynamically adjust based on actual time spent in those categories.

## Concept

Buffers represent **flexible time allocation** for categories that don't have fixed schedules but need dedicated time throughout the week. They solve the problem of wanting to ensure you spend a certain amount of time on important areas of your life without having to schedule every instance in advance.

### Example Use Cases

- **Relationship/Social Time**: Allocate 10 hours per week for dates, social activities, and quality time
- **Health & Fitness**: Reserve 5 hours per week for gym sessions, walks, or other physical activities  
- **Learning & Development**: Set aside 8 hours per week for reading, courses, or skill development
- **Creative Projects**: Dedicate 6 hours per week for creative pursuits or hobbies

## How It Works

### 1. Buffer Creation
- Navigate to Categories → Buffers tab
- Create a new buffer by selecting:
  - **Category**: Which category this buffer applies to
  - **Weekly Hours**: How many hours per week to allocate (e.g., 10 hours)

### 2. Buffer Placement
- Buffers automatically fill **actual whitespace** in your calendar - empty time slots not occupied by higher priority items
- They are placed in available time slots throughout the week up until your configured week ending time
- Buffers occupy the same time slots as other calendar events, but only in slots that are completely empty
- Higher priority items (meetings, habits, tasks, sessions) take precedence - buffers fill around them
- They appear as actual calendar blocks showing available time for that category

### 3. Dynamic Adjustment
When you spend time on activities in that category:

**Before Activity:**
```
Relationship Buffer: 10 hours remaining
[██████████] (10 hours of buffer blocks in calendar)
```

**After 2-hour gym session categorized as "Relationship":**
```
Relationship Buffer: 8 hours remaining  
[████████  ] (8 hours of buffer blocks in calendar)
```

The buffer automatically reduces by the actual time spent, showing remaining allocation.

## Technical Implementation

### Database Schema

#### `category_buffers` table
```sql
CREATE TABLE category_buffers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  weekly_hours DECIMAL(4,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### UI Components

#### Categories Page Updates
- Remove "This Week" and "Last Week" tabs
- Add new "Buffers" tab
- Buffer management interface with:
  - Category selector dropdown
  - Weekly hours input (decimal, e.g., 10.5)
  - Add/Edit/Delete buffer functionality

#### Calendar Integration
- Buffer blocks render in remaining whitespace
- Visual distinction from other calendar events
- Show remaining hours for each buffer
- Update in real-time as categorized activities are logged

### Algorithm

#### Buffer Calculation
1. **Identify Empty Time Slots**:
   - Scan all time slots from now until week ending time
   - Mark slots occupied by higher priority items (meetings, habits, tasks, sessions)
   - Remaining empty slots = available whitespace for buffers

2. **Fill Available Slots with Buffers**:
   - For each active buffer, place blocks in completely empty time slots
   - Distribute buffer hours across available slots throughout the week
   - If multiple buffers need the same slots, use priority system to determine placement
   - Buffer blocks occupy actual time slots, not overlay existing items

3. **Real-time Adjustment**:
   - Monitor categorized activities (meetings, task logs, manual entries)
   - When activity is categorized, reduce corresponding buffer
   - Recalculate and redistribute remaining buffer blocks

#### Example Calculation

```javascript
// Weekly buffer: 10 hours for "Relationship" category
let relationshipBuffer = 10;

// Current week activities in "Relationship" category:
const activitiesThisWeek = [
  { type: "meeting", duration: 2, category: "relationship" },     // Date night
  { type: "task_log", duration: 1.5, category: "relationship" }   // Call friend
];

// Calculate remaining buffer
const totalSpent = activitiesThisWeek.reduce((sum, activity) => sum + activity.duration, 0);
const remainingBuffer = relationshipBuffer - totalSpent; // 10 - 3.5 = 6.5 hours

// Find empty time slots and fill with 6.5 hours of relationship buffer blocks
const emptySlots = findEmptyTimeSlots(weekStartDate, weekEndDate);
const bufferBlocks = allocateBufferToSlots(remainingBuffer, emptySlots, "relationship");
// bufferBlocks now occupy actual calendar time slots, not overlay existing items
```

## User Experience Flow

### Setting Up Buffers
1. Go to Categories page
2. Click "Buffers" tab  
3. Click "Add Buffer"
4. Select category (e.g., "Relationship")
5. Enter weekly hours (e.g., 10)
6. Save buffer

### Using Buffers
1. **View Calendar**: See buffer blocks distributed in available time slots
2. **Log Activity**: When doing something in that category, categorize it appropriately
3. **Automatic Adjustment**: Buffer blocks reduce automatically
4. **Week Reset**: Buffers reset to full allocation each week

### Visual Indicators
- **Buffer blocks**: Distinct color/style showing category and remaining hours
- **Tooltip**: Hover to see "Relationship Buffer: 6.5 hours remaining"
- **Progress**: Visual indication of buffer utilization

## Benefits

### Time Awareness
- Visual representation of how much time is allocated vs. actually spent
- Helps identify categories that are under or over-allocated

### Flexible Planning  
- No need to schedule every activity in advance
- Maintains time boundaries while allowing spontaneity

### Life Balance
- Ensures important areas of life get adequate time
- Prevents work from consuming all available hours

### Goal Tracking
- Clear visibility into whether weekly time goals are being met
- Historical data on category time allocation

## Future Enhancements

### Phase 2 Features
- **Buffer Templates**: Predefined buffer sets (e.g., "Balanced Life", "Focus Mode")
- **Seasonal Adjustments**: Different buffer allocations for different times of year
- **Buffer Priorities**: When buffers conflict, priority system determines placement
- **Rollover**: Unused buffer hours can roll to next week (with limits)

### Phase 3 Features  
- **Smart Suggestions**: AI suggests optimal buffer allocations based on historical data
- **Habit Integration**: Automatically create buffers based on habit patterns
- **Team Buffers**: Shared buffer pools for couples or families
- **Buffer Analytics**: Deep insights into buffer utilization over time

## Implementation Notes

### Calendar Rendering
- Buffers occupy actual empty time slots in the calendar grid
- Use distinct visual styling to differentiate from scheduled items (different border style, pattern, or transparency)
- Show category color but with buffer-specific visual treatment
- Buffers are placed in the same calendar grid system as other events, filling actual whitespace

### Performance Considerations
- Cache buffer calculations to avoid real-time computation
- Batch buffer updates to prevent excessive re-renders
- Optimize conflict detection for buffer placement

### Data Consistency
- Ensure buffer reductions are atomic with activity logging
- Handle edge cases (negative buffers, overlapping activities)
- Weekly rollover should be handled cleanly

This buffer system provides a powerful way to manage flexible time allocation while maintaining the structure needed for effective time management.