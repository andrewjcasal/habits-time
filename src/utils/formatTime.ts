/**
 * Format an "HH:MM" or "HH:MM:SS" time string as 12-hour clock with AM/PM.
 * Returns `fallback` if the input is null/empty or unparseable.
 */
export const formatTimeOfDay = (
  time: string | null | undefined,
  fallback = ''
): string => {
  if (!time) return fallback
  const [hStr, mStr] = time.split(':')
  const hour = parseInt(hStr, 10)
  if (isNaN(hour)) return fallback
  const minutes = (mStr ?? '00').padStart(2, '0').slice(0, 2)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

/**
 * Normalize a time value to "HH:MM".
 * Accepts either an already-HH:MM string (with or without seconds) or a full
 * ISO timestamp. Returns an empty string for nullish input.
 */
export const toHHMM = (t: string | null | undefined): string => {
  if (!t) return ''
  if (typeof t === 'string' && t.includes('T')) {
    return new Date(t).toTimeString().slice(0, 5)
  }
  return t.slice(0, 5)
}

/**
 * Duration in minutes between two HH:MM (or ISO) timestamps.
 * Returns `undefined` if either value is missing or unparseable, or if
 * the range isn't positive.
 */
export const minutesBetween = (
  start: string | null | undefined,
  end: string | null | undefined
): number | undefined => {
  const s = toHHMM(start)
  const e = toHHMM(end)
  if (!s || !e) return undefined
  const [sh, sm] = s.split(':').map(Number)
  const [eh, em] = e.split(':').map(Number)
  if ([sh, sm, eh, em].some(n => isNaN(n))) return undefined
  const diff = eh * 60 + em - (sh * 60 + sm)
  return diff > 0 ? diff : undefined
}
