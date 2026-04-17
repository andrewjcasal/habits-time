-- Daily habit-log backfill for user b2610099-4341-47dc-8521-1f94d6ca9830.
--
-- For each active habit (visible, non-archived, created before the occurrence,
-- weekly_days matches if set), find the most recent occurrence whose scheduled
-- time falls within the last 24 hours in America/New_York, and insert a daily
-- log for that date if one doesn't already exist.
--
-- Scheduling: pg_cron at 3am ET. Because pg_cron runs in UTC we schedule
-- hourly and let NOT EXISTS keep us idempotent — a run at any other hour
-- either finds an existing log (no-op) or inserts new catch-up rows the
-- 3am pass would have created anyway. No internal hour gate, so the
-- function can also be called manually for testing.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.ensure_daily_habit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO cassian_habits_daily_logs (habit_id, user_id, log_date, scheduled_start_time)
  SELECT
    h.id,
    h.user_id,
    occ.occ_date,
    h.current_start_time
  FROM cassian_habits h
  CROSS JOIN LATERAL (
    WITH ref AS (
      SELECT (NOW() AT TIME ZONE 'America/New_York') AS ny_now
    )
    SELECT
      CASE
        WHEN (ref.ny_now::date + h.current_start_time)
               BETWEEN (ref.ny_now - INTERVAL '24 hours') AND ref.ny_now
          THEN ref.ny_now::date
        WHEN ((ref.ny_now - INTERVAL '1 day')::date + h.current_start_time)
               BETWEEN (ref.ny_now - INTERVAL '24 hours') AND ref.ny_now
          THEN (ref.ny_now - INTERVAL '1 day')::date
        ELSE NULL
      END AS occ_date
    FROM ref
  ) occ
  WHERE h.user_id = 'b2610099-4341-47dc-8521-1f94d6ca9830'
    AND h.is_visible = true
    AND (h.is_archived = false OR h.is_archived IS NULL)
    AND h.current_start_time IS NOT NULL
    AND occ.occ_date IS NOT NULL
    AND (h.created_at AT TIME ZONE 'America/New_York')::date <= occ.occ_date
    AND (
      h.weekly_days IS NULL
      OR array_length(h.weekly_days, 1) IS NULL
      OR LOWER(TO_CHAR(occ.occ_date, 'FMDay')) = ANY(h.weekly_days)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM cassian_habits_daily_logs l
      WHERE l.habit_id = h.id
        AND l.user_id  = h.user_id
        AND l.log_date = occ.occ_date
    );
END;
$fn$;

-- Remove any prior version of this job so re-running cleanly replaces it.
DO $$
BEGIN
  PERFORM cron.unschedule('ensure-daily-habit-logs');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Run hourly. 3am ET falls under this schedule regardless of DST; other
-- hours are no-ops thanks to the NOT EXISTS dedup.
SELECT cron.schedule(
  'ensure-daily-habit-logs',
  '0 * * * *',
  $cmd$SELECT public.ensure_daily_habit_logs();$cmd$
);
