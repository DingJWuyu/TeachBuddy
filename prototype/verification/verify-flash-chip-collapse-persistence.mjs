/*
 * Session verification: client-side navigation with no document reload, the
 * circular drag image, the progressive group collapse, and layout persistence
 * across a reload and a direct deep link.
 *
 * Runs against the accepted prototype. From the repository root:
 *   npm run prototype:sidebar
 *   node prototype/verification/verify-flash-chip-collapse-persistence.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { evidencePaths } from './evidence-paths.mjs';
import { openWithLayout, openWorkbench, dismissCoach } from './session.mjs';

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?prototype=sidebar';
const paths = evidencePaths('verify-flash-chip-collapse-persistence');
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

const errors = [];
let browser;
let context;
let page;

// Each section has an independent browser context.
async function startSection() {
  await context?.close().catch(() => {});
  browser ??= await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await loadShell();
  // A section is only ready once the shell is actually painted, which is also the
  // last moment a renderer that is going to die does so.
  await page.waitForSelector('.tb-module-row', { timeout: 15000 });
  await page.waitForTimeout(300);
}

/**
 * Writes the evidence log and prints the tally.
 *
 * Called from the normal tail and from the uncaught-exception guard, so a run
 * that stops early still reports every check it got through instead of losing
 * them with the process.
 */
function report() {
  const status = results.some((line) => line.startsWith('FAIL')) ? 'failed' : 'passed';
  writeFileSync(`${RESULTS}verify-flash-chip-collapse-persistence${only ? `-section-${only}` : ''}${status === 'failed' ? '-failed' : ''}.txt`,
    `Scope: ${only ? `section ${only}` : 'all'}\nStatus: ${status}\n` + results.join('\n') + '\n');
  const failed = results.filter((line) => line.startsWith('FAIL'));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) console.log(failed.join('\n'));
}

process.on('uncaughtException', async (error) => {
  console.log(`\nharness stopped early: ${String(error).split('\n')[0]}`);
  console.log(error.stack?.split('\n').slice(1, 4).join('\n') ?? '');
  results.push(`FAIL suite interrupted: ${error.message}`);
  report();
  await browser?.close().catch(() => {});
  process.exit(1);
});

async function loadShell() {
  await openWorkbench(page, BASE);
  await page.evaluate(() => {
    window.__documentId = `doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  });
  await page.waitForTimeout(350);
  await dismissCoach(page);
  await page.waitForTimeout(150);
}

/*
 * A fresh, default layout per case, so no case inherits the previous one's order.
 * The store is cleared before the shell mounts, so one load per case is enough.
 *
 * The document marker is written after the load and is what the shell's
 * "navigation did not reload the document" checks compare against, so it has to
 * be stamped by whatever performs the load. Leaving it out makes both sides of
 * that comparison `undefined` and the checks pass for the wrong reason.
 */
async function resetLayout() {
  await openWithLayout(page, BASE, (key) => window.localStorage.removeItem(key));
  await page.evaluate(() => {
    window.__documentId = `doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  });
}

/** The marker of the document currently on screen, for reload comparisons. */
const documentId = async () => {
  const value = await page.evaluate(() => window.__documentId);
  if (typeof value !== 'string' || !value) throw new Error('Missing document identity probe');
  return value;
};

async function reloadShell() {
  await openWorkbench(page, page.url());
}

// Sections: 1 navigation, 2 drag chip, 3 drop targets, 4 collapse, 5 persistence.
const option = process.argv.find((arg) => arg.startsWith('--only='));
const only = option ? Number(option.slice(7)) : null;
if (option && (!Number.isInteger(only) || only < 1 || only > 5)) {
  console.error('--only must be a section number from 1 to 5');
  process.exit(2);
}
const wanted = (section) => !only || only === section;

