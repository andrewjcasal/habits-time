import { test, expect } from '../fixtures/drag'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * Validates project-activity drag-to-resize: dragging the bottom edge
 * of an activity block down 64px snaps end_time forward by 60 minutes
 * and persists via the registry.
 *
 * Source under test:
 *   src/hooks/useEventRegistry.ts — `project-activity.resize` op
 *     (calls updateProjectActivity({end_time}))
 *   src/pages/Calendar.tsx — handleProjectActivityResizeStart, the
 *     shared resize useEffect (~L791-911)
 *   src/utils/calendarDragUtils.ts — deltaYToMinutes (64px = 60 min)
 *   src/components/CalendarEventSlots.tsx — onProjectActivityResizeStart wiring
 */

const PINNED_DATE = '2026-05-12'
const PROJECT_NAME = `${E2E_TITLE_PREFIX} Resize Project`

test.describe('calendar project-activity drag-to-resize', () => {
  let seededProjectId: string | null = null
  let seededActivityId: string | null = null

  test.beforeAll(async () => {
    const admin = adminClient()
    await admin
      .from('cassian_project_activity')
      .delete()
      .eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_projects')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('name', `${E2E_TITLE_PREFIX}%`)

    const { data: project, error: projectError } = await admin
      .from('cassian_projects')
      .insert({
        user_id: TEST_USER_ID,
        name: PROJECT_NAME,
        color: '#1e40af',
        status: 'active',
      })
      .select('id')
      .single()
    if (projectError) throw new Error(`[beforeAll] project seed failed: ${projectError.message}`)
    seededProjectId = project.id

    const start = new Date(2026, 4, 12, 11, 0).toISOString()
    const end = new Date(2026, 4, 12, 11, 30).toISOString()
    const { data: activity, error: activityError } = await admin
      .from('cassian_project_activity')
      .insert({
        user_id: TEST_USER_ID,
        project_id: seededProjectId,
        start_time: start,
        end_time: end,
      })
      .select('id')
      .single()
    if (activityError) throw new Error(`[beforeAll] activity seed failed: ${activityError.message}`)
    seededActivityId = activity.id
  })

  test.afterAll(async () => {
    const admin = adminClient()
    // FK ON DELETE CASCADE removes activity rows when project deletes,
    // but be explicit so cleanup tolerates partial seed failures.
    await admin
      .from('cassian_project_activity')
      .delete()
      .eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_projects')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('name', `${E2E_TITLE_PREFIX}%`)
  })

  test('drag bottom edge down 64px → activity end_time +60 min', async ({ page }) => {
    expect(seededActivityId).not.toBeNull()

    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-12/)

    const activityBlock = page
      .locator('[data-calendar-event="true"]')
      .filter({ hasText: PROJECT_NAME })
      .first()
    await expect(activityBlock).toBeVisible()

    // Wait for grid auto-scroll to settle so cached coords stay valid.
    await activityBlock.scrollIntoViewIfNeeded()
    await expect(async () => {
      const a = await activityBlock.boundingBox()
      await page.waitForTimeout(60)
      const b = await activityBlock.boundingBox()
      if (!a || !b) throw new Error('no box yet')
      expect(Math.abs(a.y - b.y)).toBeLessThan(0.5)
    }).toPass({ timeout: 3_000 })

    const beforeBox = await activityBlock.boundingBox()
    if (!beforeBox) throw new Error('activity block has no bounding box (before)')
    expect(Math.round(beforeBox.height)).toBeGreaterThan(20)
    expect(Math.round(beforeBox.height)).toBeLessThan(45)

    // Drag the bottom 5px resize handle (CalendarEvent.tsx ~L124-133).
    const handleX = beforeBox.x + beforeBox.width / 2
    const handleY = beforeBox.y + beforeBox.height - 2

    await page.mouse.move(handleX, handleY)
    await page.mouse.down()
    // Wait so the resize useEffect can register doc-level mousemove
    // listeners after setResizingEvent flushes through React.
    await page.waitForTimeout(50)
    await page.mouse.move(handleX, handleY + 16, { steps: 3 })
    await page.mouse.move(handleX, handleY + 32, { steps: 3 })
    await page.mouse.move(handleX, handleY + 48, { steps: 3 })
    await page.mouse.move(handleX, handleY + 64, { steps: 3 })
    await page.waitForTimeout(50)
    await page.mouse.up()

    const admin = adminClient()
    await expect(async () => {
      const { data, error } = await admin
        .from('cassian_project_activity')
        .select('end_time')
        .eq('id', seededActivityId!)
        .single()
      if (error) throw error
      const end = new Date(data.end_time)
      expect(end.getHours()).toBe(12)
      expect(end.getMinutes()).toBe(30)
    }).toPass({ timeout: 5_000 })
  })
})
