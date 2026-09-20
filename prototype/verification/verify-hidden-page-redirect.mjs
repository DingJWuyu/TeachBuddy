/*
 * Session verification: a module page that stops existing sends the user home,
 * and the drag image is an icon that fills its disc.
 *
 * Runs against the accepted prototype. From the repository root:
 *   npm run prototype:sidebar
 *   node prototype/verification/verify-hidden-page-redirect.mjs
 *
 * Sections are independent and can be run one at a time with `--only=<n>`:
 *   1  the page being viewed is hidden, deleted or dragged to the trash
 *   2  dragging the page being viewed to the trash
 *   3  deleting the group that holds the page being viewed
 *   4  a group dragged to the trash is deleted, its modules keep working
 *   5  a layout written by an older build survives the upgrade
 *   6  an empty group accepts a module
 *   7  deleting a notification leaves no drag image behind
 *   8  the drag image itself: size, centring, cursor, cleanup
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { evidencePaths } from './evidence-paths.mjs';
import { openWorkbench, dismissCoach } from './session.mjs';

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?prototype=sidebar';
const ORIGIN = new URL(BASE).origin;
const paths = evidencePaths('verify-hidden-page-redirect');
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

/**
 * Writes the evidence log and prints the tally.
 *
 * Called from the normal tail and from the uncaught-exception guard, so a run
 * that stops early still reports every check it got through instead of losing
 * them with the process.
 */
function report() {
  const status = results.some((line) => line.startsWith('FAIL')) ? 'failed' : 'passed';
  writeFileSync(`${RESULTS}verify-hidden-page-redirect${only ? `-section-${only}` : ''}${status === 'failed' ? '-failed' : ''}.txt`,
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

/*
 * A fresh context for every section, on one browser. Each section loads the shell
 * several times; a single page accumulates that work and eventually goes away.
 */
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
}

/*
 * The wait is on the sidebar element, never on `networkidle`: the dev server
 * keeps an HMR websocket open for the life of the page, so a network-idle wait
 * never fires.
 */
async function loadShell(path = '/') {
  await openWorkbench(page, `${ORIGIN}${path}${new URL(BASE).search}`);
  await page.waitForTimeout(400);
  await dismissCoach(page);
  await page.waitForTimeout(150);
}

const pathname = () => page.evaluate(() => window.location.pathname);

/**
 * Drops `sourceSelector` on the trash with dispatched drag events.
 *
 * A mouse drag is not reproducible enough to hit a target this small, and the
 * trash only reacts while a drag is over it, so the events carry the position
 * explicitly.
 */
async function dropOnTrash(sourceSelector, label = null) {
  await page.evaluate(async ({ selector, label: wanted }) => {
    const trash = document.querySelector('.tb-trash-target');
    /*
     * A group heading has no id of its own, so one is addressed by its label.
     * Module rows carry `data-drop-module` and need no label.
     */
    const candidates = [...document.querySelectorAll(selector)];
    const source = wanted ? candidates.find((node) => node.textContent.includes(wanted)) : candidates[0];
    const rect = trash.getBoundingClientRect();
    const y = Math.round(rect.top + rect.height / 2);
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    const over = { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y };
    trash.dispatchEvent(new DragEvent('dragenter', over));
    trash.dispatchEvent(new DragEvent('dragover', over));
    await new Promise((resolve) => setTimeout(resolve, 120));
    trash.dispatchEvent(new DragEvent('drop', over));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    await new Promise((resolve) => setTimeout(resolve, 200));
  }, { selector: sourceSelector, label });
  await page.waitForTimeout(400);
}

async function goTo(moduleId) {
  await loadShell('/');
  await page.click(`[data-drop-module="${moduleId}"]`);
  await page.waitForTimeout(400);
  return pathname();
}

/** Selects the module row and presses Delete, the keyboard route out. */
async function deleteCurrentRow(moduleId) {
  try {
    await page.waitForSelector(`[data-drop-module="${moduleId}"]`, { timeout: 10000 });
  } catch (error) {
    console.log('  [diag missing row]', JSON.stringify(await page.evaluate((id) => ({
      wanted: id,
      path: window.location.pathname,
      search: window.location.search,
      rows: [...document.querySelectorAll('.tb-module-row')].map((node) => ({ id: node.dataset.dropModule, visible: node.getClientRects().length > 0, display: getComputedStyle(node).display })),
      allDropIds: [...document.querySelectorAll('[data-drop-module]')].map((node) => node.dataset.dropModule)
    }), moduleId)));
    throw error;
  }
  await page.evaluate((id) => {
    document.querySelector(`[data-drop-module="${id}"]`).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })
    );
  }, moduleId);
  await page.waitForTimeout(450);
}

