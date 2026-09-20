export const DEMO_EMAIL = 'example@example.com';
export const DEMO_PASSWORD = 'teachbuddy';
const COACH_SEEN_KEY = 'teachbuddy-prototype-coach-seen';
const LAYOUT_KEY = 'teachbuddy-prototype-layout';

export async function dismissCoach(page) {
  const dismiss = page.locator('.tb-coach-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
}

// A document load loses the in-memory account session. Sign in through the UI.
export async function openWorkbench(page, url, { dismissCoach: dismiss = false, ...options } = {}) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000, ...options });
  await page.waitForSelector('.ae-card, .tb-shell', { timeout: 15000 });
  if (await page.locator('.ae-card').count()) {
    await page.fill('.ae-form input[type="email"]', DEMO_EMAIL);
    await page.fill('.ae-form input[type="password"]', DEMO_PASSWORD);
    await page.click('.ae-primary');
  }
  await page.waitForSelector('.tb-shell', { timeout: 15000 });
  if (dismiss) await dismissCoach(page);
}

export async function revealCoachMark(page, url) {
  await page.evaluate((key) => sessionStorage.removeItem(key), COACH_SEEN_KEY);
  await openWorkbench(page, url);
}

// Mutate the fixture once, then reload. No persistent init script can reset later loads.
export async function openWithLayout(page, url, action, options) {
  if (new URL(page.url()).origin !== new URL(url).origin) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  await page.evaluate(action, LAYOUT_KEY);
  await openWorkbench(page, url, options);
}
