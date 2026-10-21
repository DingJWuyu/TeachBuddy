import { addNavigationGroup, moduleRow, navigationGroup, pointerDrag } from './catalog-navigation.helpers.mjs';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { randomUUID } from 'node:crypto';
import { question } from '../../api/test/materials-http-fixture.js';
import { register, headers } from './teaching-time-auth/helpers.mjs';
let world;
let errors;
test.beforeEach(async ({ page }) => {
  world = await createIntegration();
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await register(page, world);
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
});
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});
const row = (page, id) => moduleRow(page, id);
async function route(page, path, name) {
  await page.goto(world.origin + path);
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', name);
}

test('五模块真实外壳、辅助栏、前进后退、未知及非法深链接', async ({ page }, info) => {
  const catalogResponse = await page.request.get(world.origin + '/api/modules', { headers: headers(page) });
  expect(catalogResponse.status()).toBe(200);
  const catalog = await catalogResponse.json();
  expect(catalog.version).toBe(4);
  expect(catalog.items.find(item => item.id === 'classroom')).toMatchObject({ webEnabled: true });
  await expect(row(page, 'classroom')).toBeVisible();
  await expect(page.locator('.tbx-side-nav a[href="/classroom"]')).toBeVisible();
  for (const [id, path] of [['questions', '/questions'], ['math', '/math'], ['resources', '/resources'], ['schedule', '/calendar'], ['classroom', '/classroom']]) {
    await route(page, path, id);
    if (id !== 'schedule') await expect(row(page, id)).toHaveAttribute('aria-current', 'page');
    else {
      await expect(row(page, 'schedule')).toHaveCount(0);
      await expect(page.locator('.tb-global-nav').getByRole('link', { name: '日程' })).toHaveClass(/is-current/);
    }
    await page.locator('.tbx-panel-toggle').click();
    await expect(page.locator('.wb-shell')).toHaveClass(/has-panel/);
    await page.screenshot({ path: info.outputPath(`${id}.png`) });
    await page.locator('.tbx-panel-toggle').click();
    await expect(page.locator('.wb-shell')).not.toHaveClass(/has-panel/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.body.scrollHeight <= innerHeight + 1)).toBe(true);
  }
  await row(page, 'questions').click();
  await row(page, 'resources').click();
  await page.goBack();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'questions');
  await page.goForward();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'resources');
  for (const path of ['/classroom/items', '/missing', '/resources/%E0%A4%A', '/questions/%ZZ', '/lessons/%FF', '/classes/%E0%A4%A/records/x', '/math/unknown']) {
    await route(page, path, 'unknown');
    await expect(page.getByText('未找到内容', { exact: true })).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath('invalid-url.png') });
  await route(page, '/questions/' + encodeURIComponent('题目'), 'question');
  await expect(row(page, 'questions')).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('侧栏分组、拖动、隐藏恢复和刷新保留', async ({ page }, info) => {
  await route(page, '/questions', 'questions');
  await page.getByRole('button', { name: '新建分组', exact: true }).click();
  await page.getByRole('textbox', { name: '新分组名称' }).fill('备课分组');
  await page.getByRole('textbox', { name: '新分组名称' }).press('Enter');
  const target = page.locator('[data-group]').filter({ has: page.getByText('备课分组', { exact: true }) });
  await pointerDrag(page, row(page, 'math'), target.locator('.tbx-drop-hint'));
  await expect(target.locator('[data-row="math"]')).toBeVisible();
  await row(page, 'resources').focus();
  await page.keyboard.press('Delete');
  await expect(row(page, 'resources')).toHaveCount(0);
  await page.reload();
  await expect(target.locator('[data-row="math"]')).toBeVisible();
  await expect(row(page, 'resources')).toHaveCount(0);
  await page.getByRole('button', { name: /^垃圾桶/ }).click();
  await page.getByRole('button', { name: '恢复 资源库', exact: true }).click();
  await expect(row(page, 'resources')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-group="ungrouped"] [data-row="resources"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath('layout-restored.png') });
  expect(errors).toEqual([]);
});


