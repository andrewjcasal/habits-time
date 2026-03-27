ALTER TABLE cassian_subhabits ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Backfill existing rows with sequential order based on created_at
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY habit_id ORDER BY created_at) AS rn
  FROM cassian_subhabits
)
UPDATE cassian_subhabits SET sort_order = ranked.rn
FROM ranked WHERE cassian_subhabits.id = ranked.id;
