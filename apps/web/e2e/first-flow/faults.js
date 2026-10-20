/**
 * Fault control for the real-service first-flow E2E.
 *
 * `loseCommittedResponses` keeps the real write path: the request reaches the
 * server and commits, then the browser drops the response. Chromium may resend
 * such a write on its own, so every attempt is dropped while the server has
 * committed exactly one object per idempotency key - the request state the UI
 * must report as unknown instead of saved.
 */

/**
 * Drop the response of every matching write after the server committed it.
 * Returns the dropped-attempt count plus a `clear()` that restores the network.
 */
export async function loseCommittedResponses(page, urlPattern, { method = 'POST' } = {}) {
  let dropped = 0;
  const handler = async (route) => {
    if (route.request().method() !== method) return route.continue();
    await route.fetch();
    dropped += 1;
    await route.abort('failed');
  };
  await page.route(urlPattern, handler);
  return {
    dropped: () => dropped,
    async clear() {
      await page.unroute(urlPattern, handler);
    }
  };
}
