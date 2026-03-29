/**
 * Shared drag utilities for calendar events (meeting resize, task log move).
 * Both use the same pattern: mousedown → track Y delta → snap to 15min → mouseup.
 */

/** Convert a Y pixel delta to snapped minutes (64px = 1 hour, 15-min snap) */
export function deltaYToMinutes(deltaY: number): number {
  return Math.round(deltaY / 64 * 60 / 15) * 15
}

/** Add minutes to a time string "HH:MM:SS" or "HH:MM", returns "HH:MM:SS" */
export function addMinutesToTime(time: string, deltaMinutes: number): string | null {
  const parts = time.split(':').map(Number)
  const h = parts[0]
  const m = parts[1]
  const totalMinutes = h * 60 + m + deltaMinutes
  const newH = Math.floor(totalMinutes / 60)
  const newM = totalMinutes % 60
  if (newH < 0 || newH > 23) return null
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}:00`
}

/** Compute new start and end times after a drag move */
export function computeMovedTimes(
  originalStartTime: string,
  durationHours: number,
  deltaY: number
): { newStartTime: string; newEndTime: string } | null {
  const deltaMinutes = deltaYToMinutes(deltaY)
  if (deltaMinutes === 0) return null

  const newStart = addMinutesToTime(originalStartTime, deltaMinutes)
  if (!newStart) return null

  const endDelta = deltaMinutes + durationHours * 60
  const newEnd = addMinutesToTime(originalStartTime, endDelta)
  if (!newEnd) return null

  return { newStartTime: newStart, newEndTime: newEnd }
}
