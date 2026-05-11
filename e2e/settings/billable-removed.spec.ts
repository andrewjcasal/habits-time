// [E2E:in-progress] 86b9vabp6
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../fixtures/auth'
import { adminClient, TEST_USER_ID } from '../fixtures/admin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '../..')

/**
 * PW: 86b9vabp6 — Settings page billable section + the underlying
 * cassian_user_settings columns are gone. Mixed assertions:
 *   - UI: legacy text and inputs absent on /settings; an unrelated
 *     section ("Work Hours") still renders so we know the page loaded.
 *   - DB: cassian_user_settings.billable_hours_enabled and
 *     default_hourly_rate are dropped (the migration applied
 *     20260508210904_drop_billable_settings.sql).
 *   - Static source: NewTaskModal.tsx has no is_billable references.
 *     The component is currently dead code — never imported anywhere
 *     — so we can't drive it through a UI flow. A source-level scan is
 *     the only meaningful assertion until/unless it gets re-mounted.
 *
 * Source under test:
 *   src/pages/Settings.tsx — billable form section removed
 *   src/components/NewTaskModal.tsx — is_billable checkbox removed
 *   src/hooks/useSettings.ts — billable_hours_enabled /
 *     default_hourly_rate / weekly_revenue_target removed from
 *     UserSettings type
 */

test.describe('settings page — billable section removed', () => {
  test('Settings UI has no billable section, work-hours section still renders', async ({
    page,
  }) => {
    await page.goto('/settings')

    // Positive assertion: unrelated section still renders, confirming
    // the page actually loaded (guards against a 404 / blank page
    // false-passing the negative assertions).
    await expect(page.getByText('Work Hours', { exact: true })).toBeVisible()

    // Negative: zero hits for any legacy billable label.
    await expect(page.getByText(/Billable hours/i)).toHaveCount(0)
    await expect(page.getByText(/Default Hourly Rate/i)).toHaveCount(0)
    await expect(page.getByText(/Weekly Revenue Target/i)).toHaveCount(0)
    await expect(page.getByText(/Enable billable hours tracking/i)).toHaveCount(0)
  })

  test('cassian_user_settings has no billable_hours_enabled / default_hourly_rate columns', async () => {
    const admin = adminClient()

    // PostgREST returns an error code 42703 ("undefined column") when
    // selecting a non-existent column. If the migration applied, the
    // select fails; if columns still exist, it succeeds.
    const probeBillable = await admin
      .from('cassian_user_settings')
      .select('billable_hours_enabled')
      .eq('user_id', TEST_USER_ID)
      .limit(1)
    expect(probeBillable.error).not.toBeNull()
    expect(probeBillable.error?.message || '').toMatch(
      /column.*billable_hours_enabled.*does not exist|undefined column/i,
    )

    const probeRate = await admin
      .from('cassian_user_settings')
      .select('default_hourly_rate')
      .eq('user_id', TEST_USER_ID)
      .limit(1)
    expect(probeRate.error).not.toBeNull()
    expect(probeRate.error?.message || '').toMatch(
      /column.*default_hourly_rate.*does not exist|undefined column/i,
    )
  })

  test('cassian_projects.hourly_rate is preserved (sanity)', async () => {
    const admin = adminClient()
    // The plan explicitly keeps cassian_projects.hourly_rate. Probe
    // that the column DOES exist by selecting it without an error.
    const { error } = await admin
      .from('cassian_projects')
      .select('hourly_rate')
      .limit(1)
    expect(error).toBeNull()
  })

  test('NewTaskModal source has no is_billable references', async () => {
    const path = resolve(REPO_ROOT, 'src/components/NewTaskModal.tsx')
    const source = readFileSync(path, 'utf8')
    expect(source).not.toMatch(/is_billable/)
  })
})
