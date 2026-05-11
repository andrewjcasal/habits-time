# Playwright pipeline — Cassian

## Project identity

- **Name**: Cassian
- **Repo path**: `/Users/andrewcasal/dev/cassian`
- **Stack**: React + Vite + Supabase
- **Package manager**: npm (verified by qa-engineer's bootstrap — repo does not use bun)
- **Test runner command**: `npx playwright test`
- **Dev server command**: `npm run dev`
- **Dev server port (app dev)**: 5173 (Vite default — typically already running for the user)
- **Playwright webServer port**: 5174 — Playwright spawns its own `npm run dev -- --mode test --port 5174` so it can run alongside the user's dev server on 5173

## Repo layout — single app at root

- Source: `src/`
- Pages: `src/pages/` (Calendar.tsx, Habits.tsx, HabitDetail.tsx, etc.)
- Components: `src/components/`
- Hooks: `src/hooks/`
- Specs: `e2e/` (grouped by feature, e.g. `e2e/calendar/`, `e2e/habits/`)
- Config: `playwright.config.ts` at repo root
- Storage state: `e2e/.auth/user.json` (gitignored, written by `e2e/global.setup.ts`)
- Env: `.env.test` (gitignored — contains test user creds + service-role key)

## ClickUp

- **Workspace ID**: `90141206998`
- **List ID for PW: tasks**: `901416027191` ("Project 1")
- **Index task**: `86b9v94f4` — `Calendar + Habits — Test Objectives (index)` — feature inventory + linked PW: tasks
- **Reviewer(s) for `Review:` tasks**: Andrew

## Supabase — cloud "calendar" project (NOT local)

The pipeline targets the cloud Supabase project named **`calendar`**, not a local stack.

- **Project name**: `calendar`
- **Project ref**: `blnzwktmecwgdhmmasxi`
- **URL**: `https://blnzwktmecwgdhmmasxi.supabase.co`
- **Region**: `us-west-1`
- **Anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsbnp3a3RtZWN3Z2RobW1hc3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4OTE3NDIsImV4cCI6MjA0OTQ2Nzc0Mn0._TtV6sXGr1WlqWMgaYL0lMoEVrklQXJMlve-1cb-PMo`
- **Service role key**: in `.env.local` (Cassian's existing dev env points here). Copy into `.env.test` for global.setup.ts admin operations.
- **DB table prefix**: `cassian_` — every app table uses this prefix (e.g. `cassian_meetings`, `cassian_habits`, `cassian_habits_daily_logs`, `cassian_user_settings`, `cassian_projects`)

### Use Supabase MCP for DB operations

For any DB inspection, schema lookup, or seed verification, **use the Supabase MCP tools** (`mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__apply_migration`, `mcp__supabase__get_logs`, etc.) rather than CLI. The MCP is already scoped to the `calendar` project. The local Supabase stack is **not in use** for Cassian.

### Caveats

- This Supabase project is shared with the user's running dev environment — tests must use a clearly-namespaced test user (e.g. `test+playwright@cassian.local`) and clean up their seeded rows in `afterAll`. Don't pollute prod-side data.
- Migrations stay CLI-managed per global CLAUDE.md (`supabase db push`, files in `supabase/migrations/`); use MCP for read/inspect, not for `apply_migration`.

## Auth pattern

- Real login at `/login` via Supabase auth (email + password)
- Test user created via `admin.auth.admin.createUser` in `e2e/global.setup.ts`, signed in once, storage state saved to `e2e/.auth/user.json`
- Subsequent specs reuse the storage state via `auth.ts` fixture (`e2e/fixtures/auth.ts`)

## DB schema conventions

- All Cassian tables: `cassian_` prefix
- PostgREST joins in `.select()` also use prefixed names (e.g. `cassian_projects(*)`)
- See `CLAUDE.md` for full table-naming rules

## External services to mock

- **OpenAI**: tests must not hit `OPENAI_API_KEY` — mock when generate-reflection edge function is exercised
- **Reddit (OAuth + search)**: mock `page.route("**/reddit.com/**")` and any `**/functions/v1/generate-reflection*` calls
- **Supabase edge functions**: mock via `page.route("**/functions/v1/<fn-name>", ...)` → deterministic response
- **Supabase realtime**: mock if specs don't depend on live updates

## App-specific gotchas

- **Calendar settings via localStorage**: `Calendar.tsx` persists day-count, row-height, and other view settings to localStorage — specs that test defaults must clear localStorage before reload
- **Smart day boundary**: `get_effective_habit_date()` keeps "today" alive past midnight until sleep is logged. Habits specs that test "show all habits for today" must seed a sleep entry to define the day cleanly
- **Habits daily logs filtering**: only completion logs created **after** the most recent sleep start time count toward "done today" — seed sleep_start before completion log to test this filter
- **ModalContext architecture**: pages call `openXxxModal()` from `useModal()` — they never render modal components directly. Test selectors must target the centralized modal portal, not a page-local one
- **Default day-start hour**: 5 AM (read `useSettings.ts` and `calendarGrid.ts` for source of truth)
- **No anonymous IIFEs in JSX**: per repo style, derived data uses `useMemo` — selectors should be stable

## Bug log

- **Path**: `docs/bugs-found.md` (Cassian has no `audit/` dir — engineer creates this file when first needed)

## Feature docs

- **Directory**: not yet established. Researcher reads source code directly. Index task `86b9v94f4` in ClickUp serves as a feature inventory in the meantime.

## Pipeline constraints

- All tests run against the cloud `calendar` Supabase project — there is no local stack for Cassian
- `fullyParallel: false`, `workers: 1`
- Each spec owns its own data: seed in `beforeAll`, clean up in `afterAll` using the service-role admin client. Always namespace test data so it can be safely deleted (e.g. `test+playwright@cassian.local`, meeting titles prefixed with `[E2E]`).
- No mocking of Cassian's own Supabase calls — only mock external APIs (OpenAI, Reddit)
- Playwright runs on `:5174` so it doesn't fight the user's regular dev server on `:5173`. `reuseExistingServer: false` is kept so Playwright never accidentally hits 5173 (which loads `.env.local` → prod-ish data) instead of its own `--mode test` server reading `.env.test`.
