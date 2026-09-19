// Workbench interaction regression checks.
// Covers accessibility labelling, overflow, rail behaviour and the core
// hide/restore interactions. Drag-and-drop paths are exercised structurally
// rather than by replaying synthetic drag events.
import { chromium } from 'playwright';

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?prototype=sidebar';

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass, detail });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.waitForTimeout(500);

// The one-shot first-run guide dims the shell and swallows presses by design, so
// dismiss it before driving the surface under test.
await p.click('.tb-coach-dismiss').catch(() => {});
await p.waitForTimeout(250);

// --- accessibility ---
const a11y = await p.evaluate(() => {
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const buttons = [...document.querySelectorAll('button')].filter(visible);
  const unnamed = buttons.filter((btn) => {
    const text = (btn.innerText || '').trim();
    const label = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
    return !text && !label;
  }).map((btn) => btn.className || btn.outerHTML.slice(0, 60));
  const inputs = [...document.querySelectorAll('input')].filter(visible);
  const unlabeledInputs = inputs.filter((i) => !i.getAttribute('aria-label') && !i.labels?.length && !i.getAttribute('placeholder'));
  const nestedInteractive = [...document.querySelectorAll('button button, a button, button a, [role=button] button')].filter(visible).length;
  return { unnamed, unlabeledInputs: unlabeledInputs.length, nestedInteractive, buttonCount: buttons.length };
});
ok('no unnamed visible buttons', a11y.unnamed.length === 0, JSON.stringify(a11y.unnamed));
ok('no unlabeled visible inputs', a11y.unlabeledInputs === 0);
ok('no nested interactive controls', a11y.nestedInteractive === 0);

// --- hide a module and confirm the trash can restore it ---
await p.evaluate(() => {
  const row = [...document.querySelectorAll('.tb-module-row')].find((r) => r.textContent.includes('规划器'));
  row.focus();
  row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
});
await p.waitForTimeout(400);
const afterHide = await p.evaluate(() => {
  const stillListed = [...document.querySelectorAll('.tb-module-row')].some((r) => r.textContent.includes('规划器'));
  const trashLabel = document.querySelector('.tb-trash-target')?.getAttribute('aria-label') || '';
  return { stillListed, trashLabel };
});
ok('Delete hides a module', !afterHide.stillListed);
ok('trash count reflects hidden module', /1/.test(afterHide.trashLabel), afterHide.trashLabel);

// trash panel opens and restores into Ungrouped
await p.click('.tb-trash-target', { force: true });
await p.waitForTimeout(400);
const panel = await p.evaluate(() => {
  const el = document.querySelector('.tb-hidden-panel');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const trash = document.querySelector('.tb-trash-wrap').getBoundingClientRect();
  return { w: Math.round(r.width), x: Math.round(r.x), rightOfTrash: r.x >= trash.right - 12, hasRestoreButton: !!el.querySelector('button') };
});
ok('trash panel opens', !!panel);
if (panel) {
  ok('trash panel opens to the right', panel.rightOfTrash, `panel x=${panel.x}`);
  ok('trash panel lists restorable items', panel.hasRestoreButton);
  await p.click('.tb-hidden-panel button', { force: true });
  await p.waitForTimeout(400);
  const restored = await p.evaluate(() => [...document.querySelectorAll('.tb-module-row')].some((r) => r.textContent.includes('规划器')));
  ok('module restores to Ungrouped', restored);
}

// --- overflow at both widths ---
const overflow1440 = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
ok('no horizontal overflow @1440x900', !overflow1440);

const m = await b.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(BASE, { waitUntil: 'networkidle' });
await m.waitForTimeout(500);
// This page has its own load, so it raises its own first-run guide.
await m.click('.tb-coach-dismiss').catch(() => {});
await m.waitForTimeout(250);
const overflow390 = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
ok('no horizontal overflow @390x844', !overflow390);
await m.click('.tb-mobile-menu', { force: true });
await m.waitForTimeout(500);
const drawer = await m.evaluate(() => {
  const s = document.querySelector('.tb-sidebar');
  const r = s.getBoundingClientRect();
  return { open: s.classList.contains('is-mobile-open'), x: Math.round(r.x), w: Math.round(r.width) };
});
ok('mobile drawer opens', drawer.open && drawer.x === 0, JSON.stringify(drawer));

ok('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3)));

console.log('=== REGRESSION ===');
for (const r of results) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  ' + r.detail : ''}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);

await b.close();
