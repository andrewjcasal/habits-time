// [E2E:in-progress] 86b9v965a
import { test, expect } from '../fixtures/auth'
import { adminClient, E2E_TITLE_PREFIX, TEST_USER_ID } from '../fixtures/admin'

/**
 * PW: 86b9v965a — Archive a habit from the detail panel; verify it
 * disappears from the main list reactively (no reload), shows up in
 * the archived list (toggled via the Archive icon button in the list
 * header), and that unarchiving from there restores it back to the
 * main list reactively.
 *
 * Also covers BUG: 86b9va2fg. Earlier the detail panel and the parent
 * Habits page each owned an independent useHabits() instance, so a
 * mutation in the panel did not refresh the parent's list. The fix
 * threads the parent's mutators (archiveHabit / unarchiveHabit /
 * deleteHabit) DOWN through Habits.tsx → HabitsMainContent →
 * HabitDetailTabs as optional override props (`archiveHabitOverride`
 * etc.). When the desktop sidebar mounts, the panel calls the parent's
 * mutators, which update the parent's local state in-place — no
 * refetch. unarchiveHabit was also rewritten to splice the row into
 * local state (it now takes a HabitWithType instead of an id) so the
 * non-archive-including parent state can absorb the unarchived row.
 *
 * Source under test:
 *   src/pages/Habits.tsx — destructures archive/unarchive/delete from
 *     useHabits and passes them down to HabitsMainContent
 *   src/components/HabitsMainContent.tsx — Archive icon toggle (title
 *     "View archived habits" / "Back to habits"), threads parent
 *     mutators into HabitDetailTabs as override props
 *   src/components/HabitDetailTabs.tsx — "Archive Habit" / "Unarchive
 *     Habit" buttons in the settings tab; uses override mutators when
 *     supplied so the parent's hook state mutates in place
 *   src/hooks/useHabits.ts — archiveHabit / unarchiveHabit /
 *     deleteHabit (all local-state-only, no refetch)
 *
 * Desktop layout assumed (Playwright Chromium default 1280x720 ≥ lg).
 */

const HABIT_TARGET = `${E2E_TITLE_PREFIX} Morning Coffee`
const HABIT_KEEP = `${E2E_TITLE_PREFIX} Anchor Habit`

test.describe('habits page — archive / unarchive', () => {
  let fixedTypeId: string

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

    // Wipe any leftover [E2E] habits.
    await admin
      .from('cassian_habits_daily_logs')
      .delete()
      .eq('user_id', TEST_USER_ID)
    await admin
      .from('cassian_habits')
      .delete()
      .eq('user_id', TEST_USER_ID)
      .like('name', `${E2E_TITLE_PREFIX}%`)

    // Two habits so the main list isn't empty after archive.
    const { error: insertErr } = await admin.from('cassian_habits').insert([
      {
        user_id: TEST_USER_ID,
        name: HABIT_TARGET,
        default_start_time: '07:00',
        current_start_time: '07:00',
        duration: 10,
        habit_type_id: fixedTypeId,
        is_visible: true,
        is_archived: false,
      },
      {
        user_id: TEST_USER_ID,
        name: HABIT_KEEP,
        default_start_time: '20:00',
        current_start_time: '20:00',
        duration: 10,
        habit_type_id: fixedTypeId,
        is_visible: true,
        is_archived: false,
      },
    ])
    if (insertErr) throw new Error(`[beforeAll] insert habits: ${insertErr.message}`)
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

  test('archive hides habit from main list and surfaces it in archived list; unarchive restores it', async ({
    page,
  }) => {
    const admin = adminClient()

    await page.goto('/habits')

    // Both habits visible initially.
    const targetRow = page
      .locator('div.rounded-lg', {
        has: page.locator('h3', { hasText: HABIT_TARGET }),
      })
      .first()
    const keepRow = page
      .locator('div.rounded-lg', {
        has: page.locator('h3', { hasText: HABIT_KEEP }),
      })
      .first()
    await expect(targetRow).toBeVisible()
    await expect(keepRow).toBeVisible()

    // Select HABIT_TARGET — desktop layout opens the detail panel.
    await targetRow.click()

    // The detail panel renders the "Archive Habit" button (text label).
    const archiveBtn = page.getByRole('button', { name: 'Archive Habit' })
    await expect(archiveBtn).toBeVisible()
    await archiveBtn.click()

    // Primary signal: DB-side write completes (cassian_habits.is_archived
    // flips to true). Polling so the assertion is robust against any
    // network jitter between click and the supabase round-trip.
    await expect
      .poll(async () => {
        const { data } = await admin
          .from('cassian_habits')
          .select('is_archived')
          .eq('user_id', TEST_USER_ID)
          .eq('name', HABIT_TARGET)
          .single()
        return data?.is_archived
      }, { timeout: 5000 })
      .toBe(true)

    // BUG: 86b9va2fg fix coverage — the parent list reacts WITHOUT a
    // page reload because the panel's archive click now routes through
    // the parent's useHabits mutator (override prop). The row vanishes
    // from the left list in-place; the second seeded habit stays.
    // (The panel itself unmounts via onHabitDeleted → onHabitSelect(null),
    // and Habits.tsx's auto-select effect picks HABIT_KEEP next, so the
    // "Archive Habit" button reappears for that habit.)
    await expect(targetRow).toHaveCount(0)
    await expect(keepRow).toBeVisible()

    // Toggle the archive view via the Archive icon button (title attr).
    await page.getByTitle('View archived habits').click()

    // The archived list shows HABIT_TARGET.
    const archivedListRow = page
      .locator('div.rounded-lg', { hasText: HABIT_TARGET })
      .first()
    await expect(archivedListRow).toBeVisible()

    // Select the archived habit so the detail panel re-renders with
    // the "Unarchive Habit" button.
    await archivedListRow.click()
    const unarchiveBtn = page.getByRole('button', { name: 'Unarchive Habit' })
    await expect(unarchiveBtn).toBeVisible()
    await unarchiveBtn.click()

    // After unarchive: is_archived=false in DB.
    await expect
      .poll(async () => {
        const { data } = await admin
          .from('cassian_habits')
          .select('is_archived')
          .eq('user_id', TEST_USER_ID)
          .eq('name', HABIT_TARGET)
          .single()
        return data?.is_archived
      }, { timeout: 5000 })
      .toBe(false)

    // BUG: 86b9va2fg fix coverage — unarchive splices the row back into
    // the parent's local habits state via the override mutator, so the
    // archived list view should now NOT contain the row, and toggling
    // back to the main list shows it reactively. We toggle back via
    // the "Back to habits" Archive button (title flips while in
    // archived view).
    await page.getByTitle('Back to habits').click()
    await expect(targetRow).toBeVisible()
  })
})
