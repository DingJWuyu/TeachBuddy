// Checks sidebar motion, anchors, popovers, and row geometry.
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';
import { mkdirSync } from 'node:fs';
import { evidencePaths } from './evidence-paths.mjs';

const { screenshots: OUT } = evidencePaths('verify-ui-review');
mkdirSync(OUT, { recursive: true });

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?prototype=sidebar';

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await openWorkbench(p, BASE);
await p.waitForTimeout(600);

// The one-shot first-run guide dims the shell and swallows presses by design, so
// dismiss it before driving the surface under test.
await p.click('.tb-coach-dismiss').catch(() => {});
await p.waitForTimeout(250);

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
ok('sidebar collapse is animated', anim.shellTransition.includes('grid-template-columns') && anim.shellTransition.includes('0.2s'), anim.shellTransition);
// The top bar is a fixed shell: its brand column is pinned, so it must carry no
// width transition and must not move when the sidebar collapses.
ok('top bar does not animate with the sidebar', anim.topbarTransition === '0s', anim.topbarTransition);
ok('collapse control at reference x=220', anim.toggleX === 220 && anim.toggleW === 32, `x=${anim.toggleX} w=${anim.toggleW}`);

// Record top-bar geometry, collapse, then confirm nothing in it shifted.
const topbarBefore = await p.evaluate(() => {
  const nav = document.querySelector('.tb-global-nav').getBoundingClientRect();
  const brand = document.querySelector('.tb-brand-slot').getBoundingClientRect();
  const brandText = document.querySelector('.tb-brand-wordmark').getBoundingClientRect();
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
  const brandText = document.querySelector('.tb-brand-wordmark').getBoundingClientRect();
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

// The collapse is a plain width animation: the diagonal sweep read as a page
// flip and was removed, so no mask may be attached.
const maskState = await p.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.tb-sidebar'));
  return { name: cs.animationName, clip: cs.clipPath };
});
ok('rail collapse has no flip-page mask', maskState.name === 'none' && maskState.clip === 'none', JSON.stringify(maskState));

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
ok('new-group form is compact', form && form.w <= 200 && form.h <= 60, `w=${form?.w} h=${form?.h}`);
ok('new-group form uses the popover grammar', form?.position === 'fixed' && form?.radius === '10px', `${form?.position} r=${form?.radius}`);
const hasEnterHint = await p.evaluate(() => !!document.querySelector('.tb-new-group-form > span'));
ok('new-group form has no Enter hint', !hasEnterHint);
await p.keyboard.press('Escape');
await p.waitForTimeout(300);

// 5. account block: spacing, no chevron, language width
const account = await p.evaluate(() => {
  const row = document.querySelector('.tb-account-row');
  const lang = document.querySelector('.tb-language-row');
  const term = document.querySelector('.tb-term-button');
  const avatar = row.querySelector('.tb-avatar');
  const name = row.querySelector('.tb-account-name');
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
ok('term control uses the reference radius', account.termRadius === '6px', account.termRadius);

// --- spacing is anchored: avatar and workspace heading keep their reference
// positions and only the create-term button is placed between them ---
// The head block follows the reference's rhythm: the account row, then the
// semester control, then the workspace heading, each separated by the same gap.
const spacing = await p.evaluate(() => {
  const r2 = (v) => Math.round(v * 100) / 100;
  const row = document.querySelector('.tb-account-row').getBoundingClientRect();
  const term = document.querySelector('.tb-term-button').getBoundingClientRect();
  const head = document.querySelector('.tb-workspace-heading').getBoundingClientRect();
  return { rowBottom: r2(row.bottom), termTop: r2(term.top), termBottom: r2(term.bottom), headingTop: r2(head.top),
    gapAbove: r2(term.top - row.bottom), gapBelow: r2(head.top - term.bottom) };
});
ok('account row sits where the reference places it', Math.abs(spacing.rowBottom - 129) < 0.5, String(spacing.rowBottom));
ok('semester control follows the account row by 16px', Math.abs(spacing.gapAbove - 16) < 0.5, String(spacing.gapAbove));
ok('workspace heading follows the semester control by 16px', Math.abs(spacing.gapBelow - 16) < 0.5, String(spacing.gapBelow));
ok('gaps above and below the semester control are equal', spacing.gapAbove === spacing.gapBelow,
  `${spacing.gapAbove} vs ${spacing.gapBelow}`);

// --- trash rows match the module row exactly ---
// The panel must be opened without toggling it shut, and emptied first: an
// earlier check leaves one module in the trash, and the empty-state box only
// exists while nothing is in there.
const trashDims = await p.evaluate(() => new Promise((resolve) => {
  function collect() {
    const target = document.querySelector('.tb-trash-target');
    const trashRect = target.getBoundingClientRect();
    if (trashRect.width === 0) {
      // rail is collapsed from the previous check; expand and retry shortly
      document.querySelector('.tb-sidebar-toggle').click();
      setTimeout(collect, 500);
      return;
    }
    if (target.getAttribute('aria-expanded') !== 'true') target.click();
    setTimeout(() => {
      const panel = document.querySelector('.tb-hidden-panel');
      [...panel.querySelectorAll('button')].forEach((btn) => btn.click());
      setTimeout(() => {
        const empty = document.querySelector('.tb-hidden-panel > p');
        resolve({
          trashRow: { w: Math.round(trashRect.width), h: Math.round(trashRect.height) },
          panelW: Math.round(panel.getBoundingClientRect().width),
          emptyBox: empty ? { w: Math.round(empty.getBoundingClientRect().width), h: Math.round(empty.getBoundingClientRect().height) } : null,
        });
      }, 400);
    }, 400);
  }
  collect();
}));
ok('trash panel matches the trash row footprint',
  trashDims.trashRow.w === trashDims.panelW, `row=${trashDims.trashRow.w} panel=${trashDims.panelW}`);
ok('a dropped module fills the panel width',
  trashDims.emptyBox ? trashDims.emptyBox.w === trashDims.trashRow.w : null, JSON.stringify(trashDims.emptyBox));
ok('trash row is the same height as a module row', trashDims.trashRow.h === 36, JSON.stringify(trashDims.trashRow));
ok('empty trash state occupies one module row', !!trashDims.emptyBox && trashDims.emptyBox.h === 36, JSON.stringify(trashDims.emptyBox));
await p.keyboard.press('Escape');
await p.waitForTimeout(200);

ok('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3)));

console.log('=== SIDEBAR INTERACTIONS ===');
for (const r of results) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  ' + r.detail : ''}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);

await p.evaluate(() => {
  const row = [...document.querySelectorAll('.tb-module-row')].find((r) => r.textContent.includes('规划器'));
  if (row) { row.focus(); row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); }
});
await p.waitForTimeout(300);
await p.click('.tb-trash-target', { force: true });
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/PC-CW15-trash.png` });
await p.keyboard.press('Escape');
await p.click('[data-new-group-toggle]', { force: true });
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/PC-CW16-new-group.png` });
await b.close();

process.exitCode = results.some((result) => !result.pass) || errs.length ? 1 : 0;