async function create(page, path, data) {
  const response = await page.request.post(world.origin + path, { data, headers: { ...headers(page), Origin: world.origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

test('题目数学详情、资源一次消费与 Agent 返回现场', async ({ page }, info) => {
  const q = await create(page, '/api/modules/questions/v2/items', question('目录题目'));
  const sample = JSON.parse(fs.readFileSync(new URL('../../api/test/fixtures/contracts/math-samples.json', import.meta.url))).find(item => item.id === 'create-formula').value;
  const math = await create(page, '/api/modules/math/v1/works', { ...sample, title: '目录公式' });
  const uploaded = await page.request.post(world.origin + '/api/workbench/files', { multipart: { file: { name: 'catalog.png', mimeType: 'image/png', buffer: fs.readFileSync(new URL('../../../test/fixtures/questions/figure.png', import.meta.url)) } }, headers: { ...headers(page), Origin: world.origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() } });
  expect(uploaded.status()).toBe(201);
  const resource = await create(page, '/api/modules/resources/items', { title: '目录资料', fileId: (await uploaded.json()).id, folderId: null, tagIds: [], note: '' });
  for (const [path, name, id, title] of [[`/questions/${q.id}`, 'question', 'questions', '目录题目'], [`/math?workId=${math.id}`, 'math', 'math', '目录公式'], [`/resources/${resource.id}`, 'resource', 'resources', '目录资料']]) {
    await route(page, path, name);
    await expect(row(page, id)).toHaveAttribute('aria-current', 'page');
    if (id === 'math') await expect(page.getByRole('textbox', { name: '作品名称', exact: true })).toHaveValue(title);
    else await expect(page.locator('[data-region=main]')).toContainText(title);
    await page.reload();
    if (id === 'math') await expect(page.getByRole('textbox', { name: '作品名称', exact: true })).toHaveValue(title);
    else await expect(page.locator('[data-region=main]')).toContainText(title);
    await page.screenshot({ path: info.outputPath(`${id}-detail.png`) });
  }
  await page.getByRole('button', { name: '返回资源库', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '返回资源库', exact: true })).toHaveCount(0);
  await route(page, `/questions/%${q.id.charCodeAt(0).toString(16)}${q.id.slice(1)}`, 'question');
  await expect(page.locator('[data-region=main]')).toContainText('目录题目');
  await page.locator('.tbx-panel-toggle').click();
  await expect(page.locator('.wb-shell')).toHaveClass(/has-panel/);
  await page.locator('.tb-global-nav').getByRole('link', { name: '首页', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'home');
  await page.getByRole('button', { name: '返回工作', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'question');
  await expect(page.locator('.wb-shell')).toHaveClass(/has-panel/);
  const entry = await create(page, '/api/modules/schedule/entries', { title: '目录日程详情', items: [], time: { date: '2026-09-28', startTime: '10:00', durationMinutes: 45, timeZone: 'Asia/Shanghai' }, repeat: null, reminder: null });
  await route(page, `/calendar?entry=${entry.id}`, 'schedule');
  await expect(page.locator('#calendar-entry-title')).toHaveValue('目录日程详情');
  await page.reload();
  await expect(page.locator('#calendar-entry-title')).toHaveValue('目录日程详情');
  await page.screenshot({ path: info.outputPath('schedule-detail.png') });
  expect(errors).toEqual([]);
});

test('教程搜索消费目录，窄屏日程入口和侧栏高亮', async ({ page }, info) => {
  await page.getByRole('button', { name: '使用教程', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: '教程完成进度' })).toHaveAttribute('aria-valuemax', '4');
  await expect(page.locator('.tb-popover-tutorial')).toContainText('班级');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '全局搜索', exact: true }).click();
  await page.getByRole('searchbox').fill('日程');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'schedule');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开工作台导航', exact: true }).click();
  await expect(page.locator('.tbx-side-mobile-nav').getByRole('link', { name: '日程', exact: true })).toHaveAttribute('aria-current', 'page');
  await row(page, 'questions').click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'questions');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('narrow-navigation.png') });
  expect(errors).toEqual([]);
});

test('辅助栏覆盖模块右栏，宽窄视口均保持在工作区内', async ({ page }, info) => {
  for (const path of ['/calendar', '/questions', '/resources', '/classroom']) {
    await page.goto(world.origin + path);
    if (!await page.locator('.wb-shell').getAttribute('class').then(value => value.includes('has-panel'))) await page.locator('.tbx-panel-toggle').click();
    const panel = page.locator('[data-region=auxiliary]');
    await expect(panel).toHaveClass(/is-open/);
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(async () => {
        const box = await panel.boundingBox();
        return Boolean(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 901);
      }).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`panel-${path.slice(1)}.png`) });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
});

