import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * Validates the readonly-modal flow for an existing meeting:
 *   - clicking a meeting block on the grid opens MeetingModal in
 *     `viewMode === 'readonly'` (no editable inputs)
 *   - the Pencil ([title="Edit meeting"]) headerAction switches to the
 *     edit form (title input becomes editable)
 *   - the Delete button removes the row from cassian_meetings
 *
 * Source under test:
 *   src/components/MeetingModal.tsx — readonly branch (~L455-515),
 *     headerActions Pencil (~L445-453), Delete button (~L1142-1149)
 *   src/pages/Calendar.tsx — handleEditMeeting → openMeetingModal(undefined, meeting)
 *   src/contexts/ModalContext.tsx — `editingMeeting` state on the editing path
 *   src/utils/meetingManager.ts — deleteMeeting()
 *
 * Pinned date 2026-05-12. Seed one meeting via service-role admin so
 * the spec doesn't depend on the create flow.
 */

const PINNED_DATE = '2026-05-12'
const MEETING_TITLE = `${E2E_TITLE_PREFIX} Existing meeting`

test.describe('calendar click existing meeting', () => {
  let seededMeetingId: string | null = null

  test.beforeAll(async () => {
    const admin = adminClient()
    // Pre-clean to ensure a single matching row.
    await admin
      .from('cassian_meetings')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('title', `${E2E_TITLE_PREFIX}%`)

    // Seed a single 2026-05-12 10:00–10:30 meeting.
    // Use a local-time wall-clock that round-trips through Date so we
    // can stay TZ-agnostic in the assertions.
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

  test('readonly view opens, pencil enters edit mode, delete removes the row', async ({
    page,
  }) => {
    expect(seededMeetingId).not.toBeNull()

    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-12/)

    // Wait for the seeded meeting block to render.
    const meetingBlock = page
      .locator('[data-calendar-event="true"]')
      .filter({ hasText: MEETING_TITLE })
      .first()
    await expect(meetingBlock).toBeVisible()

    // Click the block to open the readonly modal.
    await meetingBlock.click()

    // The readonly view's header is `meeting.title` (getTitle() returns
    // `meeting.title || 'Meeting'` when viewMode='readonly' && editingMeeting).
    // Look for an h2 with the seeded title.
    const modalHeader = page.locator('h2', { hasText: MEETING_TITLE }).first()
    await expect(modalHeader).toBeVisible()

    // Readonly view shows formatted date + start–end times (e.g.
    // "Tuesday, May 12, 2026" and "10:00 AM" / "10:30 AM"). Assert at
    // least the start-time slot is present, since the title-only check
    // could otherwise also match the calendar event itself.
    await expect(page.getByText('Tuesday, May 12, 2026', { exact: true })).toBeVisible()
    await expect(page.getByText('10:00 AM', { exact: true }).nth(1)).toBeVisible() // first one is the time-column row label

    // Critical: in readonly mode there should be NO editable inputs
    // (no `<input type="text">` for the title, no date / time inputs).
    // The form is only rendered after switching to viewMode='edit'.
    await expect(page.getByPlaceholder('Meeting title')).toHaveCount(0)
    await expect(page.locator('form input[type="date"]')).toHaveCount(0)

    // Click the Pencil button in headerActions to enter edit mode.
    await page.getByTitle('Edit meeting').click()

    // Edit-mode header reads "Edit Meeting" (since editingMeeting is set).
    await expect(page.getByText('Edit Meeting', { exact: true })).toBeVisible()
    // Title input is now editable, pre-filled with the seeded title.
    await expect(page.getByPlaceholder('Meeting title')).toHaveValue(MEETING_TITLE)
    // Editable date / time inputs render.
    await expect(page.locator('input[type="date"]').first()).toHaveValue(PINNED_DATE)
    await expect(page.locator('input[type="time"]').first()).toHaveValue('10:00')

    // Delete button is visible in edit mode for editingMeeting.
    const deleteBtn = page.getByRole('button', { name: 'Delete' })
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // Modal closes after delete.
    await expect(page.getByText('Edit Meeting', { exact: true })).not.toBeVisible()

    // Meeting block disappears from the grid.
    await expect(
      page.locator('[data-calendar-event="true"]').filter({ hasText: MEETING_TITLE }),
    ).toHaveCount(0)

    // DB row gone.
    const admin = adminClient()
    const { data, error } = await admin
      .from('cassian_meetings')
      .select('id')
      .eq('id', seededMeetingId!)
    if (error) throw new Error(`[verify] meeting fetch failed: ${error.message}`)
    expect(data).toHaveLength(0)
  })
})
