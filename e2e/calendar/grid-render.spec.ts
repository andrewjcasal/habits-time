import { test, expect } from '../fixtures/auth'

/**
 * Validates the calendar grid contract:
 *   - hour column starts at 5 AM (GRID_START_HOUR=5)
 *   - 24 hour rows total (5 AM → 4 AM next day, with 0–4 wrapping to bottom)
 *   - day-count and row-height controls update the grid AND persist to
 *     localStorage across reloads.
 *
 * Source under test: src/pages/Calendar.tsx, src/components/CalendarGrid.tsx,
 * src/components/CalendarTopBar.tsx, src/utils/calendarGrid.ts.
 */

// Pin the date so dayColumns are deterministic regardless of when the
// test runs. Default `baseDate` is "two days ago" otherwise.
const PINNED_DATE = '2026-05-08'
const CALENDAR_URL = `/calendar?date=${PINNED_DATE}`

// The 24 hour-row display labels in order (5 AM → 4 AM next day).
const EXPECTED_HOUR_LABELS = [
  '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM',
  '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM',
  '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM',
  '11:00 PM', '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM',
]

test.describe('calendar grid render', () => {
  test('starts at 5 AM, renders 24 rows + 7 day columns by default, then 3-day + tall rows persist across reload', async ({
    page,
  }) => {
    // First navigate to the app origin so we can mutate localStorage,
    // then clear any persisted grid prefs so the test starts from the
    // documented defaults (7 days, 64px rows).
    await page.goto(CALENDAR_URL)
    await expect(page).toHaveURL(/\/calendar/)

    await page.evaluate(() => {
      window.localStorage.removeItem('calendarHourHeight')
      window.localStorage.removeItem('calendarDayColumnCount')
    })
    // Reload so the Calendar component re-initializes its useState
    // hooks from the freshly-cleared storage.
    await page.reload()
    await expect(page).toHaveURL(/\/calendar/)

    // Day-count <select> in the top bar — anchors the visible grid.
    const daysSelect = page.getByLabel('Days visible')
    await expect(daysSelect).toBeVisible()

    // Row-height toggle button — title alternates Compact/Expand. With
    // hourHeight=64 (default) the title is "Expand rows".
    const rowHeightToggle = page.getByRole('button', { name: 'Expand rows' })
    await expect(rowHeightToggle).toBeVisible()

    // Each of the 24 hour labels should be visible in the time column.
    for (const label of EXPECTED_HOUR_LABELS) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    // Count hour rows by counting the hour-label divs in the time column.
    // CalendarGrid renders one such label per hour row.
    const hourLabelLocator = page.locator('div.font-mono.text-neutral-600.text-xs')
    await expect(hourLabelLocator).toHaveCount(EXPECTED_HOUR_LABELS.length)

    // Day-header cells: the day-header strip renders an <h2> per
    // dayColumns entry. With dayColumnCount=7 (default) we expect 7.
    const dayHeaders = page.locator('h2.text-base.text-neutral-900')
    await expect(dayHeaders).toHaveCount(7)

    // Default hour-row height is 64px. Find the first hour row (parent
    // grid container of the "5:00 AM" label) and read its height.
    const firstHourRow = page
      .getByText('5:00 AM', { exact: true })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"grid") and contains(@class,"border-b")][1]')
    await expect(firstHourRow).toBeVisible()
    const initialBox = await firstHourRow.boundingBox()
    expect(initialBox).not.toBeNull()
    expect(Math.round(initialBox!.height)).toBe(64)

    // Switch day count from 7 → 3.
    await daysSelect.selectOption('3')
    await expect(dayHeaders).toHaveCount(3)

    // Click the row-height toggle (64 → 80). The button's accessible
    // name flips from "Expand rows" to "Compact rows" once hourHeight=80.
    await rowHeightToggle.click()
    await expect(page.getByRole('button', { name: 'Compact rows' })).toBeVisible()

    await expect(async () => {
      const box = await firstHourRow.boundingBox()
      expect(box).not.toBeNull()
      expect(Math.round(box!.height)).toBe(80)
    }).toPass({ timeout: 5_000 })

    // localStorage should now hold the new prefs.
    const dayCountLS = await page.evaluate(() =>
      window.localStorage.getItem('calendarDayColumnCount'),
    )
    const hourHeightLS = await page.evaluate(() =>
      window.localStorage.getItem('calendarHourHeight'),
    )
    expect(dayCountLS).toBe('3')
    expect(hourHeightLS).toBe('80')

    // Reload — both prefs should persist via the on-mount localStorage
    // reads in Calendar.tsx.
    await page.reload()
    await expect(page).toHaveURL(/\/calendar/)

    await expect(dayHeaders).toHaveCount(3)
    await expect(async () => {
      const box = await firstHourRow.boundingBox()
      expect(box).not.toBeNull()
      expect(Math.round(box!.height)).toBe(80)
    }).toPass({ timeout: 5_000 })

    const dayCountAfterReload = await page.evaluate(() =>
      window.localStorage.getItem('calendarDayColumnCount'),
    )
    const hourHeightAfterReload = await page.evaluate(() =>
      window.localStorage.getItem('calendarHourHeight'),
    )
    expect(dayCountAfterReload).toBe('3')
    expect(hourHeightAfterReload).toBe('80')
  })
})
