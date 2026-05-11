// [E2E:in-progress] 86b9vabek
import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * PW: 86b9vabek — Billable-hours auto-placement renders 5 blocks/day
 * in free slots. Asserts: row count == min(5, freeHours), every row
 * has is_auto_placed=true + rate=100, no overlap with seeded blockers,
 * idempotency on re-run.
 *
 * Source under test:
 *   src/utils/billableHoursAutoPlacement.ts — `ensureBillableQuotaForRange`
 *   src/pages/Calendar.tsx — auto-placer useEffect (debounced 500ms,
 *     scoped to next 7 days)
 *   src/hooks/useBillableHours.ts — appendBillableHours splice
 *
 * The placer runs against `new Date()` (real wall-clock now), not a
 * pinned URL date — so this spec seeds data relative to runtime now
 * and reads cassian_billable_hours scoped to those days.
 */

const FREE_DAY_OFFSET = 1   // tomorrow → fully free, expect 5 blocks
const BUSY_DAY_OFFSET = 2   // day-after → 4h of blockers, still expect 5 blocks
const MEETING_TITLE = `${E2E_TITLE_PREFIX} Auto-Place Block`

const startOfLocalDay = (offsetDays: number): Date => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d
}

const atHour = (day: Date, hour: number, minute: number = 0): Date => {
  const d = new Date(day)
  d.setHours(hour, minute, 0, 0)
  return d
}

const intervalsOverlap = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean => aStart < bEnd && bStart < aEnd

