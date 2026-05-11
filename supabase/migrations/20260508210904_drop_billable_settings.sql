-- Remove the legacy billable plumbing now that the dedicated
-- `cassian_billable_hours` table replaces it:
--   * cassian_user_settings.billable_hours_enabled / default_hourly_rate
--     drove the old auto-fallback that fabricated "Billable Work"
--     placeholder tasks; both are gone.
--   * cassian_tasks.is_billable was the per-task flag the old fallback
--     read; it's no longer consulted anywhere in the app.
--
-- `cassian_projects.hourly_rate` is intentionally kept (preserved for
-- future per-project reporting; not dropped here).
--
-- IF EXISTS is used for each column so the migration is safe to apply
-- in environments where the column may have been added via the
-- Supabase dashboard rather than a tracked migration.

ALTER TABLE cassian_user_settings DROP COLUMN IF EXISTS billable_hours_enabled;
ALTER TABLE cassian_user_settings DROP COLUMN IF EXISTS default_hourly_rate;
ALTER TABLE cassian_tasks DROP COLUMN IF EXISTS is_billable;
