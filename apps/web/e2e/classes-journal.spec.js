import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { http, C, R, record } from '../../api/test/teaching-time-classes-materials-fixture.js';

let world, call, directory;
test.beforeEach(async ({ page }) => {
  if (!process.env.WORKBENCH_WEB_DIST) throw new Error('Set WORKBENCH_WEB_DIST to an isolated production build.');
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classes-journal-'));
  world = await createIntegration({ directory });
  const { client } = await registerMath(world, 'classes-journal@example.test');
  call = http(client);
  await page.goto(`${world.origin}/classes`);
  await page.getByLabel('邮箱', { exact: true }).fill('classes-journal@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.c-classes')).toBeVisible();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
});
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world?.close();
  if (info.status === info.expectedStatus) fs.rmSync(directory, { recursive: true });
});
async function createClass(page, name = '高一（1）班') {
  await page.getByRole('button', { name: '创建班级', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '创建班级' });
  await expect(dialog.getByLabel('班级名称')).toBeFocused();
  await dialog.getByLabel('班级名称').fill(name);
  await dialog.getByRole('button', { name: '创建班级', exact: true }).click();
  await expect(page.getByRole('button', { name: `切换班级，当前：${name}` })).toBeVisible();
  await expect(dialog).toHaveCount(0);
}
async function supplement(page, action, label, value) {
  await page.getByRole('button', { name: '添加补充', exact: true }).click();
  await page.getByRole('menuitem', { name: action }).click();
  await expect(page.getByLabel(label, { exact: true })).toBeFocused();
  await page.getByLabel(label, { exact: true }).fill(value);
}
const rows = page => page.locator('[data-region=record-rows] > li');
async function archiveCurrent(page) {
  await page.getByRole('button', { name: '班级操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '归档班级', exact: true }).click();
  await page.getByRole('dialog', { name: '归档班级', exact: true }).getByRole('button', { name: '归档', exact: true }).click();
  await expect(page).toHaveURL(`${world.origin}/classes`);
}
async function openArchives(page) {
  await page.getByRole('button', { name: '班级管理', exact: true }).click();
  await page.getByRole('menuitem', { name: '已归档班级', exact: true }).click();
  await expect(page.getByRole('heading', { name: '已归档班级', exact: true })).toBeVisible();
}

test('归档班级后回到班级主页，不继续展示刚移走的班级', async ({ page }) => {
  await createClass(page);
  await archiveCurrent(page);
  await expect(page).toHaveURL(`${world.origin}/classes`);
  await expect(page.locator('[data-region=class-detail]')).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(`${world.origin}/classes`);
  await expect(page.locator('[data-region=class-detail]')).toHaveCount(0);
});

test('创建班级后能返回班级主页，主页刷新后仍停在主页', async ({ page }) => {
  await createClass(page);
  await page.getByLabel('写一句', { exact: true }).fill('返回主页时保留的草稿');
  await page.getByRole('button', { name: '返回班级主页', exact: true }).click();
  await expect(page).toHaveURL(`${world.origin}/classes`);
  await expect(page.getByRole('button', { name: '高一（1）班', exact: true })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(`${world.origin}/classes`);
  await expect(page.locator('[data-region=class-detail]')).toHaveCount(0);
  await page.getByRole('button', { name: '高一（1）班', exact: true }).click();
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('返回主页时保留的草稿');
});

test('从用途空态完成一句话记录，编辑与新建互斥，重新打开仍有内容', async ({ page }) => {
  await expect(page.getByText('每个班，都有自己的教学记录')).toBeVisible();
  await expect(page.getByRole('button', { name: '已删除', exact: true })).toHaveCount(0);
  await createClass(page);
  await expect(page.getByLabel('教学位置', { exact: true })).toHaveCount(0);
  await page.getByLabel('写一句', { exact: true }).fill('学生对定义中的任意两个数还不熟。');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('[data-region=latest-position]')).toContainText('最近记录');
  await expect(page.locator('[data-region=latest-position]')).not.toContainText('最近教到');
  await page.getByLabel('写一句', { exact: true }).fill('新记录的草稿');
  await page.getByRole('button', { name: '编辑记录', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '写一句', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('教学位置', { exact: true })).toHaveCount(0);
  await page.getByLabel('编辑记录内容').fill('学生已理解定义，下次继续讲例题。');
  await expect(page.getByRole('button', { name: '保存修改' })).toBeVisible();
  await page.getByLabel('编辑记录内容').press('Control+s');
  await expect(page.locator('[data-region=record-editor] [data-save-status]')).toHaveAttribute('data-save-status', 'saved');
  await page.getByRole('button', { name: '返回记录' }).click();
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('新记录的草稿');
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('学生已理解定义，下次继续讲例题。');
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('新记录的草稿');
});

test('补充逐项出现，关联备课不需要先填进度，保存后按日期显示摘要', async ({ page }) => {
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '函数单调性', intro: { version: 1, blocks: [] }, sections: [], materials: [] }, 201);
  await createClass(page);
  await page.getByRole('button', { name: '关联资料', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '关联资料' });
  await picker.getByRole('button', { name: '函数单调性', exact: true }).click();
  await picker.getByRole('button', { name: '加入记录（1）' }).click();
  await expect(page.getByLabel('教学位置', { exact: true })).toHaveCount(0);
  await supplement(page, '补充教学进度', '教学位置', '单调性定义与例1');
  await expect(page.getByLabel('共性问题', { exact: true })).toHaveCount(0);
  await supplement(page, '记下下次教学想法', '下次备注', '先复习定义，再讲例2');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('[data-region=latest-position]')).toContainText('最近教到');
  await expect(page.locator('[data-region=latest-next-note]')).toContainText('先复习定义，再讲例2');
  await page.reload();
  await expect(rows(page)).toContainText('函数单调性');
  const classes = await call('GET', C);
  const records = await call('GET', `${R}?classId=${classes.items[0].id}`);
  expect(records.items).toHaveLength(1);
  expect(records.items[0].sources[0].id).toBe(lesson.id);
  await page.getByRole('button', { name: '编辑记录', exact: true }).click();
  await page.getByLabel('教学位置', { exact: true }).fill('');
  await expect(page.getByLabel('教学位置', { exact: true })).toBeFocused();
  await expect(page.getByLabel('教学位置', { exact: true })).toBeVisible();
  await page.getByLabel('教学位置', { exact: true }).fill('单调性定义与例2');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.locator('[data-region=latest-position]')).toContainText('单调性定义与例2');
});

