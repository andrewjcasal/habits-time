import { test as authTest, expect } from './auth'

/**
 * `test` fixture for drag-related specs. Layered on top of the auth
 * fixture so the signed-in storage state still loads, plus a
 * `beforeEach` that clears any leftover mouse-down state from the
 * previous spec in the same worker.
 *
 * Why: Calendar drags (create-meeting, meeting-move, meeting-resize,
 * project-activity-resize, and the billable-hours drags once they
 * exist) install document-level `mousemove` / `mouseup` listeners on
 * mousedown and tear them down on mouseup. When a previous spec ends
 * mid-drag (timeout, early throw, or an assertion that fired before
 * the spec dispatched its own `mouse.up()`), those listeners stay
 * registered and `dragStart` state lingers. The next spec's
 * `page.mouse.down()` then races against stale state and end_time
 * drifts — qa-engineer's symptom: end_time off by ~11h, start_time
 * correct.
 *
 * Two independent guards run before every drag spec:
 *   1. `page.mouse.up()` — flushes any held button at the Playwright
 *      input layer. Cheap, no-op if nothing was held.
 *   2. A page-side `mouseup` MouseEvent — fires the document-level
 *      handlers that React installed mid-drag, so they tear down their
 *      own state and remove their listeners.
 */
export const test = authTest.extend({})

test.beforeEach(async ({ page }) => {
  await page.mouse.up()
  await page.evaluate(() => {
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
})

export { expect }