/* ------------------------------------------------- 1. no document navigation */
if (wanted(1)) {
await startSection();
await resetLayout();
check('侧栏已渲染', await page.locator('.tb-sidebar').count(), 1);
await page.evaluate(() => {
  window.__shellId = Symbol.for('round3-shell');
  document.querySelector('.tb-sidebar').dataset.probe = 'kept';
});
const bootId = await documentId();
await page.click('.tb-global-nav a:nth-of-type(2)');
await page.waitForTimeout(500);
check('地址变为 /calendar', await page.evaluate(() => window.location.pathname), '/calendar');
check('入口查询参数保留', await page.evaluate(() => window.location.search), new URL(BASE).search);
check('页面标题跟随', await page.title(), 'TeachBuddy 工作台外壳原型 · 日历');
check('正文换成日历空页面', await page.textContent('.tb-empty-page h1'), '日历');
check(
  '侧栏节点没有被重建',
  await page.evaluate(() => document.querySelector('.tb-sidebar')?.dataset.probe),
  'kept'
);
check('点击导航没有重新加载文档', await documentId(), bootId);
check('侧栏仍然存在', await page.locator('.tb-sidebar').count(), 1);
check('顶栏仍然存在', await page.locator('.tb-topbar').count(), 1);
await page.screenshot({ path: `${OUT}PC-CW19-calendar-page.png` });

// the body is keyed, so a repeat visit still runs the entrance
await page.click('.tb-global-nav a:nth-of-type(1)');
await page.waitForTimeout(400);
check('回到首页', await page.evaluate(() => window.location.pathname), '/');
check('首页正文恢复', await page.locator('.tb-dashboard-grid').count(), 1);
check('返回首页也未重新加载文档', await documentId(), bootId);

check('后退仍然工作', await page.evaluate(async () => {
  window.history.back();
  await new Promise((resolve) => setTimeout(resolve, 400));
  return window.location.pathname;
}), '/calendar');
await page.goForward();
await page.waitForTimeout(400);
check('前进仍然工作', await page.evaluate(() => window.location.pathname), '/');


await page.click('[data-drop-module="planner"]');
await page.waitForTimeout(500);
check('点侧栏功能模块走到 /modules/planner', await page.evaluate(() => window.location.pathname), '/modules/planner');
check('点侧栏功能模块没有重新加载文档', await documentId(), bootId);
check('侧栏节点仍然没有被重建', await page.evaluate(() => document.querySelector('.tb-sidebar')?.dataset.probe), 'kept');
check('顶栏在侧栏导航后仍未被重建', await page.locator('.tb-topbar').count(), 1);
check('正文换成规划器空页面', await page.textContent('.tb-empty-page h1'), '规划器');
check('侧栏中的当前项高亮', await page.getAttribute('[data-drop-module="planner"]', 'aria-current'), 'page');
await page.screenshot({ path: `${OUT}PC-CW20-module-page.png` });

await page.click('[data-drop-module="grades"]');
await page.waitForTimeout(450);
check('连续在侧栏中点模块也不重载文档', await documentId(), bootId);
check('第二次点击也走到目标页', await page.evaluate(() => window.location.pathname), '/modules/grades');

}

/* ------------------------------------------------------------- 2. drag chip */
if (wanted(2)) {
await startSection();


const chipAt = async (selector, x, y) => page.evaluate(async ({ selector: source, x: px, y: py }) => {
  const node = document.querySelector(source);
  const transfer = new DataTransfer();
  node.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: px, clientY: py }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  const chip = document.querySelector('.tb-drag-chip');
  if (!chip) return { exists: false };
  const box = chip.getBoundingClientRect();
  const glyph = chip.querySelector('svg')?.getBoundingClientRect();
  const style = getComputedStyle(chip);
  return {
    exists: true,
    parent: chip.parentElement?.className.trim() ?? null,
    size: [Math.round(box.width), Math.round(box.height)],
    center: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)],
    glyphCenter: glyph ? [Math.round(glyph.left + glyph.width / 2), Math.round(glyph.top + glyph.height / 2)] : null,
    pointerEvents: style.pointerEvents,
    radius: style.borderRadius,
    background: style.backgroundColor,
    bodyClass: document.body.className
  };
}, { selector, x, y });

