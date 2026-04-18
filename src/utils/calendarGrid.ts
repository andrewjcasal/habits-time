import { format } from 'date-fns'

// ─── Calendar grid constants ────────────────────────────────────────────────
// The calendar renders one row per hour starting at GRID_START_HOUR (5am),
// wrapping past midnight through hours 0…GRID_START_HOUR-1 of the next day
// (so 5am through 4:59am the following day == a full 24h column).
//
// Hours 0 to GRID_START_HOUR-1 on a given date belong to the PREVIOUS day's
// visual column. getColumnDate handles that remap for per-hour indexing.
// ────────────────────────────────────────────────────────────────────────────

export const GRID_START_HOUR = 5

/** Number of hour rows rendered per day column (24h coverage). */
export const HOURS_PER_DAY = 24

/** Number of hour slots displayed before midnight (e.g. 5am → 11pm = 19). */
export const MORNING_SLOT_COUNT = HOURS_PER_DAY - GRID_START_HOUR // 19

/**
 * Conceptual "end" hour of the grid in the continuous-hours space where a
 * habit / task starting at 5am is `5` and running 24 hours lands at `29`.
 * Used by scheduler code to cap chunks that would otherwise overflow the
 * visible grid.
 */
export const GRID_LAST_HOUR = HOURS_PER_DAY + GRID_START_HOUR // 29

/** "HH:MM:SS" marker for meetings clipped to the start of the grid column. */
export const GRID_START_CLOCK = '05:00:00'

/** Minutes-from-midnight version of the grid start, handy for numeric clips. */
export const GRID_START_MINUTES = GRID_START_HOUR * 60 // 300

/** True when `hour` belongs to the previous day's visual column. */
export const isLateNightHour = (hour: number): boolean =>
  hour >= 0 && hour < GRID_START_HOUR

/**
 * Map an absolute clock hour (0-23) to its row index in the grid (0-based
 * from the top). Late-night hours wrap to the bottom of the previous day's
 * column.
 */
export const hourToGridIndex = (hour: number): number =>
  isLateNightHour(hour)
    ? hour + MORNING_SLOT_COUNT
    : hour - GRID_START_HOUR

/**
 * The date whose column an event at `hour` on `dateStr` should render into.
 * Hours 0-(GRID_START_HOUR-1) visually belong to the previous day.
 */
export const getColumnDate = (dateStr: string, hour: number): string => {
  if (!isLateNightHour(hour)) return dateStr
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return format(d, 'yyyy-MM-dd')
}
