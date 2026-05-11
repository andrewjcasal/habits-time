import { test, expect } from '../fixtures/drag'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * Validates meeting drag-to-resize: grabbing a meeting block's bottom
 * edge and dragging down by 64px snaps the new end_time forward by 60
 * minutes, persists to cassian_meetings, and roughly doubles the
 * rendered block height (30 min → 90 min).
 *
 * Source under test:
 *   src/hooks/useEventRegistry.ts — `meeting.resize` op (updateMeeting end_time)
 *   src/pages/Calendar.tsx — handleEventResizeStart / mousemove / mouseup
 *     in the resizingEvent useEffect (~L791-911)
 *   src/utils/calendarDragUtils.ts — deltaYToMinutes (64px = 60 min, 15-min snap)
 *   src/components/CalendarEventSlots.tsx — onMeetingResizeStart wiring
 *   src/components/CalendarEvent.tsx — bottom 5px resize handle (cursor-s-resize)
 */

const PINNED_DATE = '2026-05-12'
const MEETING_TITLE = `${E2E_TITLE_PREFIX} Resize me`

test.describe('calendar meeting drag-to-resize', () => {
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

  test('drag bottom edge down 64px → end_time +60 min, height ~ doubled', async ({
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

    // The grid auto-scrolls once after `isDataLoading` flips to false
    // (Calendar.tsx ~L361-398). If we capture boundingBox before that
    // settles, our cached y-coords go stale and the mouse drag misses
    // the resize handle. Force a scroll-into-view, then wait for the
    // bounding box to stabilize across two consecutive frames before
    // doing pixel-precise mouse work.
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
    // 30-min meeting at default 64px hour height ≈ 32px tall.
    expect(Math.round(beforeBox.height)).toBeGreaterThan(20)
    expect(Math.round(beforeBox.height)).toBeLessThan(45)

    // The resize handle is the bottom 5px of the block (CalendarEvent.tsx
    // ~L124-133, height: '5px', cursor-s-resize). Grab y at (height - 2)
    // — the inner 5px is the only region that fires onResizeStart.
    const handleX = beforeBox.x + beforeBox.width / 2
    const handleY = beforeBox.y + beforeBox.height - 2

    // Drag down by 64px → deltaYToMinutes(64) = +60 min.
    //
    // The resize useEffect (Calendar.tsx ~L814-911) registers the
    // document-level `mousemove` / `mouseup` handlers only AFTER React
    // commits the `setResizingEvent({...})` state change kicked off by
    // mousedown. We wait a tick after mouse.down so the effect's
    // registration has flushed before we start dispatching mousemoves
    // — otherwise the early moves are dropped and `resizeNewEndTime`
    // stays stale, leaving end_time unchanged on mouseup.
    await page.mouse.move(handleX, handleY)
    await page.mouse.down()
    await page.waitForTimeout(50)
    await page.mouse.move(handleX, handleY + 16, { steps: 3 })
    await page.mouse.move(handleX, handleY + 32, { steps: 3 })
    await page.mouse.move(handleX, handleY + 48, { steps: 3 })
    await page.mouse.move(handleX, handleY + 64, { steps: 3 })
    await page.waitForTimeout(50)
    await page.mouse.up()

    // Wait for the persisted end_time to update via Supabase round-trip.
    const admin = adminClient()
    await expect(async () => {
      const { data, error } = await admin
        .from('cassian_meetings')
        .select('end_time')
        .eq('id', seededMeetingId!)
        .single()
      if (error) throw error
      const end = new Date(data.end_time)
      expect(end.getHours()).toBe(11)
      expect(end.getMinutes()).toBe(30)
    }).toPass({ timeout: 5_000 })

    // Reload so the grid pulls the new end_time and rerenders.
    await page.reload()
    const meetingBlockAfter = page
      .locator('[data-calendar-event="true"]')
      .filter({ hasText: MEETING_TITLE })
      .first()
    await expect(meetingBlockAfter).toBeVisible()

    const afterBox = await meetingBlockAfter.boundingBox()
    if (!afterBox) throw new Error('meeting block has no bounding box (after)')
    // 90-min meeting at 64px/hour ≈ 96px tall. Allow ±5 for rendering
    // wiggle and verify that the block roughly tripled (was 30 min).
    expect(afterBox.height).toBeGreaterThan(beforeBox.height * 2.5)
    expect(afterBox.height).toBeLessThan(beforeBox.height * 3.5)
  })
})
