import { confirmLogout } from './teaching-time-auth/helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { backup, restore, activate } from '../../api/src/workbench/reliability/backup.js';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, login, headers } from './teaching-time-auth/helpers.mjs';
import { importLegacy } from './fixtures/math-workspace.js';
let world;
let extraDirectories;
test.beforeEach(async ({ page }) => {
  extraDirectories = [];
  world = await createIntegration({ port: 48967 });
  await register(page, world);
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
  await page.goto(world.origin + '/settings');
});
test.afterEach(async ({ context }, info) => {
  await context.close(); await world.close();
  if (info.status === info.expectedStatus) for (const directory of [world.directory, ...extraDirectories]) fs.rmSync(directory, { recursive: true, force: true });
  else fs.writeFileSync(info.outputPath('fixture-directory.txt'), [world.directory, ...extraDirectories].join('\n'));
});
test('昵称原位编辑同步侧栏，刷新及另一浏览器登录读回', async ({ page, browser }, info) => {
  const name = page.getByRole('button', { name: '修改昵称', exact: true });
  await expect(name).toHaveText('甲老师');
  await name.hover();
  await expect(name.locator('svg')).toHaveCSS('opacity', '1');
  await page.locator('.settings-profile').screenshot({ path: info.outputPath('nickname-hover.png') });
  const mounted = await page.locator('.wb-shell').elementHandle();
  await name.click();
  const input = page.getByRole('textbox', { name: '昵称', exact: true });
  await expect(input).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await input.pressSequentially('林老师');
  await input.press('Enter');
  await expect(name).toHaveText('林老师');
  await expect(page.locator('.tb-account-row')).toContainText('林老师');
  expect(await mounted.evaluate(element => element.isConnected)).toBe(true);
  await expect(name).toBeFocused();
  await page.reload();
  await expect(name).toHaveText('林老师');
  await expect(page.locator('.tb-account-row')).toContainText('林老师');
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const second = await other.newPage();
    await second.goto(world.origin);
    await login(second);
    await expect(second.locator('.tb-account-row')).toContainText('林老师');
  } finally { await other.close(); }
  await page.locator('.settings-profile').screenshot({ path: info.outputPath('nickname-saved.png') });
});

test('昵称编辑取消、空白校验、失焦保存及长昵称窄屏呈现', async ({ page }, info) => {
  const name = page.getByRole('button', { name: '修改昵称', exact: true });
  const input = page.getByRole('textbox', { name: '昵称', exact: true });
  await name.click();
  await input.fill('不保存的昵称');
  await input.press('Escape');
  await expect(name).toHaveText('甲老师');
  await expect(name).toBeFocused();
  await name.click();
  await input.fill('  ');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('昵称需为 1-40 个字符。');
  await expect(page.locator('.tb-account-row')).toContainText('甲老师');
  await input.fill('长'.repeat(41));
  await input.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('昵称需为 1-40 个字符。');
  const longName = '林老师的数学课堂'.repeat(4) + '😀'.repeat(8);
  expect(Array.from(longName)).toHaveLength(40);
  await input.fill(`  ${longName}  `);
  await page.getByText('TeachBuddy 账户', { exact: true }).click();
  await expect(name).toHaveText(longName);
  await expect(page.locator('.tb-account-row')).toContainText(longName);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['浅色', '深色']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await expect(page.locator('.settings-save-status')).toHaveText('已保存');
    await name.click();
    await expect(input).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('[data-region=settings]').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`nickname-390-${theme}.png`) });
    await input.press('Escape');
  }
});