const moduleChip = await chipAt('[data-drop-module="planner"]', 300, 400);
check('拖拽时创建了拖拽图', moduleChip.exists, true);
check('拖拽图挂在原型根节点内（样式作用域）', moduleChip.parent, 'tb-prototype');
check('拖拽图尺寸 32x32', JSON.stringify(moduleChip.size), JSON.stringify([32, 32]));
check('拖拽图不接指针', moduleChip.pointerEvents, 'none');
check('拖拽图是圆的', moduleChip.radius, '50%');
check('拖拽图是白色圆', moduleChip.background, 'rgb(255, 255, 255)');
check('圆正好居中在指针上', JSON.stringify(moduleChip.center), JSON.stringify([300, 400]));
check('图标也居中在圆心上', JSON.stringify(moduleChip.glyphCenter), JSON.stringify([300, 400]));
check('拖拽期间给 body 打了标记（光标用它切换）', moduleChip.bodyClass.includes('is-dragging-item'), true);
await page.screenshot({ path: `${OUT}PC-CW23-drag-chip-module.png`, clip: { x: 240, y: 340, width: 120, height: 120 } });

// it follows the pointer rather than staying where the drag began
const moved = await page.evaluate(async () => {
  const transfer = new DataTransfer();
  const chip = document.querySelector('.tb-drag-chip');
  window.dispatchEvent(new DragEvent('dragover', { bubbles: false, cancelable: true, dataTransfer: transfer, clientX: 720, clientY: 250 }));
  await new Promise((resolve) => setTimeout(resolve, 120));
  const box = chip.getBoundingClientRect();
  return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
});
check('拖拽图跟随指针移动', JSON.stringify(moved), JSON.stringify([720, 250]));

await page.evaluate(() => {
  document.querySelector('[data-drop-module="planner"]').dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: new DataTransfer() }));
});
await page.waitForTimeout(200);
check('拖拽结束后拖拽图被移除', await page.evaluate(() => document.querySelectorAll('.tb-drag-chip').length), 0);
check('拖拽结束后 body 标记被清掉', await page.evaluate(() => document.body.className.includes('is-dragging-item')), false);

// a group drag carries the folder icon
const groupChip = await chipAt('.tb-group-heading', 500, 300);
check('分组拖拽也生成拖拽图', groupChip.exists, true);
check('分组拖拽图同样居中在指针上', JSON.stringify(groupChip.center), JSON.stringify([500, 300]));
await page.evaluate(() => {
  document.querySelector('.tb-group-heading').dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: new DataTransfer() }));
});
await page.waitForTimeout(200);

// a read notification drags with the same disc
await page.click('[data-surface="notifications"]');
await page.waitForTimeout(350);
await page.evaluate(() => {
  const row = document.querySelector('.tb-notification');
  row.click();
});
await page.waitForTimeout(300);
const notificationChip = await page.evaluate(async () => {
  const row = document.querySelector('.tb-notification');
  const transfer = new DataTransfer();
  row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 900, clientY: 200 }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  const chip = document.querySelector('.tb-drag-chip');
  const box = chip?.getBoundingClientRect();
  return box ? { center: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)], size: [Math.round(box.width), Math.round(box.height)] } : null;
});
check('通知拖拽图同样是 32x32 且居中', JSON.stringify(notificationChip), JSON.stringify({ center: [900, 200], size: [32, 32] }));
await page.evaluate(() => {
  document.querySelector('.tb-notification').dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: new DataTransfer() }));
});
await page.waitForTimeout(200);
}


