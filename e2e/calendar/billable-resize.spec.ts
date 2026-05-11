// [E2E:in-progress] 86b9vabhe
import { test, expect } from '../fixtures/drag'
import { adminClient, TEST_USER_ID } from '../fixtures/admin'

/**
 * PW: 86b9vabhe — Drag-to-resize a billable-hours block. Asserts:
 * end_time updates via the registry resize op, is_auto_placed flips to
 * false on a previously auto-placed block, start_time is unchanged,
 * and the rendered block's height grows.
 *
 * Source under test:
 *   src/hooks/useEventRegistry.ts — `'billable-hours'.resize` op
 *     (updateBillableHour with end_time + is_auto_placed: false)
 *   src/hooks/useBillableHours.ts — updateBillableHour local-state
 *     splice + conflict guard
 *   src/pages/Calendar.tsx — handleEventResizeStart / mousemove /
 *     mouseup (shared resize loop also used by meetings + project
 *     activity)
 *   src/components/CalendarEventSlots.tsx — onBillableHourResizeStart
 *     wiring; the bottom 5px resize handle comes from CalendarEvent.tsx
 *
 * Pinned to 2026-05-12 (Tuesday) so the seeded block lives in a
 * predictable column. The auto-placer fills the next 7 days from real
 * `now`, so we wipe its rows in beforeAll AND don't let it re-create
 * blocks on the pinned day (5/12) — the pinned day is far enough from
 * any test runtime that the placer's 7-day window won't cover it.
 *
 * NOTE: this date is in the past relative to typical real wall-clock
 * runs. That's deliberate — it keeps the spec deterministic against
 * the auto-placer (which only fills today + 6 future days). The
 * resize itself doesn't care whether the block is past or future.
 */

const PINNED_DATE = '2026-05-12'
const SEED_NOTE = '[E2E] resize seed'

test.describe('billable-hours drag-to-resize', () => {
  let seededId: string | null = null

  test.beforeAll(async () => {
    const admin = adminClient()
    // Wipe billable_hours for the test user so only our seeded row
    // exists on the pinned day (and the placer won't fight us — its
    // window is rooted at real `now`, not the pinned URL date).
    await admin.from('cassian_billable_hours').delete().eq('user_id', TEST_USER_ID)

    // Seed an auto-placed 14:00–15:00 block on 2026-05-12.
    const start = new Date(2026, 4, 12, 14, 0).toISOString()
    const end = new Date(2026, 4, 12, 15, 0).toISOString()
    const { data, error } = await admin
      .from('cassian_billable_hours')
      .insert({
        user_id: TEST_USER_ID,
        start_time: start,
        end_time: end,
        rate: 100,
        note: SEED_NOTE,
        is_auto_placed: true,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(`[beforeAll] seed failed: ${error?.message}`)
    seededId = data.id
  })

  test.afterAll(async () => {
    const admin = adminClient()
    await admin.from('cassian_billable_hours').delete().eq('user_id', TEST_USER_ID)
  })

  test('drag bottom edge down 64px → end_time +60min, is_auto_placed flips false, block roughly doubles in height', async ({
    page,
  }) => {
    expect(seededId).not.toBeNull()

    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-12/)

    // Locate by emerald background (CalendarEvent.tsx
    // typeClasses['billable-hours'] = 'bg-emerald-100 ...'). Title is
    // just "Billable" for every block; with only one block seeded for
    // the test user, .first() is safe.
    const block = page.locator('[data-calendar-event="true"].bg-emerald-100').first()
    await expect(block).toBeVisible()
    await block.scrollIntoViewIfNeeded()

    // Wait for the post-load auto-scroll to settle so the captured
    // boundingBox doesn't go stale during the drag (same gotcha as
    // meeting-resize.spec.ts).
    await expect(async () => {
      const a = await block.boundingBox()
      await page.waitForTimeout(60)
      const b = await block.boundingBox()
      if (!a || !b) throw new Error('no box yet')
      expect(Math.abs(a.y - b.y)).toBeLessThan(0.5)
    }).toPass({ timeout: 3_000 })

    const beforeBox = await block.boundingBox()
    if (!beforeBox) throw new Error('block has no bounding box (before)')
    // 60-min block at default 64px/hour ≈ 64px tall (minus the 2px
    // separation in getEventStyle).
    expect(Math.round(beforeBox.height)).toBeGreaterThan(50)
    expect(Math.round(beforeBox.height)).toBeLessThan(80)

    const handleX = beforeBox.x + beforeBox.width / 2
    const handleY = beforeBox.y + beforeBox.height - 2

    // Drag down by 64px → +60 min via deltaYToMinutes (15-min snap).
    // Step the move so document-level mousemove handlers (registered
    // after the setResizingEvent commit) catch up before mouseup.
    await page.mouse.move(handleX, handleY)
    await page.mouse.down()
    await page.waitForTimeout(50)
    await page.mouse.move(handleX, handleY + 16, { steps: 3 })
    await page.mouse.move(handleX, handleY + 32, { steps: 3 })
    await page.mouse.move(handleX, handleY + 48, { steps: 3 })
    await page.mouse.move(handleX, handleY + 64, { steps: 3 })
    await page.waitForTimeout(50)
    await page.mouse.up()

    // Wait for the persisted end_time + is_auto_placed flip.
    const admin = adminClient()
    await expect(async () => {
      const { data, error } = await admin
        .from('cassian_billable_hours')
        .select('start_time, end_time, is_auto_placed')
        .eq('id', seededId!)
        .single()
      if (error) throw error
      // start_time unchanged.
      const start = new Date(data.start_time)
      expect(start.getHours()).toBe(14)
      expect(start.getMinutes()).toBe(0)
      // end_time advanced by 60 min: 15:00 → 16:00.
      const end = new Date(data.end_time)
      expect(end.getHours()).toBe(16)
      expect(end.getMinutes()).toBe(0)
      // Manual edit override flipped.
      expect(data.is_auto_placed).toBe(false)
    }).toPass({ timeout: 5_000 })

    // Reload so the grid pulls the new end_time and re-renders the
    // block at the new height.
    await page.reload()
    const blockAfter = page.locator('[data-calendar-event="true"].bg-emerald-100').first()
    await expect(blockAfter).toBeVisible()
    await blockAfter.scrollIntoViewIfNeeded()
    const afterBox = await blockAfter.boundingBox()
    if (!afterBox) throw new Error('block has no bounding box (after)')
    // 120-min block at 64px/hour ≈ 128px tall. Was 60 min ≈ 64px.
    // Verify roughly doubled with slack for rendering wiggle.
    expect(afterBox.height).toBeGreaterThan(beforeBox.height * 1.7)
    expect(afterBox.height).toBeLessThan(beforeBox.height * 2.3)
  })
})