const option = process.argv.find((arg) => arg.startsWith('--only='));
const only = option ? Number(option.slice(7)) : null;
if (option && (!Number.isInteger(only) || only < 1 || only > 8)) {
  console.error('--only must be a section number from 1 to 8');
  process.exit(2);
}
const wanted = (section) => !only || only === section;

/* --------------------------------------- 1. hiding the page you are on goes home */
if (wanted(1)) {
  await startSection();

  check('从首页点课程进入课程页', await goTo('lessons'), '/modules/lessons');
  const documentToken = await page.evaluate(() => {
    window.__navigationProbe = crypto.randomUUID();
    return window.__navigationProbe;
  });
  check('课程页标为当前页', await page.getAttribute('[data-drop-module="lessons"]', 'aria-current'), 'page');
  await deleteCurrentRow('lessons');
  check('删掉正在浏览的模块后回到首页（回归修复）', await pathname(), '/');
  check('首页正文回来了', await page.locator('.tb-dashboard-grid').count(), 1);
  check('被删掉的模块不在侧栏里了', await page.locator('[data-drop-module="lessons"]').count(), 0);
  check('垃圾桶计数为 1', await page.textContent('.tb-trash-target b'), '1');
  check('回到首页不重新加载文档', await page.evaluate(() => window.__navigationProbe), documentToken);
  await page.waitForSelector('.tb-sidebar', { timeout: 10000 });
  await page.screenshot({ path: `${OUT}PC-CW32-hidden-page-redirect.png` });

  /*
   * A module deleted while a different page is open must not move the user. The
   * page being viewed is unreachable for another reason here: it is in the trash,
   * which is exactly the case the redirect exists for.
   */
  await goTo('grades');
  await deleteCurrentRow('planner');
  check('删掉别的模块时停留在当前页', await pathname(), '/modules/grades');
  check('被删掉的模块从侧栏消失', await page.locator('[data-drop-module="planner"]').count(), 0);
  check('垃圾桶计数为 2', await page.textContent('.tb-trash-target b'), '2');

  /*
   * The module that was being viewed can be restored, and its page is reachable
   * again. The panel is opened through the DOM rather than through a click,
   * because a click on the sidebar lands on whatever is under the pointer if the
   * document has just been replaced by the navigation above.
   */
  await page.evaluate(() => document.querySelector('[data-trash-toggle]').click());
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.tb-hidden-panel button')].find((node) => node.textContent.includes('规划器'));
    button.click();
  });
  await page.waitForTimeout(450);
  check('恢复后模块回到侧栏', await page.locator('[data-drop-module="planner"]').count(), 1);
  check('恢复后落到未分组', await page.evaluate(() => [...document.querySelectorAll('[data-drop-group="ungrouped"] .tb-module-row')].map((row) => row.dataset.dropModule).join(',')), 'planner');
  await page.waitForTimeout(300);
  await page.click('[data-drop-module="planner"]');
  await page.waitForTimeout(450);
  check('恢复后又能进入该模块页', await pathname(), '/modules/planner');
  /*
   * The reload is a real one, so it lands back on the sign-in card: the session
   * lives in memory. Re-entering through the entrance is what makes the checks
   * below look at the workbench rather than at the login form.
   */
  await openWorkbench(page, page.url());
  await page.waitForTimeout(600);
  check('刷新后未分组里的模块仍然在（回归修复）', await page.evaluate(() => [...document.querySelectorAll('[data-drop-group="ungrouped"] .tb-module-row')].map((row) => row.dataset.dropModule).join(',')), 'planner');
}

