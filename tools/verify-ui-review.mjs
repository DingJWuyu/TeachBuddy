// Checks the five reported defects from the UI review are actually fixed.
import { chromium } from 'playwright';

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:4174/?prototype=sidebar', { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

// 1. no hamburger in the desktop top bar
const burger = await p.evaluate(() => {
  const el = document.querySelector('.tb-mobile-menu');
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), display: getComputedStyle(el).display };
});
ok('no hamburger in desktop top bar', burger.w === 0 && burger.h === 0, JSON.stringify(burger));

// 2. collapse is animated, and the toggle sits at the reference position
const anim = await p.evaluate(() => {
  const shell = getComputedStyle(document.querySelector('.tb-shell'));
  const topbar = getComputedStyle(document.querySelector('.tb-topbar'));
  const toggle = document.querySelector('.tb-sidebar-toggle').getBoundingClientRect();
  return { shellTransition: `${shell.transitionProperty} ${shell.transitionDuration} ${shell.transitionTimingFunction}`,
    topbarTransition: topbar.transitionDuration, toggleX: Math.round(toggle.x), toggleW: Math.round(toggle.width) };
});
ok('sidebar collapse is animated', anim.shellTransition.includes('grid-template-columns') && anim.shellTransition.includes('0.32s'), anim.shellTransition);
// The top bar is a fixed shell: its brand column is pinned, so it must carry no
// width transition and must not move when the sidebar collapses.
ok('top bar does not animate with the sidebar', anim.topbarTransition === '0s', anim.topbarTransition);
ok('collapse control at reference x=220', anim.toggleX === 220 && anim.toggleW === 32, `x=${anim.toggleX} w=${anim.toggleW}`);

// Record top-bar geometry, collapse, then confirm nothing in it shifted.
const topbarBefore = await p.evaluate(() => {
  const nav = document.querySelector('.tb-global-nav').getBoundingClientRect();
  const brand = document.querySelector('.tb-brand-slot').getBoundingClientRect();
  const brandText = document.querySelector('.tb-brand-slot > strong').getBoundingClientRect();
  return { navX: Math.round(nav.x), brandX: Math.round(brand.x), brandW: Math.round(brand.width), brandTextW: Math.round(brandText.width) };
});

// measure the mid-transition width to prove the animation runs.
// The collapse control is pointer-events:none until the top bar is hovered, so
// the synthetic click has to run inside a hovered top bar.
await p.hover('.tb-topbar');
await p.waitForTimeout(300);
await p.evaluate(() => {
  const el = document.querySelector('.tb-prototype');
  if (el.classList.contains('is-sidebar-collapsed')) {
    document.querySelector('.tb-sidebar-toggle').click();
  }
});
await p.waitForTimeout(500);
const startWidth = await p.evaluate(() => document.querySelector('.tb-sidebar').getBoundingClientRect().width);
const samples = await p.evaluate(() => new Promise((resolve) => {
  const out = [];
  const el = document.querySelector('.tb-sidebar');
  const t0 = performance.now();
  document.querySelector('.tb-sidebar-toggle').click();
  const tick = () => {
    out.push(Math.round(el.getBoundingClientRect().width));
    if (performance.now() - t0 < 400) requestAnimationFrame(tick);
    else resolve(out);
  };
  requestAnimationFrame(tick);
}));
const midFlight = samples.filter((w) => w > 72 && w < 256);
const settled = samples[samples.length - 1];
ok('sidebar starts expanded', Math.round(startWidth) === 256, String(Math.round(startWidth)));
ok('width is mid-flight during transition', midFlight.length >= 2, `samples=${samples.slice(0, 12).join(',')} midFlight=${midFlight.length}`);
ok('collapsed width settles at 72px', settled === 72, String(settled));

const topbarAfter = await p.evaluate(() => {
  const nav = document.querySelector('.tb-global-nav').getBoundingClientRect();
  const brand = document.querySelector('.tb-brand-slot').getBoundingClientRect();
  const brandText = document.querySelector('.tb-brand-slot > strong').getBoundingClientRect();
  const toggle = document.querySelector('.tb-sidebar-toggle').getBoundingClientRect();
  return { navX: Math.round(nav.x), brandX: Math.round(brand.x), brandW: Math.round(brand.width), brandTextW: Math.round(brandText.width), toggleX: Math.round(toggle.x) };
});
ok('top-bar centre nav does not shift', topbarAfter.navX === topbarBefore.navX, `before=${topbarBefore.navX} after=${topbarAfter.navX}`);
ok('brand does not shift or collapse', topbarAfter.brandX === topbarBefore.brandX && topbarAfter.brandTextW === topbarBefore.brandTextW, JSON.stringify({ before: topbarBefore, after: topbarAfter }));
ok('collapse control stays at x=220 when collapsed', topbarAfter.toggleX === 220, String(topbarAfter.toggleX));

// first rail icon must not touch the top bar
const railTop = await p.evaluate(() => {
  const row = document.querySelector('.tb-module-row');
  return Math.round(row.getBoundingClientRect().top - document.querySelector('.tb-topbar').getBoundingClientRect().bottom);
});
ok('first rail icon has clearance below the top bar', railTop >= 8, `${railTop}px`);

// the rail reveal is masked along the top-left diagonal
const maskState = await p.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.tb-sidebar'));
  return { name: cs.animationName, duration: cs.animationDuration };
});
ok('rail collapse uses a diagonal mask', maskState.name === 'tb-sidebar-fold' && maskState.duration === '0.32s', JSON.stringify(maskState));

