import { test, expect } from './fixtures/auth'

test.describe('smoke', () => {
  test('signed-in user lands on /calendar with the grid rendered', async ({ page }) => {
    await page.goto('/calendar')

    // Auth fixture should keep us out of /login.
    await expect(page).not.toHaveURL(/\/login(\?|$)/)
    await expect(page).toHaveURL(/\/calendar(\?|$)/)

    // Hour column starts at GRID_START_HOUR (5 AM). The label is rendered
    // as "5:00 AM" inside the time column on the left of the grid.
    await expect(page.getByText('5:00 AM', { exact: true }).first()).toBeVisible()
  })
})
