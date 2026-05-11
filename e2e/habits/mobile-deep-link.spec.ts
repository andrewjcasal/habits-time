// [E2E:in-progress] 86b9v9670
import { test as base, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * PW: 86b9v9670 — On mobile, clicking a habit row navigates to
 * /habits/:habitId (the HabitDetail page). The mobile-vs-desktop
 * detection is `window.innerWidth < 768`, read inside handleHabitSelect
 * at click time, so the viewport must be set BEFORE navigation.
 *
 * Also covers BUG: 86b9va0xv — the back-arrow button on the deep-link
 * detail page. HabitDetailTabs renders an ArrowLeft button + habit-name
 * header strip when `showBackButton` is true (which HabitDetail.tsx
 * sets); tapping it calls `onBackClick` to return to /habits.
 *
 * Source under test:
 *   src/pages/Habits.tsx — handleHabitSelect's mobile branch
 *     (`navigate('/habits/<id>')`)
 *   src/pages/HabitDetail.tsx — renders HabitDetailTabs with
 *     showBackButton + onBackClick
 *   src/components/HabitDetailTabs.tsx — back-arrow strip (gated by
 *     showBackButton) + Settings tab as default
 */

const HABIT_NAME = `${E2E_TITLE_PREFIX} Morning Stretch`

// Override the default desktop viewport with a mobile one. innerWidth
// must be < 768 on the very first render so handleHabitSelect's mobile
// branch fires.
const test = base.extend({})
test.use({ viewport: { width: 375, height: 667 } })

test.describe('habits page — mobile deep link', () => {
  let fixedTypeId: string
  let habitId: string

  test.beforeAll(async () => {
    const admin = adminClient()

    const { data: fixedType, error: typeErr } = await admin
      .from('cassian_habits_types')
      .select('id')
      .eq('scheduling_rule', 'fixed_time')
      .limit(1)
      .single()
    if (typeErr || !fixedType) {
      throw new Error(`[beforeAll] no fixed_time habit type: ${typeErr?.message}`)
    }
    fixedTypeId = fixedType.id

    await admin
      .from('cassian_habits_daily_logs')
      .delete()
      .eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_habits')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('name', `${E2E_TITLE_PREFIX}%`)

    const { data: inserted, error: insertErr } = await admin
      .from('cassian_habits')
      .insert({
        user_id: TEST_USER_ID,
        name: HABIT_NAME,
        default_start_time: '08:00',
        current_start_time: '08:00',
        duration: 5,
        habit_type_id: fixedTypeId,
        is_visible: true,
        is_archived: false,
      })
      .select('id')
      .single()
    if (insertErr || !inserted) {
      throw new Error(`[beforeAll] insert habit: ${insertErr?.message}`)
    }
    habitId = inserted.id
  })

  test.afterAll(async () => {
    const admin = adminClient()
    await admin
      .from('cassian_habits_daily_logs')
      .delete()
      .eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_habits')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('name', `${E2E_TITLE_PREFIX}%`)
  })

  test('clicking a habit row on mobile navigates to /habits/:habitId and renders the detail page', async ({
    page,
  }) => {
    await page.goto('/habits')

    // The habit row must be present in the mobile list.
    const habitRow = page
      .locator('div.rounded-lg', {
        has: page.locator('h3', { hasText: HABIT_NAME }),
      })
      .first()
    await expect(habitRow).toBeVisible()

    await habitRow.click()

    // URL changes to /habits/:habitId.
    await expect(page).toHaveURL(new RegExp(`/habits/${habitId}`))

    // HabitDetail page renders. The settings tab is initially active —
    // its tab button reads "Settings" and the bg-white border-blue-500
    // styling is on the active tab.
    const settingsTab = page.getByRole('button', { name: 'Settings' })
    await expect(settingsTab).toBeVisible()
    await expect(settingsTab).toHaveClass(/border-blue-500/)

    // The settings panel exposes the habit name in its name input —
    // confirms the habit data loaded into the detail view.
    const nameInput = page.locator('input[type="text"]').first()
    await expect(nameInput).toHaveValue(HABIT_NAME)

    // Back arrow renders only on the deep-link path (gated by
    // showBackButton, which HabitDetail.tsx passes). The button has
    // aria-label="Back to habits".
    const backBtn = page.getByRole('button', { name: 'Back to habits' })
    await expect(backBtn).toBeVisible()

    // Tapping back returns to /habits with the seeded row visible.
    await backBtn.click()
    await expect(page).toHaveURL(/\/habits$/)
    await expect(habitRow).toBeVisible()
  })
})
