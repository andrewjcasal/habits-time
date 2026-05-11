import { chromium, type FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.test (preferred) then .env.local so PW_TEST_* + SUPABASE_*
// values resolve. Both files are gitignored.
loadEnv({ path: resolve(__dirname, '../.env.test') })
loadEnv({ path: resolve(__dirname, '../.env.local') })

const STORAGE_STATE = resolve(__dirname, '.auth/user.json')

const requireEnv = (key: string): string => {
  const v = process.env[key]
  if (!v) {
    throw new Error(
      `[playwright global.setup] Missing required env var: ${key}. Set it in .env.test or your shell.`,
    )
  }
  return v
}

async function ensureTestUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  password: string,
) {
  // Use the admin API to upsert a confirmed user. Idempotent: a 422
  // "User already registered" response is fine.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error && !/already.*registered|already exists/i.test(error.message)) {
    throw new Error(`[playwright global.setup] Failed to create test user: ${error.message}`)
  }

  if (data?.user) {
    // eslint-disable-next-line no-console
    console.log(`[playwright global.setup] Created test user ${email} (${data.user.id}).`)
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0].use.baseURL ?? process.env.PW_BASE_URL ?? 'http://localhost:5174'

  const email = requireEnv('PW_TEST_EMAIL')
  const password = requireEnv('PW_TEST_PASSWORD')

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Best-effort seed: only create the test user if both URL + service key
  // are present. Otherwise we assume the user already exists.
  if (supabaseUrl && serviceRoleKey) {
    await ensureTestUser(supabaseUrl, serviceRoleKey, email, password)
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      '[playwright global.setup] SUPABASE_SERVICE_ROLE_KEY not set — assuming the test user already exists.',
    )
  }

  // Drive the real /login form so we exercise the same auth path as users.
  if (!existsSync(dirname(STORAGE_STATE))) {
    mkdirSync(dirname(STORAGE_STATE), { recursive: true })
  }

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(`${baseURL}/login`)

  // The Login form uses id="email" / id="password" + a single submit button.
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  // After successful login the app redirects authenticated users to /calendar.
  // On failure (bad creds, missing user, etc.) Login renders the supabase
  // error in a red <p>; surface that so the timeout reason is obvious.
  try {
    await page.waitForURL(/\/calendar/, { timeout: 30_000 })
  } catch (err) {
    const errMsg = await page
      .locator('p.text-red-500')
      .first()
      .textContent({ timeout: 1_000 })
      .catch(() => null)
    if (errMsg) {
      throw new Error(
        `[playwright global.setup] Login failed for ${email}: "${errMsg.trim()}". ` +
          `Set SUPABASE_SERVICE_ROLE_KEY in .env.test (or pre-create the user in the Supabase dashboard) and retry.`,
      )
    }
    throw err
  }

  await context.storageState({ path: STORAGE_STATE })
  await browser.close()
}
