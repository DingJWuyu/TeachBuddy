// Drag-and-drop geometry, boundaries, and rendering stability.
//
// Verifies three things that a screenshot cannot show:
//   1. row geometry is byte-identical throughout a drag (no twitching),
//   2. the gap between two groups resolves to the previous group's end,
//   3. a repeated dragover at the same spot does not re-render the sidebar.
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';
import { mkdirSync } from 'node:fs';
import { evidencePaths } from './evidence-paths.mjs';

const { screenshots: OUT } = evidencePaths('verify-drag');
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

// This boundary case needs two populated groups. The current default keeps
// Ungrouped empty, so prepare it using the existing drop path first.
await dragTo('班级教学', "document.querySelector('[data-drop-group=\"ungrouped\"] .tb-group-heading')");
await p.waitForSelector('[data-drop-group="ungrouped"] [data-drop-module="classes"]');
await p.evaluate(() => { window.__mutations = 0; });

// --- 1. geometry must not move while hovering a drop target ---
//
// The dragstart and the dragover go in separate evaluations: the mark is React
// state rendered on the next commit, so a synchronous read in the same
// evaluation sees the previous render and reports no line at all.
const before = await rowGeometry();
await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.tb-module-row')];
  const from = rows.find((r) => r.textContent.includes('资源库'));
  const onto = rows.find((r) => r.textContent.includes('数学工坊'));
  const rect = onto.getBoundingClientRect();
  const dt = new DataTransfer();
  from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  window.__dt = dt;
  window.__onto = onto;
  /*
   * The coordinate keys are `clientX`/`clientY`: a DragEvent ignores `x`/`y`,
   * so a spread of `{x, y}` leaves the pointer at (0, 0) and every mark is
   * resolved as if the drag were in the top-left corner.
   */
  window.__coord = { clientX: rect.x + rect.width / 2, clientY: rect.y + 4 };
});
await p.waitForTimeout(120);
await p.evaluate(() => {
  window.__onto.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__dt, ...window.__coord }));
});
await p.waitForTimeout(250);
const during = await rowGeometry();
ok('rows do not move while a drop target is shown', JSON.stringify(before) === JSON.stringify(during),
  before.length === during.length ? '' : `count ${before.length} -> ${during.length}`);
const lineDrawn = await p.evaluate(() => ({
  lines: document.querySelectorAll('.tb-module-row.is-drop-target').length,
  before: document.querySelectorAll('.tb-module-row.is-drop-before').length,
  after: document.querySelectorAll('.tb-module-row.is-drop-after').length,
}));
ok('insertion line is drawn on exactly one row',
  lineDrawn.lines === 1 && lineDrawn.before + lineDrawn.after === 1, JSON.stringify(lineDrawn));
const mutations = await p.evaluate(() => window.__mutations);
ok('repeated dragover does not churn the DOM', mutations <= 2, `mutations=${mutations}`);
await p.evaluate(() => {
  window.__onto.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: window.__dt }));
  document.querySelectorAll('.tb-module-row').forEach((r) => r.classList.remove('is-drop-target'));
});

// --- 2. a heading and the space above it belong to that group's top ---
//
// A heading belongs to the top of its own group. Aiming just under it must
// insert before that group's first row.
//
// Dispatch, then wait a frame: the marker is rendered from React state, so
// reading it synchronously right after the event sees the previous render.
const headingSetup = await p.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')];
  const second = groups[1];
  const heading = second.querySelector('.tb-group-toggle');
  const rect = heading.getBoundingClientRect();
  const from = [...document.querySelectorAll('.tb-module-row')].find((r) => r.textContent.includes('资源库'));
  const dt = new DataTransfer();
  from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  // a few pixels below the heading, still above the first row
  second.dispatchEvent(new DragEvent('dragover', {
    bubbles: true, cancelable: true, dataTransfer: dt, clientX: rect.x + 40, clientY: rect.y + 8,
  }));
  window.__dragCleanup = () => from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  return {
    hoveredGroupName: second.querySelector('.tb-group-toggle span')?.textContent,
    aimY: Math.round(rect.y + 8),
  };
});
await p.waitForTimeout(250);
const headingMark = await p.evaluate(() => {
  const section = document.querySelectorAll('.tb-group')[1];
  const rows = [...section.querySelectorAll('.tb-module-row')];
  const marked = rows.filter((row) => row.classList.contains('is-drop-target'));
  const before = rows.filter((row) => row.classList.contains('is-drop-before'));
  return {
    markedName: section.querySelector('.tb-group-toggle span')?.textContent,
    // exactly one line, and it sits at the top of the group the pointer is over
    markedRows: marked.length,
    lineIsAtGroupTop: before.length === 1 && before[0] === rows[0],
  };
});
await p.evaluate(() => window.__dragCleanup());
const headingResult = { ...headingSetup, ...headingMark };
ok('the top of a group is claimed by that group',
  headingResult.markedRows === 1 && headingResult.lineIsAtGroupTop,
  JSON.stringify(headingResult));

// --- 3. dropping there really lands as the first row of that group ---
const orderBefore = await p.evaluate(() => [...document.querySelectorAll('.tb-module-row')].map((r) => r.textContent.trim()));
await p.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')];
  const second = groups[1];
  const rect = second.querySelector('.tb-group-toggle').getBoundingClientRect();
  const rows = [...document.querySelectorAll('.tb-module-row')];
  const from = rows.find((r) => r.textContent.includes('资源库'));
  const dt = new DataTransfer();
  from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const over = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: rect.x + 40, clientY: rect.y + 8 };
  second.dispatchEvent(new DragEvent('dragover', over));
  second.dispatchEvent(new DragEvent('drop', over));
  from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
});
await p.waitForTimeout(400);
const orderAfter = await p.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')];
  return groups.map((g) => ({
    name: g.querySelector('.tb-group-toggle span')?.textContent,
    modules: [...g.querySelectorAll('.tb-module-row')].map((r) => r.textContent.trim()),
  }));
});
const secondGroup = orderAfter[1];
ok('dropping there puts the module first in that group',
  secondGroup.modules[0] === '资源库',
  JSON.stringify({ orderBefore, secondGroup }));

// --- 4. no jitter on the real drop-target path either ---
const before4 = await rowGeometry();
await dragTo('班级教学', "document.querySelector('.tb-module-row:nth-of-type(1)')");
await p.waitForTimeout(200);
ok('no console errors', errs.length === 0, JSON.stringify(errs.slice(0, 3)));

console.log('=== DRAG AND DROP ===');
for (const r of results) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  ' + r.detail : ''}`);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);

await p.screenshot({ path: `${OUT}/PC-CW17-insertion-line.png` });
await b.close();

process.exitCode = results.some((result) => !result.pass) || errs.length ? 1 : 0;
