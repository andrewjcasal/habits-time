# Add is_archived to habits

**Date:** 2026-03-23
**File:** `sql/migrations/20260323000000_add_is_archived_to_habits.sql`

## Changes
- Adds `is_archived` boolean column (default false) to the `habits` table
- Supports archiving habits without deleting them
