# Todoist Priority System

## Problem Statement
When hyperfixated on work, Todoist becomes overwhelming. Need to identify:
- **Easy wins** - Quick tasks that can be knocked out
- **High priority** - Tasks with repercussions or high opportunity cost
- **Context-aware** - AI-powered categorization based on title/description

## Proposed Solution

### Database Schema
Add a `todoist_tasks` table to store AI-generated context:

```sql
CREATE TABLE todoist_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  todoist_task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  ai_category TEXT CHECK (ai_category IN ('easy', 'high_priority', 'normal')),
  ai_reasoning TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, todoist_task_id)
);
```

### AI Categorization Logic
Use OpenAI to analyze tasks and categorize them:

#### Easy Tasks
- Can be completed in < 15 minutes
- No dependencies or complex thinking required
- Administrative/maintenance tasks
- Examples: "Reply to email", "Update address", "Schedule appointment"

#### High Priority Tasks
- Have deadlines with consequences
- Block other important work
- High opportunity cost if delayed
- Impact relationships, finances, or career
- Examples: "Submit tax documents", "Respond to client proposal", "Fix production bug"

#### Normal Tasks
- Everything else that doesn't fit easy or high priority

### Implementation Plan

1. **Database Migration** - Create todoist_tasks table
2. **AI Analysis Edge Function** - Analyze individual tasks
3. **Sync Logic** - Detect changes and update only modified tasks
4. **UI Updates** - Add priority columns to Todoist page
5. **Batch Processing** - Initial analysis of existing tasks

### API Integration Strategy

#### Initial Sync
- Fetch all Todoist tasks
- Check which tasks don't exist in our database
- Send new tasks to AI for analysis
- Store results in todoist_tasks table

#### Incremental Updates
- Compare task title/description with stored version
- If changed, re-analyze only that task
- Update database with new AI categorization

#### AI Prompt Template
```
Analyze this task and categorize it as "easy", "high_priority", or "normal".

Task: "{title}"
Description: "{description}"

Criteria:
- Easy: < 15 minutes, no complex thinking, administrative
- High Priority: Deadlines, consequences, blocks other work, high opportunity cost
- Normal: Everything else

Respond with JSON:
{
  "category": "easy|high_priority|normal",
  "reasoning": "Brief explanation of why this category was chosen"
}
```

### UI Enhancements

#### New Todoist Page Layout
- Add "Priority" column showing AI category
- Filter tabs: All | Easy Wins | High Priority | Normal
- Visual indicators: 🟢 Easy, 🔴 High Priority, ⚪ Normal
- Show AI reasoning on hover/expand

#### Smart Notifications
- Badge counts for easy wins and high priority items
- Quick access to "5 Easy Wins" or "Critical Items"

### Technical Implementation Notes

1. **Change Detection**: Store hash of title+description to detect changes
2. **Rate Limiting**: Batch AI requests to avoid hitting OpenAI limits
3. **Caching**: Cache AI responses for identical task content
4. **Error Handling**: Graceful fallback if AI analysis fails
5. **Privacy**: Only send task title/description to AI, not sensitive metadata

### Future Enhancements

- Learn from user behavior (if they consistently complete "normal" tasks, maybe they're actually "easy")
- Time-based priority (tasks become high priority as deadlines approach)
- Context awareness (meetings become high priority closer to start time)
- Integration with calendar for deadline detection

## Next Steps

1. Create database migration
2. Build AI analysis edge function
3. Update Todoist sync to include change detection
4. Modify UI to show priority categories
5. Add filtering and visual indicators