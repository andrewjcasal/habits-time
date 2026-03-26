-- Rename all Cassian app tables with cassian_ prefix
-- PostgreSQL ALTER TABLE RENAME automatically updates FK constraints, indexes, and RLS policies

-- Calendar & Scheduling
ALTER TABLE habits RENAME TO cassian_habits;
ALTER TABLE habits_daily_logs RENAME TO cassian_habits_daily_logs;
ALTER TABLE habits_types RENAME TO cassian_habits_types;
ALTER TABLE meetings RENAME TO cassian_meetings;
ALTER TABLE meeting_categories RENAME TO cassian_meeting_categories;
ALTER TABLE sessions RENAME TO cassian_sessions;
ALTER TABLE session_tasks RENAME TO cassian_session_tasks;
ALTER TABLE tasks RENAME TO cassian_tasks;
ALTER TABLE tasks_daily_logs RENAME TO cassian_tasks_daily_logs;
ALTER TABLE calendar_notes RENAME TO cassian_calendar_notes;
ALTER TABLE category_buffers RENAME TO cassian_category_buffers;
ALTER TABLE projects RENAME TO cassian_projects;
ALTER TABLE contracts RENAME TO cassian_contracts;
ALTER TABLE contract_sessions RENAME TO cassian_contract_sessions;

-- Habits & Aspects
ALTER TABLE aspects RENAME TO cassian_aspects;
ALTER TABLE subhabits RENAME TO cassian_subhabits;
ALTER TABLE subhabit_comments RENAME TO cassian_subhabit_comments;
ALTER TABLE habits_activity_types RENAME TO cassian_habits_activity_types;
ALTER TABLE habits_time_logs RENAME TO cassian_habits_time_logs;
ALTER TABLE habits_notes RENAME TO cassian_habits_notes;
ALTER TABLE note_aspects RENAME TO cassian_note_aspects;
ALTER TABLE note_tags RENAME TO cassian_note_tags;
ALTER TABLE tags RENAME TO cassian_tags;

-- Dashboard & Reflections
ALTER TABLE behaviors RENAME TO cassian_behaviors;
ALTER TABLE daily_reflections RENAME TO cassian_daily_reflections;
ALTER TABLE reddit_posts RENAME TO cassian_reddit_posts;
ALTER TABLE reddit_omits RENAME TO cassian_reddit_omits;

-- Todoist
ALTER TABLE todoist_tasks RENAME TO cassian_todoist_tasks;

-- Community & Social
ALTER TABLE experiences RENAME TO cassian_experiences;
ALTER TABLE experience_attendees RENAME TO cassian_experience_attendees;
ALTER TABLE people RENAME TO cassian_people;
ALTER TABLE socials RENAME TO cassian_socials;
ALTER TABLE social_posts RENAME TO cassian_social_posts;
ALTER TABLE social_post_engagement_history RENAME TO cassian_social_post_engagement_history;

-- Other
ALTER TABLE transactions RENAME TO cassian_transactions;
ALTER TABLE wins RENAME TO cassian_wins;
ALTER TABLE user_settings RENAME TO cassian_user_settings;
ALTER TABLE feedback RENAME TO cassian_feedback;

-- Drop and recreate functions that reference old table names
DROP FUNCTION IF EXISTS calculate_next_start_time;
DROP FUNCTION IF EXISTS check_task_hierarchy_circular;
DROP FUNCTION IF EXISTS get_buffer_utilization;
DROP FUNCTION IF EXISTS get_effective_habit_date CASCADE;
DROP FUNCTION IF EXISTS get_user_habits_for_today;
DROP FUNCTION IF EXISTS log_habit_completion;
DROP FUNCTION IF EXISTS update_habit_start_times;
DROP FUNCTION IF EXISTS update_or_merge_log CASCADE;
DROP FUNCTION IF EXISTS update_task_hours CASCADE;

