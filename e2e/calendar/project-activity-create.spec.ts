import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * Validates project-activity creation through the MeetingModal:
 *   - opening MeetingModal at an empty 11 AM slot
 *   - clicking the "+ Project activity" link (only visible when at
 *     least one project exists)
 *   - selecting the seeded project, submitting Save
 *   - row inserted in cassian_project_activity
 *   - block renders on the grid with the project's hex color
 *
 * Source under test:
 *   src/components/MeetingModal.tsx — handleSubmitProjectActivity (~L403),
 *     viewMode='project-activity' branch (~L517-584),
 *     "+ Project activity" link (~L794-806)
 *   src/contexts/ModalContext.tsx — handleSaveProjectActivity (~L345)
 *   src/pages/Calendar.tsx — saveProjectActivity → addProjectActivity
 *   src/hooks/useCalendarData.ts — addProjectActivity insert (~L526-536)
 *   src/components/CalendarEventSlots.tsx — project-activity render (~L274-328)
 *
 * Schema (sql/migrations/20260430000000_create_cassian_project_activity.sql):
 *   id, user_id (FK auth.users ON DELETE CASCADE),
 *   project_id (FK cassian_projects ON DELETE CASCADE),
 *   start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, note TEXT,
 *   CHECK (end_time > start_time)
 */

const PINNED_DATE = '2026-05-12'
const PROJECT_NAME = `${E2E_TITLE_PREFIX} Test Project`
const PROJECT_COLOR = '#ff0000'

test.describe('calendar project-activity creation via MeetingModal', () => {
  let seededProjectId: string | null = null

  test.beforeAll(async () => {
    const admin = adminClient()
    // Wipe any prior namespaced rows to keep state deterministic.
    await admin
      .from('cassian_project_activity')
      .delete()
      .eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_projects')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('name', `${E2E_TITLE_PREFIX}%`)
    await admin
      .from('cassian_meetings')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('title', `${E2E_TITLE_PREFIX}%`)

    // Seed a single project so the "+ Project activity" link renders.
    const { data, error } = await admin
      .from('cassian_projects')
      .insert({
        user_id: TEST_USER_ID,
        name: PROJECT_NAME,
        color: PROJECT_COLOR,
        status: 'active',
      })
      .select('id')
      .single()
    if (error) throw new Error(`[beforeAll] project seed failed: ${error.message}`)
    seededProjectId = data.id
  })

  test.afterAll(async () => {
    const admin = adminClient()
    // FK cascade deletes activity when project is deleted, but be
    // explicit so the activity rows go away even if the seed didn't
    // reach the project insert.
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

  test('click empty 11 AM slot → "+ Project activity" → save inserts row + renders red block', async ({
    page,
  }) => {
    expect(seededProjectId).not.toBeNull()

    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-12/)

    await expect(
      page.getByText('11:00 AM', { exact: true }).first(),
    ).toBeVisible()

    const elevenAmRow = page
      .locator('div.grid.border-b')
      .filter({ hasText: '11:00 AM' })
      .first()
    await expect(elevenAmRow).toBeVisible()
    const firstDayCell = elevenAmRow.locator('> div').nth(1)
    await expect(firstDayCell).toBeVisible()

    // Click upper area of the 11 AM cell (x=24 clears the add-note hover
    // zone on the left edge — see CalendarGrid.tsx ~L185-208).
    await firstDayCell.click({ position: { x: 24, y: 5 } })

    // Modal opened with the meeting form (no recent meetings → full form).
    await expect(page.getByText('Add Meeting', { exact: true })).toBeVisible()

    // The "+ Project activity" affordance only renders when projects.length > 0.
    const projectActivityLink = page.getByRole('button', { name: '+ Project activity' })
    await expect(projectActivityLink).toBeVisible()
    await projectActivityLink.click()

    // viewMode → 'project-activity'. Header reads "Track Project Time".
    await expect(page.getByText('Track Project Time', { exact: true })).toBeVisible()

    // Pre-fill: date is 2026-05-12, start_time 11:00. The activity form
    // also renders an end-time input (default 11:15 — the modal opened
    // from a click which built a 15-min default range).
    await expect(page.locator('input[type="date"]').first()).toHaveValue(PINNED_DATE)
    await expect(page.locator('input[type="time"]').first()).toHaveValue('11:00')

    // Pick the seeded project from the project select.
    await page.locator('select').first().selectOption(seededProjectId!)

    // Save.
    await page.getByRole('button', { name: 'Save' }).click()

    // Modal closes.
    await expect(page.getByText('Track Project Time', { exact: true })).not.toBeVisible()

    // Activity block renders on the May 12 column. CalendarEventSlots
    // sets the eventTitle to the project name.
    const activityBlock = page
      .locator('[data-calendar-event="true"]')
      .filter({ hasText: PROJECT_NAME })
      .first()
    await expect(activityBlock).toBeVisible()

    // Inline backgroundColor matches the seeded project color.
    const inlineBg = await activityBlock.evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    )
    expect(inlineBg).toBe('rgb(255, 0, 0)')

    // Verify cassian_project_activity row.
    const admin = adminClient()
    const { data, error } = await admin
      .from('cassian_project_activity')
      .select('id,user_id,project_id,start_time,end_time')
      .eq('user_id', TEST_USER_ID)
      .eq('project_id', seededProjectId!)
    if (error) throw new Error(`[verify] activity fetch failed: ${error.message}`)
    expect(data).toHaveLength(1)
    const row = data![0]
    expect(row.user_id).toBe(TEST_USER_ID)
    expect(row.project_id).toBe(seededProjectId)

    const start = new Date(row.start_time)
    const end = new Date(row.end_time)
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(4)
    expect(start.getDate()).toBe(12)
    expect(start.getHours()).toBe(11)
    expect(start.getMinutes()).toBe(0)
    // CHECK constraint requires end > start; default range is 15 min.
    expect(end.getTime() - start.getTime()).toBeGreaterThan(0)
    expect(end.getHours()).toBe(11)
    expect(end.getMinutes()).toBe(15)
  })
})