/* ------------------------------------------------- 3. drop at the top of a group */
if (wanted(3)) {
await startSection();
/*
 * The gesture is driven by dispatched drag events carrying an exact clientY,
 * not by Playwright's mouse. A mouse drag is not reproducible enough here: the
 * browser routes dragover to whatever is under the real pointer, and the
 * pointer does not travel the path the test asked for, so the coordinates a
 * case aims at are not the coordinates the shell resolves. The events below are
 * the same ones a real drag delivers, with the position made explicit.
 */
const groupOrder = () => page.$$eval(
  '[data-drop-group="assessment-group"] .tb-module-row',
  (rows) => rows.map((row) => row.dataset.dropModule)
);

const readMark = () => page.evaluate(() => {
  const before = document.querySelector('.is-drop-before');
  const after = document.querySelector('.is-drop-after');
  if (before) return { kind: 'before', moduleId: before.dataset.dropModule };
  if (after) return { kind: 'after', moduleId: after.dataset.dropModule };
  if (document.querySelector('.is-module-end-target')) return { kind: 'groupEnd', moduleId: null };
  return null;
});

/*
 * Where the mark puts the dragged module, as an insertion index in the group's
 * order.
 *
 * The index has to be resolved against the list as it stood while the pointer
 * was down, because that is the list the line was drawn on: the dragged row
 * leaves the flow as soon as the gesture starts, so every row below it moves up
 * one. Reading the line as "before the row after the dropped module" is what
 * makes a correct drop look wrong.
 */
function indexFromMark(mark, preExtractionOrder, dragId) {
  if (!mark) return null;
  const source = preExtractionOrder.indexOf(dragId);
  const place = (index) => (source >= 0 && source < index ? index - 1 : index);
  if (mark.kind === 'groupEnd') return place(preExtractionOrder.length - 1);
  const anchor = preExtractionOrder.indexOf(mark.moduleId);
  if (anchor < 0) return null;
  return place(mark.kind === 'before' ? anchor : anchor + 1);
}

/** The same insertion index, read off the layout after the drop. */
function indexFromOrder(order, dragId) {
  return order.indexOf(dragId);
}

/**
 * Runs one drag: starts it on `sourceModule`, hovers over the target group at
 * `offsetY` from `anchorSelector`'s top, marks the drop, releases it, and
 * reports where the module ended up.
 */
async function dragCase(label, sourceModule, anchorSelector, offsetY) {
  await resetLayout();
  const preExtractionOrder = await groupOrder();
  const geometry = await page.evaluate(({ anchorSelector: anchor }) => {
    const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
    return { anchorTop: Math.round(rect(anchor).top), groupTop: Math.round(rect('[data-drop-group="assessment-group"]').top) };
  }, { anchorSelector });
  const clientY = geometry.anchorTop + offsetY;
  const result = await page.evaluate(async ({ sourceModule: source, clientY: y }) => {
    const row = document.querySelector(`[data-drop-module="${source}"]`);
    const section = document.querySelector('[data-drop-group="assessment-group"]');
    /*
     * The insertion line lives in a class that React writes after the dragover
     * handler runs, so it is watched rather than sampled: the interesting fact is
     * that the line was painted at all, and one instant's snapshot misses it.
     */
    const painted = { mark: null, seen: false };
    const observer = new MutationObserver(() => {
      const before = document.querySelector('.is-drop-before');
      const after = document.querySelector('.is-drop-after');
      if (before || after || document.querySelector('.is-module-end-target')) painted.seen = true;
      painted.mark = before
        ? { kind: 'before', moduleId: before.dataset.dropModule }
        : after
          ? { kind: 'after', moduleId: after.dataset.dropModule }
          : (document.querySelector('.is-module-end-target') ? { kind: 'groupEnd', moduleId: null } : painted.mark);
    });
    observer.observe(section, { subtree: true, attributes: true, attributeFilter: ['class'] });

    const transfer = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y }));
    await new Promise((resolve) => setTimeout(resolve, 60));
    const over = { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y };
    const target = document.elementFromPoint(
      section.getBoundingClientRect().left + 40,
      Math.min(y, window.innerHeight - 2)
    ) || section;
    target.dispatchEvent(new DragEvent('dragover', over));
    await new Promise((resolve) => setTimeout(resolve, 120));
    target.dispatchEvent(new DragEvent('drop', over));
    row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    observer.disconnect();
    return { on: target.dataset.dropModule ?? String(target.className).trim(), painted };
  }, { sourceModule, clientY });

  const mark = result.painted.mark;
  await page.waitForTimeout(150);
  const order = await groupOrder();
  return {
    label,
    clientY,
    on: result.on,
    mark,
    painted: result.painted.seen,
    expected: indexFromMark(mark, preExtractionOrder, sourceModule),
    landed: indexFromOrder(order, sourceModule),
    order
  };
}

/*
 * Each case drags a module from another group, so the group the pointer is over
 * keeps its geometry while the gesture is in flight.
 */
const cases = [
  await dragCase('分组标题中部', 'planner', '[data-drop-group="assessment-group"] .tb-group-heading', 12),
  await dragCase('分组标题上沿', 'planner', '[data-drop-group="assessment-group"] .tb-group-heading', 1),
  await dragCase('首行上半部', 'planner', '[data-drop-module="grades"]', 6),
  await dragCase('首行下半部', 'planner', '[data-drop-module="grades"]', 30),
  await dragCase('第三行上半部', 'planner', '[data-drop-module="attendance"]', 6),
  await dragCase('末行下半部', 'planner', '[data-drop-module="attendance"]', 32)
];

