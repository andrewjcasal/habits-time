import { test, expect } from '../fixtures/drag'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * Validates meeting drag-to-move: grabbing a meeting's body (NOT the
 * bottom 5px resize handle) and dragging down by 64px snaps the start
 * forward by 60 minutes, keeping the duration constant.
 *
 * Source under test:
 *   src/pages/Calendar.tsx — handleMeetingDragStart (~L1149-1158),
 *     drag useEffect (~L1160-1195), `meetingDragMovedRef` threshold (>2px)
 *   src/utils/calendarDragUtils.ts — deltaYToMinutes (64px = 60 min, 15-min snap)
 *   src/utils/meetingManager.ts — updateMeeting()
 *   src/components/CalendarEventSlots.tsx — onMeetingDragStart wiring (~L265)
 *   src/components/CalendarEvent.tsx — block-level onMouseDown (NOT the
 *     bottom 5px resize handle which has its own stopPropagation)
 */

const PINNED_DATE = '2026-05-12'
const MEETING_TITLE = `${E2E_TITLE_PREFIX} Move me`

test.describe('calendar meeting drag-to-move', () => {
  let seededMeetingId: string | null = null

  test.beforeAll(async () => {
    const admin = adminClient()
    await admin
      .from('cassian_meetings')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('title', `${E2E_TITLE_PREFIX}%`)

    const start = new Date(2026, 4, 12, 10, 0).toISOString()
    const end = new Date(2026, 4, 12, 10, 30).toISOString()

    const { data, error } = await admin
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
      .select('id')
      .single()
    if (error) throw new Error(`[beforeAll] seed failed: ${error.message}`)
    seededMeetingId = data.id
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

  test('drag block body down 64px → start_time +60 min, end_time +60 min, duration preserved', async ({
    page,
  }) => {
    expect(seededMeetingId).not.toBeNull()

    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-12/)

    const meetingBlock = page
      .locator('[data-calendar-event="true"]')
      .filter({ hasText: MEETING_TITLE })
      .first()
    await expect(meetingBlock).toBeVisible()

    // Wait for grid auto-scroll (Calendar.tsx ~L361-398) to settle so
    // our cached coords stay valid through the drag.
    await meetingBlock.scrollIntoViewIfNeeded()
    await expect(async () => {
      const a = await meetingBlock.boundingBox()
      await page.waitForTimeout(60)
      const b = await meetingBlock.boundingBox()
      if (!a || !b) throw new Error('no box yet')
      expect(Math.abs(a.y - b.y)).toBeLessThan(0.5)
    }).toPass({ timeout: 3_000 })

    const beforeBox = await meetingBlock.boundingBox()
    if (!beforeBox) throw new Error('meeting block has no bounding box (before)')

    // Grab the BODY of the meeting, well away from the bottom 5px
    // resize handle. y at top + 5 lands inside the body's drag region.
    const grabX = beforeBox.x + beforeBox.width / 2
    const grabY = beforeBox.y + 5

    // Drag down 64px → +60 min. Multi-step move so React's document
    // mousemove handler keeps `meetingDragY` updated and
    // `meetingDragMovedRef` flips true (Math.abs(deltaY) > 2).
    await page.mouse.move(grabX, grabY)
    await page.mouse.down()
    await page.waitForTimeout(50)
    await page.mouse.move(grabX, grabY + 16, { steps: 3 })
    await page.mouse.move(grabX, grabY + 32, { steps: 3 })
    await page.mouse.move(grabX, grabY + 48, { steps: 3 })
    await page.mouse.move(grabX, grabY + 64, { steps: 3 })
    await page.waitForTimeout(50)
    await page.mouse.up()

    // Verify persisted start_time / end_time both shifted by +60 min.
    const admin = adminClient()
    await expect(async () => {
      const { data, error } = await admin
        .from('cassian_meetings')
        .select('start_time,end_time')
        .eq('id', seededMeetingId!)
        .single()
      if (error) throw error
      const start = new Date(data.start_time)
      const end = new Date(data.end_time)
      // start: 10:00 → 11:00
      expect(start.getHours()).toBe(11)
      expect(start.getMinutes()).toBe(0)
      // end: 10:30 → 11:30
      expect(end.getHours()).toBe(11)
      expect(end.getMinutes()).toBe(30)
      // Duration unchanged at 30 min.
      expect((end.getTime() - start.getTime()) / 60000).toBe(30)
    }).toPass({ timeout: 5_000 })
  })
})
