/*
 * Session verification: real navigation destinations and empty pages, the
 * notification read/delete flow, the trash drop targets, the feedback
 * acknowledgement and the progressive surface reveal.
 *
 * Runs against the accepted prototype. From the repository root:
 *   npm run prototype:sidebar
 *   node prototype/verification/verify-navigation-notifications-feedback.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { evidencePaths } from './evidence-paths.mjs';
import { openWorkbench, dismissCoach } from './session.mjs';

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?prototype=sidebar';
const query = new URL(BASE).search;
const paths = evidencePaths('verify-navigation-notifications-feedback');
const OUT = `${paths.screenshots}/`;
const RESULTS = `${paths.results}/`;
mkdirSync(OUT, { recursive: true });
mkdirSync(RESULTS, { recursive: true });

const results = [];
function check(name, value, expected) {
  const ok = expected === undefined ? Boolean(value) : value === expected;
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${expected === undefined ? ` -> ${JSON.stringify(value)}` : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)})`}`);
  console.log(results.at(-1));
  return ok;
}

// Client-side navigation waits for its URL and destination, not a document load.
async function settling(pathname) {
  await page.waitForURL((url) => url.pathname === pathname, { timeout: 15000 });
  if (pathname === '/') {
    await page.waitForSelector('.tb-empty-page', { timeout: 15000 });
  } else {
    await page.waitForSelector('.tb-empty-page h1', { timeout: 15000 });
  }
  await page.waitForTimeout(300);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

try {
await openWorkbench(page, BASE, { dismissCoach: true });
await page.waitForTimeout(900);

// ------------------------------------------------- 1. brand and top-bar nav
check('brand href keeps query options', await page.getAttribute('.tb-brand', 'href'), `/${query}`);
check('首页 href', await page.getAttribute('.tb-global-nav a:nth-of-type(1)', 'href'), `/${query}`);
check('日历 href', await page.getAttribute('.tb-global-nav a:nth-of-type(2)', 'href'), `/calendar${query}`);
check('首页 aria-current', await page.getAttribute('.tb-global-nav a:nth-of-type(1)', 'aria-current'), 'page');

await page.click('.tb-global-nav a:nth-of-type(2)');
await settling('/calendar');
check('after 日历 click pathname', await page.evaluate(() => window.location.pathname), '/calendar');
check('日历 page title', await page.textContent('.tb-empty-page h1'), '日历');
check('日历 aria-current', await page.getAttribute('.tb-global-nav a:nth-of-type(2)', 'aria-current'), 'page');
check('sidebar still rendered', await page.isVisible('.tb-sidebar'));
check('no sign-in form', await page.locator('.login-card, form input[type="password"]').count(), 0);
await page.screenshot({ path: `${OUT}/PC-CW19-calendar-page.png` });

await page.click('.tb-brand');
await settling('/');
check('brand returns home pathname', await page.evaluate(() => window.location.pathname), '/');
check('coach mark stays dismissed across a real navigation', await page.locator('.tb-coach').count(), 0);
check('home placeholder visible', await page.isVisible('.tb-empty-page'));
check('首页 aria-current back', await page.getAttribute('.tb-global-nav a:nth-of-type(1)', 'aria-current'), 'page');

// ------------------------------------------------------ 2. sidebar module nav
check('module row is anchor', await page.evaluate(() => document.querySelector('.tb-module-row')?.tagName), 'A');
check('module row href', await page.getAttribute('.tb-module-row', 'href'), `/modules/classes${query}`);
await page.click('.tb-module-row');
await settling('/modules/classes');
check('module pathname', await page.evaluate(() => window.location.pathname), '/modules/classes');
check('module page title', await page.textContent('.tb-empty-page h1'), '我的班级');
check('module row active', await page.evaluate(() => document.querySelector('.tb-module-row[href^="/modules/classes"]')?.classList.contains('is-active')), true);
check('module row aria-current', await page.getAttribute('.tb-module-row[href^="/modules/classes"]', 'aria-current'), 'page');
check('首页 no longer current', await page.getAttribute('.tb-global-nav a:nth-of-type(1)', 'aria-current'), null);
await page.screenshot({ path: `${OUT}/PC-CW20-module-page.png` });

// back button drives the shell
await page.goBack();
await settling('/');
check('back returns home', await page.evaluate(() => window.location.pathname), '/');
check('back shows the home placeholder', await page.isVisible('.tb-empty-page'));

// ------------------------------------------------------- 3. support menu nav
await page.hover('[data-surface="support"]');
await page.waitForTimeout(120);
const menuMid = await page.evaluate(() => {
  const menu = document.querySelector('.tb-support-menu');
  if (!menu) return null;
  const style = getComputedStyle(menu);
  return { animation: style.animationName, transform: style.transform, opacity: style.opacity };
});
check('support menu animates in', menuMid?.animation, 'tb-surface-in-centered');
await page.waitForTimeout(300);
await page.click('.tb-support-menu [role="menuitem"]:nth-of-type(1)');
await settling('/settings');
check('support 设置 navigates', await page.evaluate(() => window.location.pathname), '/settings');
check('支持 menu closed after nav', await page.locator('.tb-support-menu').count(), 0);
check('设置 page title', await page.textContent('.tb-empty-page h1'), '设置');

// ---------------------------------------------------------- 4. search results
await page.click('[data-surface="search"]');
await page.waitForTimeout(250);
check('search panel animates in', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-search-panel')).animationName), 'tb-surface-in');
await page.click('.tb-search-item:nth-of-type(1)');
await settling('/modules/timetable');
check('search result navigates', await page.evaluate(() => window.location.pathname), '/modules/timetable');
check('search closed after nav', await page.locator('.tb-search-panel').count(), 0);
check('课程表 page title', await page.textContent('.tb-empty-page h1'), '课程表');

// ------------------------------------------------------ 5. notification panel
await page.click('.tb-brand');
await settling('/');
const badgeBefore = await page.textContent('[data-surface="notifications"] .tb-badge');
check('badge present with unread', badgeBefore, '!');
check('notification label counts unread', await page.getAttribute('[data-surface="notifications"]', 'aria-label'), '通知，2 条未读');

await page.click('[data-surface="notifications"]');
await page.waitForTimeout(300);
check('panel animates in', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-popover-notifications')).animationName), 'tb-surface-in');
check('description line removed', await page.locator('.tb-popover-notifications .tb-popover-desc').count(), 0);
check('trash present in list', await page.isVisible('.tb-notification-trash'));
check('trash label', (await page.textContent('.tb-notification-trash')).trim(), '删除消息');
check('read mark scale before click', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-notification .tb-row-text'), '::after').transform), 'matrix(0, 0, 0, 1, 0, 0)');
await page.screenshot({ path: `${OUT}/PC-CW18-notifications.png` });

// click a row: read, then unread
await page.click('.tb-notification:nth-of-type(1)');
await page.waitForTimeout(500);
check('row is read', await page.evaluate(() => document.querySelector('.tb-notification')?.classList.contains('is-read')), true);
check('read mark drawn', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-notification .tb-row-text'), '::after').transform), 'matrix(1, 0, 0, 1, 0, 0)');
check('row has transition on the mark', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-notification .tb-row-text'), '::after').transitionProperty.includes('transform')));
await page.screenshot({ path: `${OUT}/PC-CW21-notifications-read.png` });
check('row draggable once read', await page.getAttribute('.tb-notification', 'draggable'), 'true');

await page.click('.tb-notification:nth-of-type(1)');
await page.waitForTimeout(500);
check('row back to unread', await page.evaluate(() => document.querySelector('.tb-notification')?.classList.contains('is-read')), false);
check('read mark retracted', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-notification .tb-row-text'), '::after').transform), 'matrix(0, 0, 0, 1, 0, 0)');

// mark all read: badge disappears
await page.click('.tb-popover-action');
await page.waitForTimeout(400);
check('all rows read', await page.evaluate(() => [...document.querySelectorAll('.tb-notification')].every((row) => row.classList.contains('is-read'))), true);
check('badge gone when nothing unread', await page.locator('[data-surface="notifications"] .tb-badge').count(), 0);
check('全部已读 action gone', await page.locator('.tb-popover-action').count(), 0);
check('notification label without unread', await page.getAttribute('[data-surface="notifications"]', 'aria-label'), '通知');

/*
 * Drag and drop is HTML5 drag, and Playwright's low-level mouse API does not
 * start a native drag on this platform: mouse.down plus mouse.move produces no
 * dragstart at all, in headless and headed alike. page.dragAndDrop does, so the
 * gesture itself is driven with the helper. The mid-gesture highlight is checked
 * separately with a dispatched dragover, because the helper completes the whole
 * drop in one call and never exposes the in-flight state.
 */
