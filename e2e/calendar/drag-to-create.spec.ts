import { test, expect } from '../fixtures/drag'

/**
 * Validates that dragging vertically inside a single day-column hour
 * cell on the calendar opens MeetingModal once with the dragged time
 * range pre-filled, and that cancelling clears the drag-selection
 * overlay.
 *
 * Source under test:
 *   src/pages/Calendar.tsx — handleMouseDown / handleMouseMove / handleMouseUp,
 *     dragOccurredRef (suppresses trailing click)
 *   src/components/CalendarGrid.tsx — drag-selection overlay (only renders
 *     while isDragging && dragStart && dragEnd are set)
 *   src/components/MeetingModal.tsx — full-form path
 *
 * Drag math (handleMouseUp ~L703 in Calendar.tsx):
 *   start: hourIndex=4 (9AM, since 5AM is index 0), quarter=0 → "09:00"
 *   end:   hourIndex=4, quarter=1 → endPlusOne=18 → endHour=4, endQuarter=2 → "09:30"
 *
 * Pinned date 2026-05-12. No DB writes — purely modal-open assertions
 * + cancel.
 */

const PINNED_DATE = '2026-05-12'

test.describe('calendar drag-to-create meeting', () => {
  test('drag inside 9 AM cell opens MeetingModal once with 09:00–09:30 pre-fill; cancel clears the ghost rect', async ({
    page,
  }) => {
    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-12/)

    // Wait for the 9 AM hour-row to render.
    await expect(
      page.getByText('9:00 AM', { exact: true }).first(),
    ).toBeVisible()

    const nineAmRow = page
      .locator('div.grid.border-b')
      .filter({ hasText: '9:00 AM' })
      .first()
    await expect(nineAmRow).toBeVisible()

    // First day column = May 12 (column 0 = baseDate).
    const firstDayCell = nineAmRow.locator('> div').nth(1)
    await expect(firstDayCell).toBeVisible()

    const cellBox = await firstDayCell.boundingBox()
    if (!cellBox) throw new Error('first day cell has no bounding box')

    // Drag inside the 9 AM cell. x=24 clears the 10px add-note hover
    // zone on the left edge (CalendarGrid.tsx ~L185-208) which would
    // otherwise intercept the mousedown and route the gesture into the
    // notes flow.
    //   y= 2 → quarter 0 → "09:00"
    //   y=cellH/4 + cellH/8 → quarter 1 → endPlusOne 18 → "09:30"
    const dragX = cellBox.x + 24
    const quarterHeight = cellBox.height / 4
    const dragStartY = cellBox.y + 2
    const dragEndY = cellBox.y + quarterHeight + quarterHeight / 2

    // Modal must be closed before the drag.
    await expect(page.getByText('Add Meeting', { exact: true })).toHaveCount(0)

    await page.mouse.move(dragX, dragStartY)
    await page.mouse.down()
    // Multi-step move so React's mouseenter/mousemove handlers latch
    // onto each quarter cleanly — a single jump can land before
    // mouseEnter has fired and dragEnd would be stale.
    await page.mouse.move(dragX, dragStartY + quarterHeight, { steps: 5 })
    await page.mouse.move(dragX, dragEndY, { steps: 5 })
    await page.mouse.up()

    // Modal opened in "Add Meeting" mode.
    await expect(page.getByText('Add Meeting', { exact: true })).toBeVisible()

    // Pre-fill: date 2026-05-12, start 09:00.
    await expect(page.locator('input[type="date"]').first()).toHaveValue(PINNED_DATE)
    await expect(page.locator('input[type="time"]').first()).toHaveValue('09:00')
    // End-time input is the second `<input type="time">` in the form.
    await expect(page.locator('input[type="time"]').nth(1)).toHaveValue('09:30')

    // Title input is empty (full form, not the recent-meetings picker).
    await expect(page.getByPlaceholder('Meeting title')).toHaveValue('')

    // Modal opened EXACTLY once: drag suppresses the trailing click via
    // dragOccurredRef.current, so there is exactly one MeetingModal in
    // the DOM (one "Add Meeting" header).
    await expect(page.getByText('Add Meeting', { exact: true })).toHaveCount(1)

    // Cancel.
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Add Meeting', { exact: true })).toHaveCount(0)

    // Drag-selection overlay (in CalendarGrid.tsx ~L223-262) renders only
    // while `isDragging && dragStart && dragEnd`. After mouseup, all three
    // are reset, so no overlay should remain. The overlay is the only
    // element on the page with inline `animation: pulse 1s infinite`.
    const ghostRect = page.locator('div[style*="animation: pulse"]')
    await expect(ghostRect).toHaveCount(0)
  })
})
