# Development Notes

## Database Migrations

- Do not apply migrations automatically through Supabase CLI
- Create SQL migration files and user will apply them manually
- Migration files go in `sql/migrations/` folder
- Markdown files go to .claude/migrations

## Project Structure

- Main app: React TypeScript with Vite
- Database: Supabase PostgreSQL
- No automatic schema changes via tools

## Smart Day Boundary Logic

- Day doesn't end until user logs sleep in the time tracking system
- Migration 003_smart_day_boundary.sql implements this with get_effective_habit_date() function
- Habits remain available past midnight until sleep is logged

## Habits Daily Logs Filtering

- Show all habits for the day, but filter habits_daily_logs by sleep start time
- Only include completion logs created AFTER the most recent sleep start time
- This prevents habits completed before sleep from showing as "done" the next day
- Both Morning Routine and Shutdown should appear unchecked after sleep

## Dashboard Reflection System

- OpenAI generates personalized reflections based on recent habits_notes and completed habits
- Reddit integration uses OAuth to find relevant posts from people "1-2 steps ahead"
- General Reddit search across all subreddits, then filter to relevant communities
- Focus on shorter, actionable posts rather than long personal stories
- Reflection tone should be coaching/momentum-building, not therapeutic

## Environment Variables Needed

- OPENAI_API_KEY
- REDDIT_CLIENT_ID
- REDDIT_CLIENT_SECRET
- REDDIT_REDIRECT_URI (should be the generate-reflection function URL)
