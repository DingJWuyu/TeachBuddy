import { moduleRow, navigationGroup, pointerDrag } from './catalog-navigation.helpers.mjs';
import fs from 'node:fs';
import { test, expect, chromium } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, login, headers, confirmLogout } from './teaching-time-auth/helpers.mjs';
let world;
let device;
let other;
test.beforeEach(async () => {
  world = await createIntegration();
  device = await chromium.launch();
  other = await device.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
});
test.afterEach(async ({ context }, info) => {
  await context.close();
  await device.close();
  await world.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
  else fs.writeFileSync(info.outputPath('fixture-directory.txt'), world.directory);
});
const row = (page, id) => moduleRow(page, id);
const group = page => page.locator('[data-group]').filter({ has: page.getByText('同步备课', { exact: true }) });
async function dismissCoach(page) {
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
}
test('账户导航在独立设备读回分组、位置和隐藏状态', async ({ page }, info) => {
  await register(page, world);
  await dismissCoach(page);
  await page.getByRole('button', { name: '新建分组', exact: true }).click();
  await page.getByRole('textbox', { name: '新分组名称' }).fill('同步备课');
  await page.getByRole('textbox', { name: '新分组名称' }).press('Enter');
  await pointerDrag(page, row(page, 'math'), group(page).locator('.tbx-drop-hint'));
  await expect(group(page).locator('[data-row="math"]')).toBeVisible();
  await row(page, 'resources').focus();
  await page.keyboard.press('Delete');
  await expect(row(page, 'resources')).toHaveCount(0);
  await page.screenshot({ animations: 'disabled', path: info.outputPath('device-a.png') });
  await other.goto(world.origin);
  await login(other);
  await dismissCoach(other);
  await other.screenshot({ animations: 'disabled', path: info.outputPath('device-b.png') });
  await expect(group(other).locator('[data-row="math"]')).toBeVisible();
  await expect(row(other, 'resources')).toHaveCount(0);
  await page.getByRole('button', { name: '同步备课', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '同步备课', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await other.reload();
  await expect(other.getByRole('button', { name: '同步备课', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(group(other).locator('[data-row="math"]')).toBeVisible();
  await logout(other);
  await login(other);
  await expect(group(other).locator('[data-row="math"]')).toBeVisible();
  await expect(row(other, 'resources')).toHaveCount(0);
  await logout(other);
  await register(other, world, 'teacher-b@example.test');
  await dismissCoach(other);
  await expect(group(other)).toHaveCount(0);
  await expect(row(other, 'resources')).toBeVisible();
});

const endpoint = '/api/workbench/navigation';
async function read(page) {
  const response = await page.request.get(world.origin + endpoint, { headers: headers(page) });
  expect(response.status()).toBe(200);
  return response.json();
}
async function settled(page) {
  await expect(page.locator('[data-navigation-status]')).toHaveCount(0);
}
async function addGroup(page, name) {
  await page.getByRole('button', { name: '新建分组', exact: true }).click();
  await page.getByRole('textbox', { name: '新分组名称' }).fill(name);
  await page.getByRole('textbox', { name: '新分组名称' }).press('Enter');
}
async function logout(page) {
  await page.locator('.tb-account-row').click();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await confirmLogout(page);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
}
async function start(page) { await register(page, world); await dismissCoach(page); await settled(page); }

test('读取失败不覆盖服务器，重试后恢复布局', async ({ page }) => {
  await start(page);
  await addGroup(page, '已保存布局'); await settled(page);
  const before = await read(page);
  let writes = 0;
  await page.route('**' + endpoint, async route => {
    if (route.request().method() === 'GET') await route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: '/problems/workbench/temporarily-unavailable' }) });
    else { writes++; await route.continue(); }
  });
  await page.reload();
  await expect(page.getByText('导航读取失败', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新建分组', exact: true })).toBeDisabled();
  expect(writes).toBe(0);
  expect(await read(page)).toEqual(before);
  await page.unroute('**' + endpoint);
  await page.getByRole('button', { name: '重试读取导航', exact: true }).click();
  await expect(page.getByText('已保存布局', { exact: true })).toBeVisible();
  expect(await read(page)).toEqual(before);
});

test('并发修改明确冲突，可对照采用服务器或保留本机布局', async ({ page }, info) => {
  await start(page);
  await other.goto(world.origin); await login(other); await dismissCoach(other); await settled(other);
  await addGroup(page, '设备甲'); await settled(page);
  await addGroup(other, '设备乙');
  await expect(other.getByText('导航已在别处修改', { exact: true })).toBeVisible();
  await other.getByText('对照布局', { exact: true }).click();
  await expect(other.getByRole('dialog', { name: '对照导航布局', exact: true })).toContainText('设备甲');
  await expect(other.getByRole('dialog', { name: '对照导航布局', exact: true })).toContainText('设备乙');
  await expect.poll(() => other.getByRole('dialog', { name: '对照导航布局', exact: true }).evaluate(el => getComputedStyle(el.closest('.wb-dialog-host')).opacity)).toBe('1');
  await other.screenshot({ animations: 'disabled', path: info.outputPath('conflict.png') });
  await other.getByRole('dialog', { name: '对照导航布局', exact: true }).getByRole('button', { name: '取消', exact: true }).click();
  await other.locator('.tb-account-row').click();
  await other.getByRole('button', { name: '深色', exact: true }).click();
  await expect(other.locator('html')).toHaveAttribute('data-workbench-theme', 'dark');
  await other.getByRole('button', { name: '对照布局', exact: true }).click();
  await expect.poll(() => other.getByRole('dialog', { name: '对照导航布局', exact: true }).evaluate(el => getComputedStyle(el.closest('.wb-dialog-host')).opacity)).toBe('1');
  await other.screenshot({ animations: 'disabled', path: info.outputPath('conflict-dark.png') });
  await other.setViewportSize({ width: 390, height: 844 });
  const dialog = other.getByRole('dialog', { name: '对照导航布局', exact: true });
  await dialog.getByRole('button', { name: '保留此设备布局', exact: true }).scrollIntoViewIfNeeded();
  expect(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await other.screenshot({ animations: 'disabled', path: info.outputPath('conflict-dark-narrow.png') });
  await other.setViewportSize({ width: 1440, height: 900 });
  other.once('dialog', dialog => dialog.accept());
  await other.getByRole('button', { name: '保留此设备布局', exact: true }).click();
  await settled(other);
  await page.reload();
  await expect(page.getByText('设备乙', { exact: true })).toBeVisible();
  await expect(page.getByText('设备甲', { exact: true })).toHaveCount(0);
  await addGroup(other, '另一修改'); await settled(other);
  await addGroup(page, '待舍弃修改');
  await page.getByRole('button', { name: '对照布局', exact: true }).click();
  await expect(page.getByRole('button', { name: '使用已保存布局', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '使用已保存布局', exact: true }).click();
  await expect(page.locator('.tbx-side-nav')).toContainText('待舍弃修改');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '使用已保存布局', exact: true }).click();
  await expect(page.locator('.tbx-side-nav')).not.toContainText('待舍弃修改');
  await expect(page.locator('.tbx-side-nav')).toContainText('另一修改');
});

for (const failure of ['断响应', '无效成功内容', '事务回滚']) test(`${failure}后保留原请求及后续输入，刷新后恢复`, async ({ page }) => {
  await start(page);
  const before = await read(page), writes = [];
  let lose = true;
  let failRead = false;
  if (failure === '事务回滚') world.workbench.db.exec("CREATE TRIGGER reject_navigation_update BEFORE UPDATE ON workbench_navigation BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
  await page.route('**' + endpoint, async route => {
    if (failRead && route.request().method() === 'GET') return route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{"type":"/problems/workbench/temporarily-unavailable"}' });
    if (route.request().method() !== 'PUT') return route.continue();
    writes.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (!lose || failure === '事务回滚') return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    if (failure === '断响应') await route.abort('failed');
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'navigation', version: 999, layout: {} }) });
  });
  await addGroup(page, '未确认分组');
  await expect(page.getByRole('button', { name: '确认导航保存', exact: true })).toBeVisible();
  await row(page, 'resources').focus(); await page.keyboard.press('Delete');
  if (failure === '断响应') failRead = true;
  await page.reload();
  if (failRead) {
    await expect(page.getByRole('button', { name: '重试读取导航', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '确认导航保存', exact: true })).toHaveCount(0);
    failRead = false;
    await page.getByRole('button', { name: '重试读取导航', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: '确认导航保存', exact: true })).toBeVisible();
  await expect(row(page, 'resources')).toHaveCount(0);
  if (failure === '事务回滚') world.workbench.db.exec('DROP TRIGGER reject_navigation_update');
  lose = false;
  await page.getByRole('button', { name: '确认导航保存', exact: true }).click();
  await settled(page);
  expect(writes[1]).toEqual(writes[0]);
  const saved = await read(page);
  expect(saved.version).toBe(before.version + 2);
  expect(saved.layout.hiddenModuleIds).toContain('resources');
  await other.goto(world.origin); await login(other); await dismissCoach(other);
  await expect(other.locator('.tbx-side-nav')).toContainText('未确认分组');
  await expect(row(other, 'resources')).toHaveCount(0);
});

