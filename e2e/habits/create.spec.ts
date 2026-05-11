// [E2E:in-progress] 86b9v961u
import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * PW: 86b9v961u — Create a new habit via CreateHabitModal. Verifies the
 * resulting cassian_habits row plus that the new habit shows up in the
 * /habits list immediately (createHabit() refetches).
 *
 * Source under test:
 *   src/components/HabitsMainContent.tsx — the "+ Add new habit" button
 *     (title="Add new habit") and the CreateHabitModal mount
 *   src/components/CreateHabitModal.tsx — name/time/duration inputs +
 *     weekday chips (3-letter labels Mon/Tue/Wed/...)
 *   src/hooks/useHabits.ts — createHabit (uses fixed_time habit_type_id;
 *     refetches after insert)
 *
 * Note: the /habits list does NOT filter by weekly_days — that filter
 * only applies to the calendar grid. So the new habit appears in the
 * list regardless of today's weekday.
 */

const HABIT_NAME = `${E2E_TITLE_PREFIX} Evening Walk`
const SELECTED_DAYS = ['monday', 'wednesday', 'friday']
// CreateHabitModal renders chip labels via `day.slice(0, 3)` on the
// lowercase WEEKDAYS array — so the visible chip text is "mon", not "Mon".
const DAY_LABELS = ['mon', 'wed', 'fri']

test.describe('habits page — create habit', () => {
  test.beforeAll(async () => {
    const admin = adminClient()

    // Sanity: the fixed_time habit type must exist or createHabit silently
    // no-ops (the modal disables Submit when fixedType is missing).
    const { data: fixedType } = await admin
      .from('cassian_habits_types')
      .select('id')
      .eq('scheduling_rule', 'fixed_time')
      .limit(1)
      .single()
    if (!fixedType) {
      throw new Error('[beforeAll] no fixed_time habit type seeded in cassian_habits_types')
    }

    // Wipe any leftover [E2E] habits from prior runs.
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

  test('plus button → modal → fill → submit creates a habit row + lists it', async ({ page }) => {
    const admin = adminClient()

    await page.goto('/habits')

    // Open the create modal via the "+ Add new habit" button (title attr).
    await page.getByTitle('Add new habit').click()

    // ModalWrapper has no role="dialog"; identify the modal by its title
    // heading "New Habit" and climb to the modal panel container (the
    // ancestor div with the bg-white rounded-lg card chrome).
    const modalHeading = page.getByRole('heading', { name: 'New Habit' })
    await expect(modalHeading).toBeVisible()
    const modal = modalHeading.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " bg-white ")][1]'
    )

    // Name input (placeholder="Habit name").
    await modal.getByPlaceholder('Habit name').fill(HABIT_NAME)

    // Time + duration inputs. The modal puts them side-by-side; the time
    // input is the first <input type="time"> and duration is the
    // numeric input (placeholder="Duration (min)").
    await modal.locator('input[type="time"]').fill('18:30')
    const durationInput = modal.getByPlaceholder('Duration (min)')
    await durationInput.fill('30')

    // Weekday chips: 3-letter labels rendered from full names. Click
    // mon/wed/fri.
    for (const label of DAY_LABELS) {
      await modal.getByRole('button', { name: label, exact: true }).click()
    }

    // Submit.
    await modal.getByRole('button', { name: 'Create' }).click()

    // Modal closes — the heading goes away.
    await expect(modalHeading).toBeHidden()

    // Habit row appears in the list.
    const habitRow = page
      .locator('div.rounded-lg', {
        has: page.locator('h3', { hasText: HABIT_NAME }),
      })
      .first()
    await expect(habitRow).toBeVisible()
    await expect(habitRow.getByText('30m', { exact: true })).toBeVisible()

    // Verify the DB row matches.
    const { data: dbHabit, error } = await admin
      .from('cassian_habits')
      .select('id, name, default_start_time, current_start_time, duration, weekly_days, is_visible, is_archived, habit_type_id')
      .eq('user_id', TEST_USER_ID)
      .eq('name', HABIT_NAME)
      .single()
    if (error || !dbHabit) {
      throw new Error(`[assert] no DB row for ${HABIT_NAME}: ${error?.message}`)
    }
    // default_start_time may serialize as "18:30:00" or "18:30" — accept
    // either by normalizing to HH:MM.
    expect(dbHabit.default_start_time?.slice(0, 5)).toBe('18:30')
    expect(dbHabit.current_start_time?.slice(0, 5)).toBe('18:30')
    expect(dbHabit.duration).toBe(30)
    expect(dbHabit.is_visible).toBe(true)
    expect(dbHabit.is_archived === false || dbHabit.is_archived == null).toBe(true)
    expect(dbHabit.habit_type_id).toBeTruthy()
    // weekly_days order is insertion order from the chip clicks; sort
    // both sides for comparison.
    expect((dbHabit.weekly_days || []).slice().sort()).toEqual(SELECTED_DAYS.slice().sort())
  })
})
