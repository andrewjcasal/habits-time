// [E2E:in-progress] 86b9v95yw
import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * PW: 86b9v95yw — Toggling a habit's completion writes a row to
 * cassian_habits_daily_logs with is_completed=true and the actual_*
 * timestamps set to ~now. Toggling again flips is_completed=false (the
 * upsert path in useHabits.ts.logHabitCompletion keeps the row, just
 * sets is_completed=false and clears actual_start/end_time).
 *
 * Source under test:
 *   src/pages/Habits.tsx — toggleCompletion (sends now's HH:MM to both
 *     actual_start_time and actual_end_time)
 *   src/hooks/useHabits.ts — logHabitCompletion (UPSERTs on
 *     habit_id+user_id+log_date+scheduled_start_time)
 *   src/components/HabitsList.tsx — toggle button + the bg-green-50/80
 *     class flip + Circle <-> CheckCircle2 swap
 */

const HABIT_NAME = `${E2E_TITLE_PREFIX} Toggle Test`

test.describe('habits page toggle completion', () => {
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
      throw new Error(
        `[beforeAll] No fixed_time habit type found: ${typeErr?.message}`,
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

    const { data: insertedHabit, error: insertErr } = await admin
      .from('cassian_habits')
      .insert({
        user_id: TEST_USER_ID,
        name: HABIT_NAME,
        default_start_time: '09:00',
        current_start_time: '09:00',
        duration: 10,
        habit_type_id: fixedTypeId,
        is_visible: true,
        is_archived: false,
      })
      .select('id')
      .single()
    if (insertErr || !insertedHabit) {
      throw new Error(`[beforeAll] insert habit: ${insertErr?.message}`)
    }
    habitId = insertedHabit.id
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

  test('toggle on writes is_completed=true + actual_* times; toggle off flips back', async ({
    page,
  }) => {
    const admin = adminClient()
    const today = new Date().toISOString().split('T')[0]

    await page.goto('/habits')

    // Locate the seeded row (rounded-lg container with the h3 name).
    const habitRow = page
      .locator('div.rounded-lg', {
        has: page.locator('h3', { hasText: HABIT_NAME }),
      })
      .first()
    await expect(habitRow).toBeVisible()

    // First button in the row container is the toggle. Its icon swaps
    // between Circle (lucide-circle) when uncompleted and CheckCircle2
    // (lucide-check-circle2) when completed — those classes are baked
    // in by createLucideIcon. Note: the kebab-case helper splits on
    // letter→capital boundaries only, so the digit `2` in `CheckCircle2`
    // does NOT get a leading hyphen — the real class is `circle2`,
    // not `circle-2`. The row-level bg colour can't be used as the
    // completion signal because `isSelected` (auto-select via
    // getNextHabit) overrides the completed bg with `bg-amber-200`.
    const toggleBtn = habitRow.locator('button').first()
    await expect(toggleBtn).toBeVisible()
    await expect(toggleBtn.locator('svg.lucide-circle')).toBeVisible()

    // Capture the time at click — actual_start_time should land within
    // a small window around it (the page reads `new Date()` inline).
    const before = new Date()
    await toggleBtn.click()

    // After completion the icon swaps to CheckCircle2.
    await expect(toggleBtn.locator('svg.lucide-check-circle2')).toBeVisible()

    // The DB row exists and is_completed=true. Wait for the upsert to
    // settle — the toggleCompletion handler is fire-and-forget from the
    // UI's perspective, so we poll briefly.
    const waitForLog = async (predicate: (log: any) => boolean): Promise<any> => {
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        const { data } = await admin
          .from('cassian_habits_daily_logs')
          .select('*')
          .eq('habit_id', habitId)
          .eq('user_id', TEST_USER_ID)
          .eq('log_date', today)
          .limit(1)
          .maybeSingle()
        if (data && predicate(data)) return data
        await new Promise(r => setTimeout(r, 100))
      }
      throw new Error('timed out waiting for daily log row')
    }

    const completedLog = await waitForLog(l => l.is_completed === true)
    expect(completedLog.is_completed).toBe(true)
    expect(completedLog.actual_start_time).toBeTruthy()
    expect(completedLog.actual_end_time).toBeTruthy()

    // Times come from `now.toTimeString().slice(0, 5)` → "HH:MM" — the
    // DB stores them as TIME so they may round-trip as "HH:MM:00".
    const beforeMin = before.getHours() * 60 + before.getMinutes()
    const [h, m] = completedLog.actual_start_time.split(':').map(Number)
    const loggedMin = h * 60 + m
    // Allow a 2-minute drift window between the "before" snapshot and
    // the click landing (network latency + clock granularity).
    expect(Math.abs(loggedMin - beforeMin)).toBeLessThanOrEqual(2)

    // Click again to toggle off.
    await toggleBtn.click()

    // Icon swaps back to the empty Circle.
    await expect(toggleBtn.locator('svg.lucide-circle')).toBeVisible()

    // logHabitCompletion(false, undefined, undefined) UPSERTs with
    // actual_start_time/actual_end_time omitted from the payload —
    // supabase-js strips `undefined` keys before serializing, so the
    // ON CONFLICT DO UPDATE clause does NOT touch those columns and
    // their previous values persist. Only is_completed flips.
    const reverted = await waitForLog(l => l.is_completed === false)
    expect(reverted.is_completed).toBe(false)
  })
})
