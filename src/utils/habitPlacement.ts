import { format } from 'date-fns'
import { getEffectiveHabitStartTime } from './habitScheduling'

// A single occurrence of a habit on a given date, resolved to concrete
// hour-since-midnight bounds after applying meeting/session/habit-vs-habit
// conflict resolution.
export interface HabitPlacement {
  habitId: string
  dailyLogId?: string // log row that drove this occurrence, if any
  dateKey: string
  start: number // hours since midnight
  end: number
  duration: number // minutes
  isRescheduled: boolean
}

interface DayColumn {
  dateStr: string
  date: Date
}

/**
 * Compute the effective time windows each habit occupies on each day, after
 * applying these rules in order:
 *
 *  1. Habits that don't overlap any meeting or session on their day KEEP
 *     their original scheduled start time.
 *  2. Habits that DO overlap a meeting/session get pushed to the meeting (or
 *     session) end time.
 *  3. Habits that would now overlap another already-placed habit get pushed
 *     to the end of the overlapping habit. No extra buffer — back-to-back.
 *
 * Preserved habits are placed first so they anchor their original slots;
 * shuffled habits then cascade after them. This lets the caller (render
 * path and task scheduler) agree on one set of "effective" habit positions.
 */
export const resolveHabitPlacements = (
  habits: any[],
  meetings: any[],
  sessions: any[],
  dayColumns: DayColumn[],
  projectActivity: any[] = []
): HabitPlacement[] => {
  interface Occurrence {
    habit: any
    log: any | null
    origStart: number
    origEnd: number
    duration: number
  }

  const candidatesByDate = new Map<string, Occurrence[]>()

  for (const habit of habits) {
    if (habit.habits_types?.scheduling_rule === 'non_calendar') continue

    for (const col of dayColumns) {
      const dateKey = col.dateStr

      const dailyLogs = (habit.habits_daily_logs || []).filter(
        (l: any) => l.log_date === dateKey
      )
      const unskipped = dailyLogs.filter((l: any) => !l.is_skipped)
      const hasSkipped = dailyLogs.some((l: any) => l.is_skipped)

      // Archived habits stop scheduling forward but stay on dates that
      // already have an unskipped log so past completions remain visible.
      if (habit.is_archived) {
        if (unskipped.length === 0) continue
      } else {
        if (habit.created_at) {
          const creationDate = new Date(habit.created_at).toLocaleDateString('en-CA')
          if (dateKey < creationDate) continue
        }

        // Weekly pattern filter — skipped unless an explicit daily log overrides.
        if (habit.weekly_days && habit.weekly_days.length > 0) {
          const dayName = col.date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
          const matchesPattern = habit.weekly_days.includes(dayName)
          const hasOverrideLog = unskipped.length > 0
          if (!matchesPattern && !hasOverrideLog) continue
        }

        if (hasSkipped && unskipped.length === 0) continue
      }

      const logsToRender: (any | null)[] = unskipped.length > 0 ? unskipped : [null]

      for (const log of logsToRender) {
        const effectiveStart = getEffectiveHabitStartTime(habit, dateKey, log)
        const duration = (log?.duration || habit.duration || 0) as number
        if (!effectiveStart || duration <= 0) continue
        const [h, m] = effectiveStart.split(':').map(Number)
        const origStart = h + m / 60
        const origEnd = origStart + duration / 60
        const list = candidatesByDate.get(dateKey) || []
        list.push({ habit, log, origStart, origEnd, duration })
        candidatesByDate.set(dateKey, list)
      }
    }
  }

  const result: HabitPlacement[] = []

  for (const [dateKey, occurrences] of candidatesByDate.entries()) {
    const dateMeetings = meetings.filter(
      m => format(new Date(m.start_time), 'yyyy-MM-dd') === dateKey
    )
    const dateProjectActivity = projectActivity.filter(
      a => format(new Date(a.start_time), 'yyyy-MM-dd') === dateKey
    )
    const dateSessions = sessions.filter(s => s.scheduled_date === dateKey)

    const findConflictingBlockEnd = (
      blocks: any[],
      start: number,
      end: number
    ): number | null => {
      for (const b of blocks) {
        const bs = new Date(b.start_time)
        const be = new Date(b.end_time)
        const bsH = bs.getHours() + bs.getMinutes() / 60
        const beH = be.getHours() + be.getMinutes() / 60
        if (start < beH && end > bsH) return beH
      }
      return null
    }

    const findConflictingMeetingEnd = (start: number, end: number): number | null =>
      findConflictingBlockEnd(dateMeetings, start, end)
    const findConflictingProjectActivityEnd = (start: number, end: number): number | null =>
      findConflictingBlockEnd(dateProjectActivity, start, end)

    const findConflictingSessionEnd = (start: number, end: number): number | null => {
      for (const s of dateSessions) {
        if (!s.actual_start_time) continue
        const timeOnly = String(s.actual_start_time).split(/[+-]/)[0]
        const [h, m] = timeOnly.split(':').map(Number)
        const ss = h + m / 60
        const se = ss + (s.scheduled_hours || 1)
        if (start < se && end > ss) return se
      }
      return null
    }

    type Entry = { occ: Occurrence; shuffleStart?: number }
    const preserved: Entry[] = []
    const shuffled: Entry[] = []
    for (const occ of occurrences) {
      const meetingEnd = findConflictingMeetingEnd(occ.origStart, occ.origEnd)
      const projectEnd =
        meetingEnd === null
          ? findConflictingProjectActivityEnd(occ.origStart, occ.origEnd)
          : null
      const sessionEnd =
        meetingEnd === null && projectEnd === null
          ? findConflictingSessionEnd(occ.origStart, occ.origEnd)
          : null
      if (meetingEnd === null && projectEnd === null && sessionEnd === null) {
        preserved.push({ occ })
      } else {
        shuffled.push({ occ, shuffleStart: meetingEnd ?? projectEnd ?? sessionEnd! })
      }
    }

    preserved.sort((a, b) => a.occ.origStart - b.occ.origStart)
    shuffled.sort((a, b) => a.occ.origStart - b.occ.origStart)

    const placed: Array<{ start: number; end: number }> = []

    // Fixed-block intervals (meetings + project_activity + sessions) the
    // cascade must skip over, not just stack against. Without this the
    // shuffle-after-conflict step can land a habit ON TOP of a different
    // project_activity / meeting that didn't trigger its initial conflict.
    const fixedBlocked: Array<{ start: number; end: number }> = []
    for (const m of dateMeetings) {
      const ms = new Date(m.start_time)
      const me = new Date(m.end_time)
      fixedBlocked.push({
        start: ms.getHours() + ms.getMinutes() / 60,
        end: me.getHours() + me.getMinutes() / 60,
      })
    }
    for (const a of dateProjectActivity) {
      const as = new Date(a.start_time)
      const ae = new Date(a.end_time)
      fixedBlocked.push({
        start: as.getHours() + as.getMinutes() / 60,
        end: ae.getHours() + ae.getMinutes() / 60,
      })
    }
    for (const s of dateSessions) {
      if (!s.actual_start_time) continue
      const timeOnly = String(s.actual_start_time).split(/[+-]/)[0]
      const [h, m] = timeOnly.split(':').map(Number)
      const ss = h + m / 60
      fixedBlocked.push({ start: ss, end: ss + (s.scheduled_hours || 1) })
    }

    const placeAt = (candidateStart: number, duration: number) => {
      let start = candidateStart
      for (let guard = 0; guard < 50; guard++) {
        const end = start + duration / 60
        const habitConflict = placed.find(p => start < p.end && end > p.start)
        const fixedConflict = fixedBlocked.find(b => start < b.end && end > b.start)
        const conflict = habitConflict || fixedConflict
        if (!conflict) return { start, end }
        start = conflict.end
      }
      return { start, end: start + duration / 60 }
    }

    for (const e of preserved) {
      const { start, end } = placeAt(e.occ.origStart, e.occ.duration)
      placed.push({ start, end })
      result.push({
        habitId: e.occ.habit.id,
        dailyLogId: e.occ.log?.id,
        dateKey,
        start,
        end,
        duration: e.occ.duration,
        isRescheduled: start !== e.occ.origStart,
      })
    }
    for (const e of shuffled) {
      const { start, end } = placeAt(e.shuffleStart!, e.occ.duration)
      placed.push({ start, end })
      result.push({
        habitId: e.occ.habit.id,
        dailyLogId: e.occ.log?.id,
        dateKey,
        start,
        end,
        duration: e.occ.duration,
        isRescheduled: true,
      })
    }
  }

  return result
}
