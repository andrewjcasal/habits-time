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

## Modal & Dialog Architecture

- All modals and dialogs are managed by `ModalContext` (`src/contexts/ModalContext.tsx`)
- Modal components are rendered inside the `ModalProvider`, not in individual pages
- Pages call `openXxxModal()` from `useModal()` — they never render modal components directly
- Only one modal can be open at a time — `getClosedModalState()` closes all others before opening a new one
- Calendar-specific UI state (tooltips, drag state, note modals) can stay local to Calendar.tsx

## UI Design

- Use the `frontend-design` skill for all new components, pages, and significant layout updates
- Design direction: warm editorial minimalism — DM Serif Display for headings, DM Sans for body
- Color palette: warm ivory backgrounds (#FDFBF7), amber accents, neutral-900 for primary actions

## Code Style

- Do not use anonymous functions (IIFEs) inside JSX — extract logic into `useMemo`, named functions, or variables before the return statement
- Prefer `useMemo` for derived data that needs computation (e.g., grouping, filtering, sorting)

## Database Table Naming

- All Supabase tables used by this project must have the `cassian_` prefix
- Example: `cassian_tasks`, `cassian_habits`, `cassian_user_settings`
- When creating new tables, always use the `cassian_` prefix
- When referencing tables in `.from()` calls, always use the prefixed name
- PostgREST join references in `.select()` also use the prefixed names (e.g., `cassian_projects(*)`)

Always follow user CLAUDE.md unless overridden by this file.