test('两班草稿独立，空补充和日期保留，窄屏可切换且没有横向溢出', async ({ page }) => {
  await createClass(page);
  await page.getByRole('button', { name: '添加补充', exact: true }).click();
  await page.getByRole('menuitem', { name: '记录共性问题' }).click();
  await page.getByLabel('记录日期', { exact: true }).fill('2026-09-20');
  await createClass(page, '高一（2）班');
  await expect(page.getByLabel('共性问题', { exact: true })).toHaveCount(0);
  await page.getByLabel('写一句', { exact: true }).fill('二班已经讲到例3');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole('button', { name: /切换班级，当前/ }).click();
  await page.getByRole('dialog', { name: '切换班级' }).getByRole('button', { name: '高一（1）班', exact: true }).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByLabel('共性问题', { exact: true })).toBeVisible();
  await expect(page.getByLabel('记录日期', { exact: true })).toHaveValue('2026-09-20');
  await page.reload();
  await expect(page.getByLabel('共性问题', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'AI 助理', exact: true }).click();
  await expect(page.locator('[data-region=auxiliary]')).toBeVisible();
  await expect(page.locator('.c-layout > [data-region=class-list]')).toHaveCount(0);
  await page.getByRole('button', { name: /切换班级，当前/ }).click();
  await page.getByRole('dialog', { name: '切换班级' }).getByRole('button', { name: '高一（2）班', exact: true }).click();
  await expect(page.locator('[data-region=auxiliary]')).toBeVisible();
  await expect(rows(page)).toContainText('二班已经讲到例3');
});

