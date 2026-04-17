-- Rename cassian_habits_notes → cassian_notes.
-- PostgreSQL ALTER TABLE RENAME automatically updates FK constraints, indexes,
-- and RLS policies that reference the table, so no other changes are needed.

ALTER TABLE cassian_habits_notes RENAME TO cassian_notes;

-- Rename the updated_at trigger so its name matches the new table.
ALTER TRIGGER update_habits_notes_updated_at ON cassian_notes
  RENAME TO update_notes_updated_at;