CREATE OR REPLACE FUNCTION calculate_next_start_time(p_habit_id UUID, p_user_id UUID, p_current_date DATE)
RETURNS TIME AS $$
DECLARE
  v_habit_type text;
  v_current_start_time time;
  v_was_completed boolean;
  v_new_start_time time;
BEGIN
  SELECT ht.scheduling_rule, h.current_start_time
  INTO v_habit_type, v_current_start_time
  FROM cassian_habits h
  JOIN cassian_habits_types ht ON h.habit_type_id = ht.id
  WHERE h.id = p_habit_id;

  SELECT COALESCE(is_completed, false)
  INTO v_was_completed
  FROM cassian_habits_daily_logs
  WHERE habit_id = p_habit_id
    AND user_id = p_user_id
    AND log_date = p_current_date;

  CASE v_habit_type
    WHEN 'pull_back_15min' THEN
      IF v_was_completed THEN
        v_new_start_time := v_current_start_time - INTERVAL '15 minutes';
      ELSE
        v_new_start_time := v_current_start_time;
      END IF;
    WHEN 'fixed_time' THEN
      SELECT default_start_time INTO v_new_start_time
      FROM cassian_habits WHERE id = p_habit_id;
    ELSE
      v_new_start_time := v_current_start_time;
  END CASE;

  RETURN v_new_start_time;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_task_hierarchy_circular(task_id UUID, parent_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_parent_id UUID;
    depth INTEGER := 0;
    max_depth INTEGER := 10;
BEGIN
    IF parent_id IS NULL THEN
        RETURN FALSE;
    END IF;

    current_parent_id := parent_id;

    WHILE current_parent_id IS NOT NULL AND depth < max_depth LOOP
        IF current_parent_id = task_id THEN
            RETURN TRUE;
        END IF;

        SELECT parent_task_id INTO current_parent_id
        FROM cassian_tasks
        WHERE id = current_parent_id;

        depth := depth + 1;
    END LOOP;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_buffer_utilization(p_user_id UUID, p_week_start TIMESTAMPTZ, p_week_end TIMESTAMPTZ)
RETURNS TABLE(
    buffer_id UUID,
    category_id UUID,
    category_name TEXT,
    category_color TEXT,
    weekly_hours NUMERIC,
    hours_spent NUMERIC,
    hours_remaining NUMERIC,
    utilization_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH buffer_spending AS (
        SELECT
            cb.id as buffer_id,
            cb.category_id,
            cb.weekly_hours,
            COALESCE(
                (
                    SELECT SUM(EXTRACT(EPOCH FROM (m.end_time - m.start_time)) / 3600.0)
                    FROM cassian_meetings m
                    WHERE m.user_id = p_user_id
                        AND m.category_id = cb.category_id
                        AND m.start_time >= p_week_start
                        AND m.start_time < p_week_end
                ), 0
            ) as hours_spent
        FROM cassian_category_buffers cb
        WHERE cb.user_id = p_user_id
    )
    SELECT
        bs.buffer_id,
        bs.category_id,
        mc.name as category_name,
        mc.color as category_color,
        bs.weekly_hours,
        bs.hours_spent,
        GREATEST(0, bs.weekly_hours - bs.hours_spent) as hours_remaining,
        CASE
            WHEN bs.weekly_hours > 0 THEN
                ROUND((bs.hours_spent / bs.weekly_hours * 100)::DECIMAL, 2)
            ELSE 0
        END as utilization_percentage
    FROM buffer_spending bs
    JOIN cassian_meeting_categories mc ON mc.id = bs.category_id
    ORDER BY mc.name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_effective_habit_date(p_user_id UUID)
RETURNS DATE AS $$
DECLARE
  v_current_date date := CURRENT_DATE;
  v_yesterday date := CURRENT_DATE - INTERVAL '1 day';
  v_sleep_logged boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM cassian_habits_time_logs tl
    JOIN cassian_habits_activity_types at ON tl.activity_type_id = at.id
    WHERE tl.user_id = p_user_id
    AND at.label = 'sleep'
    AND DATE(tl.start_time) = v_yesterday
  ) INTO v_sleep_logged;

  IF EXTRACT(HOUR FROM NOW()) < 6 AND NOT v_sleep_logged THEN
    RETURN v_yesterday;
  ELSE
    RETURN v_current_date;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_habits_for_today(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    name TEXT,
    duration INTEGER,
    scheduled_time TIME,
    habit_type TEXT,
    is_completed BOOLEAN,
    actual_start_time TIME,
    actual_end_time TIME,
    notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.name,
    h.duration,
    h.current_start_time as scheduled_time,
    ht.name as habit_type,
    COALESCE(dhl.is_completed, false) as is_completed,
    dhl.actual_start_time,
    dhl.actual_end_time,
    dhl.notes
  FROM cassian_habits h
  LEFT JOIN cassian_habits_types ht ON h.habit_type_id = ht.id
  LEFT JOIN cassian_habits_daily_logs dhl ON h.id = dhl.habit_id
    AND dhl.log_date = get_effective_habit_date(p_user_id)
    AND dhl.user_id = h.user_id
  WHERE h.is_visible = true
    AND h.user_id = p_user_id
  ORDER BY h.current_start_time;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_habit_completion(
    p_habit_id UUID, p_user_id UUID, p_log_date DATE,
    p_actual_start_time TIME, p_actual_end_time TIME,
    p_is_completed BOOLEAN, p_notes TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO cassian_habits_daily_logs (
    habit_id, user_id, log_date, scheduled_start_time,
    actual_start_time, actual_end_time, is_completed, notes
  )
  VALUES (
    p_habit_id, p_user_id, p_log_date,
    (SELECT current_start_time FROM cassian_habits WHERE id = p_habit_id),
    p_actual_start_time, p_actual_end_time, p_is_completed, p_notes
  )
  ON CONFLICT (habit_id, user_id, log_date)
  DO UPDATE SET
    actual_start_time = EXCLUDED.actual_start_time,
    actual_end_time = EXCLUDED.actual_end_time,
    is_completed = EXCLUDED.is_completed,
    notes = EXCLUDED.notes;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_habit_start_times(p_user_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
  habit_record RECORD;
  new_time time;
BEGIN
  FOR habit_record IN
    SELECT id FROM cassian_habits
    WHERE user_id = p_user_id
      AND is_visible = true
      AND habit_type_id IS NOT NULL
  LOOP
    SELECT calculate_next_start_time(habit_record.id, p_user_id, p_date)
    INTO new_time;

    UPDATE cassian_habits
    SET current_start_time = new_time
    WHERE id = habit_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_or_merge_log()
RETURNS TRIGGER AS $$
declare
  prev_log record;
  time_diff interval;
begin
  select * into prev_log
  from cassian_habits_time_logs
  where user_id = NEW.user_id
    and id <> NEW.id
    and start_time < NEW.start_time
  order by start_time desc
  limit 1;

  if prev_log.id IS NOT NULL then
    time_diff := NEW.start_time - prev_log.start_time;

    if time_diff < interval '1 minute' then
      delete from cassian_habits_time_logs where id = prev_log.id;
    else
      update cassian_habits_time_logs
      set end_time = NEW.start_time
      where id = prev_log.id;
    end if;
  end if;

  return NEW;
end;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_task_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cassian_tasks
  SET
    hours_completed = (
      SELECT COALESCE(SUM(time_spent_hours), 0)
      FROM cassian_tasks_daily_logs
      WHERE task_id = COALESCE(NEW.task_id, OLD.task_id)
        AND completed_at IS NOT NULL
    ),
    hours_remaining = GREATEST(0, estimated_hours - (
      SELECT COALESCE(SUM(time_spent_hours), 0)
      FROM cassian_tasks_daily_logs
      WHERE task_id = COALESCE(NEW.task_id, OLD.task_id)
        AND completed_at IS NOT NULL
    ))
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