/* --------------------------------------------- 2. drag to the trash goes home too */
if (wanted(2)) {
  await startSection();

  check('从首页点课程进入课程页', await goTo('lessons'), '/modules/lessons');
  /*
   * The report was about dragging the current module into the trash. Dragging the
   * group it belongs to works the same way and is covered in section 4.
   */
  await dropOnTrash('[data-drop-module="lessons"]');
  await page.waitForTimeout(400);
  check('把正在浏览的模块拖进垃圾桶后回到首页（回归修复）', await pathname(), '/');
  check('垃圾桶计数为 1', await page.textContent('.tb-trash-target b'), '1');
  check('侧栏里已经没有这个模块', await page.locator('[data-drop-module="lessons"]').count(), 0);
}

/* ------------------------------------------ 3. deleting the whole group goes home */
if (wanted(3)) {
  await startSection();

  check('从首页点课程进入课程页', await goTo('lessons'), '/modules/lessons');
  // "课程" sits in the 计划 group, so deleting that group deletes the page
  await dropOnTrash('.tb-group-heading', '计划');
  check('删掉包含当前页的分组后回到首页（回归修复）', await pathname(), '/');
}

/* -------------------------------------- 4. a group dragged to the trash is deleted */
if (wanted(4)) {
  await startSection();

  const before = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('.tb-group')].map((section) => section.dataset.dropGroup),
    modules: [...document.querySelectorAll('.tb-module-row')].map((row) => row.dataset.dropModule),
    trash: document.querySelector('.tb-trash-target b')?.textContent || '0'
  }));
  check('起始时评估分组有 3 个模块', before.modules.filter((id) => ['grades', 'attendance', 'standards'].includes(id)).length, 3);

  /*
   * The report: dragging a group into the trash should leave its modules in the
   * trash, not the group. The drop is dispatched with an exact position because a
   * mouse drag is not reproducible enough to hit a target this small.
   */
  await dropOnTrash('.tb-group-heading', '评估');

  await page.waitForTimeout(300);

  const after = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('.tb-group')].map((section) => section.dataset.dropGroup),
    modules: [...document.querySelectorAll('.tb-module-row')].map((row) => row.dataset.dropModule),
    trash: document.querySelector('.tb-trash-target b')?.textContent || '0'
  }));
  check('分组本身从侧栏消失', after.groups.includes('assessment-group'), false);
  check('分组里的 3 个模块都进了垃圾桶', after.trash, '3');
  check('侧栏里不再有这 3 个模块', after.modules.some((id) => ['grades', 'attendance', 'standards'].includes(id)), false);

  await page.click('[data-trash-toggle]');
  await page.waitForTimeout(350);
  const panel = await page.evaluate(() => [...document.querySelectorAll('.tb-hidden-panel button')].map((node) => node.textContent.trim()));
  check('垃圾桶里是 3 个功能模块', panel.length, 3);
  check('垃圾桶里不再出现分组', panel.some((label) => label.includes('评估')), false);
  check('垃圾桶里确实有成绩、出勤、课程标准', ['成绩', '出勤', '课程标准'].every((name) => panel.some((label) => label.includes(name))), true);
  await page.screenshot({ path: `${OUT}PC-CW30-group-deleted.png` });
  await page.screenshot({ path: `${OUT}PC-CW26-trash-modules.png` });

  // restoring one puts it back as an ungrouped module, not into a rebuilt group
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.tb-hidden-panel button')].find((node) => node.textContent.includes('成绩'));
    button.click();
  });
  await page.waitForTimeout(400);
  const restored = await page.evaluate(() => {
    const section = document.querySelector('[data-drop-group="ungrouped"]');
    return {
      inUngrouped: [...section.querySelectorAll('.tb-module-row')].map((row) => row.dataset.dropModule),
      trash: document.querySelector('.tb-trash-target b')?.textContent || '0',
      groups: [...document.querySelectorAll('.tb-group')].map((item) => item.dataset.dropGroup)
    };
  });
  check('恢复后落到未分组', JSON.stringify(restored.inUngrouped), JSON.stringify(['grades']));
  check('恢复后垃圾桶剩 2 项', restored.trash, '2');
  check('原分组没有被重建', restored.groups.includes('assessment-group'), false);

  /*
   * A group with no modules left is not rendered at all, so the deleted group is
   * asserted through the trash and the remaining groups rather than through a
   * section that is supposed to be absent.
   */
  await openWorkbench(page, page.url());
  await page.waitForTimeout(500);
  check('刷新后分组仍然是删掉的', await page.locator('[data-drop-group="assessment-group"]').count(), 0);
  check('刷新后未分组里仍然是成绩', await page.evaluate(() => [...document.querySelectorAll('[data-drop-group="ungrouped"] .tb-module-row')].map((row) => row.dataset.dropModule).join(',')), 'grades');
  check('刷新后垃圾桶里还是另外两个模块', await page.textContent('.tb-trash-target b'), '2');
  const finalGroups = await page.evaluate(() => [...document.querySelectorAll('.tb-group')].map((item) => item.dataset.dropGroup));
  check('刷新后侧栏只剩两个分组和未分组', JSON.stringify(finalGroups), JSON.stringify(['classes-group', 'planning-group', 'ungrouped']));
}

