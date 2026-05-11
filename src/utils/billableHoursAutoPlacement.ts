import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { BillableHour } from '../types'
import { HourRanges, hourFromHHMM, DEFAULT_HOUR_RANGES } from './hourRanges'

interface HabitInput {
  id: string
  duration: number | null
  current_start_time?: string | null
  default_start_time?: string | null
  weekly_days?: string[] | null
  habits_daily_logs?: Array<{
    log_date: string
    scheduled_start_time?: string | null
    duration?: number | null
    is_skipped?: boolean | null
    is_completed?: boolean | null
  }> | null
}

interface IntervalInput {
  start_time: string
  end_time: string
}

interface EnsureBillableQuotaArgs {
  userId: string
  /** Inclusive (start of day for the first day to fill). */
  startDate: Date
  /** Exclusive (end of day after the last day to fill). */
  endDate: Date
  hourRanges?: HourRanges
  habits: HabitInput[]
  meetings: IntervalInput[]
  projectActivity: IntervalInput[]
  /** End-of-day buffer blocks (and category buffers, if any) the auto
   *  placer must avoid. Caller is responsible for converting
   *  `BufferTime` (HH:MM + dateStr) into ISO intervals. */
  buffers?: IntervalInput[]
  existingBillableHours: BillableHour[]
  /** Default 5 hours/day. */
  dailyQuota?: number
  /** Default 100 USD/hr. */
  rate?: number
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const startOfLocalDay = (d: Date): Date => {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

const buildLocalTimestamp = (day: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10))
  const out = new Date(day)
  out.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0)
  return out
}

interface Interval {
  start: number // ms
  end: number   // ms
}

