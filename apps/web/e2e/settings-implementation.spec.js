import fs from 'node:fs';
import path from 'node:path';
import { backup, restore, activate } from '../../api/src/workbench/reliability/backup.js';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, login, headers, track } from './teaching-time-auth/helpers.mjs';
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
test('删除账户提供可执行的危险确认', async ({ page }, info) => {
  await page.getByRole('button', { name: '删除账户', exact: true }).click();
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
  await page.getByRole('button', { name: '删除账户', exact: true }).click();
  await dialog.getByLabel('输入账户邮箱以确认').fill('teacher-a@example.test');
  await dialog.getByRole('button', { name: '永久删除账户', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
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
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
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


test('英文覆盖六模块和帮助，独立浏览器读回，同浏览器换账户恢复默认中文', async ({ page, browser }, info) => {
  await page.getByRole('button', { name: '语言', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect.poll(async () => (await (await page.request.get(world.origin + '/api/reliability/v1/preferences', { headers: headers(page) })).json()).values.locale).toBe('en');
  const pages = [];
  for (const route of ['/classes', '/calendar', '/questions', '/resources', '/lessons', '/math', '/help']) {
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
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
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
  await page.goto(world.origin + '/classes');
  await page.getByRole('button', { name: '创建班级', exact: true }).first().click();
  const create = page.getByRole('dialog', { name: '创建班级', exact: true });
  await create.getByLabel('班级名称', { exact: true }).fill('保留中文名称');
  await create.getByRole('button', { name: '创建班级', exact: true }).click();
  await expect(create).not.toBeVisible();
  const original = world.workbench.db.prepare('SELECT * FROM classes_items').all();
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
  await page.goto(world.origin + '/classes');
  await expect(page.getByRole('button', { name: '保留中文名称', exact: true })).toBeVisible();
  expect(world.workbench.db.prepare('SELECT * FROM classes_items').all()).toEqual(original);
  await page.goto(world.origin + '/lessons');
  await page.getByRole('button', { name: 'View a lesson plan example', exact: true }).click();
  const example = page.getByRole('dialog', { name: 'Lesson plan example', exact: true });
  await expect(example).toBeVisible();
  expect(await example.innerText()).not.toMatch(/[\u3400-\u9fff]/);
  await page.screenshot({ path: info.outputPath('lesson-example-en.png'), animations: 'disabled' });
  await example.getByRole('button', { name: 'Close example', exact: true }).click();
  await page.goto(world.origin + '/settings');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Language', exact: true })).toBeEnabled();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: info.outputPath('settings-en-390-dark.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete account?', exact: true });
  await expect(confirm).toHaveCSS('opacity', '1');
  await page.screenshot({ path: info.outputPath('delete-en-390-dark.png'), animations: 'disabled' });
  const box = await confirm.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(confirm).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete account', exact: true })).toBeFocused();
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
  await page.getByRole('button', { name: '删除账户', exact: true }).click();
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
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), deviceKey)).toBe('未确认设备原文');
  expect(await page.evaluate(() => sessionStorage.getItem('teachbuddy:account-deletion'))).toBe(null);
  await page.screenshot({ path: info.outputPath('restored-deletion-login.png'), animations: 'disabled' });
  await login(page, 'teacher-b@example.test');
  await expect(page.locator('.wb-shell')).toBeVisible();
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts WHERE email=?').get('teacher-a@example.test').n).toBe(0);
  await page.reload();
  await expect(page.locator('.wb-shell')).toBeVisible();
});
