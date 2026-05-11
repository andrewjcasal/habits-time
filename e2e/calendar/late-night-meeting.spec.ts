import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * Validates that a late-night meeting (start hour 0–4) renders in the
 * PREVIOUS calendar day's column, anchored at the bottom of the grid.
 *
 * Source under test:
 *   src/utils/calendarGrid.ts — `isLateNightHour` (hour < GRID_START_HOUR=5),
 *     `hourToGridIndex` (wraps 0–4 to indices 19–23, the bottom of the
 *     column), `getColumnDate` (remaps dateStr to dateStr-1 for hours 0–4)
 *   src/hooks/useCalendarData.ts — meeting indexing (~L437-472), keyed
 *     by `${getColumnDate(startDateStr, startHour)}-${startHour}`
 *
 * Strategy: seed a 2026-05-12 01:00–02:00 meeting. With ?date=2026-05-11
 * (Monday), the May-11 column is column 0. The meeting renders inside
 * the 1 AM hour-row of the May-11 column, which is grid row 20 (5 AM is
 * row 0, 6 AM row 1, …, 11 PM row 18, 12 AM row 19, 1 AM row 20).
 * That puts it in the lower portion of the grid.
 */

const PINNED_DATE = '2026-05-11' // Monday — column 0
const MEETING_TITLE = `${E2E_TITLE_PREFIX} Late night`

test.describe('calendar late-night meeting render', () => {
  test.beforeAll(async () => {
    const admin = adminClient()
    await admin
      .from('cassian_meetings')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('title', `${E2E_TITLE_PREFIX}%`)

    // 2026-05-12 01:00–02:00 — visually belongs to the May-11 column.
    const start = new Date(2026, 4, 12, 1, 0).toISOString()
    const end = new Date(2026, 4, 12, 2, 0).toISOString()
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
    if (error) throw new Error(`[beforeAll] ${error.message}`)
  })

  test.afterAll(async () => {
    const admin = adminClient()
    await admin
      .from('cassian_meetings')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('title', `${E2E_TITLE_PREFIX}%`)
  })

  test('1 AM meeting on 2026-05-12 renders inside Monday 2026-05-11 column 1 AM hour-row', async ({
    page,
  }) => {
    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-11/)

    // Find the unique seeded meeting block by title. There is only one
    // event in the entire grid carrying this title, so a global locator
    // is safe and avoids climbing the hour-row DOM (which had a brittle
    // chain previously).
    const meetingBlock = page
      .locator('[data-calendar-event="true"]')
      .filter({ hasText: MEETING_TITLE })
    await expect(meetingBlock).toHaveCount(1)
    await meetingBlock.scrollIntoViewIfNeeded()
    await expect(meetingBlock).toBeVisible()

    // Locate the 1 AM hour-row label. The label text "1:00 AM" appears
    // exactly once in the grid (the time-column cell uses exact match).
    // Climb to the row container via xpath — filtering rows by `hasText`
    // would also match the 11 AM row whose label *contains* "1:00 AM".
    const oneAmLabel = page.getByText('1:00 AM', { exact: true }).first()
    await expect(oneAmLabel).toBeVisible()
    const oneAmRow = oneAmLabel.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " grid ") and contains(concat(" ", normalize-space(@class), " "), " border-b ")][1]'
    )
    await expect(oneAmRow).toBeVisible()

    // Locate the May-11 column header. The label is "Mon, May 11" unless
    // the test runs on that exact date (then "Today"). Since PINNED_DATE
    // is the URL anchor and today's date drives the "Today"/"Yesterday"
    // mapping, we match either "May 11" or "Today" / "Yesterday" — the
    // header for the FIRST column (the May-11 anchor) is what we need.
    // Using the first <h2> heading after the calendar headers row is
    // the most robust target — column 0 is always the leftmost.
    const dayHeaders = page.getByRole('heading', { level: 2 })
    await expect(dayHeaders.first()).toBeVisible()
    const mayElevenHeaderBox = await dayHeaders.first().boundingBox()

    const oneAmRowBox = await oneAmRow.boundingBox()
    const meetingBox = await meetingBlock.boundingBox()
    if (!oneAmRowBox || !meetingBox || !mayElevenHeaderBox) throw new Error('no boxes')

    // Vertical: meeting top sits within the 1 AM row (allow 1px slack).
    expect(meetingBox.y).toBeGreaterThanOrEqual(oneAmRowBox.y - 1)
    expect(meetingBox.y).toBeLessThan(oneAmRowBox.y + oneAmRowBox.height)

    // Horizontal: meeting's center X is inside the FIRST day column's
    // horizontal span (i.e. May-11) — proves the late-night remap landed
    // it in column 0 (May-11) and NOT column 1 (May-12). Allow small
    // tolerance for column padding.
    const meetingCenterX = meetingBox.x + meetingBox.width / 2
    expect(meetingCenterX).toBeGreaterThanOrEqual(mayElevenHeaderBox.x - 2)
    expect(meetingCenterX).toBeLessThanOrEqual(mayElevenHeaderBox.x + mayElevenHeaderBox.width + 2)
  })
})