test('昵称保存失败保留输入，未知结果先读取核实且不自动重放', async ({ page }) => {
  const name = page.getByRole('button', { name: '修改昵称', exact: true });
  const input = page.getByRole('textbox', { name: '昵称', exact: true });
  world.workbench.db.exec("CREATE TRIGGER fail_nickname BEFORE UPDATE OF nickname ON auth_accounts BEGIN SELECT RAISE(ABORT, 'write rejected'); END");
  await name.click(); await input.fill('失败后重试'); await input.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('昵称未能保存，请重试。');
  await expect(input).toHaveValue('失败后重试');
  await expect(page.locator('.tb-account-row')).toContainText('甲老师');
  world.workbench.db.exec('DROP TRIGGER fail_nickname');
  await input.press('Enter');
  await expect(name).toHaveText('失败后重试');
  let writes = 0;
  await page.route('**/api/auth/profile', async route => { writes++; await route.fetch(); await route.abort('failed'); });
  await name.click(); await input.fill('已保存但回执丢失'); await input.press('Enter');
  await expect(name).toHaveText('已保存但回执丢失');
  expect(writes).toBe(1);
  await page.unroute('**/api/auth/profile');
  await page.route('**/api/auth/profile', async route => { writes++; await route.abort('failed'); });
  await name.click(); await input.fill('结果仍未确认'); await input.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('昵称保存结果未确认，请重试。');
  await expect(input).toHaveValue('结果仍未确认');
  await page.getByText('TeachBuddy 账户', { exact: true }).click();
  expect(writes).toBe(2);
  await expect(page.locator('.tb-account-row')).toContainText('已保存但回执丢失');
  await page.unroute('**/api/auth/profile');
  await input.press('Enter');
  await expect(name).toHaveText('结果仍未确认');
});

test('昵称在同一会话的另一标签页同步，保留工作台挂载', async ({ page, context }) => {
  const mounted = await page.locator('.wb-shell').elementHandle();
  const second = await context.newPage();
  await second.goto(world.origin + '/settings');
  await second.getByRole('button', { name: '修改昵称', exact: true }).click();
  await second.getByRole('textbox', { name: '昵称', exact: true }).fill('另一页的昵称');
  await second.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('另一页的昵称');
  await expect(page.locator('.tb-account-row')).toContainText('另一页的昵称');
  expect(await mounted.evaluate(element => element.isConnected)).toBe(true);
});

