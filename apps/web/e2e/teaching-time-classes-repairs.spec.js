import fs from 'node:fs';
// T53 ff248141 repair scenarios replayed with the T51-MATH isolated composition, port and outputs.
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createTeachingTimeClassesService, T51_DATA_DIR, T51_ORIGIN } from './teaching-time-classes/service.js';
import { bootstrapPrincipal } from './fixtures/first-flow/identity.js';

const dataDir = T51_DATA_DIR;
const origin = T51_ORIGIN;
const evidence = path.resolve('test-results/evidence/T51-MATH/v1/inherited-repairs');
fs.mkdirSync(evidence, { recursive: true });
const records = '/api/modules/classes/v2/records';
const entries = '/api/modules/schedule/entries';
const notices = '/api/modules/schedule/notifications';
let runner;
let now;
const service = createTeachingTimeClassesService({webDist:path.resolve('apps/web/dist'),clock:()=>new Date(now)});
const entryInput = {
  title: '定向回归课程', items: [],
  time: { date: '2026-09-21', startTime: '15:00', durationMinutes: 90, timeZone: 'Asia/Shanghai' },
  repeat: null, course: { classId: null, lessonId: null, recordIds: [] },
  reminder: { side: 'before', minutes: 10 }
};
async function write(page, url, data) {
  const response = await page.request.post(origin + url, {
    data, headers: { Origin: origin, 'X-TeachBuddy-Request': '1', 'Idempotency-Key': randomUUID() }
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function read(page, url) {
  const response = await page.request.get(origin + url);
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(evidence, `${name}.png`), animations: 'disabled' });
}
async function composer(page) {
  const classroom = await write(page, '/api/modules/classes/items', { name: '快记回归班' });
  await page.goto(origin + '/classes/' + classroom.id);
  return classroom;
}
// Hold the actual committed response, never synthesize a business success.
async function holdSave(page) {
  let release;
  let committed;
  const done = new Promise(resolve => { committed = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const requests = [];
  await page.route('**' + records, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() });
    const response = await route.fetch();
    committed();
    const action = await gate;
    if (action === 'abort') await route.abort('failed');
    else await route.fulfill({ response });
  });
  return { done, release, requests };
}
const input = page => page.getByRole('textbox', { name: '写一句', exact: true });
const save = page => page.locator('[data-region=record-composer]').getByRole('button', { name: '保存', exact: true });
const status = page => page.locator('[data-region=composer-status]');

test.use({ baseURL: origin, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ context }) => {
  now = '2026-09-21T06:00:00Z';
  runner = await service.start({reset:true});
  await bootstrapPrincipal(context, 'fixture-teacher-a', { origin, dataDir });
});
test.afterEach(async () => { await service.stop(); });

test('D03: slow committed response preserves new text and supplementary draft, then saves it separately', async ({ page }) => {
  const classroom = await composer(page);
  await input(page).fill('原始提交');
  const held = await holdSave(page);
  await save(page).click(); await held.done;
  await input(page).fill('保存期间的新草稿');
  await page.getByRole('button', { name: '补充', exact: true }).click();
  await page.getByRole('textbox', { name: '教学位置', exact: true }).fill('新位置');
  await shot(page, 'slow-before-response');
  held.release();
  await expect(page.locator('[data-region=record-rows]')).toContainText('原始提交');
  await expect(input(page)).toHaveValue('保存期间的新草稿');
  await expect(page.getByRole('textbox', { name: '教学位置', exact: true })).toHaveValue('新位置');
  await expect(status(page)).toContainText('新输入');
  expect((await read(page, records + '?classId=' + classroom.id)).items.map(x => x.note)).toEqual(['原始提交']);
  await shot(page, 'slow-after-response');
  await page.reload();
  await expect(input(page)).toHaveValue('保存期间的新草稿');
  await page.unroute('**' + records);
  await save(page).click();
  await expect(input(page)).toHaveValue('');
  await expect.poll(async () => (await read(page, records + '?classId=' + classroom.id)).items.length).toBe(2);
});

