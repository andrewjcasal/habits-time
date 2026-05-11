import { test as base, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * `test` fixture that loads the signed-in storage state written by
 * `e2e/global.setup.ts`. The same storage state is also wired into
 * `playwright.config.ts` `use.storageState`, so most specs can simply
 * import `test` from `@playwright/test` directly. This export exists for
 * specs that want an explicit, named fixture or that need to override
 * `storageState` behavior in the future.
 */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
export const STORAGE_STATE = resolve(__dirname, '../.auth/user.json')

export const test = base.extend({
  // Ensure each test gets a fresh context loaded from the saved storageState.
  storageState: STORAGE_STATE,
})

export { expect }
