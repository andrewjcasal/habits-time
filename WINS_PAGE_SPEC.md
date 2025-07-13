# Wins Page Specification

## Overview
The Wins page will track achievements and positive moments based on habit streaks and notes analysis. It uses OpenAI to extract wins from user notes and displays them in a celebratory interface.

## Database Schema

### Wins Table
```sql
CREATE TABLE wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('note', 'habit_streak')),
  source_id UUID, -- references habits_notes.id or habits.id
  extracted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure uniqueness of wins per user based on content
  CONSTRAINT unique_user_win UNIQUE (user_id, title)
);
```

## Page Features

### UI Components
1. **Header Section**
   - Page title: "Wins & Achievements"
   - Celebration emoji or icon
   - Stats: Total wins, Recent wins this week

2. **Wins List**
   - Card-based layout
   - Each win shows:
     - Title (extracted from note)
     - Description (optional)
     - Source indicator (note/habit streak)
     - Date extracted
     - Source link (to original note or habit)

3. **Filtering & Sorting**
   - Filter by source type (notes vs habit streaks)
   - Sort by date (newest/oldest)
   - Search through win titles/descriptions

### Win Types

#### From Notes
- Extracted using OpenAI when notes are saved
- Examples: "Completed first 5K run", "Got promoted at work", "Successfully meditated for 30 days"

#### From Habit Streaks
- Generated when hitting streak milestones
- Examples: "7-day morning routine streak", "30-day meditation streak"

## OpenAI Integration

### Prompt for Win Extraction
```
Analyze this note and extract any wins, achievements, accomplishments, or positive moments. 
Return a JSON array of wins, each with a "title" (short, celebratory) and optional "description".

Focus on:
- Completed goals or milestones
- Personal achievements 
- Positive life events
- Habit successes
- Work/career wins
- Health improvements
- Learning accomplishments

Ignore:
- Future plans or intentions
- Negative events
- Routine daily activities
- Mundane updates

Note content: {note_content}

Return format:
[
  {
    "title": "Completed first marathon",
    "description": "Finished in 4:15 after 6 months of training"
  }
]
```

### Duplicate Prevention
- Use the `unique_user_win` constraint on `(user_id, title)`
- Before inserting, check if similar win already exists
- Use fuzzy matching on titles to prevent near-duplicates

## Implementation Flow

1. **Note Save Trigger**
   - When a note is saved in Notes page
   - Call OpenAI to extract wins
   - Insert unique wins into database

2. **Habit Streak Detection**
   - Check habit completion streaks
   - Generate wins for milestone achievements (7, 30, 100 days)

3. **Win Display**
   - Fetch user's wins ordered by date
   - Display in celebratory card format
   - Link back to source note/habit

## Navigation Integration
- Add "Wins" to left navigation with Trophy icon
- Position between "Habits" and "Notes"

## Future Enhancements
- Win categories/tags
- Achievement badges
- Sharing wins
- Win statistics and charts
- Manual win entry