for (const item of cases) {
  console.log(`  ${item.label}: y=${item.clientY} on=${item.on} mark=${JSON.stringify(item.mark)} expectedIndex=${item.expected} landedIndex=${item.landed} order=${JSON.stringify(item.order)}`);
}

/*
 * What each case asserts:
 *
 *   - the drop lands on the slot the insertion line marked, which is the thing a
 *     user sees and the thing the drop-time re-resolution got wrong;
 *   - the top of a group is reachable at all, which is the reported bug;
 *   - dropping below the last row still appends instead of jumping a group.
 *
 * The absolute slot is not pinned for every case: the dragged row leaves the
 * flex flow as soon as the gesture starts, so the rows below it move up by one
 * and the slot a given screen position means shifts with them. The mark is read
 * from the live DOM for exactly that reason.
 */
check('每个用例都画出了插入线', cases.every((item) => item.painted), true);
for (const item of cases) {
  check(`${item.label}：落点与插入线一致`, item.landed, item.expected);
}

check('拖到分组标题：模块排到第一位（回归修复）', JSON.stringify(cases[0].order), JSON.stringify(['planner', 'grades', 'attendance', 'standards']));
check('拖到标题上沿：模块排到第一位（回归修复）', JSON.stringify(cases[1].order), JSON.stringify(['planner', 'grades', 'attendance', 'standards']));
check('拖到首行上半部：模块排到第一位', JSON.stringify(cases[2].order), JSON.stringify(['planner', 'grades', 'attendance', 'standards']));
check('拖到首行下半部：模块没有排到第一位', cases[3].order.indexOf('planner') > 0, true);
check('拖到第三行上半部：模块落在第三行之前', cases[4].order.indexOf('planner') > 0 && cases[4].order.indexOf('planner') < cases[4].order.indexOf('attendance'), true);
check('拖到末行下半部：模块落在末行之后', cases[5].order.indexOf('planner') > cases[5].order.indexOf('attendance'), true);
}

