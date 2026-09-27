import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { http, C, R } from '../../api/test/teaching-time-classes-materials-fixture.js';

let world, call, directory, teachingTime;
test.beforeEach(async ({ page }) => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classes-capabilities-'));
  teachingTime = new Date('2026-09-25T01:00:00Z');
  world = await createIntegration({ directory, workbenchClock: () => teachingTime });
  const { client } = await registerMath(world, 'classes-capabilities@example.test');
  call = http(client);
  await page.goto(`${world.origin}/classes`);
  await page.getByLabel('邮箱', { exact: true }).fill('classes-capabilities@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
});
test.afterEach(async ({ context }, info) => {
  await context.close(); await world?.close();
  if (info.status === info.expectedStatus) fs.rmSync(directory, { recursive: true });
});
async function createClass(page, name = '高一（1）班') {
  await page.getByRole('button', { name: '创建班级', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '创建班级' });
  await dialog.getByLabel('班级名称').fill(name);
  await dialog.getByRole('button', { name: '创建班级', exact: true }).click();
  await expect(page.getByLabel('写一句', { exact: true })).toBeVisible();
}
async function saveRecord(page, text) {
  await page.getByLabel('写一句', { exact: true }).fill(text);
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('');
}
async function position(page, value) {
  await page.getByRole('button', { name: '添加补充', exact: true }).click();
  await page.getByRole('menuitem', { name: '补充教学进度' }).click();
  await page.getByLabel('教学位置', { exact: true }).fill(value);
}
const rows = page => page.locator('[data-region=record-rows] > li');

test('补记历史后新的空白记录回到今天，刷新仍是今天', async ({ page }) => {
  await createClass(page);
  const today = await page.getByLabel('记录日期', { exact: true }).inputValue();
  await page.getByLabel('记录日期', { exact: true }).fill('2025-09-01');
  await saveRecord(page, '补记去年的课堂');
  await expect(page.getByLabel('记录日期', { exact: true })).toHaveValue(today);
  await page.reload();
  await expect(page.getByLabel('记录日期', { exact: true })).toHaveValue(today);
});

test('修改同一天较早记录的文字，不会把教学进度倒退', async ({ page }) => {
  await createClass(page);
  await position(page, '例题1'); await saveRecord(page, '上午课');
  teachingTime = new Date('2026-09-25T07:00:00Z');
  await position(page, '例题3'); await saveRecord(page, '下午课');
  teachingTime = new Date('2026-09-25T10:00:00Z');
  await rows(page).filter({ hasText: '上午课' }).getByRole('button', { name: '编辑记录' }).click();
  await page.getByLabel('编辑记录内容').fill('上午课，修正错字');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.locator('[data-region=record-editor] [data-save-status]')).toHaveAttribute('data-save-status', 'saved');
  await expect(page.locator('[data-region=latest-position]')).toContainText('例题3');
});

test('一份关联资料读取失败时仍能阅读与编辑课堂正文，并重试资料', async ({ page }) => {
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '单调性备课', intro: { version: 1, blocks: [] }, sections: [], materials: [] }, 201);
  await createClass(page);
  await page.getByRole('button', { name: '关联资料', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '关联资料' });
  await picker.getByRole('button', { name: '单调性备课', exact: true }).click();
  await picker.getByRole('button', { name: '加入记录（1）' }).click();
  await saveRecord(page, '资料故障也要保留的课堂原文');
  await saveRecord(page, '没有关联的正常记录');
  const port = world.workbench.loader.get('lessons').port;
  const original = port.readForTeachingLink;
  port.readForTeachingLink = () => { throw Object.assign(new Error('isolated source unavailable'), { status: 503 }); };
  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).filter({ hasText: '资料故障也要保留的课堂原文' })).toBeVisible();
  await expect(page.getByText('资料暂不可用', { exact: true })).toBeVisible();
  await rows(page).filter({ hasText: '资料故障也要保留的课堂原文' }).getByRole('button', { name: '编辑记录' }).click();
  await page.getByLabel('编辑记录内容').fill('资料不可用期间仍可编辑');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.locator('[data-region=record-editor] [data-save-status]')).toHaveAttribute('data-save-status', 'saved');
  await page.getByRole('button', { name: '返回记录', exact: true }).click();
  await expect(rows(page).filter({ hasText: '资料不可用期间仍可编辑' })).toContainText('资料暂不可用');
  port.readForTeachingLink = original;
  await page.getByRole('button', { name: '重试关联资料' }).click();
  await expect(page.getByText('资料暂不可用', { exact: true })).toHaveCount(0);
});

