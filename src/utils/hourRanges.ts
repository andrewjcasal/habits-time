// Helpers for reading the cassian_user_settings.hour_ranges JSONB column.
// The column is the new home for both work and personal hour windows;
// these helpers fall back to the legacy work_hours_start / work_hours_end
// columns so settings rows that haven't been backfilled still load.

export interface HourRange {
  start: string // 'HH:MM' (24h)
  end: string   // 'HH:MM' (24h)
}

export interface HourRanges {
  work_hours: HourRange
  personal_hours: HourRange
}

export const DEFAULT_HOUR_RANGES: HourRanges = {
  work_hours: { start: '10:00', end: '22:00' },
  personal_hours: { start: '19:00', end: '23:00' },
}

const stripSeconds = (t?: string | null): string | null => {
  if (!t) return null
  return t.length >= 5 ? t.slice(0, 5) : null
}

/**
 * Read hour_ranges from a settings row, with legacy fallback. Always
 * returns a fully-populated HourRanges (defaults fill any gaps).
 */
export const getHourRanges = (settings: any | null | undefined): HourRanges => {
  if (!settings) return DEFAULT_HOUR_RANGES

  const raw = settings.hour_ranges as Partial<HourRanges> | undefined

  const legacyWorkStart = stripSeconds(settings.work_hours_start)
  const legacyWorkEnd = stripSeconds(settings.work_hours_end)

  const work: HourRange = {
    start: raw?.work_hours?.start ?? legacyWorkStart ?? DEFAULT_HOUR_RANGES.work_hours.start,
    end:   raw?.work_hours?.end   ?? legacyWorkEnd   ?? DEFAULT_HOUR_RANGES.work_hours.end,
  }

  const personal: HourRange = {
    start: raw?.personal_hours?.start ?? DEFAULT_HOUR_RANGES.personal_hours.start,
    end:   raw?.personal_hours?.end   ?? DEFAULT_HOUR_RANGES.personal_hours.end,
  }

  return { work_hours: work, personal_hours: personal }
}

/** "HH:MM" → integer hour (drops minutes; matches existing scheduler usage). */
export const hourFromHHMM = (hhmm: string): number => {
  const parts = hhmm.split(':')
  const h = parseInt(parts[0], 10)
  return Number.isFinite(h) ? h : 0
}
