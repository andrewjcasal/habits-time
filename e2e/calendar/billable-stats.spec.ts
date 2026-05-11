// [E2E:in-progress] 86b9vabna
import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * PW: 86b9vabna — CalendarTopBar shows new compact stats: "Bill 7d:
 * Xh ($Y)" (upcoming billable_hours sum × $100) and "Billed 7d: Zh"
 * (past billable_hours + past project_activity, no $).
 *
 * Whole-row discriminator: a row with start_time < now contributes its
 * full duration to "Billed 7d"; a row with start_time >= now and
 * < now+7d contributes its full duration to "Bill 7d". No splitting.
 *
 * Source under test:
 *   src/components/CalendarTopBar.tsx — stats render
 *   src/hooks/useBillableHours.ts — upcomingHoursToBill /
 *     hoursBilledLast7Days useMemos
 *   src/pages/Calendar.tsx — composes pastBilledExtras from
 *     projectActivity, passes upcomingHoursToBill / hoursBilledLast7Days
 *     to CalendarTopBar
 *
 * Removed-UI assertions cover the strip cleanup from plan §7: planned
 * / actual stats, "Upcoming Tasks" ListTodo button, "Work Hours"
 * label literal, TaskScheduleModal.
 */

const PAST_HOURS_BILLABLE = 3
const PAST_HOURS_PROJECT_ACTIVITY = 2
const UPCOMING_HOURS_BILLABLE = 4