test('外壳反馈草稿、教程进度和学期在刷新后保留', async ({ page }, info) => {
  const original = page.url();
  await page.getByRole('button', { name: '发送反馈', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '发送反馈', exact: true })).toBeVisible();
  await expect(page).toHaveURL(original);
  await page.getByRole('button', { name: '错误报告', exact: true }).click();
  await page.getByRole('textbox', { name: '反馈内容', exact: true }).fill('刷新与切换后保留的外壳反馈');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: '发送反馈', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '反馈内容', exact: true })).toHaveValue('刷新与切换后保留的外壳反馈');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await page.getByRole('button', { name: '使用教程', exact: true }).click();
  await page.getByRole('dialog', { name: '快速上手', exact: true }).getByRole('button', { name: '题库', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: '教程完成进度' })).toHaveAttribute('aria-valuenow', '1');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '隐私与数据保护', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Trusted, Secure & Private', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.tb-term-button').click();
  await page.getByRole('button', { name: '新学期', exact: true }).click();
  await page.getByLabel('名称 *', { exact: true }).fill('2026秋季学期');
  await page.getByLabel('开始日期 *', { exact: true }).fill('2026-09-01');
  await page.getByLabel('结束日期 *', { exact: true }).fill('2027-01-31');
  await page.getByRole('button', { name: '创建学期', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('combobox', { name: '2026秋季学期', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '使用教程', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: '教程完成进度' })).toHaveAttribute('aria-valuenow', '1');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: info.outputPath('shell-restored.png') });
  expect(errors).toEqual([]);
});

test('首页建议建立真实草稿并聚焦，跨模块和刷新保留输入', async ({ page }, info) => {
  await route(page, '/', 'home');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^梳理一节课的讲解顺序 / }).click();
  const input = page.getByRole('textbox', { name: 'AI 输入', exact: true });
  await expect(input).toHaveValue('帮我梳理一节二次函数图像与性质的讲解顺序');
  await expect(input).toBeFocused();
  await page.screenshot({ path: info.outputPath('home-mobile-draft.png') });
  await page.setViewportSize({ width: 1680, height: 910 });
  await row(page, 'resources').click();
  await page.locator('.tb-global-nav').getByRole('link', { name: '首页', exact: true }).click();
  await expect(input).toHaveValue('帮我梳理一节二次函数图像与性质的讲解顺序');
  await page.reload();
  await expect(input).toHaveValue('帮我梳理一节二次函数图像与性质的讲解顺序');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('侧栏导航在桌面、1024平板与窄屏均可由指针打开', async ({ page }, info) => {
  for (const width of [1024, 1081, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width > 1080) await page.locator('.tb-topbar').hover();
    const collapse = page.getByRole('button', { name: '收起侧栏', exact: true }).filter({ visible: true });
    if (await collapse.count()) await collapse.click();
    const open = page.getByRole('button', { name: /^(展开侧栏|打开工作台导航)$/ }).filter({ visible: true });
    await expect(open).toHaveCount(1);
    await open.click();
    await expect(row(page, 'questions')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`pointer-navigation-open-${width}.png`) });
    await row(page, 'questions').click();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'questions');
    if (width <= 1080) await expect(row(page, 'questions')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`pointer-navigation-${width}.png`) });
  }
  expect(errors).toEqual([]);
});

test('首页新对话按钮完整留在对话卡内，窄屏列表仍可点击', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const toggle = page.getByRole('button', { name: '对话列表', exact: true });
    if (await toggle.isVisible()) await toggle.click();
    const compose = page.getByRole('button', { name: '新对话', exact: true });
    await expect(compose).toBeVisible();
    const bounds = await compose.evaluate(button => {
      const box = button.getBoundingClientRect();
      const head = button.closest('.tbx-threads-head').getBoundingClientRect();
      return { left: box.left - head.left, right: head.right - box.right,
        clickable: [0.1, 0.5, 0.9].every(ratio => button.contains(document.elementFromPoint(box.left + box.width * ratio, box.top + box.height / 2))) };
    });
    expect(bounds.left, '新对话按钮左侧位于对话标题行内').toBeGreaterThanOrEqual(0);
    expect(bounds.right, '新对话按钮右侧位于对话标题行内').toBeGreaterThanOrEqual(0);
    expect(bounds.clickable, '新对话按钮的左右边缘与中心均可点击').toBe(true);
    await compose.click();
    await expect(page.getByRole('textbox', { name: 'AI 输入', exact: true })).toBeVisible();
  }
});

