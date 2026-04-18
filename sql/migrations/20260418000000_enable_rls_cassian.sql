-- Enable RLS and apply consistent policies for all cassian_* tables.
--
-- Strategy:
--   * Per-user tables (have a user_id column):
--       FOR ALL TO authenticated USING/WITH CHECK (user_id = auth.uid())
--   * Child tables (ownership derived from a parent cassian_* row):
--       FOR ALL TO authenticated USING/WITH CHECK (EXISTS parent WHERE parent.user_id = auth.uid())
--   * Shared lookup tables (no user_id, no per-user parent):
--       FOR ALL TO authenticated USING (true) WITH CHECK (true)
--       (single-user app — safe; tighten later if it ever becomes multi-tenant)
--
-- Each policy is (re)created via DROP IF EXISTS + CREATE so the migration is idempotent.

BEGIN;

-- =========================================================================
-- Group A: per-user tables (user_id = auth.uid())
-- =========================================================================

DO $$
DECLARE
  tbl text;
  per_user_tables text[] := ARRAY[
    'cassian_behaviors',
    'cassian_calendar_notes',
    'cassian_category_buffers',
    'cassian_contracts',
    'cassian_daily_reflections',
    'cassian_experiences',
    'cassian_feedback',
    'cassian_habit_todoist_tasks',
    'cassian_habits',
    'cassian_habits_activity_types',
    'cassian_habits_daily_logs',
    'cassian_habits_time_logs',
    'cassian_issues',
    'cassian_meeting_categories',
    'cassian_meeting_habits',
    'cassian_meetings',
    'cassian_note_issues',
    'cassian_notes',
    'cassian_people',
    'cassian_projects',
    'cassian_sessions',
    'cassian_social_posts',
    'cassian_socials',
    'cassian_subhabit_comments',
    'cassian_tasks',
    'cassian_tasks_daily_logs',
    'cassian_todoist_tasks',
    'cassian_transactions',
    'cassian_user_calendars',
    'cassian_user_settings',
    'cassian_wins'
  ];
BEGIN
  FOREACH tbl IN ARRAY per_user_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_owner_all', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      tbl || '_owner_all', tbl
    );
  END LOOP;
END
$$;

-- =========================================================================
-- Group B: child tables — ownership derived via parent cassian_* row
-- =========================================================================

-- cassian_contract_sessions -> cassian_contracts(contract_id)
ALTER TABLE public.cassian_contract_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cassian_contract_sessions_owner_all ON public.cassian_contract_sessions;
CREATE POLICY cassian_contract_sessions_owner_all
  ON public.cassian_contract_sessions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cassian_contracts c
    WHERE c.id = cassian_contract_sessions.contract_id
      AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cassian_contracts c
    WHERE c.id = cassian_contract_sessions.contract_id
      AND c.user_id = auth.uid()
  ));

-- cassian_experience_attendees -> cassian_experiences(experience_id)
ALTER TABLE public.cassian_experience_attendees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cassian_experience_attendees_owner_all ON public.cassian_experience_attendees;
CREATE POLICY cassian_experience_attendees_owner_all
  ON public.cassian_experience_attendees
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cassian_experiences e
    WHERE e.id = cassian_experience_attendees.experience_id
      AND e.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cassian_experiences e
    WHERE e.id = cassian_experience_attendees.experience_id
      AND e.user_id = auth.uid()
  ));

-- cassian_note_aspects -> cassian_notes(note_id)
ALTER TABLE public.cassian_note_aspects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cassian_note_aspects_owner_all ON public.cassian_note_aspects;
CREATE POLICY cassian_note_aspects_owner_all
  ON public.cassian_note_aspects
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cassian_notes n
    WHERE n.id = cassian_note_aspects.note_id
      AND n.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cassian_notes n
    WHERE n.id = cassian_note_aspects.note_id
      AND n.user_id = auth.uid()
  ));

-- cassian_note_tags -> cassian_notes(note_id)
ALTER TABLE public.cassian_note_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cassian_note_tags_owner_all ON public.cassian_note_tags;
CREATE POLICY cassian_note_tags_owner_all
  ON public.cassian_note_tags
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cassian_notes n
    WHERE n.id = cassian_note_tags.note_id
      AND n.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cassian_notes n
    WHERE n.id = cassian_note_tags.note_id
      AND n.user_id = auth.uid()
  ));

-- cassian_session_tasks -> cassian_sessions(session_id)
ALTER TABLE public.cassian_session_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cassian_session_tasks_owner_all ON public.cassian_session_tasks;
CREATE POLICY cassian_session_tasks_owner_all
  ON public.cassian_session_tasks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cassian_sessions s
    WHERE s.id = cassian_session_tasks.session_id
      AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cassian_sessions s
    WHERE s.id = cassian_session_tasks.session_id
      AND s.user_id = auth.uid()
  ));

-- cassian_social_post_engagement_history -> cassian_social_posts(social_post_id)
ALTER TABLE public.cassian_social_post_engagement_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cassian_social_post_engagement_history_owner_all ON public.cassian_social_post_engagement_history;
CREATE POLICY cassian_social_post_engagement_history_owner_all
  ON public.cassian_social_post_engagement_history
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cassian_social_posts p
    WHERE p.id = cassian_social_post_engagement_history.social_post_id
      AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cassian_social_posts p
    WHERE p.id = cassian_social_post_engagement_history.social_post_id
      AND p.user_id = auth.uid()
  ));

-- cassian_subhabits -> cassian_habits(habit_id)
ALTER TABLE public.cassian_subhabits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cassian_subhabits_owner_all ON public.cassian_subhabits;
CREATE POLICY cassian_subhabits_owner_all
  ON public.cassian_subhabits
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cassian_habits h
    WHERE h.id = cassian_subhabits.habit_id
      AND h.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.cassian_habits h
    WHERE h.id = cassian_subhabits.habit_id
      AND h.user_id = auth.uid()
  ));

-- =========================================================================
-- Group C: shared lookup tables (no user_id, no per-user parent)
-- Any authenticated user has full access. Single-user app today;
-- tighten to read-only or service-role if this ever goes multi-tenant.
-- =========================================================================

DO $$
DECLARE
  tbl text;
  shared_tables text[] := ARRAY[
    'cassian_aspects',
    'cassian_habits_types',
    'cassian_tags',
    'cassian_reddit_omits',
    'cassian_reddit_posts'
  ];
BEGIN
  FOREACH tbl IN ARRAY shared_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_authenticated_all', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl || '_authenticated_all', tbl
    );
  END LOOP;
END
$$;

COMMIT;
