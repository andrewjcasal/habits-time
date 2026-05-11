import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * Validates the daily buffer-time placement logic: the default
 * 17:30–18:30 buffer dodges both meetings AND project activity blocks
 * that overlap its slot, repositioning to immediately after the
 * blocker ends.
 *
 * Source under test:
 *   src/utils/bufferManager.ts — generateDailyBuffer (~L16-118).
 *     Key line: `const blockers = [...meetings, ...projectActivity]`
 *     (commit `1c21cc8`). This is what the spec exercises.
 *
 * Two cases run sequentially:
 *   A: meeting 17:00–18:00 → buffer moves to 18:00 (60 min)
 *   B: project activity 17:00–18:00 → buffer also moves to 18:00
 *
 * Notes:
 *   - PINNED_DATE is in the future (2026-05-15) — today (2026-05-08
 *     when this spec was authored) would trigger same-day reduction
 *     to 30 min, and the buffer disappears entirely after 1 PM.
 *   - Buffer block is rendered via CalendarEventSlots and has
 *     `data-calendar-event="true"` with the title text "Buffer Time".
 *   - Each subtest cleans the prior namespaced rows so the two cases
 *     run with independent state.
 */

const PINNED_DATE = '2026-05-15'
const MEETING_TITLE = `${E2E_TITLE_PREFIX} Buffer blocker meeting`
const PROJECT_NAME = `${E2E_TITLE_PREFIX} Buffer blocker project`

const cleanupAll = async () => {
  const admin = adminClient()
  await admin
    .from('cassian_meetings')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .like('title', `${E2E_TITLE_PREFIX}%`)
  await admin
    .from('cassian_project_activity')
    .delete()
    .eq('user_id', TEST_USER_ID)
  await admin
    .from('cassian_projects')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .like('name', `${E2E_TITLE_PREFIX}%`)
}

test.describe('calendar daily buffer dodges blockers', () => {
  test.beforeAll(cleanupAll)
  test.afterAll(cleanupAll)

  test('A: 17:00–18:00 meeting pushes buffer to 18:00', async ({ page }) => {
    const admin = adminClient()
    // Reset state for this case.
    await cleanupAll()

    // Seed a meeting that overlaps the default 17:30–18:30 buffer.
    const start = new Date(2026, 4, 15, 17, 0).toISOString()
    const end = new Date(2026, 4, 15, 18, 0).toISOString()
    const { error } = await admin
      .from('cassian_meetings')
      .insert({
        user_id: TEST_USER_ID,
        title: MEETING_TITLE,
        start_time: start,
        end_time: end,
        meeting_type: 'general',
        priority: 'medium',
        status: 'scheduled',
      })
    if (error) throw new Error(`[A seed] ${error.message}`)

    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-15/)

    // Buffer block titled "Buffer Time" should land in the 18:00 row,
    // not the 17:00 row. The 18:00 row's first day-cell is the May-15
    // column.
    const sixPmRow = page
      .locator('div.grid.border-b')
      .filter({ hasText: '6:00 PM' })
      .first()
    await expect(sixPmRow).toBeVisible()
    const firstDayCell6pm = sixPmRow.locator('> div').nth(1)

    const bufferIn6pm = firstDayCell6pm
      .locator('[data-calendar-event="true"]')
      .filter({ hasText: 'Buffer Time' })
    await expect(bufferIn6pm).toBeVisible()

    // And the 17:00 row's May-15 cell should NOT contain a Buffer Time
    // block — the meeting block lives there instead.
    const fivePmRow = page
      .locator('div.grid.border-b')
      .filter({ hasText: '5:00 PM' })
      .first()
    const firstDayCell5pm = fivePmRow.locator('> div').nth(1)
    await expect(
      firstDayCell5pm
        .locator('[data-calendar-event="true"]')
        .filter({ hasText: 'Buffer Time' }),
    ).toHaveCount(0)
  })

  test('B: 17:00–18:00 project activity also pushes buffer to 18:00', async ({ page }) => {
    const admin = adminClient()
    // Reset state for this case so Case A's meeting doesn't influence
    // the test (it would also push to 18:00, masking the bug).
    await cleanupAll()

    // Seed a project + an activity that overlaps the default buffer.
    const { data: project, error: projectError } = await admin
      .from('cassian_projects')
      .insert({
        user_id: TEST_USER_ID,
        name: PROJECT_NAME,
        color: '#0000ff',
        status: 'active',
      })
      .select('id')
      .single()
    if (projectError) throw new Error(`[B project seed] ${projectError.message}`)

    const start = new Date(2026, 4, 15, 17, 0).toISOString()
    const end = new Date(2026, 4, 15, 18, 0).toISOString()
    const { error: activityError } = await admin
      .from('cassian_project_activity')
      .insert({
        user_id: TEST_USER_ID,
        project_id: project.id,
        start_time: start,
        end_time: end,
      })
    if (activityError) throw new Error(`[B activity seed] ${activityError.message}`)

    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-15/)

    // Buffer should land in the 18:00 row, not 17:00.
    const sixPmRow = page
      .locator('div.grid.border-b')
      .filter({ hasText: '6:00 PM' })
      .first()
    await expect(sixPmRow).toBeVisible()
    const firstDayCell6pm = sixPmRow.locator('> div').nth(1)

    const bufferIn6pm = firstDayCell6pm
      .locator('[data-calendar-event="true"]')
      .filter({ hasText: 'Buffer Time' })
    await expect(bufferIn6pm).toBeVisible()

    // 17:00 row's May-15 cell has no Buffer Time block.
    const fivePmRow = page
      .locator('div.grid.border-b')
      .filter({ hasText: '5:00 PM' })
      .first()
    const firstDayCell5pm = fivePmRow.locator('> div').nth(1)
    await expect(
      firstDayCell5pm
        .locator('[data-calendar-event="true"]')
        .filter({ hasText: 'Buffer Time' }),
    ).toHaveCount(0)
  })
})
