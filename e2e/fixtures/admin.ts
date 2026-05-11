import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Lazily create a service-role Supabase client for E2E setup/teardown.
 * The service role bypasses RLS, so all admin clean-up code MUST scope
 * its mutations by `user_id = TEST_USER_ID` AND a clearly-namespaced
 * field (e.g. `title LIKE '[E2E]%'`) to avoid touching real dev data
 * in the shared cloud project.
 */

/** Auth user id for `test+playwright@cassian.local`. */
export const TEST_USER_ID = 'c7cbe317-a793-4584-9513-4946e053542f'

/** Recommended title prefix for E2E-owned rows. Use everywhere. */
export const E2E_TITLE_PREFIX = '[E2E]'

let cachedAdmin: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin

  const url = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error(
      '[e2e/fixtures/admin] VITE_SUPABASE_URL is not set; run inside the playwright test harness which loads .env.test.',
    )
  }
  if (!serviceRoleKey) {
    throw new Error(
      '[e2e/fixtures/admin] SUPABASE_SERVICE_ROLE_KEY is not set; populate it in .env.test before running specs that mutate data.',
    )
  }

  cachedAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cachedAdmin
}