test('全局搜索键盘焦点限制在弹层内，关闭后返回入口', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '全局搜索', exact: true });
  await trigger.click();
  const search = page.getByRole('searchbox', { name: '搜索模块', exact: true });
  await expect(search).toBeFocused();
  await search.press('Shift+Tab');
  await expect(page.getByRole('dialog', { name: '全局搜索', exact: true }).getByRole('link').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '全局搜索', exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('侧栏分组选项取消后可立即用键盘重开和重命名', async ({ page }) => {
  await page.getByRole('button', { name: '新建分组', exact: true }).click();
  await page.getByRole('textbox', { name: '新分组名称' }).fill('课堂资料');
  await page.getByRole('textbox', { name: '新分组名称' }).press('Enter');
  const group = navigationGroup(page, '课堂资料');
  const trigger = group.getByRole('button', { name: '分组选项', exact: true });
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Space');
  await page.getByRole('menuitem', { name: '重命名分组', exact: true }).press('Enter');
  const rename = page.getByRole('textbox', { name: '重命名分组', exact: true });
  await expect(rename).toBeFocused();
  await rename.fill('课堂精选');
  await rename.press('Enter');
  await expect(navigationGroup(page, '课堂精选')).toBeVisible();
  await navigationGroup(page, '课堂精选').getByRole('button', { name: '分组选项', exact: true }).click();
  await page.getByRole('menuitem', { name: '解散分组', exact: true }).click();
  await page.getByRole('menuitem', { name: '确认解散', exact: true }).click();
  await expect(navigationGroup(page, '课堂精选')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '新建分组', exact: true })).toBeFocused();
});