/** Merge overlapping or touching intervals (sorted ascending). */
const mergeIntervals = (intervals: Interval[]): Interval[] => {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const out: Interval[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const last = out[out.length - 1]
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

/** Within [windowStart, windowEnd], return the gaps not covered by `blocked`. */
const invertBlocked = (
  blocked: Interval[],
  windowStart: number,
  windowEnd: number
): Interval[] => {
  const merged = mergeIntervals(
    blocked
      .map(b => ({
        start: Math.max(b.start, windowStart),
        end: Math.min(b.end, windowEnd),
      }))
      .filter(b => b.end > b.start)
  )
  const free: Interval[] = []
  let cursor = windowStart
  for (const m of merged) {
    if (m.start > cursor) free.push({ start: cursor, end: m.start })
    cursor = Math.max(cursor, m.end)
  }
  if (cursor < windowEnd) free.push({ start: cursor, end: windowEnd })
  return free
}

const habitIntervalsForDay = (habits: HabitInput[], day: Date): Interval[] => {
  const dateStr = format(day, 'yyyy-MM-dd')
  const weekdayName = WEEKDAY_NAMES[day.getDay()]
  const out: Interval[] = []
  for (const habit of habits) {
    if (habit.weekly_days && habit.weekly_days.length > 0 && !habit.weekly_days.includes(weekdayName)) {
      continue
    }
    const log = habit.habits_daily_logs?.find(l => l.log_date === dateStr && !l.is_skipped)
    const startStr = log?.scheduled_start_time || habit.current_start_time || habit.default_start_time
    const duration = log?.duration ?? habit.duration ?? 0
    if (!startStr || duration <= 0) continue
    const start = buildLocalTimestamp(day, startStr.slice(0, 5)).getTime()
    const end = start + duration * 60 * 1000
    out.push({ start, end })
  }
  return out
}

const intervalsFromIso = (entries: IntervalInput[]): Interval[] =>
  entries
    .map(e => ({
      start: new Date(e.start_time).getTime(),
      end: new Date(e.end_time).getTime(),
    }))
    .filter(i => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)

/**
 * Idempotently top up billable-hour blocks for each day in [startDate,
 * endDate). Existing rows (manual or auto-placed) are respected — the
 * placer only ADDS new rows to fill the daily quota gap.
 *
 * Algorithm (per day):
 *   1. Compute blocked intervals: habits + meetings + project_activity
 *      + existing billable_hours, all clipped to the day's work_hours
 *      window.
 *   2. Invert → list of free intervals.
 *   3. Sum existing billable_hours hours for that day.
 *   4. If existing < dailyQuota, greedily slice the largest free
 *      intervals into 1-hour blocks until the gap closes.
 */
export async function ensureBillableQuotaForRange(
  args: EnsureBillableQuotaArgs
): Promise<BillableHour[]> {
  const {
    userId,
    startDate,
    endDate,
    hourRanges = DEFAULT_HOUR_RANGES,
    habits,
    meetings,
    projectActivity,
    buffers = [],
    existingBillableHours,
    dailyQuota = 5,
    rate = 100,
  } = args

  if (!userId) return []
  if (endDate.getTime() <= startDate.getTime()) return []

  const workStartHour = hourFromHHMM(hourRanges.work_hours.start)
  const workEndHour = hourFromHHMM(hourRanges.work_hours.end)
  if (workEndHour <= workStartHour) return []

  const meetingIntervals = intervalsFromIso(meetings)
  const projectIntervals = intervalsFromIso(projectActivity)
  const bufferIntervals = intervalsFromIso(buffers)
  const billableIntervalsAll = intervalsFromIso(
    existingBillableHours.map(b => ({ start_time: b.start_time, end_time: b.end_time }))
  )

  const insertsToCreate: Array<{
    user_id: string
    start_time: string
    end_time: string
    rate: number
    is_auto_placed: true
  }> = []

  // Iterate one day at a time in local-time space.
  const cursor = startOfLocalDay(startDate)
  const endCursor = startOfLocalDay(endDate)
  // Round "now" UP to the next 15-minute slot so a refill that runs at
  // 9:07 places its first block at 9:15 (not 9:07). Keeps blocks aligned
  // to the calendar's quarter-hour grid.
  const QUARTER_MS = 15 * 60 * 1000
  const nowMs = Math.ceil(Date.now() / QUARTER_MS) * QUARTER_MS

  while (cursor.getTime() < endCursor.getTime()) {
    const dayStart = new Date(cursor)
    dayStart.setHours(workStartHour, 0, 0, 0)
    const dayEnd = new Date(cursor)
    dayEnd.setHours(workEndHour, 0, 0, 0)

    // Never place billable hours in the past — clamp the day's work
    // window to start no earlier than now. Skip days that are fully
    // behind us.
    const dayStartMs = Math.max(dayStart.getTime(), nowMs)
    const dayEndMs = dayEnd.getTime()
    if (dayEndMs <= dayStartMs) {
      cursor.setDate(cursor.getDate() + 1)
      continue
    }

    const habitIntervals = habitIntervalsForDay(habits, cursor)

    // Existing billable hours that overlap this day's work window.
    const billableThisDay = billableIntervalsAll.filter(
      b => b.end > dayStartMs && b.start < dayEndMs
    )
    const existingHoursThisDay =
      billableThisDay.reduce((sum, b) => {
        const s = Math.max(b.start, dayStartMs)
        const e = Math.min(b.end, dayEndMs)
        return e > s ? sum + (e - s) / HOUR_MS : sum
      }, 0)

    let needed = dailyQuota - existingHoursThisDay
    if (needed > 0) {
      const blocked = [
        ...habitIntervals,
        ...meetingIntervals,
        ...projectIntervals,
        ...bufferIntervals,
        ...billableThisDay,
      ]
      const free = invertBlocked(blocked, dayStartMs, dayEndMs)
        .map(f => ({ ...f, span: (f.end - f.start) / HOUR_MS }))
        .filter(f => f.span >= 0.25) // skip slivers shorter than 15 min
        .sort((a, b) => b.span - a.span) // largest free window first

      for (const window of free) {
        if (needed <= 0) break
        let cursorMs = window.start
        const limitMs = window.end
        while (needed > 0 && cursorMs + 0.25 * HOUR_MS <= limitMs) {
          // Slice in 1-hour blocks, or whatever fits if smaller.
          const blockHours = Math.min(1, needed, (limitMs - cursorMs) / HOUR_MS)
          if (blockHours < 0.25) break
          const blockEndMs = cursorMs + blockHours * HOUR_MS
          insertsToCreate.push({
            user_id: userId,
            start_time: new Date(cursorMs).toISOString(),
            end_time: new Date(blockEndMs).toISOString(),
            rate,
            is_auto_placed: true,
          })
          needed -= blockHours
          cursorMs = blockEndMs
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  if (insertsToCreate.length === 0) return []

  const { data, error } = await supabase
    .from('cassian_billable_hours')
    .insert(insertsToCreate)
    .select()

  if (error) throw error

  return (data || []) as BillableHour[]
}