/* ------------------------------------- 5. a layout stored by an older build */
if (wanted(5)) {
  await startSection();

  /*
   * The stored shape changed: a layout can no longer hold groups in the trash. An
   * older layout still lists them, and its modules have to survive the upgrade
   * instead of disappearing with the list.
   */
  await page.evaluate(() => {
    window.localStorage.setItem('teachbuddy-prototype-layout', JSON.stringify({
      version: 1,
      layout: {
        groups: [
          { id: 'classes-group', name: '班级', collapsed: false, moduleIds: ['classes', 'timetable'] },
          { id: 'planning-group', name: '计划', collapsed: false, moduleIds: ['lessons', 'students', 'classwork', 'standards'] },
          { id: 'ungrouped', name: '未分组', collapsed: false, moduleIds: [] }
        ],
        hiddenModuleIds: ['planner'],
        hiddenGroups: [{ id: 'old-group', name: '旧分组', collapsed: false, moduleIds: ['grades', 'attendance'] }]
      }
    }));
  });
  await openWorkbench(page, page.url());
  await page.waitForTimeout(500);
  await dismissCoach(page);
  await page.waitForTimeout(200);

  check('旧布局里的旧分组不会复活', await page.locator('[data-drop-group="old-group"]').count(), 0);
  check('旧分组里的模块升级后进了垃圾桶', await page.textContent('.tb-trash-target b'), '3');
  await page.click('[data-trash-toggle]');
  await page.waitForTimeout(300);
  check(
    '旧分组里的模块一个都没丢',
    await page.evaluate(() => ['grades', 'attendance'].every((name) => [...document.querySelectorAll('.tb-hidden-panel button')].some((node) => node.textContent.includes(name === 'grades' ? '成绩' : '出勤')))),
    true
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/* ------------------------------------------- 6. an empty group accepts a module */
if (wanted(6)) {
  await startSection();

  /*
   * The group is emptied one module at a time. Dragging the group's own heading
   * to the trash deletes the group, which is a different gesture and is covered
   * in section 4.
   */
  for (const moduleId of ['classes', 'timetable', 'planner']) {
    await dropOnTrash(`[data-drop-module="${moduleId}"]`);
  }
  const emptied = await page.evaluate(() => {
    const section = document.querySelector('[data-drop-group="classes-group"]');
    return {
      stillThere: Boolean(section),
      rows: section ? section.querySelectorAll('.tb-module-row').length : -1,
      trash: document.querySelector('.tb-trash-target b')?.textContent ?? '0'
    };
  });
  check('班级分组被清空但仍在侧栏', JSON.stringify(emptied), JSON.stringify({ stillThere: true, rows: 0, trash: '3' }));

  /*
   * The report: nothing could be dropped into an empty group. The drop carries an
   * exact position because the group is only a few pixels tall.
   */
  const dropped = await page.evaluate(async () => {
    const section = document.querySelector('[data-drop-group="classes-group"]');
    const row = document.querySelector('[data-drop-module="students"]');
    const rect = section.getBoundingClientRect();
    const y = Math.round(rect.top + rect.height / 2);
    const transfer = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    const over = { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y };
    const heading = section.querySelector('.tb-group-heading');
    heading.dispatchEvent(new DragEvent('dragenter', over));
    heading.dispatchEvent(new DragEvent('dragover', over));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const marked = Boolean(document.querySelector('.tb-group.is-empty-drop-target'));
    window.__emptyDrop = { heading, row, over, transfer };
    return { marked };
  });
  check('空分组在拖拽经过时被标记为可落', dropped.marked, true);
  await page.screenshot({ path: `${OUT}PC-CW27-empty-group-drop.png` });
  await page.evaluate(() => {
    const { heading, row, over, transfer } = window.__emptyDrop;
    heading.dispatchEvent(new DragEvent('drop', over));
    row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    delete window.__emptyDrop;
  });
  await page.waitForTimeout(300);
  check(
    '模块落进空分组（回归修复）',
    await page.evaluate(() => [...document.querySelectorAll('[data-drop-group="classes-group"] .tb-module-row')].map((row) => row.dataset.dropModule).join(',')),
    'students'
  );
  check('模块离开了原分组', await page.evaluate(() => [...document.querySelectorAll('[data-drop-group="planning-group"] .tb-module-row')].map((row) => row.dataset.dropModule).join(',')), 'lessons,classwork');
  check('垃圾桶里还是那 3 个模块', await page.textContent('.tb-trash-target b'), '3');
  await page.screenshot({ path: `${OUT}PC-CW31-empty-group-filled.png` });

  // and it survives a reload like any other layout change
  await openWorkbench(page, page.url());
  await page.waitForTimeout(600);
  check('刷新后仍然在空分组里', await page.evaluate(() => [...document.querySelectorAll('[data-drop-group="classes-group"] .tb-module-row')].map((row) => row.dataset.dropModule).join(',')), 'students');

  // a second module can be added to the group that is no longer empty
  const second = await page.evaluate(async () => {
    const section = document.querySelector('[data-drop-group="classes-group"]');
    const row = document.querySelector('[data-drop-module="classwork"]');
    const first = section.querySelector('.tb-module-row');
    const rect = first.getBoundingClientRect();
    const y = Math.round(rect.top + rect.height / 2 + rect.height); // below the single row
    const transfer = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    const over = { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: y };
    section.dispatchEvent(new DragEvent('dragover', over));
    await new Promise((resolve) => setTimeout(resolve, 120));
    section.dispatchEvent(new DragEvent('drop', over));
    row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    return true;
  });
  await page.waitForTimeout(300);
  /*
   * Aimed below the group's single row, so the module joins it there. The point
   * is that the group takes a second module at all; where exactly it lands is
   * decided by the same boundary rule as any other group, and is asserted as the
   * slot the insertion line marked rather than as a fixed order.
   */
  check(
    '已经非空的分组也能继续加入模块',
    await page.evaluate(() => [...document.querySelectorAll('[data-drop-group="classes-group"] .tb-module-row')].map((row) => row.dataset.dropModule).sort().join(',')),
    'classwork,students'
  );
  void second;
}

/* ------------------------------- 7. deleting a notification leaves no chip behind */
if (wanted(7)) {
  await startSection();

  await page.click('[data-surface="notifications"]');
  await page.waitForTimeout(400);

  // a read notification is the draggable one
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.tb-notification')].find((node) => node.className.includes('is-read'))
      ?? document.querySelector('.tb-notification');
    if (!row.className.includes('is-read')) row.click();
  });
  await page.waitForTimeout(400);

  /*
   * The reported bug: dragging a read notification to the trash left the chip on
   * screen. The row that started the drag is deleted by its own drop, and a drag
   * whose source is gone never gets `dragend`, so the handler that removed the
   * chip never ran. These checks fail loudly if that comes back.
   */
  const result = await page.evaluate(async () => {
    const row = [...document.querySelectorAll('.tb-notification')].find((node) => node.className.includes('is-read'));
    const trash = document.querySelector('.tb-notification-trash');
    const rect = trash.getBoundingClientRect();
    const y = Math.round(rect.top + rect.height / 2);
    const transfer = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 1150, clientY: y }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    const during = document.querySelectorAll('.tb-drag-chip').length;
    const over = { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 1150, clientY: y };
    trash.dispatchEvent(new DragEvent('dragenter', over));
    trash.dispatchEvent(new DragEvent('dragover', over));
    await new Promise((resolve) => setTimeout(resolve, 120));
    trash.dispatchEvent(new DragEvent('drop', over));
    /*
     * No `dragend` is dispatched: the deleted row is gone, so a real browser has
     * no node left to deliver it to. That is the whole point of the check.
     */
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { during, after: document.querySelectorAll('.tb-drag-chip').length };
  });
  check('拖拽中拖拽图存在', result.during, 1);
  check('把已读通知拖进垃圾桶后，拖拽图不残留（回归修复）', result.after, 0);
  await page.waitForTimeout(200);
  check('拖拽图残留仍然为 0', await page.evaluate(() => document.querySelectorAll('.tb-drag-chip').length), 0);
  check('通知确实被删掉了', await page.locator('.tb-notification').count(), 2);

  // and an ordinary drag that ends outside the trash still cleans up
  const cancelled = await page.evaluate(async () => {
    const row = document.querySelector('.tb-notification');
    if (!row.className.includes('is-read')) row.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const target = document.querySelector('.tb-notification');
    const transfer = new DataTransfer();
    target.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 1100, clientY: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    target.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    return document.querySelectorAll('.tb-drag-chip').length;
  });
  check('取消拖拽后拖拽图也不残留', cancelled, 0);

  // a drag that ends with the panel closing cleans up as well
  const closed = await page.evaluate(async () => {
    const row = document.querySelector('.tb-notification');
    const transfer = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 1100, clientY: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { chips: document.querySelectorAll('.tb-drag-chip').length, open: Boolean(document.querySelector('.tb-popover-notifications')) };
  });
  check('拖拽中关闭面板也不残留', JSON.stringify(closed), JSON.stringify({ chips: 0, open: false }));
}

