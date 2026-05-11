import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * Cassian Playwright config (Phase 1).
 *
 * Required env vars (set in `.env.test` or shell):
 *   VITE_SUPABASE_URL          – Supabase REST URL for the `calendar` cloud
 *                                project used by E2E.
 *   VITE_SUPABASE_ANON_KEY     – anon key for the same project.
 *   SUPABASE_SERVICE_ROLE_KEY  – service-role key (admin createUser in
 *                                the global setup).
 *   PW_TEST_EMAIL              – e.g. test+playwright@cassian.local
 *   PW_TEST_PASSWORD           – any strong password.
 *   PW_BASE_URL                – defaults to http://localhost:5174.
 *
 * Phase 1 constraints: workers=1, fullyParallel=false, single chromium
 * project. The webServer runs Vite on :5174 in `--mode test` so it does
 * not collide with the developer's regular `npm run dev` on :5173 (which
 * is wired to prod Supabase via `.env.local`). All E2E specs must clean
 * up the rows they seed because we share a cloud project with the dev
 * environment.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load `.env.test` so VITE_* + PW_* values are available in this config
// process (and so the spawned Vite child inherits them).
loadEnv({ path: resolve(__dirname, '.env.test') })

// E2E uses port 5174 to coexist with a developer's normal `npm run dev`
// running on :5173 (which is pointed at prod via `.env.local`).
const baseURL = process.env.PW_BASE_URL ?? 'http://localhost:5174'

export default defineConfig({
  testDir: './e2e',
  // The global setup logs in once and writes storageState to e2e/.auth/user.json.
  globalSetup: './e2e/global.setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  // Don't pick up the auth bootstrap as a regular spec.
  testIgnore: ['**/global.setup.ts', '**/.auth/**'],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: 'e2e/.auth/user.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `--mode test` makes Vite load `.env.test` + `.env.test.local`
    // INSTEAD of `.env.local`. `--port 5174` keeps E2E off the
    // developer's :5173 dev server (which is pointed at prod).
    command: 'npm run dev -- --mode test --port 5174',
    url: baseURL,
    // Always spawn a fresh server so we know it's running in test mode
    // and on the right port.
    reuseExistingServer: false,
    timeout: 120_000,
    // Surface Vite output during E2E runs.
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
