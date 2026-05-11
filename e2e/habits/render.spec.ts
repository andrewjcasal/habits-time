// [E2E:in-progress] 86b9v95vv
import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * PW: 86b9v95vv — /habits renders the seeded habits in the daily list.
 *
 * Source under test:
 *   src/pages/Habits.tsx — date header + selectedDate state
 *   src/components/HabitsMainContent.tsx — list header (date label + + Plus + Archive icon)
 *   src/components/HabitsList.tsx — per-row UI: name, duration, toggle (Circle button)
 *   src/hooks/useHabits.ts — fetch (filters is_visible=true, is_archived=false)
 *
 * NOTE: The brief mentions a "Today: HH:MM" / "Next: HH:MM" string per row.
 * That label is computed (`getHabitScheduleDisplay`) and threaded through
 * props but the current `HabitsList.tsx` no longer renders it. We assert
 * what is actually rendered: name, duration, and the toggle button.
 */

const HABIT_A = `${E2E_TITLE_PREFIX} Morning Stretch`
const HABIT_B = `${E2E_TITLE_PREFIX} Daily Review`

test.describe('habits page render', () => {
  let fixedTypeId: string

  test.beforeAll(async () => {
    const admin = adminClient()

    // Look up the fixed_time habit type. Cleanup-resilient: the row is
    // shared across all users (no user_id filter on cassian_habits_types).
    const { data: fixedType, error: typeErr } = await admin
      .from('cassian_habits_types')
      .select('id')
      .eq('scheduling_rule', 'fixed_time')
      .limit(1)
      .single()
    if (typeErr || !fixedType) {
      throw new Error(
        `[beforeAll] No fixed_time habit type found in cassian_habits_types: ${typeErr?.message}`,
      )
    }
    fixedTypeId = fixedType.id

    // Wipe any leftover [E2E] habits + their logs so the run is repeatable.
    await admin
      .from('cassian_habits_daily_logs')
      .delete()
      .eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_habits')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('name', `${E2E_TITLE_PREFIX}%`)

    const today = new Date().toISOString().split('T')[0]

    const { error: insertErr } = await admin.from('cassian_habits').insert([
      {
        user_id: TEST_USER_ID,
        name: HABIT_A,
        default_start_time: '07:00',
        current_start_time: '07:30',
        duration: 15,
        habit_type_id: fixedTypeId,
        is_visible: true,
        is_archived: false,
      },
      {
        user_id: TEST_USER_ID,
        name: HABIT_B,
        default_start_time: '21:00',
        current_start_time: '21:00',
        duration: 20,
        habit_type_id: fixedTypeId,
        is_visible: true,
        is_archived: false,
      },
    ])
    if (insertErr) throw new Error(`[beforeAll] insert habits: ${insertErr.message}`)

    // Belt-and-braces: ensure no completion logs for these habits today.
    await admin
      .from('cassian_habits_daily_logs')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .eq('log_date', today)
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

  test('renders today header + both seeded habits with toggles', async ({ page }) => {
    await page.goto('/habits')

    // Date header reads "Today" (assumes the user runs the suite in the
    // same date as `new Date()` resolved client-side; the page sets
    // selectedDate from `new Date().toISOString().split('T')[0]`).
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

    // Both seeded habit rows are present, by name.
    const habitARow = page.locator('h3', { hasText: HABIT_A }).first()
    const habitBRow = page.locator('h3', { hasText: HABIT_B }).first()
    await expect(habitARow).toBeVisible()
    await expect(habitBRow).toBeVisible()

    // Each row shows duration. Habit A = 15m, Habit B = 20m.
    // Find the row container (closest .rounded-lg ancestor) and assert the
    // duration text appears within it.
    const habitARowBox = page
      .locator('div.rounded-lg', { has: page.locator('h3', { hasText: HABIT_A }) })
      .first()
    const habitBRowBox = page
      .locator('div.rounded-lg', { has: page.locator('h3', { hasText: HABIT_B }) })
      .first()
    await expect(habitARowBox.getByText('15m', { exact: true })).toBeVisible()
    await expect(habitBRowBox.getByText('20m', { exact: true })).toBeVisible()

    // Each row has a toggle button (the un-completed Circle icon button).
    // Match by the button preceding the <h3 className="font-medium ...">.
    // We rely on the row container scope to keep the count stable.
    const habitAToggle = habitARowBox.locator('button').first()
    const habitBToggle = habitBRowBox.locator('button').first()
    await expect(habitAToggle).toBeVisible()
    await expect(habitBToggle).toBeVisible()

    // Sanity: order. useHabits orders by current_start_time asc, so
    // Habit A (07:30) should render before Habit B (21:00).
    const aBox = await habitARowBox.boundingBox()
    const bBox = await habitBRowBox.boundingBox()
    if (!aBox || !bBox) throw new Error('row bounding boxes missing')
    expect(aBox.y).toBeLessThan(bBox.y)
  })
})