test('记录删除恢复与班级归档恢复，记录不会随归档丢失', async ({ page }) => {
  await createClass(page);
  await page.getByLabel('写一句', { exact: true }).fill('例1已讲完');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: '记录操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '删除记录' }).click();
  await page.getByRole('dialog', { name: '删除记录' }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(rows(page)).toHaveCount(0);
  await page.getByRole('button', { name: '教学记录选项' }).click();
  await page.getByRole('menuitem', { name: '已删除的记录' }).click();
  await expect(rows(page)).toHaveCount(1);
  const recordId = await rows(page).getAttribute('data-record-id');
  const classUrl = page.url();
  await page.goto(`${classUrl}/records/${recordId}`);
  await expect(rows(page)).toContainText('例1已讲完');
  await expect(page.getByLabel('编辑记录内容')).toHaveCount(0);
  await page.getByRole('button', { name: '记录操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '恢复记录' }).click();
  await expect(rows(page)).toHaveAttribute('data-record-state', 'active');
  await expect(page.getByLabel('编辑记录内容')).toHaveValue('例1已讲完');
  await page.getByRole('button', { name: '返回记录', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await archiveCurrent(page);
  await openArchives(page);
  await page.getByRole('button', { name: '高一（1）班', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复班级', exact: true })).toBeVisible();
  await expect(rows(page)).toContainText('例1已讲完');
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '恢复班级', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeVisible();
});

test('已归档班级可以取消或确认彻底删除，删除后刷新不再出现', async ({ page }) => {
  await createClass(page);
  const classroom = (await call('GET', C)).items[0];
  await page.getByLabel('写一句', { exact: true }).fill('随班级彻底删除的记录');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  const recordId = await rows(page).getAttribute('data-record-id');
  await archiveCurrent(page);
  await openArchives(page);
  const card = page.locator(`[data-class-id="${classroom.id}"]`);
  await card.getByRole('button', { name: /班级操作/ }).click();
  await page.getByRole('menuitem', { name: '彻底删除', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '彻底删除班级', exact: true });
  await expect(dialog).toContainText('全部课堂记录，无法恢复');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /班级操作/ }).click();
  await page.getByRole('menuitem', { name: '彻底删除', exact: true }).click();
  await dialog.getByRole('button', { name: '彻底删除', exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText('没有已归档的班级', { exact: true })).toBeVisible();
  await page.reload();
  await expect(card).toHaveCount(0);
  await call('GET', `${C}/${classroom.id}`, undefined, 404);
  await call('GET', `${R}/${recordId}`, undefined, 404);
});

test('彻底删除响应丢失后，刷新仍可重试确认', async ({ page }) => {
  await createClass(page);
  await archiveCurrent(page);
  await openArchives(page);
  let lost = false;
  await page.route('**/api/modules/classes/items/*/purge', async route => {
    if (!lost) { lost = true; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByRole('button', { name: /班级操作 ·/ }).click();
  await page.getByRole('menuitem', { name: '彻底删除', exact: true }).click();
  await page.getByRole('dialog', { name: '彻底删除班级', exact: true }).getByRole('button', { name: '彻底删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toHaveCount(0);
  await expect(page.getByText('没有已归档的班级', { exact: true })).toBeVisible();
});

test('保存响应丢失后重试确认不重复记录，并保留期间的新输入', async ({ page }) => {
  await createClass(page);
  let lost = false;
  await page.route(`**${R}`, async route => {
    if (route.request().method() === 'POST' && !lost) {
      lost = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByLabel('写一句', { exact: true }).fill('第一次记录');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  await page.getByLabel('写一句', { exact: true }).fill('后续的新草稿');
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('第一次记录');
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('后续的新草稿');
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('后续的新草稿');
});

test('长记录列表编辑返回阅读位置，菜单快速反向与键盘关闭恢复焦点', async ({ page }) => {
  await createClass(page);
  const classes = await call('GET', C);
  for (let i = 0; i < 12; i += 1) await call('POST', R, record(classes.items[0].id, [], `课堂记录${i}：定义、例题和练习分别讨论，下一节继续。`), 201);
  await page.reload();
  await expect(rows(page)).toHaveCount(12);
  const target = rows(page).nth(8);
  await target.scrollIntoViewIfNeeded();
  const before = await target.evaluate(el => el.getBoundingClientRect().top);
  await target.getByRole('button', { name: '编辑记录', exact: true }).click();
  await target.getByLabel('编辑记录内容').fill('保留阅读位置的修改');
  await target.getByRole('button', { name: '返回记录' }).click();
  await expect(target.getByRole('button', { name: '编辑记录', exact: true })).toBeVisible();
  await expect.poll(() => target.evaluate(el => el.getBoundingClientRect().top)).toBeCloseTo(before, 0);
  await expect(target.getByRole('button', { name: '编辑记录', exact: true })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await target.getByRole('button', { name: '编辑记录', exact: true }).click();
  await expect(target.getByLabel('编辑记录内容')).toHaveValue('保留阅读位置的修改');
  await target.getByRole('button', { name: '返回记录' }).click();
  await expect.poll(() => target.evaluate(el => el.getBoundingClientRect().top)).toBeCloseTo(before, 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const add = page.getByRole('button', { name: '添加补充', exact: true });
  await add.scrollIntoViewIfNeeded();
  const box = await add.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(add).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('menu', { name: '添加补充' })).toHaveCount(0);
  await add.click();
  await page.keyboard.press('Escape');
  await expect(add).toBeFocused();
});