test('资料类型多选筛选关闭后可用键盘重开并清除选择', async ({ page }) => {
  await route(page, '/resources', 'resources');
  await page.getByLabel('上传资料', { exact: true }).setInputFiles({
    name: '课堂图.png', mimeType: 'image/png',
    buffer: fs.readFileSync(new URL('../../../test/fixtures/questions/figure.png', import.meta.url)),
  });
  const trigger = page.locator('.tbx-filter-btn').filter({ hasText: '类型' });
  await trigger.click();
  await page.getByRole('menuitemcheckbox', { name: '图片', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('menuitemcheckbox', { name: '图片', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('menuitemradio').click();
  await expect(page.getByRole('menuitemcheckbox', { name: '图片', exact: true })).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('侧栏拖动到无效位置或 Escape 取消，仍可随后正常移动', async ({ page }) => {
  await addNavigationGroup(page, '取消目标');
  const target = navigationGroup(page, '取消目标');
  const source = row(page, 'math');
  const origin = await source.evaluate(node => node.closest('[data-group]').dataset.group);
  for (const cancel of ['outside', 'escape']) {
    const from = await source.boundingBox();
    const to = await target.locator('.tbx-drop-hint').boundingBox();
    await page.mouse.move(from.x + 30, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + from.height / 2, { steps: 3 });
    await page.mouse.move(to.x + 50, to.y + to.height / 2, { steps: 12 });
    await expect(page.locator('.tbx-drag-ghost')).toBeVisible();
    if (cancel === 'outside') await page.mouse.move(900, 500, { steps: 12 });
    else { await page.keyboard.press('Escape'); await expect(page.locator('.tbx-drag-ghost')).toHaveCount(0); }
    await page.mouse.up();
    await expect(page.locator('.tbx-drag-ghost')).toHaveCount(0);
    expect(await source.evaluate(node => node.closest('[data-group]').dataset.group)).toBe(origin);
  }
  await pointerDrag(page, source, target.locator('.tbx-drop-hint'));
  await expect(target.locator('[data-row="math"]')).toBeVisible();
  await page.reload();
  await expect(target.locator('[data-row="math"]')).toBeVisible();
});

test('新设备窄屏首次进入不会留下不可见教程的遮罩', async ({ page, browser }) => {
  const state = await page.context().storageState();
  const fresh = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, storageState: { cookies: state.cookies, origins: [] } });
  try {
    const next = await fresh.newPage();
    await next.goto(world.origin);
    await expect(next.locator('.wb-shell')).toBeVisible();
    await expect(next.locator('.tb-coach-scrim')).toBeHidden();
    await next.getByRole('button', { name: '打开工作台导航', exact: true }).click();
    await expect(row(next, 'questions')).toBeVisible();
    await row(next, 'questions').click();
    await expect(next.locator('.wb-shell')).toHaveAttribute('data-route', 'questions');
    await next.setViewportSize({ width: 1440, height: 900 });
    await expect(next.getByRole('button', { name: '知道了', exact: true })).toBeVisible();
    await next.getByRole('button', { name: '知道了', exact: true }).click();
    await expect(next.locator('.tb-coach-scrim')).toHaveCount(0);
  } finally { await fresh.close(); }
});

test('已有学期删除先确认，取消保留，确认后刷新只剩另一学期', async ({ page }) => {
  for (const name of ['保留学期甲', '删除目标乙']) {
    await page.locator('.tb-term-button').click();
    await page.getByRole('button', { name: '新学期', exact: true }).click();
    await page.locator('#tb-semester-name').fill(name);
    await page.locator('#tb-semester-start').fill('2026-09-01');
    await page.locator('#tb-semester-end').fill('2027-01-31');
    await page.locator('.tb-dialog-submit').click();
  }
  await page.locator('.tb-term-button').click();
  await page.getByRole('button', { name: '编辑删除目标乙', exact: true }).click();
  await page.locator('.tb-dialog-more').click();
  await page.getByRole('menuitem', { name: '删除学期', exact: true }).click();
  await expect(page.locator('.tb-term-button')).toContainText('删除目标乙');
  await expect(page.getByRole('menuitem', { name: '确认删除', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '编辑学期', exact: true })).toBeVisible();
  await expect(page.locator('.tb-term-button')).toContainText('删除目标乙');
  await page.locator('.tb-dialog-more').click();
  await page.getByRole('menuitem', { name: '删除学期', exact: true }).click();
  await page.getByRole('menuitem', { name: '确认删除', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '编辑学期', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.tb-term-button')).toContainText('保留学期甲');
  await page.locator('.tb-term-button').click();
  await expect(page.getByRole('button', { name: '编辑删除目标乙', exact: true })).toHaveCount(0);
});

test('减少动效下窄屏导航直接展开，仍能进入业务页', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开工作台导航', exact: true }).click();
  const drawer = page.locator('.tbx-side');
  const moving = await drawer.evaluate(node => node.getAnimations().filter(animation => animation.playState === 'running' && animation.effect.getTiming().duration > 1).length);
  expect(moving, '减少动效时侧栏不再执行滑入过渡').toBe(0);
  await expect(row(page, 'questions')).toBeVisible();
  await row(page, 'questions').click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-route', 'questions');
  await expect(drawer).toBeHidden();
});

test('窄屏顶栏的入口显隐不随中英文翻译改变', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['发送反馈', '使用教程', '隐私与数据保护']) {
    await expect(page.getByRole('button', { name, exact: true, includeHidden: true })).toBeHidden();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.tb-language-row').click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  const english = ['Send feedback', 'Tutorial', 'Privacy and data protection'];
  for (const name of english) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of english) {
    await expect(page.getByRole('button', { name, exact: true, includeHidden: true })).toBeHidden();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('首页窄屏对话列表支持 Escape 与点击外部收起', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.getByRole('button', { name: '对话列表', exact: true });
  await toggle.click();
  await expect(page.locator('.tbx-home')).toHaveClass(/is-threads-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tbx-home')).not.toHaveClass(/is-threads-open/);
  await expect(toggle).toBeFocused();
  await expect(page.locator('.tbx-threads')).toHaveCSS('opacity', '0');
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('.tbx-threads'))), '关闭的对话列表不接收键盘焦点').toBe(false);
  await toggle.click();
  await expect(page.locator('.tbx-home')).toHaveClass(/is-threads-open/);
  await page.mouse.click(365, 430);
  await expect(page.locator('.tbx-home')).not.toHaveClass(/is-threads-open/);
  await toggle.click();
  await page.getByRole('button', { name: '新对话', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'AI 输入', exact: true })).toBeVisible();
  await toggle.click();
  await page.locator('.tbx-thread.is-active').getByRole('button', { name: '对话选项', exact: true }).press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('.tbx-home')).toHaveClass(/is-threads-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tbx-home')).not.toHaveClass(/is-threads-open/);
  const input = page.getByRole('textbox', { name: 'AI 输入', exact: true });
  await input.fill('第一条会话的草稿');
  await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible();
  await toggle.click();
  await page.getByRole('button', { name: '新对话', exact: true }).click();
  await expect(input).toHaveValue('');
  await input.fill('第二条会话的草稿');
  await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible();
  await toggle.click();
  const previous = page.locator('.tbx-thread:not(.is-active)').first();
  await previous.focus();
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('第一条会话的草稿');
  await expect(page.locator('.tbx-home')).not.toHaveClass(/is-threads-open/);
});
