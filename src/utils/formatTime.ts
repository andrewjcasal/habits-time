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