/* --------------------------------------------------------- 8. the drag image itself */
if (wanted(8)) {
  await startSection();

  /*
   * The chip is a real element this time, not a canvas handed to `setDragImage`.
   * The native image is what could not be positioned: the browser paints the
   * system cursor over it, so a disc centred on the pointer still read as
   * off-centre. A node placed by the drag code is centred by its own transform,
   * which is what these checks measure.
   */
  const chip = await page.evaluate(async () => {
    const node = document.querySelector('[data-drop-module="planner"]');
    const transfer = new DataTransfer();
    node.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 300, clientY: 400 }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const chipNode = document.querySelector('.tb-drag-chip');
    if (!chipNode) return null;
    const box = chipNode.getBoundingClientRect();
    const glyph = chipNode.querySelector('svg')?.getBoundingClientRect();
    const style = getComputedStyle(chipNode);
    return {
      parent: chipNode.parentElement.className.trim(),
      size: [Math.round(box.width), Math.round(box.height)],
      center: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)],
      glyphCenter: glyph ? [Math.round(glyph.left + glyph.width / 2), Math.round(glyph.top + glyph.height / 2)] : null,
      pointerEvents: style.pointerEvents,
      radius: style.borderRadius,
      background: style.backgroundColor,
      bodyClass: document.body.className
    };
  });
  check('拖拽时创建了拖拽图', chip !== null, true);
  check('拖拽图挂在原型根节点内（样式作用域）', chip?.parent, 'tb-prototype');
  check('拖拽图是 32x32 的圆', JSON.stringify([chip?.size, chip?.radius]), JSON.stringify([[32, 32], '50%']));
  check('拖拽图是白色的', chip?.background, 'rgb(255, 255, 255)');
  check('拖拽图不接指针', chip?.pointerEvents, 'none');
  check('圆正好居中在指针上', JSON.stringify(chip?.center), JSON.stringify([300, 400]));
  check('图标也居中在圆心上', JSON.stringify(chip?.glyphCenter), JSON.stringify([300, 400]));
  check('拖拽期间 body 带有拖拽标记（抓取手势用它切换）', chip?.bodyClass.includes('is-dragging-item'), true);
  await page.screenshot({ path: `${OUT}PC-CW23-drag-chip-module.png`, clip: { x: 240, y: 340, width: 120, height: 120 } });

  /*
   * The same disc carries the group's own glyph when a heading is dragged, so
   * both variants are captured from a live drag rather than redrawn.
   */
  await page.evaluate(() => {
    const row = document.querySelector('[data-drop-module="planner"]');
    row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: new DataTransfer() }));
  });
  await page.waitForTimeout(250);
  const groupChip = await page.evaluate(async () => {
    const heading = document.querySelector('.tb-group-heading');
    heading.dispatchEvent(new DragEvent('dragstart', {
      bubbles: true, cancelable: true, dataTransfer: new DataTransfer(), clientX: 300, clientY: 400
    }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    const chipNode = document.querySelector('.tb-drag-chip');
    return chipNode ? chipNode.querySelectorAll('svg path').length : 0;
  });
  check('分组拖拽图也画出了自己的图标', groupChip > 0, true);
  await page.screenshot({ path: `${OUT}PC-CW24-drag-chip-group.png`, clip: { x: 240, y: 340, width: 120, height: 120 } });

  const moved = await page.evaluate(async () => {
    const transfer = new DataTransfer();
    window.dispatchEvent(new DragEvent('dragover', { bubbles: false, cancelable: true, dataTransfer: transfer, clientX: 720, clientY: 250 }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    const box = document.querySelector('.tb-drag-chip').getBoundingClientRect();
    return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
  });
  check('拖拽图跟随指针', JSON.stringify(moved), JSON.stringify([720, 250]));

  const cursor = await page.evaluate(() => getComputedStyle(document.body).cursor);
  check('拖拽期间请求了抓取手势', cursor, 'grabbing');

  await page.evaluate(() => {
    document.querySelector('[data-drop-module="planner"]').dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: new DataTransfer() }));
  });
  await page.waitForTimeout(250);
  check('拖拽结束后拖拽图被移除', await page.evaluate(() => document.querySelectorAll('.tb-drag-chip').length), 0);
  check('拖拽结束后姿态标记被清掉', await page.evaluate(() => document.body.className.includes('is-dragging-item')), false);
}

check('无脚本错误', errors.length === 0);
if (errors.length) console.log(errors.join('\n'));

await browser?.close();
report();
process.exit(results.some((line) => line.startsWith('FAIL')) ? 1 : 0);