await page.evaluate(() => {
  const row = document.querySelector('.tb-notification');
  row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
});
await page.waitForTimeout(150);
await page.evaluate(() => {
  const trash = document.querySelector('.tb-notification-trash');
  trash.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
});
await page.waitForTimeout(200);
check('trash recognises the drag', await page.evaluate(() => document.querySelector('.tb-popover-notifications')?.classList.contains('is-over-trash')), true);
check('trash icon turns red', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-notification-trash-icon')).color), 'rgb(217, 45, 32)');
check('trash icon swells', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-notification-trash-icon')).transform.startsWith('matrix(1.2')), true);
await page.screenshot({ path: `${OUT}/PC-CW22-notification-delete.png` });
await page.evaluate(() => {
  const row = document.querySelector('.tb-notification');
  row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: new DataTransfer() }));
});
await page.waitForTimeout(250);
check('trash state cleared when the drag ends elsewhere', await page.evaluate(() => document.querySelector('.tb-popover-notifications')?.classList.contains('is-over-trash')), false);
check('a cancelled drag removes nothing', await page.locator('.tb-notification').count(), 3);

await page.dragAndDrop('.tb-notification >> nth=0', '.tb-notification-trash');
await page.waitForTimeout(400);
check('dropping a read notification on the trash removes it', await page.locator('.tb-notification').count(), 2);