// Both settled states must be fully visible: an animation that keeps painting
// its final frame would leave the sidebar masked after the transition ends.
const settledClip = await p.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.tb-sidebar'));
  const row = document.querySelector('.tb-module-row').getBoundingClientRect();
  return { clip: cs.clipPath, rowW: Math.round(row.width), rowH: Math.round(row.height) };
});
const clipIsFull = settledClip.clip === 'none'
  || settledClip.clip === 'polygon(0px 0px, 100% 0px, 100% 100%, 0px 100%)';
ok('collapsed rail is not masked away', clipIsFull && settledClip.rowW === 36 && settledClip.rowH === 36, JSON.stringify(settledClip));

// 3. trash panel rows are horizontal, not stacked
await p.hover('.tb-topbar');
await p.waitForTimeout(200);
await p.evaluate(() => {
  const root = document.querySelector('.tb-prototype');
  if (root.classList.contains('is-sidebar-collapsed')) document.querySelector('.tb-sidebar-toggle').click();
});
await p.waitForTimeout(450);
await p.evaluate(() => {
  const row = [...document.querySelectorAll('.tb-module-row')].find((r) => r.textContent.includes('规划器'));
  row.focus();
  row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
});
await p.waitForTimeout(400);
await p.click('.tb-trash-target', { force: true });
await p.waitForTimeout(400);
const panel = await p.evaluate(() => {
  const btn = document.querySelector('.tb-hidden-panel > button');
  if (!btn) return null;
  const kids = [...btn.children].map((c) => { const r = c.getBoundingClientRect(); return { mid: Math.round(r.y + r.height / 2), x: Math.round(r.x) }; });
  const display = getComputedStyle(btn).display;
  const xSpread = Math.max(...kids.map((k) => k.x)) - Math.min(...kids.map((k) => k.x));
  const ySpread = Math.max(...kids.map((k) => k.mid)) - Math.min(...kids.map((k) => k.mid));
  return { display, kidCount: kids.length, xSpread, ySpread, rows: kids };
});
ok('trash row uses the grid layout', panel?.display === 'grid', panel?.display);
ok('trash row children are laid out horizontally', panel && panel.xSpread > 100 && panel.ySpread <= 2, JSON.stringify(panel));

// 4. new-group form is a compact right-hand flyout
const toggleBox = await p.evaluate(() => {
  const t = document.querySelector('[data-new-group-toggle]').getBoundingClientRect();
  return { right: Math.round(t.right), top: Math.round(t.top) };
});
await p.click('[data-new-group-toggle]', { force: true });
await p.waitForTimeout(400);
const form = await p.evaluate(() => {
  const f = document.querySelector('.tb-new-group-form');
  if (!f) return null;
  const r = f.getBoundingClientRect();
  const input = f.querySelector('input').getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    inputW: Math.round(input.width), inputH: Math.round(input.height), position: getComputedStyle(f).position,
    radius: getComputedStyle(f).borderRadius, shadow: getComputedStyle(f).boxShadow.slice(0, 40) };
});
ok('new-group form opens to the right of its trigger', form && form.x >= toggleBox.right, `form x=${form?.x} trigger right=${toggleBox.right}`);
ok('new-group form is compact', form && form.w <= 260 && form.h <= 60, `w=${form?.w} h=${form?.h}`);
ok('new-group form uses the popover grammar', form?.position === 'fixed' && form?.radius === '12px', `${form?.position} r=${form?.radius}`);
await p.keyboard.press('Escape');
await p.waitForTimeout(300);

// 5. account block: spacing, no chevron, language width
const account = await p.evaluate(() => {
  const row = document.querySelector('.tb-account-row');
  const lang = document.querySelector('.tb-language-row');
  const term = document.querySelector('.tb-term-button');
  const avatar = row.querySelector('.tb-avatar');
  const name = row.querySelector('strong');
  const rr = row.getBoundingClientRect();
  const ar = avatar.getBoundingClientRect();
  const nr = name.getBoundingClientRect();
  const lr = lang.getBoundingClientRect();
  const tr = term.getBoundingClientRect();
  return {
    avatarSize: Math.round(ar.width), avatarToName: Math.round(nr.x - ar.right),
    accountSvgCount: row.querySelectorAll('svg').length,
    rowRight: Math.round(rr.right), langX: Math.round(lr.x), langW: Math.round(lr.width),
    gapRowToLang: Math.round(lr.x - rr.right),
    termRadius: getComputedStyle(term).borderRadius, termBottom: Math.round(tr.bottom),
  };
});
ok('account row has no trailing chevron', account.accountSvgCount === 0, String(account.accountSvgCount));
ok('avatar is 32px with a 12px gap to the name', account.avatarSize === 32 && account.avatarToName === 12, JSON.stringify(account));
ok('language button is 32px wide, not stretched', account.langW === 32, String(account.langW));
ok('create-term radius is slightly rounded', account.termRadius === '10px', account.termRadius);

ok('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3)));

console.log('=== UI REVIEW FIXES ===');
for (const r of results) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  ' + r.detail : ''}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);

await p.evaluate(() => {
  const row = [...document.querySelectorAll('.tb-module-row')].find((r) => r.textContent.includes('规划器'));
  if (row) { row.focus(); row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); }
});
await p.waitForTimeout(300);
await p.click('.tb-trash-target', { force: true });
await p.waitForTimeout(400);
await p.screenshot({ path: 'docs/reference/shots/prototype-trash-panel.png' });
await p.keyboard.press('Escape');
await p.click('[data-new-group-toggle]', { force: true });
await p.waitForTimeout(400);
await p.screenshot({ path: 'docs/reference/shots/prototype-new-group-popover.png' });
await b.close();
