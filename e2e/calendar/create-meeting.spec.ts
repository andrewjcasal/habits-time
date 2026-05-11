import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * Validates the full create-meeting happy path:
 *   - drag-to-create on the calendar opens MeetingModal with start/end pre-filled
 *   - submitting the form inserts a row in cassian_meetings
 *   - the new meeting renders on the grid as a red (unlinked) meeting block
 *
 * Source under test:
 *   src/pages/Calendar.tsx — handleMouseDown / handleMouseUp drag flow + handleSaveMeeting
 *   src/components/MeetingModal.tsx — full-form path (forced by clearing prior meetings)
 *   src/utils/meetingManager.ts — addMeeting()
 *   src/components/CalendarEventSlots.tsx + CalendarEvent.tsx — meeting render markup
 *
 * The pinned date is 2026-05-12 (Tuesday). Drag spans 10:00 → 10:30
 * inside the 10 AM hour-row cell:
 *   start: hourIndex=5 (10AM), quarter=0 → "10:00"
 *   end:   hourIndex=5 (10AM), quarter=1 → endPlusOne=22 → "10:30"
 *
 * Cleanup discipline: every row this spec writes is namespaced with the
 * `[E2E]` title prefix and scoped to TEST_USER_ID, so the afterAll
 * service-role delete cannot touch real dev data in this shared cloud
 * project.
 */

const PINNED_DATE = '2026-05-12'
const MEETING_TITLE = `${E2E_TITLE_PREFIX} Standup`