test('D03: lost response survives reload and original-key retry without deleting the new draft', async ({ page }) => {
  const classroom = await composer(page);
  await input(page).fill('丢响应的原句');
  const held = await holdSave(page);
  await save(page).click(); await held.done;
  await input(page).fill('丢响应期间的新句'); held.release('abort');
  await expect(status(page)).toContainText('暂时无法确认');
  await page.unroute('**' + records);
  await page.reload();
  await expect(input(page)).toHaveValue('丢响应期间的新句');
  const retry = page.waitForRequest(request => request.url().endsWith(records) && request.method() === 'POST');
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  const request = await retry;
  expect(request.headers()['idempotency-key']).toBe(held.requests[0].key);
  expect(request.postDataJSON()).toEqual(held.requests[0].body);
  await expect(status(page)).toContainText('已保存');
  await expect(input(page)).toHaveValue('丢响应期间的新句');
  expect((await read(page, records + '?classId=' + classroom.id)).items).toHaveLength(1);
  await shot(page, 'lost-response-retried');
});

for (const panel of ['closed', 'AI 助理', '安排']) {
  test(`D01: tablet notifications remain operable with ${panel}`, async ({ page }) => {
    const entry = await write(page, entries, entryInput);
    now = '2026-09-21T09:00:00Z';
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/calendar');
    if (panel !== 'closed') {
      await page.getByRole('button', { name: 'AI 助理', exact: true }).first().click();
      await page.getByRole('textbox', { name: 'AI 输入' }).fill('保留 AI 草稿');
      if (panel === '安排') await page.getByRole('tab', { name: '安排', exact: true }).click();
    }
    const bell = page.getByRole('button', { name: /^通知/ });
    await bell.click();
    await expect(page.locator('[data-notification-id]')).toHaveCount(1);
    await shot(page, `notifications-${panel}`);
    await page.getByRole('button', { name: '全部已读', exact: true }).click({ timeout: 2500 });
    await expect.poll(async () => (await read(page, notices)).unreadCount).toBe(0);
    await page.keyboard.press('Escape'); await expect(bell).toBeFocused();
    await bell.click();
    await page.locator('[data-notification-id]').click();
    await expect(page).toHaveURL(new RegExp(`entry=${entry.id}`));
    await expect(page.locator('[name=entry-title]')).toHaveValue(entryInput.title);
    await bell.click(); await page.getByRole('button', { name: '清空', exact: true }).click();
    await expect(page.getByText('暂无通知', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    if (panel !== 'closed') {
      await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'AI 输入' })).toHaveValue('保留 AI 草稿');
    }
  });
}