test('昵称较早写入的迟到回执不覆盖另一标签页的后续改名', async ({ page, context }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let committed = false;
  await page.route('**/api/auth/profile', async route => {
    const response = await route.fetch(); committed = true;
    await held; await route.fulfill({ response });
  });
  const second = await context.newPage();
  await second.goto(world.origin + '/settings');
  await page.getByRole('button', { name: '修改昵称', exact: true }).click();
  await page.getByRole('textbox', { name: '昵称', exact: true }).fill('较早写入的昵称');
  await page.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await expect.poll(() => committed).toBe(true);
  const rechecked = page.waitForResponse(response => response.url().endsWith('/api/auth/session') && response.request().method() === 'GET');
  await second.getByRole('button', { name: '修改昵称', exact: true }).click();
  await second.getByRole('textbox', { name: '昵称', exact: true }).fill('后来写入的昵称');
  await second.getByRole('textbox', { name: '昵称', exact: true }).press('Enter');
  await expect(second.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('后来写入的昵称');
  expect((await (await rechecked).json()).session.account.nickname).toBe('后来写入的昵称');
  release();
  for (const target of [page, second]) {
    await expect(target.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('后来写入的昵称');
    await expect(target.locator('.tb-account-row')).toContainText('后来写入的昵称');
  }
});

test('昵称迟到回执不恢复已退出的身份或覆盖另一账户', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let committed = false;
  await page.route('**/api/auth/profile', async route => {
    const response = await route.fetch(); committed = true;
    await held; await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '修改昵称', exact: true }).click();
  const input = page.getByRole('textbox', { name: '昵称', exact: true });
  await input.fill('旧账户的迟到昵称'); await input.press('Enter');
  await expect.poll(() => committed).toBe(true);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await confirmLogout(page);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await register(page, world, 'teacher-b@example.test');
  const response = page.waitForResponse('**/api/auth/profile');
  release(); await response;
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
  await page.goto(world.origin + '/settings');
  await expect(page.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('乙老师');
  await expect(page.locator('.tb-account-row')).toContainText('乙老师');
});

test('语言选择立即应用真实界面并写入账户偏好', async ({ page }, info) => {
  const before = await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json();
  await page.getByRole('button', { name: '语言', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  try {
    await expect(page.getByRole('button', { name: 'Language', exact: true })).toBeVisible();
    await expect.poll(async () => (await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json()).values.locale).toBe('en');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Language', exact: true })).toBeVisible();
  } finally {
    const after = await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json();
    fs.writeFileSync(info.outputPath('preferences.json'), JSON.stringify({ before, after }, null, 2));
    await page.screenshot({ path: info.outputPath('language.png'), animations: 'disabled' });
  }
});
test('数学参数校验随当前语言显示，修正后可保存重开原始内容', async ({ page }, info) => {
  await page.goto(world.origin + '/math');
  await importLegacy(page, 'dynamic');
  await page.getByRole('button', { name: '设置滑杆', exact: true }).click();
  const name = page.getByLabel('parameter-0-name', { exact: true });
  await name.fill('x');
  await page.getByRole('button', { name: '应用参数 1', exact: true }).click();
  const error = page.locator('.math-dynamic-fields [role=alert]');
  await expect(error).toHaveText('参数名须以英文字母开头，不能使用 x、pi 或函数名。');
  await page.locator('.tb-language-row').click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(error).toHaveText('Parameter names must start with an English letter and cannot be x, pi, or a function name.');
  await expect(name).toHaveValue('x');
  await page.screenshot({ path: info.outputPath('math-parameter-error-en.png'), animations: 'disabled' });
  await page.locator('.tb-language-row').click();
  await page.getByRole('menuitemradio', { name: '简体中文 Chinese (Simplified)', exact: true }).click();
  await expect(error).toHaveText('参数名须以英文字母开头，不能使用 x、pi 或函数名。');
  await name.fill('b');
  await page.getByRole('button', { name: '应用参数 1', exact: true }).click();
  await expect(error).toHaveCount(0);
  await page.getByLabel('作品名称', { exact: true }).fill('教师原文参数探究');
  const saved = page.waitForResponse(response => response.request().method() === 'PUT' && /\/api\/modules\/math\/v1\/works\/[^/]+$/.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  const work = await response.json();
  expect(work.title).toBe('教师原文参数探究');
  expect(work.source.parameters[0]).toMatchObject({ name: 'b', label: '系数 a' });
  expect(work.source.scene.elements[0].expression).toBe('b*(x-h)^2+k');
  await expect(page.locator('.math-workspace-status')).toHaveText('已保存');
  await page.reload();
  await expect(page.getByLabel('作品名称', { exact: true })).toHaveValue(work.title);
  await page.getByRole('button', { name: '设置滑杆', exact: true }).click();
  await expect(name).toHaveValue('b');
  const reopened = await page.request.get(world.origin + '/api/modules/math/v1/works/' + work.id, { headers: headers(page) });
  expect(reopened.status()).toBe(200);
  expect((await reopened.json()).source).toEqual(work.source);
});

test('删除账户提供可执行的危险确认', async ({ page }, info) => {
  await page.getByRole('button', { name: '删除账户…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '删除账户？', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog.getByRole('button', { name: '永久删除账户', exact: true })).toBeDisabled();
  await dialog.getByLabel('输入账户邮箱以确认').fill('teacher-a@example.test');
  await page.screenshot({ path: info.outputPath('delete-account.png'), animations: 'disabled' });
  await expect(dialog.getByRole('button', { name: '永久删除账户', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts').get().n).toBe(1);
  await page.getByRole('button', { name: '删除账户…', exact: true }).click();
  await dialog.getByLabel('输入账户邮箱以确认').fill('teacher-a@example.test');
  await dialog.getByRole('button', { name: '永久删除账户', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts').get().n).toBe(0);
});

test('删除丢失回执后刷新仍可用原请求核实，英文不串入匿名页', async ({ page }, info) => {
  await page.getByRole('button', { name: '语言', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Language', exact: true })).toBeVisible();
  const owner = world.workbench.db.prepare('SELECT accountKey FROM auth_accounts').get().accountKey;
  await page.evaluate(async account => {
    for (const key of [`tb.workbench.v1:${account}:draft`, `teachbuddy:agent:${account}:context`, 'tb.workbench.v1:other-account:draft']) localStorage.setItem(key, 'device-content');
    for (const [database, storeName] of [['teachbuddy.math.uploads', 'pending'], ['teachbuddy-resources-pending', 'requests']]) {
      await new Promise((resolve, reject) => {
        const open = indexedDB.open(database, 1);
        open.onupgradeneeded = () => open.result.createObjectStore(storeName);
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put({ bytes: 'private' }, account + ':pending');
          tx.objectStore(storeName).put({ bytes: 'other' }, 'other-account:pending');
          tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    }
  }, owner);
  let submitted;
  await page.route('**/api/auth/account-deletion', async route => {
    submitted = route.request().postDataJSON();
    await route.fetch();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Delete Account…', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=email]').fill('teacher-a@example.test');
  await dialog.getByRole('button', { name: 'Permanently delete account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry deletion verification', exact: true })).toBeVisible();
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts').get().n).toBe(0);
  await page.unroute('**/api/auth/account-deletion');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry deletion verification', exact: true })).toBeVisible();
  const retry = page.waitForRequest('**/api/auth/account-deletion');
  await page.getByRole('button', { name: 'Retry deletion verification', exact: true }).click();
  expect((await retry).postDataJSON()).toEqual(submitted);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  const device = await page.evaluate(async account => {
    const result = { keys: Object.keys(localStorage).filter(key => key.includes(account) && !key.startsWith('tb.account.deleted:')), other: localStorage.getItem('tb.workbench.v1:other-account:draft'), uploads: [] };
    for (const [database, storeName] of [['teachbuddy.math.uploads', 'pending'], ['teachbuddy-resources-pending', 'requests']]) {
      result.uploads.push(await new Promise((resolve, reject) => {
        const open = indexedDB.open(database, 1);
        open.onsuccess = () => { const db = open.result, request = db.transaction(storeName).objectStore(storeName).getAllKeys(); request.onsuccess = () => { db.close(); resolve(request.result); }; request.onerror = () => reject(request.error); };
      }));
    }
    return result;
  }, owner);
  expect(device).toEqual({ keys: [], other: 'device-content', uploads: [['other-account:pending'], ['other-account:pending']] });
  await page.screenshot({ path: info.outputPath('deleted-login.png'), animations: 'disabled' });
});

test('英文覆盖四模块和帮助，独立浏览器读回，同浏览器换账户恢复默认中文', async ({ page, browser }, info) => {
  await page.getByRole('button', { name: '语言', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json()).values.locale).toBe('en');
  const pages = [];
  for (const route of ['/calendar', '/questions', '/resources', '/math', '/help']) {
    await page.goto(world.origin + route);
    await expect(page.locator('.wb-shell')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const visibleChinese = await page.evaluate(() => [...document.body.querySelectorAll('*')].filter(el => {
      if (!el.checkVisibility() || el.closest('svg,script,style')) return false;
      return [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && /[\u3400-\u9fff]/.test(node.textContent));
    }).map(el => ({ tag: el.tagName, text: [...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim() })));
    pages.push({ route, visibleChinese, text: await page.locator('.wb-shell').innerText() });
    await page.screenshot({ path: info.outputPath(route.slice(1) + '-en.png'), animations: 'disabled' });
  }
  fs.writeFileSync(info.outputPath('english-pages.json'), JSON.stringify(pages, null, 2));
  expect(pages.flatMap(entry => entry.visibleChinese).filter(entry => !['甲老师', '甲'].includes(entry.text))).toEqual([]);
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const second = await context.newPage();
    await second.goto(world.origin); await login(second);
    await second.goto(world.origin + '/settings');
    await expect(second.getByRole('button', { name: 'Language', exact: true })).toBeVisible();
  } finally { await context.close(); }
  await page.goto(world.origin + '/settings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await confirmLogout(page);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await register(page, world, 'teacher-b@example.test');
  const coach = page.getByRole('button', { name: '知道了', exact: true });
  if (await coach.count()) await coach.click();
  await page.goto(world.origin + '/settings');
  await expect(page.getByRole('button', { name: '语言', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('settings-390-light.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.screenshot({ path: info.outputPath('settings-390-dark.png'), animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('语言保存回执丢失后原键核实，保留期间的新选择并同步侧栏', async ({ page }) => {
  const requests = [];
  let lose = true;
  await page.route('**/api/reliability/v1/preferences', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    if (!lose) return route.continue();
    lose = false; await route.fetch(); await route.abort('failed');
  });
  await page.getByRole('button', { name: '语言', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry saving', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('menuitemradio', { name: /^简体中文/ }).click();
  await expect(page.getByRole('button', { name: '语言', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试保存', exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[2].key).not.toBe(requests[0].key);
  await expect.poll(async () => (await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json()).values.locale).toBe('zh-CN');
  await page.locator('.tb-language-row').click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Language', exact: true })).toBeVisible();
});

test('键盘语言菜单、真实偏好冲突、教师原文及英文窄屏危险确认', async ({ page }, info) => {
  const created = await page.request.post(world.origin + '/api/modules/schedule/entries', {
    headers: { ...headers(page), 'X-TeachBuddy-Request': '1', Origin: world.origin, 'Idempotency-Key': crypto.randomUUID() },
    data: { title: '保留中文名称', items: [], time: null, repeat: null, reminder: null },
  });
  expect(created.status()).toBe(201);
  const original = await created.json();
  await page.goto(world.origin + '/settings');
  await expect(page.getByRole('button', { name: '语言', exact: true })).toBeEnabled();
  let conflictInjected = false;
  await page.route('**/api/reliability/v1/preferences', async route => {
    if (route.request().method() !== 'PUT' || conflictInjected) return route.continue();
    conflictInjected = true;
    const baseline = route.request().postDataJSON();
    const competing = await page.request.put(world.origin + '/api/reliability/v1/preferences', {
      headers: { ...headers(page), 'X-TeachBuddy-Request': '1', Origin: world.origin, 'Idempotency-Key': crypto.randomUUID() },
      data: { baseVersion: baseline.baseVersion, values: { ...baseline.values, locale: 'zh-CN', theme: 'dark' } },
    });
    expect(competing.status()).toBe(200);
    await route.continue();
  });
  const sidebar = page.locator('.tb-language-row');
  await sidebar.focus(); await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sidebar).toBeFocused();
  await expect(page.getByRole('button', { name: 'Use saved settings', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use saved settings', exact: true }).click();
  await expect(page.getByRole('button', { name: '语言', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '语言', exact: true }).focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Language', exact: true })).toBeFocused();
  await expect.poll(async () => (await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json()).values.locale).toBe('en');
  const preserved = await page.request.get(world.origin + `/api/modules/schedule/entries/${original.id}`, { headers: headers(page) });
  expect(await preserved.json()).toEqual(original);
  await page.goto(world.origin + '/settings');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Language', exact: true })).toBeEnabled();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: info.outputPath('settings-en-390-dark.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Delete Account…', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete account?', exact: true });
  await expect(confirm).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('delete-en-390-dark.png'), animations: 'disabled' });
  const box = await confirm.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(confirm).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Account…', exact: true })).toBeFocused();
});

test('维护恢复清除删除回执后明确无法核实，可重新准备登录且不清未确认设备资料', async ({ page, browser }, info) => {
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  try { const b = await other.newPage(); await register(b, world, 'teacher-b@example.test'); }
  finally { await other.close(); }
  const account = world.workbench.db.prepare('SELECT accountKey FROM auth_accounts WHERE email=?').get('teacher-a@example.test').accountKey;
  const deviceKey = `tb.workbench.v1:${account}:unconfirmed-note`;
  await page.evaluate(key => localStorage.setItem(key, '未确认设备原文'), deviceKey);
  const bytes = Buffer.from('用于验证删除物理失败的原文件');
  const file = await world.workbench.files.store({ accountKey: account }, { name: 'original.txt', bytes }, { key: crypto.randomUUID(), method: 'POST', path: '/api/workbench/files' });
  const blob = path.join(world.directory, 'files', 'blobs', world.workbench.db.prepare('SELECT blobName FROM materials_files WHERE id=?').get(file.id).blobName);
  fs.unlinkSync(blob); fs.mkdirSync(blob);
  const attempts = [];
  page.on('request', request => { if (request.url().endsWith('/api/auth/account-deletion')) attempts.push(request.postDataJSON()); });
  await page.getByRole('button', { name: '删除账户…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '删除账户？', exact: true });
  await dialog.getByLabel('输入账户邮箱以确认').fill('teacher-a@example.test');
  await dialog.getByRole('button', { name: '永久删除账户', exact: true }).click();
  await expect(page.getByText('删除尚未完成，账户已锁定。请重试完成清理。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '重新准备登录', exact: true })).toHaveCount(0);
  fs.rmdirSync(blob); fs.writeFileSync(blob, bytes);
  await page.route('**/api/auth/account-deletion', async route => { await route.fetch(); await route.abort('failed'); });
  await page.getByRole('button', { name: '重试核实删除', exact: true }).click();
  await expect(page.getByText('删除结果尚未确认。请使用原请求核实，不要将登录失效当作删除成功。', { exact: true })).toBeVisible();
  expect(attempts[1]).toEqual(attempts[0]);
  await page.unroute('**/api/auth/account-deletion');
  const source = world.directory, archived = source + '-backup', restored = source + '-restored';
  extraDirectories.push(source, archived);
  await world.close();
  await backup({ database: path.join(source, 'workspace.sqlite'), files: path.join(source, 'files'), target: archived, stopped: true });
  const recovery = restore({ source: archived, target: restored, stopped: true });
  expect(recovery.auth.first.removed.deletions).toBe(1);
  activate({ target: restored, stopped: true });
  world = await createIntegration({ directory: restored, port: 48967 });
  const verify = page.waitForResponse('**/api/auth/account-deletion');
  await page.getByRole('button', { name: '重试核实删除', exact: true }).click();
  expect((await verify).status()).toBe(409);
  await expect(page.getByText('浏览器验证信息已失效，原删除结果无法继续核实。服务器可能已从备份恢复。重新登录后请核对账户和资料。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新准备登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), deviceKey)).toBe('未确认设备原文');
  expect(await page.evaluate(() => sessionStorage.getItem('teachbuddy:account-deletion'))).toBe(null);
  await page.screenshot({ path: info.outputPath('restored-deletion-login.png'), animations: 'disabled' });
  await login(page, 'teacher-b@example.test');
  await expect(page.locator('.wb-shell')).toBeVisible();
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts WHERE email=?').get('teacher-a@example.test').n).toBe(0);
  await page.reload();
  await expect(page.locator('.wb-shell')).toBeVisible();
});

test('设置语言菜单的 Tab 和离焦关闭后延续原顺序', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '语言', exact: true });
  const grid = page.getByRole('button', { name: '网格', exact: true });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(grid).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitemradio').last()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '深色', exact: true })).toBeFocused();
  await trigger.click();
  await grid.focus();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('背景图片读取完成保留期间更新的背景选择，刷新后仍正确', async ({ page }, info) => {
  const sharp = (await import('sharp')).default;
  const buffer = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#517fa4' } }).png().toBuffer();
  await page.evaluate(() => {
    const decode = window.createImageBitmap;
    window.__backgroundDecode = decode;
    window.createImageBitmap = async (...args) => {
      const bitmap = await decode(...args);
      window.__backgroundDecoded = true;
      await new Promise(resolve => { window.__releaseBackgroundDecode = resolve; });
      return bitmap;
    };
  });
  const image = page.locator('.tbx-bg-options input[type=file]');
  await image.setInputFiles({ name: 'background.png', mimeType: 'image/png', buffer });
  await expect.poll(() => page.evaluate(() => window.__backgroundDecoded)).toBe(true);
  const circles = page.getByRole('button', { name: '圆形', exact: true });
  await circles.click();
  await expect(circles).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { window.createImageBitmap = window.__backgroundDecode; window.__releaseBackgroundDecode(); });
  await expect(page.locator('.tbx-spinner')).toHaveCount(0);
  await expect(circles).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  await page.screenshot({ path: info.outputPath('latest-background-selection.png') });
  await page.reload();
  await expect(circles).toHaveAttribute('aria-pressed', 'true');
  await image.setInputFiles({ name: 'background.png', mimeType: 'image/png', buffer });
  await expect(page.getByRole('button', { name: '自定义背景', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.settings-save-status')).toHaveText('已保存');
});

test('资料包下载与删除完成后保留弹层焦点，可继续键盘操作', async ({ page }, info) => {
  const trigger = page.getByRole('button', { name: '导出数据', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '导出个人资料', exact: true });
  await expect(dialog.getByRole('button', { name: '下载', exact: true })).toBeVisible({ timeout: 30000 });
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载', exact: true }).click();
  await downloaded;
  await expect(dialog.getByRole('button', { name: '下载', exact: true })).toBeEnabled();
  await expect(dialog.locator('.settings-confirm-actions button')).toBeFocused();
  await dialog.getByRole('button', { name: '删除资料包', exact: true }).click();
  await dialog.locator('.settings-confirm-copy > p').first().click();
  await expect(dialog.getByRole('button', { name: '删除资料包', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '删除资料包', exact: true }).click();
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(dialog.locator('.reliability-list li')).toHaveCount(0);
  await expect(dialog.locator('.settings-confirm-actions button')).toBeFocused();
  await page.screenshot({ path: info.outputPath('export-deleted-focus.png') });
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '关闭', exact: true }).first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '签署协议', exact: true })).toBeFocused();
});