// ------------------------------------------------------------ 6. feedback sent
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.click('[data-surface="feedback"]');
await page.waitForTimeout(250);
await page.fill('.tb-feedback-body', '测试反馈');
await page.click('.tb-button-primary');
await page.waitForTimeout(300);
check('sent heading', await page.textContent('.tb-feedback-sent h2'), '已收到，谢谢你的反馈！');
check('no prototype disclaimer', await page.locator('.tb-feedback-sent p').count(), 0);
check('acknowledgement offers a way out', await page.textContent('.tb-feedback-dismiss'), '知道了');
await page.screenshot({ path: `${OUT}/PC-CW28-feedback-sent.png` });
await page.click('.tb-feedback-dismiss');
await page.waitForTimeout(250);
check('dismiss closes the feedback popover', await page.locator('.tb-popover-feedback').count(), 0);

// -------------------------------------------------- 7. sidebar trash drop feel
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.evaluate(() => {
  const row = document.querySelector('.tb-module-row[href^="/modules/timetable"]');
  const payload = JSON.stringify({ type: 'module', id: 'timetable' });
  const dt = new DataTransfer();
  dt.setData('text/plain', payload);
  row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
});
await page.waitForTimeout(200);
await page.evaluate(() => {
  const trash = document.querySelector('.tb-trash-target');
  trash.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
});
await page.waitForTimeout(250);
check('sidebar trash recognises the drag', await page.evaluate(() => document.querySelector('.tb-trash-target')?.classList.contains('is-drop-target')), true);
check('sidebar trash icon turns red', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-trash-icon')).color), 'rgb(217, 45, 32)');
check('sidebar trash icon swells', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-trash-icon')).transform.startsWith('matrix(1.2')), true);
await page.screenshot({ path: `${OUT}/PC-CW25-sidebar-trash-drop.png` });
await page.evaluate(() => {
  document.querySelector('.tb-trash-target').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
});
await page.waitForTimeout(400);
check('module hidden into trash', await page.evaluate(() => Number(document.querySelector('.tb-trash-target b')?.textContent || 0)), 1);
check('sidebar trash state cleared after the drop', await page.evaluate(() => document.querySelector('.tb-trash-target')?.classList.contains('is-drop-target')), false);

// --------------------------------------------------------------- 8. no leftovers
check('no page errors', errors.length === 0);
if (errors.length) console.log(errors.join('\n'));

} catch (error) {
  results.push(`FAIL suite interrupted: ${error.message}`);
  console.error(error);
} finally {
  await browser.close();
}
const failed = results.filter((line) => line.startsWith('FAIL'));
writeFileSync(`${RESULTS}verify-navigation-notifications-feedback${failed.length ? '-failed' : ''}.txt`,
  `Scope: all\nStatus: ${failed.length ? 'failed' : 'passed'}\n${results.join('\n')}\n`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