test.describe('billable-hours auto-placement', () => {
  test.beforeAll(async () => {
    const admin = adminClient()

    // Wipe all calendar-affecting rows for the test user so the placer
    // runs against deterministic state. The test user is dedicated to
    // E2E (test+playwright@cassian.local) so a full wipe is safe.
    await admin.from('cassian_billable_hours').delete().eq('user_id', TEST_USER_ID)
    await admin.from('cassian_meetings').delete().eq('user_id', TEST_USER_ID)
    await admin.from('cassian_project_activity').delete().eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_habits_daily_logs')
      .delete()
      .eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_habits')
      .delete()
      .eq('user_id', TEST_USER_ID)

    // Pin hour_ranges to 10:00-22:00 so the placer's free window is
    // deterministic regardless of any prior settings shape on this row.
    await admin.from('cassian_user_settings').upsert(
      {
        user_id: TEST_USER_ID,
        hour_ranges: {
          work_hours: { start: '10:00', end: '22:00' },
          personal_hours: { start: '19:00', end: '23:00' },
        },
        work_hours_start: '10:00:00',
        work_hours_end: '22:00:00',
        weekend_days: [],
        week_ending_day: 'sunday',
        week_ending_time: '20:30',
        week_ending_timezone: 'America/New_York',
      },
      { onConflict: 'user_id' },
    )

    // Seed two blockers on BUSY_DAY: a meeting 11:00-13:00 (2h) and a
    // project_activity 14:00-16:00 (2h). 12h work window − 4h blocked
    // = 8h free, capped at 5 → still 5 blocks expected.
    const busyDay = startOfLocalDay(BUSY_DAY_OFFSET)
    const { error: meetingErr } = await admin.from('cassian_meetings').insert({
      user_id: TEST_USER_ID,
      title: MEETING_TITLE,
      start_time: atHour(busyDay, 11).toISOString(),
      end_time: atHour(busyDay, 13).toISOString(),
      meeting_type: 'general',
      priority: 'medium',
      status: 'scheduled',
    })
    if (meetingErr) throw new Error(`[beforeAll] insert meeting: ${meetingErr.message}`)

    // project_activity needs a project_id; create a minimal [E2E] project.
    const { data: projectRow, error: projErr } = await admin
      .from('cassian_projects')
      .insert({
        user_id: TEST_USER_ID,
        name: `${E2E_TITLE_PREFIX} Auto-Place Project`,
        status: 'active',
      })
      .select('id')
      .single()
    if (projErr || !projectRow) {
      throw new Error(`[beforeAll] insert project: ${projErr?.message}`)
    }

    const { error: activityErr } = await admin.from('cassian_project_activity').insert({
      user_id: TEST_USER_ID,
      project_id: projectRow.id,
      start_time: atHour(busyDay, 14).toISOString(),
      end_time: atHour(busyDay, 16).toISOString(),
      note: `${E2E_TITLE_PREFIX} blocker`,
    })
    if (activityErr) throw new Error(`[beforeAll] insert activity: ${activityErr.message}`)
  })

  test.afterAll(async () => {
    const admin = adminClient()
    await admin.from('cassian_billable_hours').delete().eq('user_id', TEST_USER_ID)
    await admin.from('cassian_meetings').delete().eq('user_id', TEST_USER_ID)
    await admin.from('cassian_project_activity').delete().eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_projects')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('name', `${E2E_TITLE_PREFIX}%`)
  })

  test('placer fills both a free day and a constrained day to 5 hours each, no overlaps, idempotent', async ({
    page,
  }) => {
    const admin = adminClient()

    await page.goto('/calendar')

    // The placer fires on a 500ms debounce after data load. Poll the
    // DB until 10 rows exist (5 per day × 2 days), giving ample slack
    // for the debounce + supabase round-trip on a cold start.
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('cassian_billable_hours')
            .select('id')
            .eq('user_id', TEST_USER_ID)
          return data?.length ?? 0
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(10)

    const freeDay = startOfLocalDay(FREE_DAY_OFFSET)
    const busyDay = startOfLocalDay(BUSY_DAY_OFFSET)
    const dayAfterFree = new Date(freeDay)
    dayAfterFree.setDate(dayAfterFree.getDate() + 1)
    const dayAfterBusy = new Date(busyDay)
    dayAfterBusy.setDate(dayAfterBusy.getDate() + 1)

    const fetchBlocksForDay = async (dayStart: Date, dayEnd: Date) => {
      const { data, error } = await admin
        .from('cassian_billable_hours')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .gte('start_time', dayStart.toISOString())
        .lt('start_time', dayEnd.toISOString())
      if (error) throw new Error(error.message)
      return data || []
    }

    const freeDayBlocks = await fetchBlocksForDay(freeDay, dayAfterFree)
    const busyDayBlocks = await fetchBlocksForDay(busyDay, dayAfterBusy)

    // FREE day: exactly 5 one-hour blocks summing to 5h. The window is
    // 10:00–22:00 (12h) with no blockers, so the placer fills 5 of the
    // 12 free hours. Each block is at most 1h per algorithm (largest-
    // free-window first, 1h slice cap).
    expect(freeDayBlocks.length).toBe(5)
    const freeTotalHours = freeDayBlocks.reduce(
      (sum, b) =>
        sum +
        (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) /
          (1000 * 60 * 60),
      0,
    )
    expect(freeTotalHours).toBeCloseTo(5, 5)

    // Every row carries the auto-placed marker + flat rate + null note.
    for (const block of [...freeDayBlocks, ...busyDayBlocks]) {
      expect(block.is_auto_placed).toBe(true)
      expect(Number(block.rate)).toBeCloseTo(100, 5)
      expect(block.note).toBeNull()
    }

    // BUSY day: 5 blocks summing to 5h, none overlapping the seeded
    // meeting (11–13) or project_activity (14–16).
    expect(busyDayBlocks.length).toBe(5)
    const busyTotalHours = busyDayBlocks.reduce(
      (sum, b) =>
        sum +
        (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) /
          (1000 * 60 * 60),
      0,
    )
    expect(busyTotalHours).toBeCloseTo(5, 5)

    const meetingStart = atHour(busyDay, 11).getTime()
    const meetingEnd = atHour(busyDay, 13).getTime()
    const activityStart = atHour(busyDay, 14).getTime()
    const activityEnd = atHour(busyDay, 16).getTime()
    for (const block of busyDayBlocks) {
      const bs = new Date(block.start_time).getTime()
      const be = new Date(block.end_time).getTime()
      expect(intervalsOverlap(bs, be, meetingStart, meetingEnd)).toBe(false)
      expect(intervalsOverlap(bs, be, activityStart, activityEnd)).toBe(false)
    }

    // Every block sits inside the work-hours window [10:00, 22:00) on
    // its day.
    for (const block of [...freeDayBlocks, ...busyDayBlocks]) {
      const blockDate = new Date(block.start_time)
      const dayStart = new Date(blockDate)
      dayStart.setHours(10, 0, 0, 0)
      const dayEnd = new Date(blockDate)
      dayEnd.setHours(22, 0, 0, 0)
      expect(blockDate.getTime()).toBeGreaterThanOrEqual(dayStart.getTime())
      expect(new Date(block.end_time).getTime()).toBeLessThanOrEqual(dayEnd.getTime())
    }

    // At least one auto-placed block renders on the visible calendar
    // grid with the billable-hours emerald color (per CalendarEvent.tsx
    // typeClasses['billable-hours'] = 'bg-emerald-100 ...'). The placer
    // covers the next 7 days starting today; the rendered grid covers
    // the day-column window starting from baseDate. Don't pin a
    // specific block — assert at least one renders.
    const billableBlocks = page.locator('[data-calendar-event="true"].bg-emerald-100')
    await expect(billableBlocks.first()).toBeVisible()
    expect(await billableBlocks.count()).toBeGreaterThan(0)

    // Idempotency: capture the current row IDs, then trigger a placer
    // re-run by reloading the page. The placer respects existing
    // is_auto_placed rows and only ADDS — so the row count must NOT
    // increase. (Re-running cannot remove rows.)
    const beforeIds = new Set(
      [...freeDayBlocks, ...busyDayBlocks].map((b: any) => b.id),
    )
    const beforeCount = beforeIds.size

    await page.reload()
    // Give the placer time to run again post-reload.
    await page.waitForTimeout(2_000)

    const { data: afterAll } = await admin
      .from('cassian_billable_hours')
      .select('id')
      .eq('user_id', TEST_USER_ID)
      .gte('start_time', freeDay.toISOString())
      .lt('start_time', dayAfterBusy.toISOString())
    expect((afterAll || []).length).toBe(beforeCount)
  })
})
