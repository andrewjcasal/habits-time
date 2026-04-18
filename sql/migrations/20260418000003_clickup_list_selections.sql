-- Per-user opt-in for ClickUp lists. The task fetcher only pulls tasks from
-- lists that are is_enabled=true. Rows are created/updated as the user
-- toggles lists in the calendar settings modal.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cassian_clickup_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clickup_list_id text NOT NULL,
  clickup_space_id text,
  clickup_team_id text,
  name text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, clickup_list_id)
);

CREATE INDEX IF NOT EXISTS idx_cassian_clickup_lists_user_enabled
  ON public.cassian_clickup_lists (user_id, is_enabled);

ALTER TABLE public.cassian_clickup_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cassian_clickup_lists_owner_all ON public.cassian_clickup_lists;
CREATE POLICY cassian_clickup_lists_owner_all
  ON public.cassian_clickup_lists
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;
