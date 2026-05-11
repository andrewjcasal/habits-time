import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * Validates that clicking an empty calendar cell opens MeetingModal in
 * "Add Meeting" mode with the date pre-filled and the start time
 * derived from the click's quarter-hour position within the cell:
 *
 *   y in [0, quarterHeight)        → :00
 *   y in [quarterHeight, 2*qh)     → :15
 *   y in [2*qh, 3*qh)              → :30
 *   y in [3*qh, hourHeight)        → :45
 *
 * Source under test:
 *   src/pages/Calendar.tsx — `handleTimeSlotClick` (~L412)
 *   src/components/CalendarGrid.tsx — `getQuarterFromMousePosition`
 *   src/components/MeetingModal.tsx — full-form render path
 *   src/contexts/ModalContext.tsx — `openMeetingModal` builds start_time
 *
 * The full form only renders directly when `previousTitles.length === 0`.
 * For the freshly-provisioned test user this is already the case, but
 * the `beforeAll` hook clears any `[E2E]%`-prefixed meetings as a
 * resilience measure (and to establish the cleanup pattern that the
 * upcoming create-meeting spec will rely on).
 */

const PINNED_DATE = '2026-05-12'

test.describe('calendar empty-slot click → MeetingModal', () => {
  test.beforeAll(async () => {
    const admin = adminClient()
    // Belt-and-suspenders: scope by user AND by title prefix so we
    // never delete real dev data in this shared cloud project.
    const { error } = await admin
      .from('cassian_meetings')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('title', `${E2E_TITLE_PREFIX}%`)
    if (error) throw new Error(`[beforeAll] cleanup failed: ${error.message}`)
  })

  test('click empty 10am slot opens MeetingModal pre-filled with that time', async ({
    page,
  }) => {
    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-12/)

    // Wait for the grid to render so the 10:00 AM row exists.
    await expect(
      page.getByText('10:00 AM', { exact: true }).first(),
    ).toBeVisible()

    // Locate the 10 AM hour-row. Each row is a `<div class="grid border-b ...">`
    // and "10:00 AM" appears only in the time column of one row.
    const tenAmRow = page
      .locator('div.grid.border-b')
      .filter({ hasText: '10:00 AM' })
      .first()
    await expect(tenAmRow).toBeVisible()

    // The first child is the time-column cell; subsequent children are
    // the day cells. With `?date=2026-05-12` the first day column is
    // 2026-05-12 itself.
    const firstDayCell = tenAmRow.locator('> div').nth(1)
    await expect(firstDayCell).toBeVisible()

    // Click upper area → quarter 0 → :00. CalendarGrid renders a 10px
    // "add note" hover zone on the left edge of every cell (see
    // CalendarGrid.tsx ~L185-208) — clicking inside that zone opens the
    // notes modal instead of MeetingModal. Use x=24 so we clear that
    // zone with margin. y=5 lands inside the first quarter band even
    // at the smallest supported row height.
    await firstDayCell.click({ position: { x: 24, y: 5 } })

    // Modal renders in "Add Meeting" mode (no editingMeeting) — header
    // text is "Add Meeting" via getTitle() in MeetingModal.tsx.
    await expect(page.getByText('Add Meeting', { exact: true })).toBeVisible()

    // Title input is empty (the form path, not the "Recent meetings" picker).
    await expect(page.getByPlaceholder('Meeting title')).toHaveValue('')

    // Date input pre-filled with the pinned date; start time pre-filled
    // with the click's quarter (`10:00`).
    await expect(page.locator('input[type="date"]').first()).toHaveValue(
      PINNED_DATE,
    )
    await expect(page.locator('input[type="time"]').first()).toHaveValue('10:00')

    // Cancel returns to the calendar with the modal closed.
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Add Meeting', { exact: true })).not.toBeVisible()

    // Click bottom-right of the same cell → quarter 3 → :45. Use a
    // position relative to the day cell's measured box so we correctly
    // hit the last quarter band regardless of exact pixel sizes.
    const dayBox = await firstDayCell.boundingBox()
    if (!dayBox) throw new Error('first day cell has no bounding box')
    await firstDayCell.click({
      position: { x: dayBox.width - 5, y: dayBox.height - 5 },
    })

    await expect(page.getByText('Add Meeting', { exact: true })).toBeVisible()
    await expect(page.locator('input[type="time"]').first()).toHaveValue('10:45')
  })
})