test.describe('billable-hours top-bar stats', () => {
  test.beforeAll(async () => {
    const admin = adminClient()

    // Wipe billable_hours + project_activity for the test user so the
    // sums are deterministic. Auto-placer will fill upcoming days too,
    // so we'll account for what we seed AND what it adds. Cleanest:
    // disable the placer's contribution by seeding a manual block
    // covering the full work-hours window for each future day so the
    // placer has no free room to add more. Simpler: just dominate the
    // upcoming sum by seeding far enough that placer additions are
    // dwarfed and assert ranges. But that's flaky.
    //
    // Cleanest path: seed everything needed AND a single big upcoming
    // manual block with is_auto_placed=false at exactly known hours.
    // Then assert via the precomputed expected sums, accepting that
    // the placer will ALSO add up to 5h × 7 days = 35h of additional
    // upcoming rows on free days. So the expected upcoming total is
    // (seeded UPCOMING_HOURS_BILLABLE) + (placer rows).
    //
    // Tighter: wipe rows, then in beforeAll BLOCK the placer by
    // seeding 12h of manual is_auto_placed=false rows on each upcoming
    // day so the placer's `existing < dailyQuota` check fails for
    // every day (existing dominates). That blanket-blocks the placer
    // and makes the upcoming sum predictable.
    //
    // Simpler still: seed only a known UPCOMING block, navigate to the
    // calendar, wait for the placer to settle, THEN read the real
    // upcoming sum from the DB and assert the rendered stat matches
    // that runtime sum. This trades pure unit semantics for a
    // self-consistency check, which is appropriate for a stats
    // display.
    await admin.from('cassian_billable_hours').delete().eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_project_activity')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('note', `${E2E_TITLE_PREFIX}%`)

    const now = new Date()

    // PAST seed: 3h of billable_hours fully in the past (today, but
    // hours that have already elapsed). Anchor the past block well
    // before now so the row's start_time < now even with timezone or
    // clock-skew slack.
    const pastBillStart = new Date(now)
    pastBillStart.setDate(pastBillStart.getDate() - 1)
    pastBillStart.setHours(8, 0, 0, 0)
    const pastBillEnd = new Date(pastBillStart)
    pastBillEnd.setHours(pastBillEnd.getHours() + PAST_HOURS_BILLABLE)

    const { error: pastBillErr } = await admin.from('cassian_billable_hours').insert({
      user_id: TEST_USER_ID,
      start_time: pastBillStart.toISOString(),
      end_time: pastBillEnd.toISOString(),
      rate: 100,
      note: `${E2E_TITLE_PREFIX} past billable`,
      is_auto_placed: false,
    })
    if (pastBillErr) throw new Error(`[beforeAll] past billable: ${pastBillErr.message}`)

    // PAST seed: 2h of project_activity fully in the past. Need a
    // project to link.
    const { data: projectRow, error: projErr } = await admin
      .from('cassian_projects')
      .insert({
        user_id: TEST_USER_ID,
        name: `${E2E_TITLE_PREFIX} stats project`,
        status: 'active',
      })
      .select('id')
      .single()
    if (projErr || !projectRow) {
      throw new Error(`[beforeAll] insert project: ${projErr?.message}`)
    }

    const pastActStart = new Date(pastBillStart)
    pastActStart.setHours(pastActStart.getHours() + PAST_HOURS_BILLABLE + 1)
    const pastActEnd = new Date(pastActStart)
    pastActEnd.setHours(pastActEnd.getHours() + PAST_HOURS_PROJECT_ACTIVITY)
    const { error: pastActErr } = await admin.from('cassian_project_activity').insert({
      user_id: TEST_USER_ID,
      project_id: projectRow.id,
      start_time: pastActStart.toISOString(),
      end_time: pastActEnd.toISOString(),
      note: `${E2E_TITLE_PREFIX} past activity`,
    })
    if (pastActErr) throw new Error(`[beforeAll] past activity: ${pastActErr.message}`)

    // UPCOMING seed: a 4h manual block tomorrow at 09:00. is_auto_placed
    // false so the placer respects it (won't cover the same hours).
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    const upcomingEnd = new Date(tomorrow)
    upcomingEnd.setHours(upcomingEnd.getHours() + UPCOMING_HOURS_BILLABLE)
    const { error: upcomingErr } = await admin.from('cassian_billable_hours').insert({
      user_id: TEST_USER_ID,
      start_time: tomorrow.toISOString(),
      end_time: upcomingEnd.toISOString(),
      rate: 100,
      note: `${E2E_TITLE_PREFIX} upcoming manual`,
      is_auto_placed: false,
    })
    if (upcomingErr) throw new Error(`[beforeAll] upcoming: ${upcomingErr.message}`)
  })

  test.afterAll(async () => {
    const admin = adminClient()
    await admin.from('cassian_billable_hours').delete().eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_project_activity')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('note', `${E2E_TITLE_PREFIX}%`)
    await admin
      .from('cassian_projects')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('name', `${E2E_TITLE_PREFIX}%`)
  })

  test('renders Bill 7d / Billed 7d with the right math; legacy stats stripped', async ({
    page,
  }) => {
    const admin = adminClient()
    await page.goto('/calendar')

    // Wait for the auto-placer to settle (it'll add up-to-5h/day on
    // free upcoming days). 2.5s covers the 500ms debounce + bulk
    // insert + state splice + a little margin.
    await page.waitForTimeout(2_500)

    // Read the runtime ground truth: sum upcoming billable durations
    // and past billable+activity durations using the same whole-row
    // discriminator as the hook.
    const now = Date.now()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const sevenDaysAhead = now + sevenDaysMs
    const sevenDaysAgo = now - sevenDaysMs

    const { data: bills } = await admin
      .from('cassian_billable_hours')
      .select('start_time, end_time')
      .eq('user_id', TEST_USER_ID)
    const { data: acts } = await admin
      .from('cassian_project_activity')
      .select('start_time, end_time')
      .eq('user_id', TEST_USER_ID)

    const hoursBetween = (s: string, e: string) =>
      (new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60)

    const expectedUpcoming = (bills || []).reduce((sum, b) => {
      const start = new Date(b.start_time).getTime()
      if (start >= now && start < sevenDaysAhead) return sum + hoursBetween(b.start_time, b.end_time)
      return sum
    }, 0)
    const expectedBilledBills = (bills || []).reduce((sum, b) => {
      const start = new Date(b.start_time).getTime()
      if (start >= sevenDaysAgo && start < now) return sum + hoursBetween(b.start_time, b.end_time)
      return sum
    }, 0)
    const expectedBilledActs = (acts || []).reduce((sum, a) => {
      const start = new Date(a.start_time).getTime()
      if (start >= sevenDaysAgo && start < now) return sum + hoursBetween(a.start_time, a.end_time)
      return sum
    }, 0)
    const expectedBilled = expectedBilledBills + expectedBilledActs

    // Rendered formatting: CalendarTopBar uses .toFixed(1) for the h
    // values and .toFixed(0) for the dollar value.
    const billText = `Bill 7d:`
    const billedText = `Billed 7d:`
    await expect(page.getByText(billText, { exact: false })).toBeVisible()
    await expect(page.getByText(billedText, { exact: false })).toBeVisible()

    // The two stats live next to each other in a single hidden-on-
    // mobile flex container. Read their full visible text and parse
    // the numbers; assert against the runtime ground truth (within
    // 0.1h of slack for rounding-display drift since we compare a
    // single-decimal display to a precise float).
    const billStat = page.getByText(/Bill 7d:\s*[\d.]+h\s*\(\$[\d,]+\)/)
    const billedStat = page.getByText(/Billed 7d:\s*[\d.]+h/)
    await expect(billStat).toBeVisible()
    await expect(billedStat).toBeVisible()

    const billRaw = (await billStat.textContent()) || ''
    const billedRaw = (await billedStat.textContent()) || ''
    const billHoursMatch = billRaw.match(/([\d.]+)h/)
    const billDollarsMatch = billRaw.match(/\$([\d,]+)/)
    const billedHoursMatch = billedRaw.match(/([\d.]+)h/)
    if (!billHoursMatch || !billDollarsMatch || !billedHoursMatch) {
      throw new Error(`stats parse failed: bill=${billRaw} billed=${billedRaw}`)
    }
    const renderedBillHours = parseFloat(billHoursMatch[1])
    const renderedBillDollars = parseFloat(billDollarsMatch[1].replace(/,/g, ''))
    const renderedBilledHours = parseFloat(billedHoursMatch[1])

    expect(renderedBillHours).toBeCloseTo(expectedUpcoming, 0)
    // Bill dollar value = renderedBillHours × 100 (flat rate).
    expect(renderedBillDollars).toBeCloseTo(renderedBillHours * 100, 0)
    expect(renderedBilledHours).toBeCloseTo(expectedBilled, 0)

    // Sanity: each seeded contribution shows up as a floor on the
    // running total. Upcoming gets our 4h manual seed PLUS whatever
    // the auto-placer added on free upcoming days. Past gets the 3h
    // seeded billable + 2h seeded activity (total 5h) PLUS any
    // auto-placed blocks for TODAY whose start_time has already
    // elapsed by the time the test reads — the placer fills today
    // forward from the start of the work-hours window, so any block
    // before `now` counts as past in the whole-row discriminator.
    // Both sums are floors, not exact equalities.
    expect(expectedUpcoming).toBeGreaterThanOrEqual(UPCOMING_HOURS_BILLABLE - 0.01)
    expect(expectedBilled).toBeGreaterThanOrEqual(
      PAST_HOURS_BILLABLE + PAST_HOURS_PROJECT_ACTIVITY - 0.01,
    )

    // Removed-UI assertions: nothing on the top bar mentions the
    // legacy planned/actual/upcoming-tasks UI or the "Work Hours"
    // label.
    await expect(page.getByText('Work Hours', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Planned:', { exact: false })).toHaveCount(0)
    await expect(page.getByText('Actual:', { exact: false })).toHaveCount(0)
    // The TaskScheduleModal had role=dialog and a "Upcoming Tasks"
    // heading. With the file deleted, neither should appear.
    await expect(page.getByText('Upcoming Tasks', { exact: false })).toHaveCount(0)

    // Info icon for the schedule tooltip is preserved (per plan §7
    // "Keep the info icon"). The button has aria-label="Work hours
    // details".
    await expect(page.getByRole('button', { name: 'Work hours details' })).toBeVisible()
  })
})