/* ------------------------------------------------------ 4. group collapse */
if (wanted(4)) {
await startSection();
const collapse = await page.evaluate(async () => {
  const wrapper = document.querySelector('.tb-module-collapse');
  const toggle = document.querySelector('.tb-group-toggle');
  const samples = [];
  const start = performance.now();
  toggle.click();
  await new Promise((resolve) => {
    function frame() {
      const style = getComputedStyle(wrapper);
      samples.push({
        t: Math.round(performance.now() - start),
        rows: style.gridTemplateRows,
        height: +document.querySelector('.tb-module-clip').getBoundingClientRect().height.toFixed(1)
      });
      if (performance.now() - start < 420) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
  const distinct = new Set(samples.map((sample) => sample.height)).size;
  return {
    distinct,
    first: samples[0].height,
    last: samples.at(-1).height,
    hasCollapsedClass: wrapper.classList.contains('is-collapsed'),
    rowsAtStart: samples[0].rows,
    inert: document.querySelector('.tb-module-clip').hasAttribute('inert')
  };
});
check('折叠过程是插值的（多于 3 个中间高度）', collapse.distinct > 3, true);
check('折叠从有高度开始', collapse.first > 20, true);
check('折叠结束到 0 高度', collapse.last, 0);
check('折叠后带 is-collapsed', collapse.hasCollapsedClass, true);
check('折叠后内容退出可达树', collapse.inert, true);
check('折叠首帧不是 0fr（即不是瞬时）', collapse.rowsAtStart !== '0fr', true);
check('折叠动画时长 220ms', await page.evaluate(() => getComputedStyle(document.querySelector('.tb-module-collapse')).transitionDuration), '0.22s');

const expand = await page.evaluate(async () => {
  const wrapper = document.querySelector('.tb-module-collapse');
  const toggle = document.querySelector('.tb-group-toggle');
  const samples = [];
  const start = performance.now();
  toggle.click();
  await new Promise((resolve) => {
    function frame() {
      samples.push(+document.querySelector('.tb-module-clip').getBoundingClientRect().height.toFixed(1));
      if (performance.now() - start < 420) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
  return { distinct: new Set(samples).size, last: samples.at(-1), collapsed: wrapper.classList.contains('is-collapsed'), inert: document.querySelector('.tb-module-clip').hasAttribute('inert') };
});
check('展开过程也是插值的', expand.distinct > 3, true);
check('展开后恢复高度', expand.last > 20, true);
check('展开后移除 is-collapsed', expand.collapsed, false);
check('展开后恢复可达', expand.inert, false);

}

/* -------------------------------------------------------- 5. layout persists */
if (wanted(5)) {
await startSection();
await page.evaluate(() => window.localStorage.removeItem('teachbuddy-prototype-layout'));
await loadShell();

const before = await page.evaluate(() => ({
  order: [...document.querySelectorAll('.tb-module-row')].map((row) => row.dataset.dropModule),
  trash: document.querySelector('.tb-trash-target b')?.textContent || '0'
}));

// hide one module through the keyboard path, and collapse a group
await page.evaluate(() => {
  const row = document.querySelector('[data-drop-module="planner"]');
  row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
});
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelectorAll('.tb-group-toggle')[1].click());
await page.waitForTimeout(400);
// and move a module up one slot
await page.evaluate(() => {
  const row = document.querySelector('[data-drop-module="students"]');
  row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
});
await page.waitForTimeout(300);

const arranged = await page.evaluate(() => ({
  order: [...document.querySelectorAll('.tb-module-row')].map((row) => row.dataset.dropModule),
  trash: document.querySelector('.tb-trash-target b')?.textContent || '0',
  collapsed: [...document.querySelectorAll('.tb-module-collapse')].map((node) => node.classList.contains('is-collapsed'))
}));
check('隐藏后垃圾桶计数为 1', arranged.trash, '1');

// reload: same arrangement, and a different page keeps it too
await reloadShell();
await dismissCoach(page);
await page.waitForTimeout(250);
const afterReload = await page.evaluate(() => ({
  order: [...document.querySelectorAll('.tb-module-row')].map((row) => row.dataset.dropModule),
  trash: document.querySelector('.tb-trash-target b')?.textContent || '0',
  collapsed: [...document.querySelectorAll('.tb-module-collapse')].map((node) => node.classList.contains('is-collapsed'))
}));
check('刷新后模块顺序保留', JSON.stringify(afterReload.order), JSON.stringify(arranged.order));
check('刷新后隐藏状态保留', afterReload.trash, '1');
check('刷新后分组折叠状态保留', JSON.stringify(afterReload.collapsed), JSON.stringify(arranged.collapsed));
check('刷新后顺序确实与默认不同', JSON.stringify(afterReload.order) !== JSON.stringify(before.order), true);

await page.click('.tb-global-nav a:nth-of-type(2)');
await page.waitForTimeout(500);
check('换页后布局仍在（未重载文档）', await page.evaluate(() => document.querySelector('.tb-trash-target b')?.textContent || '0'), '1');
await openWorkbench(page, new URL(`/calendar${new URL(BASE).search}`, BASE).href);
await page.waitForTimeout(900);
await dismissCoach(page);
await page.waitForTimeout(250);
check('直接以 /calendar 打开也保留布局', await page.evaluate(() => document.querySelector('.tb-trash-target b')?.textContent || '0'), '1');
check('直接打开时侧栏顺序保留', await page.evaluate(() => JSON.stringify([...document.querySelectorAll('.tb-module-row')].map((row) => row.dataset.dropModule))), JSON.stringify(arranged.order));

// a corrupt stored layout falls back instead of breaking the shell
await openWithLayout(page, BASE, (key) => window.localStorage.setItem(key, '{"version":1,"layout":{"groups":"nope"}}'));
check('损坏的存储数据回落到默认布局', await page.evaluate(() => document.querySelectorAll('.tb-module-row').length), 9);

await page.evaluate(() => localStorage.removeItem('teachbuddy-prototype-layout'));

}

check('无脚本错误', errors.length === 0);
if (errors.length) console.log(errors.join('\n'));
await browser.close();
report();
process.exit(results.some((line) => line.startsWith('FAIL')) ? 1 : 0);
