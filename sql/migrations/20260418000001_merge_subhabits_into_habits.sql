-- Fold cassian_subhabits into cassian_habits as self-referential child rows.
--
-- After this migration:
--   * Top-level habits:   cassian_habits.parent_habit_id IS NULL
--   * Sub-habits (steps): cassian_habits.parent_habit_id = <parent habit id>
--
-- Subhabit IDs are preserved, so cassian_subhabit_comments rows continue to
-- resolve — we just repoint the FK at cassian_habits(id).
--
-- IMPORTANT: this migration assumes no cassian_habits row today has a
-- colliding id with any cassian_subhabits row (both use uuid defaults, so
-- collisions are cryptographically unlikely). The INSERT uses
-- ON CONFLICT (id) DO NOTHING defensively.
--
-- Name mapping:
--   cassian_subhabits.title            -> cassian_habits.name
--   cassian_subhabits.duration_minutes -> cassian_habits.duration
--   cassian_subhabits.habit_id         -> cassian_habits.parent_habit_id
--   cassian_subhabits.aspect_id        -> cassian_habits.aspect_id  (new column)
--   cassian_subhabits.sort_order       -> cassian_habits.sort_order (new column)

BEGIN;

-- 1. New columns on cassian_habits
ALTER TABLE public.cassian_habits
  ADD COLUMN IF NOT EXISTS parent_habit_id uuid,
  ADD COLUMN IF NOT EXISTS aspect_id uuid,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Name the FKs explicitly so PostgREST embed calls can reference them reliably.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cassian_habits_parent_habit_id_fkey'
  ) THEN
    ALTER TABLE public.cassian_habits
      ADD CONSTRAINT cassian_habits_parent_habit_id_fkey
      FOREIGN KEY (parent_habit_id)
      REFERENCES public.cassian_habits(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cassian_habits_aspect_id_fkey'
  ) THEN
    ALTER TABLE public.cassian_habits
      ADD CONSTRAINT cassian_habits_aspect_id_fkey
      FOREIGN KEY (aspect_id)
      REFERENCES public.cassian_aspects(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_cassian_habits_parent_habit_id
  ON public.cassian_habits(parent_habit_id);
CREATE INDEX IF NOT EXISTS idx_cassian_habits_aspect_id
  ON public.cassian_habits(aspect_id);

-- 2. Copy subhabit rows into cassian_habits, preserving id so existing
--    comment rows keep pointing at the right record.
INSERT INTO public.cassian_habits (
  id,
  created_at,
  name,
  user_id,
  duration,
  parent_habit_id,
  aspect_id,
  sort_order,
  is_visible,
  is_archived
)
SELECT
  s.id,
  COALESCE(s.created_at, now()),
  s.title,
  h.user_id,
  COALESCE(s.duration_minutes, 0),
  s.habit_id,
  s.aspect_id,
  COALESCE(s.sort_order, 0),
  false,  -- sub-habits don't render on the calendar as their own events
  false
FROM public.cassian_subhabits s
JOIN public.cassian_habits h ON h.id = s.habit_id
ON CONFLICT (id) DO NOTHING;

-- 3. Repoint the comment table's FK from cassian_subhabits -> cassian_habits.
ALTER TABLE public.cassian_subhabit_comments
  DROP CONSTRAINT IF EXISTS subhabit_comments_subhabit_id_fkey;

ALTER TABLE public.cassian_subhabit_comments
  ADD CONSTRAINT cassian_subhabit_comments_subhabit_id_fkey
    FOREIGN KEY (subhabit_id)
    REFERENCES public.cassian_habits(id)
    ON DELETE CASCADE;

-- 4. Drop the old subhabits table. Everything now lives in cassian_habits.
DROP TABLE public.cassian_subhabits;

COMMIT;
