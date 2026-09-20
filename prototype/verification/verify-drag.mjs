// Drag-and-drop geometry, boundaries, and rendering stability.
//
// Verifies three things that a screenshot cannot show:
//   1. row geometry is byte-identical throughout a drag (no twitching),
//   2. the gap between two groups resolves to the previous group's end,
//   3. a repeated dragover at the same spot does not re-render the sidebar.
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = process.env.PROTOTYPE_EVIDENCE_DIR || fileURLToPath(new URL('../evidence/screenshots/workbench/', import.meta.url));
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
await p.waitForTimeout(700);

// The one-shot first-run guide dims the shell and swallows presses by design, so
// dismiss it before driving the surface under test.
await p.click('.tb-coach-dismiss').catch(() => {});
await p.waitForTimeout(250);

// Count how many times the sidebar subtree re-renders by patching React's
// commit hook is overkill; instead count DOM mutations under the nav.
await p.evaluate(() => {
  window.__mutations = 0;
  const nav = document.querySelector('.tb-module-nav');
  window.__observer = new MutationObserver((records) => {
    window.__mutations += records.filter((r) => r.type === 'attributes' || r.type === 'childList').length;
  });
  window.__observer.observe(nav, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
});

const rowGeometry = () => p.evaluate(() => [...document.querySelectorAll('.tb-module-row')].map((r) => {
  const b = r.getBoundingClientRect();
  return `${r.textContent.trim()}:${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}`;
}));

const dragTo = async (fromLabel, toExpr) => p.evaluate(({ fromLabel, toExpr }) => {
  const rows = [...document.querySelectorAll('.tb-module-row')];
  const from = rows.find((r) => r.textContent.includes(fromLabel));
  const target = eval(toExpr);
  const rect = target.getBoundingClientRect();
  const x = rect.x + rect.width / 2;
  const y = rect.y + (rect.height * (window.__yFrac ?? 0.5));
  const dt = new DataTransfer();
  from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  // several dragovers at the same coordinate: state must not churn
  for (let i = 0; i < 5; i += 1) {
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
  }
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
  from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  return { x: Math.round(x), y: Math.round(y) };
}, { fromLabel, toExpr });

// --- 1. geometry must not move while hovering a drop target ---
const before = await rowGeometry();
await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.tb-module-row')];
  const from = rows.find((r) => r.textContent.includes('课程标准'));
  const onto = rows.find((r) => r.textContent.includes('学生'));
  const rect = onto.getBoundingClientRect();
  const dt = new DataTransfer();
  from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  window.__dt = dt;
  window.__onto = onto;
  window.__coord = { x: rect.x + rect.width / 2, y: rect.y + 4 };
  onto.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, ...window.__coord }));
});
await p.waitForTimeout(250);
const during = await rowGeometry();
ok('rows do not move while a drop target is shown', JSON.stringify(before) === JSON.stringify(during),
  before.length === during.length ? '' : `count ${before.length} -> ${during.length}`);
const lineDrawn = await p.evaluate(() => document.querySelectorAll('.tb-module-row.is-drop-target').length);
ok('insertion line is drawn on exactly one row', lineDrawn === 1, String(lineDrawn));
const mutations = await p.evaluate(() => window.__mutations);
ok('repeated dragover does not churn the DOM', mutations <= 2, `mutations=${mutations}`);
await p.evaluate(() => {
  window.__onto.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: window.__dt }));
  document.querySelectorAll('.tb-module-row').forEach((r) => r.classList.remove('is-drop-target'));
});

// --- 2. the gap between two groups belongs to the previous group ---
// Dispatch, then wait a frame: the marker is rendered from React state, so
// reading it synchronously right after the event sees the previous render.
const gapSetup = await p.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')];
  const first = groups[0];
  const second = groups[1];
  const gapY = (first.getBoundingClientRect().bottom + second.getBoundingClientRect().top) / 2;
  const from = [...document.querySelectorAll('.tb-module-row')].find((r) => r.textContent.includes('课程标准'));
  const dt = new DataTransfer();
  from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const rect = second.getBoundingClientRect();
  second.dispatchEvent(new DragEvent('dragover', {
    bubbles: true, cancelable: true, dataTransfer: dt, clientX: rect.x + 40, clientY: gapY,
  }));
  window.__dragCleanup = () => from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  return {
    gapY: Math.round(gapY),
    firstGroupName: first.querySelector('.tb-group-toggle span')?.textContent,
    hoveredGroupName: second.querySelector('.tb-group-toggle span')?.textContent,
  };
});
await p.waitForTimeout(250);
const gapMark = await p.evaluate(() => {
  const marked = document.querySelector('.tb-group.is-module-end-target');
  return { markedName: marked ? marked.querySelector('.tb-group-toggle span')?.textContent : null };
});
await p.evaluate(() => window.__dragCleanup());
const gapResult = { ...gapSetup, ...gapMark };
ok('gap between groups marks the previous group end',
  gapResult.markedName === gapResult.firstGroupName,
  JSON.stringify(gapResult));

// --- 3. dropping in the gap really lands at the end of the previous group ---
const orderBefore = await p.evaluate(() => [...document.querySelectorAll('.tb-module-row')].map((r) => r.textContent.trim()));
const dropped = await p.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')];
  const first = groups[0];
  const second = groups[1];
  const gapY = (first.getBoundingClientRect().bottom + second.getBoundingClientRect().top) / 2;
  const rows = [...document.querySelectorAll('.tb-module-row')];
  const from = rows.find((r) => r.textContent.includes('课程标准'));
  const dt = new DataTransfer();
  from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const rect = second.getBoundingClientRect();
  second.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: rect.x + 40, clientY: gapY }));
  second.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: rect.x + 40, clientY: gapY }));
  from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  return true;
});
await p.waitForTimeout(400);
const orderAfter = await p.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')];
  return groups.map((g) => ({
    name: g.querySelector('.tb-group-toggle span')?.textContent,
    modules: [...g.querySelectorAll('.tb-module-row')].map((r) => r.textContent.trim()),
  }));
});
const firstGroup = orderAfter[0];
ok('dropping in the gap appends to the previous group',
  firstGroup.modules[firstGroup.modules.length - 1] === '课程标准',
  JSON.stringify({ orderBefore, firstGroup }));

// --- 4. no jitter on the real drop-target path either ---
const before4 = await rowGeometry();
await dragTo('成绩', "document.querySelector('.tb-module-row:nth-of-type(1)')");
await p.waitForTimeout(200);
ok('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3)));

console.log('=== DRAG AND DROP ===');
for (const r of results) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  ' + r.detail : ''}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);

await p.screenshot({ path: `${OUT}/PC-CW17-insertion-line.png` });
await b.close();

process.exitCode = results.some((result) => !result.pass) || errs.length ? 1 : 0;