test('首次导入本机布局，休眠项保留，新增模块进未分组', async ({ page }) => {
  await page.route('**' + endpoint, route => route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{"type":"/problems/workbench/temporarily-unavailable"}' }));
  await register(page, world); await dismissCoach(page);
  const account = (await page.request.get(world.origin + '/api/workbench/context', { headers: headers(page) }));
  const { accountKey } = await account.json();
  // A fixture of the previous released device record, not a substitute UI action.
  await page.evaluate(accountKey => localStorage.setItem(`tb.workbench.v1:${accountKey}:scene:restored-navigation`, JSON.stringify({ layout: {
    groups: [{ id: 'old', name: '旧备课组', collapsed: true, fixed: false, moduleIds: ['questions', 'sleeping-module', 'lessons'] }, { id: 'ungrouped', name: '未分组', collapsed: false, fixed: true, moduleIds: [] }],
    hiddenModuleIds: ['resources', 'sleeping-hidden']
  } })), accountKey);
  await page.unroute('**' + endpoint); await page.reload();
  await expect(page.getByRole('button', { name: '旧备课组', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await settled(page);
  await expect(page.locator('[data-group="ungrouped"] [data-row="math"]')).toBeVisible();
  await page.getByRole('button', { name: '旧备课组', exact: true }).click();
  await row(page, 'questions').focus(); await page.keyboard.press('Alt+ArrowDown'); await settled(page);
  await addGroup(page, '继续编辑'); await settled(page);
  const saved = await read(page);
  expect(saved.layout.groups.find(g => g.id === 'old').moduleIds).toEqual(['lessons', 'sleeping-module', 'questions']);
  expect(saved.layout.hiddenModuleIds).toContain('sleeping-hidden');
  expect(saved.layout.groups.every(g => !Object.hasOwn(g, 'collapsed'))).toBe(true);
  await other.goto(world.origin); await login(other); await dismissCoach(other);
  await expect(other.getByRole('button', { name: '旧备课组', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(row(other, 'resources')).toHaveCount(0);
});

for (const method of ['GET', 'PUT']) test(`旧账户迟到${method}不会回填新账户`, async ({ page }) => {
  await start(page);
  await addGroup(page, '甲账户布局'); await settled(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let captured;
  const ready = new Promise(resolve => { captured = resolve; });
  let hold = true;
  await page.route('**' + endpoint, async route => {
    if (!hold || route.request().method() !== method) return route.continue();
    hold = false;
    const response = await route.fetch(); captured();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  if (method === 'GET') await page.reload();
  else await addGroup(page, '甲账户迟到写');
  await ready;
  await logout(page);
  await register(page, world, 'teacher-b@example.test'); await dismissCoach(page); await settled(page);
  release();
  await expect(page.locator('.tbx-side-nav')).not.toContainText('甲账户');
  await addGroup(page, '乙账户布局'); await settled(page);
  const saved = await read(page);
  expect(JSON.stringify(saved.layout)).not.toContain('甲账户');
  expect(JSON.stringify(saved.layout)).toContain('乙账户布局');
});

test('真实主题开关、窄屏导航和隐藏恢复', async ({ page }, info) => {
  await start(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**' + endpoint, async route => {
    if (route.request().method() === 'PUT') await gate;
    await route.continue();
  });
  const saving = page.waitForRequest(request => request.method() === 'PUT' && request.url().endsWith(endpoint));
  await addGroup(page, '紧凑导航');
  await saving;
  await expect(navigationGroup(page, '紧凑导航')).toBeVisible();
  await expect(row(page, 'questions')).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: info.outputPath('saving-position.png') });
  release(); await settled(page); await page.unroute('**' + endpoint);
  await pointerDrag(page, row(page, 'math'), navigationGroup(page, '紧凑导航').locator('.tbx-drop-hint'));
  await settled(page);
  await page.locator('.tb-account-row').click();
  for (const theme of ['深色', '浅色']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-workbench-theme', theme === '深色' ? 'dark' : 'light');
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`${theme}-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '打开工作台导航', exact: true }).click();
    await expect(page.locator('[data-group]').filter({ has: page.getByText('紧凑导航', { exact: true }) }).locator('[data-row="math"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`${theme}-narrow.png`) });
    await page.locator('.tbx-side-mobile-head').getByRole('button', { name: '关闭', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await expect(page.getByRole('button', { name: '打开工作台导航', exact: true })).toBeHidden();
  await row(page, 'resources').press('Delete');
  await expect(row(page, 'resources')).toHaveCount(0);
  await settled(page);
  await page.getByRole('button', { name: /^垃圾桶/ }).click();
  await page.getByRole('button', { name: '恢复 资源库', exact: true }).click();
  await settled(page); await page.reload();
  await expect(page.locator('[data-group="ungrouped"] [data-row="resources"]')).toBeVisible();
});

for (const source of ['直接冲突', '未知结果确认']) test(`${source}草稿连续刷新仍需明确解决，不能自动覆盖远端`, async ({ page }, info) => {
  await start(page);
  await other.goto(world.origin); await login(other); await dismissCoach(other); await settled(other);
  if (source === '未知结果确认') {
    await other.route('**' + endpoint, async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      const response = await route.fetch(); expect(response.status()).toBe(200);
      await route.abort('failed');
    });
    await addGroup(other, '本机已提交未确认');
    await expect(other.getByRole('button', { name: '确认导航保存', exact: true })).toBeVisible();
    await addGroup(other, '本机后续草稿');
    await page.reload(); await settled(page);
  }
  await addGroup(page, '远端应保留'); await settled(page);
  if (source === '直接冲突') await addGroup(other, '本机冲突草稿');
  else {
    await other.unroute('**' + endpoint);
    await other.getByRole('button', { name: '确认导航保存', exact: true }).click();
  }
  await expect(other.getByText('导航已在别处修改', { exact: true })).toBeVisible();
  const remote = await read(page), snapshots = [];
  try {
    for (let n = 1; n <= 3; n++) {
      if (source === '直接冲突' && n > 1) {
        // Compatibility with drafts written before full baselines were stored,
        // including an unresolved conflict whose old writer advanced its version.
        await other.evaluate(({ n, version }) => {
          for (const key of Object.keys(localStorage).filter(key => key.endsWith(':draft:navigation:account'))) {
            const value = JSON.parse(localStorage.getItem(key)), draft = value?.value ?? value;
            if (draft?.status !== 'conflict') continue;
            delete draft.baseline;
            if (n === 3) draft.baselineVersion = version;
            localStorage.setItem(key, JSON.stringify(value));
          }
        }, { n, version: remote.version });
      }
      if (n === 2) {
        await other.route('**' + endpoint, route => route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{"type":"/problems/workbench/temporarily-unavailable"}' }));
        await other.reload();
        await expect(other.getByRole('button', { name: '重试读取导航', exact: true })).toBeVisible();
        await expect(other.getByRole('button', { name: '新建分组', exact: true })).toBeDisabled();
        expect(await read(page)).toEqual(remote);
        await other.unroute('**' + endpoint);
      }
      await other.reload();
      await expect(other.getByRole('button', { name: '新建分组', exact: true })).toBeEnabled();
      await expect(other.locator('[data-navigation-status="loading"], [data-navigation-status="saving"]')).toHaveCount(0);
      // Observe the server after the restored draft has completed its lifecycle.
      await expect(other.getByText('导航已在别处修改', { exact: true })).toBeVisible();
      snapshots.push(await read(page));
      expect(snapshots.at(-1)).toEqual(remote);
    }
    await other.getByRole('button', { name: '对照布局', exact: true }).click();
    await expect(other.getByRole('dialog', { name: '对照导航布局' })).toContainText('远端应保留');
    await expect(other.locator('.wb-module-presence').filter({ has: other.getByRole('dialog', { name: '对照导航布局' }) })).toHaveAttribute('data-state', 'open');
    await expect(other.locator('.tb-navigation-comparison').locator('..')).toHaveCSS('opacity', '1');
    await other.screenshot({ animations: 'disabled', path: info.outputPath('restored-comparison.png') });
    other.once('dialog', dialog => dialog.accept());
    await other.getByRole('button', { name: '保留此设备布局', exact: true }).click();
    await settled(other);
    const chosen = await read(other);
    expect(chosen.version).toBe(remote.version + 1);
    expect(JSON.stringify(chosen.layout)).not.toContain('远端应保留');
  } finally {
    snapshots.push(await read(page));
    fs.writeFileSync(info.outputPath('refresh-server-snapshots.json'), JSON.stringify({ source, remote, snapshots }, null, 2));
    await other.screenshot({ animations: 'disabled', path: info.outputPath('refresh-conflict.png') });
  }
});

for (const failure of ['读取失败', '结果未确认']) test(`折叠侧栏${failure}保留紧凑入口和恢复操作`, async ({ page }, info) => {
  await start(page);
  if (failure === '结果未确认') {
    await page.locator('.tb-account-row').click();
    await page.getByRole('button', { name: '深色', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-workbench-theme', 'dark');
    await page.keyboard.press('Escape');
  }
  const fail = route => route.request().method() === 'GET'
    ? route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{"type":"/problems/workbench/temporarily-unavailable"}' })
    : route.continue();
  if (failure === '结果未确认') {
    await page.route('**' + endpoint, async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      await route.fetch(); await route.abort('failed');
    });
    await addGroup(page, '待确认布局');
    await expect(page.getByRole('button', { name: '确认导航保存', exact: true })).toBeVisible();
  }
  await page.locator('.tb-topbar').hover();
  await page.getByRole('button', { name: '收起侧栏', exact: true }).click();
  await expect(page.locator('.tb-sidebar')).toHaveClass(/is-rail-collapsed/);
  if (failure === '读取失败') { await page.route('**' + endpoint, fail); await page.reload(); }
  await expect(page.locator('.tb-sidebar')).toHaveClass(/is-rail-collapsed/);
  await expect(page.locator('[data-navigation-status]')).toHaveCount(1);
  const sidebar = await page.locator('.tb-sidebar').boundingBox();
  const first = await row(page, 'questions').boundingBox();
  fs.writeFileSync(info.outputPath('rail-measurement.json'), JSON.stringify({ failure, sidebar, first }));
  await page.screenshot({ animations: 'disabled', path: info.outputPath('rail-error.png') });
  expect(sidebar.width).toBe(64);
  const recovery = await page.getByRole('button', { name: '展开侧栏处理导航同步', exact: true }).boundingBox();
  expect(recovery.x).toBeGreaterThanOrEqual(sidebar.x);
  expect(recovery.x + recovery.width).toBeLessThanOrEqual(sidebar.x + sidebar.width);
  expect(recovery.y + recovery.height).toBeLessThanOrEqual(first.y);
  await page.getByRole('button', { name: '展开侧栏处理导航同步', exact: true }).click();
  await expect(page.locator('.tb-sidebar')).not.toHaveClass(/is-rail-collapsed/);
  await page.unroute('**' + endpoint);
  await page.getByRole('button', { name: failure === '读取失败' ? '重试读取导航' : '确认导航保存', exact: true }).click();
  await settled(page);
});
