-- ClickUp integration: store the user's personal API token and tag tasks
-- imported from ClickUp so the scheduler can treat them separately from
-- Todoist (different work-hour window).

BEGIN;

-- 1. User settings: personal ClickUp API key.
ALTER TABLE public.cassian_user_settings
  ADD COLUMN IF NOT EXISTS clickup_api_key text;

-- 2. Tasks: external id + unique partial index (mirrors the Todoist shape
--    added by 20260324000000_todoist_calendar_integration.sql).
ALTER TABLE public.cassian_tasks
  ADD COLUMN IF NOT EXISTS clickup_task_id text;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_clickup_task_id_key
  ON public.cassian_tasks (clickup_task_id)
  WHERE clickup_task_id IS NOT NULL;

COMMIT;
