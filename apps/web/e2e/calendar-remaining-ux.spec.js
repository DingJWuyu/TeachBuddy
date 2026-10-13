import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
const E = '/api/modules/schedule/entries';
const L = '/api/modules/schedule/labels';
let world, client, now, errors;
const entry = (title, patch = {}) => ({ title, items: [], time: { date: '2026-09-25', startTime: '15:00', durationMinutes: 30, timeZone: 'Asia/Shanghai' },
  repeat: null, reminder: null, calendar: { allDay: false, tags: [], notes: '' }, ...patch });
async function call(method, url, body) {
  const r = await client.request(method, url, { body, headers: method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() } });
  expect(r.status, JSON.stringify(r.json)).toBeLessThan(300); return r.json;
}
async function open(page, title) { await page.locator('.cal-upcoming-row').filter({ hasText: title }).click(); }
test.beforeEach(async ({ page }) => {
  now = '2026-09-25T06:00:00Z';
  await page.clock.setFixedTime(new Date(now));
  errors = []; page.on('pageerror', e => errors.push(e.message));
  world = await createIntegration({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-polish-')), workbenchClock: () => new Date(now) });
  ({ client } = await registerMath(world, 'schedule-polish@example.test'));
  await page.goto(`${world.origin}/calendar`);
  await page.getByLabel('邮箱', { exact: true }).fill('schedule-polish@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.cal-page')).toBeVisible();
  const welcome = page.getByRole('button', { name: '知道了', exact: true });
  if (await welcome.isVisible()) await welcome.click();
  await expect(page.locator('.cal-loading')).toHaveCount(0);
});
test.afterEach(async ({ context }, info) => {
  const failed = info.status !== info.expectedStatus || errors.length;
  if (failed) {
    const data = { test: info.title, directory: world.directory, origin: world.origin, time: now, pageErrors: errors, entries: (await call('GET', E)).items };
    fs.writeFileSync(info.outputPath('preserved-case.json'), JSON.stringify(data, null, 2));
  }
  await context.close(); await world.close();
  if (!failed) fs.rmSync(world.directory, { recursive: true, force: true });
  expect(errors).toEqual([]);
});


test('无效结束时间就地提示不挤动布局，关闭保留原时间且不阻塞',async({page})=>{
  const task=await call('POST',E,entry('关闭交互待核对'));
  await page.reload();await open(page,task.title);
  const notes=page.locator('.cal-notes-label');
  const before=await notes.boundingBox();
  await page.locator('[name=entry-end]').fill('14:55');
  await expect(page.locator('[name=entry-end]')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('.cal-time-error')).toContainText('时间无效');
  await expect(page.locator('.cal-time-error')).toHaveCSS('color','rgb(216, 58, 66)');
  await expect(page.locator('.cal-time-error')).toHaveCSS('font-size','11px');
  expect((await notes.boundingBox()).y).toBe(before.y);
  await expect(page.locator('.cal-editor > .cal-error')).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath('invalid-time-inline.png')});
  await page.getByRole('textbox',{name:'备注',exact:true}).fill('无效时间不妨碍保留这条备注');
  await page.getByRole('button',{name:'关闭任务',exact:true}).click();
  await expect(page.locator('.cal-editor')).toHaveCount(0);
  const saved=await call('GET',`${E}/${task.id}`);
  expect(saved.time).toEqual(task.time);
  expect(saved.calendar.notes).toBe('无效时间不妨碍保留这条备注');
  await open(page,task.title);
  await expect(page.locator('[name=entry-end]')).toHaveValue('15:30');
  await page.locator('[name=entry-end]').fill('14:55');
  await page.locator('[name=entry-end]').fill('15:45');
  await expect(page.locator('.cal-time-error')).toHaveCount(0);
  await expect.poll(async()=>(await call('GET',`${E}/${task.id}`)).time.durationMinutes).toBe(45);
});
