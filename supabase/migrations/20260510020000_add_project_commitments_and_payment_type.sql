-- Project commitments: total contracted hours and weekly cadence the
-- user has agreed to. Both are nullable — projects without an explicit
-- commitment leave them null and the UI hides the progress widget.
ALTER TABLE cassian_projects
  ADD COLUMN IF NOT EXISTS commitment_total_hours numeric,
  ADD COLUMN IF NOT EXISTS commitment_weekly_hours numeric,
  ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'manual'
    CHECK (payment_type IN ('manual', 'upwork'));