test('主页对照各班进度，记录按关键词、日期和内容查找，筛选与草稿互不干扰', async ({ page }) => {
  await createClass(page);
  await position(page, '单调性定义');
  await page.getByLabel('记录日期', { exact: true }).fill('2025-09-01');
  await saveRecord(page, '学生对任意两个数有疑问');
  await position(page, '例题3');
  await page.getByLabel('记录日期', { exact: true }).fill('2026-09-25');
  await saveRecord(page, '本周练习已讲完');
  await page.getByLabel('写一句', { exact: true }).fill('筛选期间的草稿');
  await page.getByRole('button', { name: '查找记录', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索课堂记录' }).fill('任意');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('2025年9月1日');
  await page.reload();
  await expect(page.getByRole('searchbox', { name: '搜索课堂记录' })).toHaveValue('任意');
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('筛选期间的草稿');
  await page.getByRole('button', { name: '清除筛选' }).click();
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await page.getByLabel('从哪天').fill('2026-09-01');
  await page.getByLabel('到哪天').fill('2026-09-30');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('本周练习');
  await page.getByRole('combobox', { name: '记录内容', exact: true }).selectOption('commonIssues');
  await expect(page.getByText('没有符合条件的记录，试试其他关键词或清除筛选。')).toBeVisible();
  await page.getByRole('button', { name: '关闭查找记录' }).click();
  await expect(page.getByRole('button', { name: '查找记录', exact: true })).toBeFocused();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole('button', { name: '返回班级主页', exact: true }).click();
  await expect(page.locator('.c-home-card').filter({ hasText: '高一（1）班' })).toContainText('例题3');
  await createClass(page, '高一（2）班');
  await position(page, '单调性定义'); await saveRecord(page, '二班刚开始');
  await page.getByRole('button', { name: '返回班级主页', exact: true }).click();
  await expect(page.locator('.c-home-card').filter({ hasText: '高一（1）班' })).toContainText('例题3');
  await expect(page.locator('.c-home-card').filter({ hasText: '高一（2）班' })).toContainText('单调性定义');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('空白表单跨日更新，已有草稿和手选日期保持原样', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-24T15:59:00Z') });
  await createClass(page);
  await expect(page.getByLabel('记录日期', { exact: true })).toHaveValue('2026-09-24');
  await page.clock.fastForward(90000);
  await expect(page.getByLabel('记录日期', { exact: true })).toHaveValue('2026-09-25');
  await page.getByLabel('写一句', { exact: true }).fill('昨天未保存的草稿');
  await page.clock.fastForward(24 * 3600 * 1000);
  await expect(page.getByLabel('记录日期', { exact: true })).toHaveValue('2026-09-25');
  await page.reload();
  await expect(page.getByLabel('记录日期', { exact: true })).toHaveValue('2026-09-25');
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('昨天未保存的草稿');
});

test('课前回顾保留原文，过时想法可停止提示并在记录菜单恢复', async ({ page }) => {
  await createClass(page);
  for (const [action, label, value] of [
    ['记下未讲内容', '未讲内容', '课后练习第2题'],
    ['记录共性问题', '共性问题', '对任意性的理解不牢'],
    ['记下下次教学想法', '下次备注', '用反例复习定义']
  ]) {
    await page.getByRole('button', { name: '添加补充', exact: true }).click();
    await page.getByRole('menuitem', { name: action }).click();
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await saveRecord(page, '课堂小结');
  await page.getByRole('button', { name: '课前回顾', exact: true }).click();
  await expect(page.locator('[data-region=class-review]')).toContainText('课后练习第2题');
  await expect(page.locator('[data-region=class-review]')).toContainText('对任意性的理解不牢');
  await page.getByRole('button', { name: '不再提示这条想法', exact: true }).click();
  await expect(page.locator('[data-region=latest-next-note]')).toHaveCount(0);
  await expect(rows(page)).toContainText('用反例复习定义');
  await page.reload();
  await expect(page.locator('[data-region=latest-next-note]')).toHaveCount(0);
  await expect(page.locator('[data-region=class-review]')).not.toContainText('用反例复习定义');
  await rows(page).getByRole('button', { name: '记录操作' }).click();
  await page.getByRole('menuitem', { name: '恢复想法提示' }).click();
  await expect(page.locator('[data-region=latest-next-note]')).toContainText('用反例复习定义');
});

test('单条记录彻底删除可取消，响应丢失后刷新仍可确认且其他记录保留', async ({ page }) => {
  await createClass(page);
  await saveRecord(page, '需要永久移除的记录');
  await saveRecord(page, '需要保留的记录');
  await rows(page).filter({ hasText: '需要永久移除的记录' }).getByRole('button', { name: '记录操作' }).click();
  await page.getByRole('menuitem', { name: '删除记录', exact: true }).click();
  await page.getByRole('dialog', { name: '删除记录', exact: true }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: '教学记录选项' }).click();
  await page.getByRole('menuitem', { name: '已删除的记录' }).click();
  await rows(page).getByRole('button', { name: '记录操作' }).click();
  await page.getByRole('menuitem', { name: '彻底删除记录' }).click();
  await page.getByRole('dialog', { name: '彻底删除记录', exact: true }).getByRole('button', { name: '取消' }).click();
  await expect(rows(page)).toHaveCount(1);
  let dropped = false;
  await page.route('**/api/modules/classes/v2/records/*/purge', async route => {
    if (!dropped) { dropped = true; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await rows(page).getByRole('button', { name: '记录操作' }).click();
  await page.getByRole('menuitem', { name: '彻底删除记录' }).click();
  await page.getByRole('dialog', { name: '彻底删除记录', exact: true }).getByRole('button', { name: '彻底删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试删除记录' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '重试删除记录' }).click();
  await expect(page.getByRole('button', { name: '重试删除记录' })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(0);
  await page.getByRole('button', { name: '返回教学记录', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText('需要保留的记录');
});

test('公式与图片按需加入，保存重开可编辑，原文字中的美元符号保持原样', async ({ page }) => {
  await createClass(page);
  await page.getByRole('button', { name: '公式与图片', exact: true }).click();
  await page.getByRole('button', { name: '公式', exact: true }).click();
  const formula = page.getByRole('textbox', { name: '课堂补充公式 1源', exact: true });
  await formula.click();
  await formula.pressSequentially('x^2 + 1');
  await expect(formula).toHaveValue('x^2 + 1');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '图片', exact: true }).click();
  await (await chooser).setFiles('apps/web/e2e/fixtures/materials-questions/figure.png');
  await expect(page.locator('.c-content-editor img')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).locator('[data-formula-source="x^2 + 1"]')).toBeVisible();
  await expect(rows(page).locator('img')).toBeVisible();
  await page.reload();
  await expect(rows(page).locator('img')).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await rows(page).locator('img').scrollIntoViewIfNeeded();
    const box = await rows(page).locator('img').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`content-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await rows(page).getByRole('button', { name: '编辑记录', exact: true }).click();
  await expect(formula).toHaveValue('x^2 + 1');
  await page.getByRole('textbox', { name: '编辑记录内容', exact: true }).fill('价格 $5 与 $10 是原始文字。');
  await formula.fill('\\unsupportedCommand{x}');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.locator('[data-region=record-editor] [data-save-status]')).toHaveAttribute('data-save-status', 'saved');
  await page.getByRole('button', { name: '返回记录', exact: true }).click();
  await expect(rows(page)).toContainText('价格 $5 与 $10 是原始文字。');
  await expect(rows(page).locator('.c-record-content [data-formula-failed]')).toContainText('unsupportedCommand');
  await page.getByRole('button', { name: '查找记录', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索课堂记录' }).fill('unsupportedCommand');
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole('button', { name: '关闭查找记录' }).click();
  await rows(page).getByRole('button', { name: '编辑记录', exact: true }).click();
  await page.getByRole('button', { name: '删除课堂补充图片 1', exact: true }).click();
  await page.getByRole('button', { name: '删除课堂补充公式 1', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.locator('[data-region=record-editor] [data-save-status]')).toHaveAttribute('data-save-status', 'saved');
  await page.reload();
  await expect(page.getByRole('textbox', { name: '编辑记录内容', exact: true })).toHaveValue('价格 $5 与 $10 是原始文字。');
  await expect(page.locator('[data-region=record-editor] img')).toHaveCount(0);
});

test('图片上传响应丢失后刷新，原文件确认不重复上传且继续原草稿', async ({ page }) => {
  await createClass(page);
  await page.getByRole('textbox', { name: '写一句', exact: true }).fill('图片上传期间的原草稿');
  await page.getByRole('button', { name: '公式与图片', exact: true }).click();
  let dropped = false;
  await page.route('**/api/workbench/files', async route => {
    if (route.request().method() === 'POST' && !dropped) { dropped = true; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '图片', exact: true }).click();
  await (await chooser).setFiles('apps/web/e2e/fixtures/materials-questions/figure.png');
  await expect(page.getByRole('button', { name: '重试上传图片', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeDisabled();
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB); let fail = true;
    indexedDB.open = (...args) => {
      if (args[0] === 'teachbuddy.classes.uploads' && fail) { fail = false; throw new Error('图片存储暂不可用'); }
      return open(...args);
    };
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('图片存储暂不可用');
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '重试读取图片状态', exact: true }).click();
  const reselect = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '重新选择原图片并确认', exact: true }).click();
  await (await reselect).setFiles('apps/web/e2e/fixtures/materials-questions/figure.png');
  await expect(page.locator('.c-content-editor img')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: '写一句', exact: true })).toHaveValue('图片上传期间的原草稿');
  expect(world.workbench.db.prepare('SELECT count(*) n FROM materials_files').get().n).toBe(1);
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(rows(page).locator('img')).toBeVisible();
});

test('没有图片待确认时，图片存储故障不影响一句话记录', async ({ page }) => {
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => {
      if (args[0] === 'teachbuddy.classes.uploads') throw new Error('图片存储暂不可用');
      return open(...args);
    };
  });
  await page.reload();
  await createClass(page);
  await expect(page.getByRole('button', { name: '保存记录', exact: true })).toBeEnabled();
  await saveRecord(page, '不用图片也可以继续记课');
  await expect(rows(page)).toContainText('不用图片也可以继续记课');
});

test('跨班移动可以取消，未知结果刷新后确认，原记录与新记录草稿分别保留', async ({ page }) => {
  await createClass(page, '原班级');
  await saveRecord(page, '准备移动的课堂记录');
  const sourceClass = (await call('GET', C)).items.find(item => item.name === '原班级');
  const original = (await call('GET', `${R}?classId=${sourceClass.id}`)).items[0];
  await page.getByRole('button', { name: '返回班级主页', exact: true }).click();
  await createClass(page, '目标班级');
  const target = (await call('GET', C)).items.find(item => item.name === '目标班级');
  await page.getByRole('button', { name: '返回班级主页', exact: true }).click();
  await page.getByRole('button', { name: '原班级', exact: true }).click();
  await page.getByRole('textbox', { name: '写一句', exact: true }).fill('下一节课的草稿');
  await rows(page).getByRole('button', { name: '记录操作' }).click();
  await page.getByRole('menuitem', { name: '移到其他班级' }).click();
  await page.getByRole('dialog', { name: '移动课堂记录' }).getByRole('button', { name: '取消' }).click();
  await expect(rows(page)).toHaveCount(1);
  await rows(page).getByRole('button', { name: '编辑记录', exact: true }).click();
  await page.getByRole('textbox', { name: '编辑记录内容', exact: true }).fill('尚未保存的修改');
  await page.getByRole('button', { name: '返回记录', exact: true }).click();
  await rows(page).getByRole('button', { name: '记录操作' }).click();
  await page.getByRole('menuitem', { name: '移到其他班级' }).click();
  await expect(page.getByRole('dialog', { name: '移动课堂记录' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '编辑记录内容', exact: true })).toHaveValue('尚未保存的修改');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.locator('[data-region=record-editor] [data-save-status]')).toHaveAttribute('data-save-status', 'saved');
  await page.getByRole('button', { name: '返回记录', exact: true }).click();
  let dropped = false;
  await page.route('**/api/modules/classes/v2/records/*/move', async route => {
    if (!dropped) { dropped = true; await route.fetch(); await route.abort('failed'); } else await route.continue();
  });
  await rows(page).getByRole('button', { name: '记录操作' }).click();
  await page.getByRole('menuitem', { name: '移到其他班级' }).click();
  await page.getByRole('combobox', { name: '移到哪个班级' }).selectOption(target.id);
  await page.getByRole('button', { name: '移动并打开记录', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试移动记录', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '重试移动记录', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/classes/${target.id}/records/`));
  await expect(page.getByRole('textbox', { name: '编辑记录内容', exact: true })).toHaveValue('尚未保存的修改');
  expect((await call('GET', `${R}?classId=${target.id}`)).items).toHaveLength(1);
  expect((await call('GET', `${R}/${original.id}`)).deletedAt).not.toBeNull();
  await page.getByRole('button', { name: '返回班级主页', exact: true }).click();
  await page.getByRole('button', { name: '原班级', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '写一句', exact: true })).toHaveValue('下一节课的草稿');
  await expect(rows(page)).toHaveCount(0);
});

test('升级前不含补充文稿的待确认请求，刷新确认后不把已保存文字当成新草稿', async ({ page }) => {
  await createClass(page);
  let dropped = false;
  await page.route(`**${R}`, async route => {
    if (route.request().method() === 'POST' && !dropped) {
      dropped = true;
      const body = route.request().postDataJSON(); delete body.content;
      await route.fetch({ postData: JSON.stringify(body) }); await route.abort('failed');
    } else await route.continue();
  });
  await page.getByLabel('写一句', { exact: true }).fill('旧版本保存结果待确认');
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试确认', exact: true })).toBeVisible();
  // A retained device fixture from before optional record content existed.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      let envelope; try { envelope = JSON.parse(localStorage.getItem(key)); } catch { continue; }
      if (envelope?.name?.startsWith('pending:class-record-new:')) delete envelope.value.payload.body.content;
      else if (envelope?.name?.startsWith('draft:class-record-new:')) delete envelope.value.input.content;
      else continue;
      localStorage.setItem(key, JSON.stringify(envelope));
    }
  });
  await page.reload();
  await page.getByRole('button', { name: '重试确认', exact: true }).click();
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('');
  await expect(rows(page)).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel('写一句', { exact: true })).toHaveValue('');
  await expect(rows(page)).toHaveCount(1);
});