test.describe('calendar create meeting via MeetingModal', () => {
  test.beforeAll(async () => {
    const admin = adminClient()
    // Wipe any leftover [E2E] meetings owned by the test user so:
    //   1. the modal opens to the full form (no "Recent meetings" picker)
    //   2. the post-create assertion can match exactly one row by title
    const { error } = await admin
      .from('cassian_meetings')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('title', `${E2E_TITLE_PREFIX}%`)
    if (error) throw new Error(`[beforeAll] cleanup failed: ${error.message}`)
  })

  test.afterAll(async () => {
    const admin = adminClient()
    const { error } = await admin
      .from('cassian_meetings')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('title', `${E2E_TITLE_PREFIX}%`)
    if (error) throw new Error(`[afterAll] cleanup failed: ${error.message}`)
  })

  test('drag-to-create on 2026-05-12 10:00–10:30 inserts cassian_meetings row + renders red meeting block', async ({
    page,
  }) => {
    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-12/)

    // Wait for the 10 AM hour-row to be present.
    await expect(
      page.getByText('10:00 AM', { exact: true }).first(),
    ).toBeVisible()

    // Locate the 10 AM hour-row (a `<div class="grid border-b">` whose
    // time-column contains "10:00 AM" as the only "h:00 AM/PM" text).
    const tenAmRow = page
      .locator('div.grid.border-b')
      .filter({ hasText: '10:00 AM' })
      .first()
    await expect(tenAmRow).toBeVisible()

    // First day cell of the row = May 12 (column 0 = baseDate).
    const firstDayCell = tenAmRow.locator('> div').nth(1)
    await expect(firstDayCell).toBeVisible()

    const cellBox = await firstDayCell.boundingBox()
    if (!cellBox) throw new Error('first day cell has no bounding box')

    // Drag inside the 10AM cell from y=2 (quarter 0 → 10:00) down past
    // the quarter-1 band so dragEnd resolves to quarter 1 (→ endPlusOne
    // 22 → "10:30"). x is offset >= 12 to clear the 10px add-note hover
    // zone on the left edge (CalendarGrid.tsx ~L185-208) which would
    // otherwise intercept the mousedown and route the gesture into the
    // notes flow.
    const dragX = cellBox.x + 24
    const quarterHeight = cellBox.height / 4
    const dragStartY = cellBox.y + 2
    // Land in the middle of quarter 1 to be robust to subpixel rounding.
    const dragEndY = cellBox.y + quarterHeight + quarterHeight / 2

    await page.mouse.move(dragX, dragStartY)
    await page.mouse.down()
    // Multi-step move so React's mouseenter/mousemove handlers latch
    // onto the dragEnd quarter cleanly. The drag must traverse multiple
    // intermediate positions or the mouseUp fires before mouseEnter has
    // updated dragEnd to the final quarter.
    await page.mouse.move(dragX, dragStartY + quarterHeight, { steps: 5 })
    await page.mouse.move(dragX, dragEndY, { steps: 5 })
    await page.mouse.up()

    // Modal opened in "Add Meeting" mode (no editingMeeting → header reads "Add Meeting").
    await expect(page.getByText('Add Meeting', { exact: true })).toBeVisible()

    // Verify pre-fill before typing.
    await expect(page.locator('input[type="date"]').first()).toHaveValue(PINNED_DATE)
    await expect(page.locator('input[type="time"]').first()).toHaveValue('10:00')

    // Title.
    const titleInput = page.getByPlaceholder('Meeting title')
    await titleInput.fill(MEETING_TITLE)

    // The full form has 3 selects in order: meeting_type, priority, category.
    // Set meeting_type=work, priority=medium (default), leave category as "".
    const formSelects = page.locator('form select')
    await formSelects.nth(0).selectOption('work')
    await formSelects.nth(1).selectOption('medium')
    await expect(formSelects.nth(2)).toHaveValue('')

    // Submit.
    await page.getByRole('button', { name: 'Create' }).click()

    // Modal closes (header gone).
    await expect(page.getByText('Add Meeting', { exact: true })).not.toBeVisible()

    // Meeting block renders inside the May 12 column. CalendarEvent renders
    // a div with `data-calendar-event="true"` and the meeting title text.
    const meetingBlock = page
      .locator('[data-calendar-event="true"]')
      .filter({ hasText: MEETING_TITLE })
      .first()
    await expect(meetingBlock).toBeVisible()

    // Unlinked meetings get the red-100 / red-800 type style. The
    // bg-red-100 class is on the same element as `data-calendar-event`.
    await expect(meetingBlock).toHaveClass(/bg-red-100/)
    // And it should NOT be rendered with the green meeting+habit-link style
    // (an inline backgroundColor of #dcfce7 added when meeting_habits.length > 0).
    const inlineBg = await meetingBlock.evaluate(el => (el as HTMLElement).style.backgroundColor)
    expect(inlineBg.toLowerCase()).not.toBe('rgb(220, 252, 231)') // #dcfce7

    // Verify cassian_meetings row.
    const admin = adminClient()
    const { data, error } = await admin
      .from('cassian_meetings')
      .select(
        'id,user_id,title,start_time,end_time,meeting_type,priority,status,category_id',
      )
      .eq('user_id', TEST_USER_ID)
      .eq('title', MEETING_TITLE)
    if (error) throw new Error(`[verify] meeting fetch failed: ${error.message}`)
    expect(data).toHaveLength(1)
    const row = data![0]
    expect(row.meeting_type).toBe('work')
    expect(row.priority).toBe('medium')
    expect(row.status).toBe('scheduled')
    expect(row.category_id).toBeNull()
    // start_time / end_time are timestamptz ISO strings. The app builds
    // them with local-time `new Date(year, month-1, day, hour, minute)`,
    // so wall-clock value is 10:00 / 10:30 local. Asserting via Date
    // getter fields stays robust regardless of the test runner's TZ.
    const start = new Date(row.start_time)
    const end = new Date(row.end_time)
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(4) // May (0-indexed)
    expect(start.getDate()).toBe(12)
    expect(start.getHours()).toBe(10)
    expect(start.getMinutes()).toBe(0)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(4)
    expect(end.getDate()).toBe(12)
    expect(end.getHours()).toBe(10)
    expect(end.getMinutes()).toBe(30)
  })
})