for (const count of [0, 1, 3, 12]) {
  test(`D02: tablet list ${count} items is readable and movable with priority expanded or collapsed`, async ({ page }) => {
    const target = await write(page, entries, { ...entryInput, reminder: null });
    if (count) await write(page, entries, { ...entryInput, title: '', time: null, reminder: null,
      items: Array.from({ length: count }, (_, i) => ({ id: randomUUID(), text: i === 0 ? '长文本'.repeat(50) : `未排期第${i + 1}项`, priority: 'normal' })) });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/calendar');
    await page.getByLabel('开始', { exact: true }).fill('2026-09-21');
    await page.getByLabel('结束', { exact: true }).fill('2026-09-27');
    await page.locator('[data-action=apply-range]').click();
    const list = page.locator('[data-region=unscheduled]');
    await expect(list.locator('[data-item-id]')).toHaveCount(count);
    for (let i = 0; i < 2; i++) {
      if (i) await page.locator('[data-region=priority]').getByRole('button').first().click();
      const content = count ? list.locator('[data-item-id]').last() : list.locator('.wb-empty-note');
      const bounds = await list.evaluate(node => ({ outer: node.getBoundingClientRect().bottom,
        contents: [...node.querySelectorAll('[data-item-id], .wb-empty-note')].map(x => x.getBoundingClientRect().bottom) }));
      expect(bounds.contents.every(bottom => bottom <= bounds.outer)).toBeTruthy();
      await page.locator('.sch-page').hover({ position: { x: 20, y: 200 } });
      await page.mouse.wheel(0, 1200);
      await expect(content).toBeInViewport();
      await shot(page, `list-${count}-priority-${i}`);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    if (count) {
      const priority = page.locator('[data-region=priority]');
      await priority.locator('.sch-priority-row').first().click();
      await expect(page.locator('[name=item-text]').first()).toHaveValue('长文本'.repeat(50));
      await page.locator('[data-region=auxiliary]').getByRole('button', { name: '关闭辅助栏', exact: true }).click();
      const row = list.locator('[data-item-id]').last();
      const id = await row.getAttribute('data-item-id');
      await row.getByRole('combobox').selectOption(target.id);
      await row.getByRole('button', { name: '移入', exact: true }).click();
      await expect(list.locator('[data-item-id]')).toHaveCount(count - 1);
      expect((await read(page, `${entries}/${target.id}`)).items.some(item => item.id === id)).toBeTruthy();
    }
  });
}

test('D03: late response after identity loss cannot erase account A draft or appear in account B', async ({ page, context }) => {
  const classroom = await composer(page);
  await input(page).fill('A 已提交的句子');
  const held = await holdSave(page);
  await save(page).click(); await held.done;
  await input(page).fill('A 仍未提交的草稿');
  await context.clearCookies();
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('[data-region=identity-gate]')).toBeVisible();
  await bootstrapPrincipal(context, 'fixture-teacher-b', { origin, dataDir });
  await page.getByRole('button', { name: '重新检查身份' }).click();
  await expect(page.locator('[data-region=identity-gate]')).toHaveCount(0);
  const delivered = page.waitForResponse(response => response.url().endsWith(records) && response.request().method() === 'POST');
  held.release(); await delivered;
  await page.locator('a[href="/classes"]').click();
  await expect(page.locator('[data-region=class-empty]')).toBeVisible();
  await expect(page.getByText('A 已提交的句子', { exact: true })).toHaveCount(0);
  expect((await page.request.get(origin + records + '?classId=' + classroom.id)).status()).toBe(404);
  await shot(page, 'account-b-after-late-response');
  await context.clearCookies();
  await page.getByRole('link', { name: '日程', exact: true }).click();
  await expect(page.locator('[data-region=identity-gate]')).toBeVisible();
  await bootstrapPrincipal(context, 'fixture-teacher-a', { origin, dataDir });
  await page.getByRole('button', { name: '重新检查身份' }).click();
  await page.locator('a[href="/classes"]').click();
  await page.locator(`[data-class-id="${classroom.id}"]`).click();
  await expect(input(page)).toHaveValue('A 仍未提交的草稿');
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(status(page)).toContainText('已保存');
  await expect(input(page)).toHaveValue('A 仍未提交的草稿');
  expect((await read(page, records + '?classId=' + classroom.id)).items).toHaveLength(1);
  await shot(page, 'account-a-restored-draft');
});

test('D03: changing only the record date and supplementary field keeps the whole draft', async ({ page }) => {
  await composer(page);
  await input(page).fill('正文保持相同');
  const held = await holdSave(page);
  await save(page).click(); await held.done;
  await page.getByLabel('记录日期', { exact: true }).fill('2026-09-20');
  await page.getByRole('button', { name: '补充', exact: true }).click();
  await page.getByLabel('下次备注', { exact: true }).fill('保存期间补写');
  held.release();
  await expect(status(page)).toContainText('新输入');
  await expect(input(page)).toHaveValue('正文保持相同');
  await expect(page.getByLabel('记录日期', { exact: true })).toHaveValue('2026-09-20');
  await expect(page.getByLabel('下次备注', { exact: true })).toHaveValue('保存期间补写');
  await shot(page, 'supplementary-only-draft');
});
