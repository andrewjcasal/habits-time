import { format } from 'date-fns'
import { test, expect } from '../fixtures/auth'

/**
 * Validates the calendar's date-nav contract:
 *   - chevrons in CalendarTopBar mutate `?date=YYYY-MM-DD` in the URL
 *   - the `useEffect` watching `searchParams` re-syncs `baseDate`
 *   - browser back navigation restores the prior `?date=` value
 *
 * Source under test: src/pages/Calendar.tsx (navigateBack/Forward Day/Week,
 * navigateToToday, the searchParams effect ~line 310) and
 * src/components/CalendarTopBar.tsx.
 *
 * The test pins `2026-05-12` (Tuesday) so weekday math is deterministic.
 *
 * The week chevrons are titled "Go back 7 days" / "Go forward 7 days"
 * and the handlers in Calendar.tsx (navigateBackWeek /
 * navigateForwardWeek) move baseDate by ±7 days, matching.
 */

const PINNED_DATE = '2026-05-12'

test.describe('calendar date navigation', () => {
  test('chevrons + today button sync ?date= in the URL and history.back restores prior date', async ({
    page,
  }) => {
    await page.goto(`/calendar?date=${PINNED_DATE}`)
    await expect(page).toHaveURL(/date=2026-05-12/)

    // ── Single-day chevrons ──────────────────────────────────────────
    // "Go back 1 day": 2026-05-12 → 2026-05-11.
    await page.getByTitle('Go back 1 day').click()
    await expect(page).toHaveURL(/date=2026-05-11/)

    // ── Week chevrons (±7 days) ──────────────────────────────────────
    // "Go forward 7 days": 2026-05-11 → 2026-05-18.
    await page.getByTitle('Go forward 7 days').click()
    await expect(page).toHaveURL(/date=2026-05-18/)

    // "Go forward 1 day": 2026-05-18 → 2026-05-19.
    await page.getByTitle('Go forward 1 day').click()
    await expect(page).toHaveURL(/date=2026-05-19/)

    // "Go back 7 days": 2026-05-19 → 2026-05-12.
    await page.getByTitle('Go back 7 days').click()
    await expect(page).toHaveURL(/date=2026-05-12/)

    // ── Today button ─────────────────────────────────────────────────
    // Two buttons share title="Go to today" — a mobile one (md:hidden)
    // and a desktop sun icon (hidden md:block). At Desktop Chrome's
    // 1280×720 viewport only the desktop one is visible; filter by
    // ":visible" so the strict-mode locator resolves cleanly.
    await page.locator('button[title="Go to today"]:visible').click()
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    await expect(page).toHaveURL(new RegExp(`date=${todayStr}`))

    // ── Browser back ─────────────────────────────────────────────────
    // Each setSearchParams call pushes a history entry, so popping back
    // once restores the prior URL (`?date=2026-05-12`). The Calendar
    // useEffect on `searchParams` will then re-set baseDate.
    await page.goBack()
    await expect(page).toHaveURL(/date=2026-05-12/)
  })
})
