import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import { emptySource } from '../src/features/math/model.js';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';
import { http, C, R, Q, question, writable, record, doc } from '../../api/test/teaching-time-classes-materials-fixture.js';
const evidence = path.resolve(process.env.MANUAL_LESSONS_EVIDENCE || 'test-results/manual-lessons-evidence');
fs.mkdirSync(evidence, { recursive: true });
let world;
test.afterEach(async ({ context }, info) => { await context.close(); await world?.close(); if (world && info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true }); });
async function setup(page) {
  world = await createIntegration();
  const { client } = await registerMath(world, 'manual-lessons@example.test');
  const call = http(client);
  const lesson = await call('POST', '/api/modules/lessons/v3', { title: '函数专题', intro: doc('从定义出发'), sections: [{ id: crypto.randomUUID(), title: '概念探究', content: doc('讨论定义域'), references: [] }], materials: [] }, 201);
  await page.goto(world.origin);
  await page.getByLabel('邮箱', { exact: true }).fill('manual-lessons@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await page.getByRole('complementary', { name: '工作台导航' }).getByRole('link', { name: /^备课/ }).click();
  await page.getByRole('button', { name: /函数专题/ }).first().click();
  await page.getByRole('button', { name: '编辑备课', exact: true }).click();
  return { call, lesson, client };
}
async function pick(page, name, section = page.locator('[data-section-id]').first()) {
  await section.getByRole('button', { name: '加入材料', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
async function sectionAction(page, title, action) {
  await page.getByRole('button', { name: `环节操作 ${title}`, exact: true }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}
test('备课回看两班反馈并打开原记录', async ({ page }) => {
  const { call, lesson } = await setup(page);
  for (const name of ['高一一班', '高一二班']) {
    const cls = await call('POST', C, { name }, 201);
    await call('POST', R, record(cls.id, [{ kind: 'lesson', id: lesson.id }], `${name}还需巩固定义域`), 201);
  }
  await page.getByText('教学反馈', { exact: true }).click();
  const panel = page.locator('[data-region="source-records-panel"]');
  await expect(panel.locator('[data-source-record-id]')).toHaveCount(2);
  await panel.getByRole('button', { name: /高一二班.*还需巩固定义域/ }).click();
  await expect(page).toHaveURL(/\/classes\/.*\/records\//);
  await expect(page.getByLabel('编辑记录内容', { exact: true })).toHaveValue('高一二班还需巩固定义域');
  await page.getByRole('button', { name: '返回备课现场', exact: true }).click();
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('函数专题');
  await page.screenshot({ path: path.join(evidence, 'feedback.png') });
});
test('当前环节可就地取已有数学作品', async ({ page }) => {
  const { call } = await setup(page);
  const work = await call('POST', '/api/modules/math/v1/works', { title: '定义域公式', source: { ...emptySource('formula'), latex: 'x\\ne-3' }, originalFileId: null }, 201);
  await pick(page, '加入数学作品');
  await expect(page.getByRole('heading', { name: '加入数学作品', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '定义域公式', exact: true }).click();
  await expect(page.locator('.lesson-math-snapshot .katex')).toBeVisible();
  await page.getByRole('checkbox', { name: '选择 定义域公式', exact: true }).check();
  await page.getByRole('button', { name: /^加入 1 (道题|份材料)$/ }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-reference-id]')).toHaveCount(1);
  await page.getByRole('button', { name: '查看来源', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/math\\?workId=${work.id}`));
  await page.getByRole('button', { name: '返回备课现场', exact: true }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(1);
  await pick(page, '加入数学作品');
  await expect(page.getByRole('checkbox', { name: '选择 定义域公式', exact: true })).toBeDisabled();
});

test('取材写入后断线，刷新仍可原键确认且不重复加入', async ({ page }) => {
  const { call, lesson } = await setup(page);
  await call('POST', Q, question('断线取题'), 201);
  await pick(page, '加入题目');
  await page.getByRole('checkbox', { name: '选择 断线取题', exact: true }).check();
  const attempts = [];
  await page.route(`**/api/modules/lessons/v3/${lesson.id}`, async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    if (attempts.length === 1) { await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByRole('button', { name: /^加入 1 (道题|份材料)$/ }).click();
  await expect(page.getByRole('button', { name: '重试确认取材', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '重试确认取材', exact: true }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(1);
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections[0].references).toHaveLength(1);
});

test('取材明确拒绝后可重试或取消，取消不留下待采用引用', async ({ page }) => {
  const { call, lesson } = await setup(page);
  await call('POST', Q, question('第一份材料'), 201);
  await call('POST', Q, question('第二份材料'), 201);
  let reject = true;
  await page.route(`**/api/modules/lessons/v3/${lesson.id}`, async route => {
    if (route.request().method() !== 'PUT' || !reject) return route.continue();
    // Exercise an explicit rejection from the real API, without storing a batch.
    const response = await route.fetch({ postData: JSON.stringify({ ...route.request().postDataJSON(), title: '' }) });
    expect(response.status()).toBe(422);
    await route.fulfill({ response });
  });
  await pick(page, '加入题目');
  await page.getByRole('checkbox', { name: '选择 第一份材料', exact: true }).check();
  await page.getByRole('button', { name: /^加入 1 (道题|份材料)$/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  reject = false;
  await page.getByRole('button', { name: /^加入 1 (道题|份材料)$/ }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(1);
  reject = true;
  await pick(page, '加入题目');
  await page.getByRole('checkbox', { name: '选择 第二份材料', exact: true }).check();
  await page.getByRole('button', { name: /^加入 1 (道题|份材料)$/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: '返回课稿', exact: true }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(1);
  await expect(page.locator('.wb-reference h4')).toHaveText(['第一份材料']);
  expect((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections[0].references).toHaveLength(1);
});

test('已选来源删除后仍可清空隐藏选择并重新取材', async ({ page }) => {
  const { call } = await setup(page);
  const q = await call('POST', Q, question('稍后删除的来源'), 201);
  await pick(page, '加入题目');
  await page.getByRole('checkbox', { name: '选择 稍后删除的来源', exact: true }).check();
  await call('POST', `${Q}/${q.id}/deletion`, { baseVersion: q.version, deleted: true });
  await page.reload();
  await expect(page.getByRole('checkbox', { name: '选择 稍后删除的来源', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '清空选择', exact: true }).click();
  await expect(page.getByRole('button', { name: '加入 0 道题', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '返回课稿', exact: true }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(0);
});

test('取题、环节排序、来源采用及三成果的学生教师 Word/PDF', async ({ page }) => {
  test.setTimeout(480000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const { call, lesson } = await setup(page);
  const q = await call('POST', Q, { ...question('定义域练习'), body: { version: 2, blocks: [{ type: 'paragraph', runs: [{ type: 'text', text: '求函数的定义域' }, { type: 'math', latex: 'y=\\frac{1}{x+3}' }] }] }, solution: doc('仅教师答案：排除负三'), answerStatus: 'present' }, 201);
  await page.getByRole('button', { name: '添加教学环节', exact: true }).click();
  await page.getByLabel('环节名称 2').fill('课堂练习');
  await sectionAction(page, '课堂练习', '上移环节');
  await expect(page.getByLabel('环节名称 1')).toHaveValue('课堂练习');
  const section = page.locator('[data-section-id]').first();
  await pick(page, '加入题目', section);
  await page.getByRole('checkbox', { name: '选择 定义域练习', exact: true }).check();
  await page.getByRole('button', { name: /^加入 1 (道题|份材料)$/ }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(1);
  await page.getByRole('button', { name: '添加本课备注', exact: true }).click();
  await page.getByLabel('本课备注 定义域练习').fill('仅教师注记：先让学生讨论');
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', /saved|clean/);
  await call('PUT', `${Q}/${q.id}`, { baseVersion: q.version, ...writable(q), body: doc('新版题面：求有理函数定义域') });
  await page.reload();
  await page.getByRole('button', { name: '有更新 · 查看', exact: true }).click();
  await expect(page.locator('[data-region="reference-new"]')).toContainText('新版题面');
  await page.getByRole('button', { name: '采用更新', exact: true }).click();
  await expect(page.locator('.wb-reference-body')).toContainText('新版题面');
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', /saved|clean/);
  // Keep a real editable formula in the accepted source for all output kinds.
  const current = await call('GET', `${Q}/${q.id}`);
  await call('PUT', `${Q}/${q.id}`, { baseVersion: current.version, ...writable(current), body: q.body });
  await page.reload();
  await page.getByRole('button', { name: '有更新 · 查看', exact: true }).click();
  await page.getByRole('button', { name: '采用更新', exact: true }).click();
  await page.getByRole('button', { name: '生成教学资料', exact: true }).click();
  for (const [answers, notes] of [[false, false], [true, false], [false, true], [true, true]]) {
    await page.getByRole('checkbox', { name: /附上答案与解析/ }).setChecked(answers);
    await page.getByRole('checkbox', { name: /附上教师注记/ }).setChecked(notes);
    for (const kind of ['lesson-plan', 'handout', 'practice']) {
      await page.getByRole('radio', { name: kind === 'lesson-plan' ? /^教案/ : kind === 'handout' ? /^导学案/ : /^练习/ }).click();
      for (const format of ['docx', 'pdf']) {
        await page.getByRole('radio', { name: format === 'docx' ? /^Word/ : /^PDF/ }).check();
        const oldCount = await page.locator('.r34-output-list article').count();
        await page.getByRole('button', { name: '保存并生成', exact: true }).click();
        await expect(page.locator('.r34-output-list article')).toHaveCount(oldCount + 1);
        const row = page.locator('.r34-output-list article').first();
        await expect(row.getByRole('button', { name: '下载', exact: true })).toBeVisible({ timeout: 60000 });
        const pending = page.waitForEvent('download');
        await row.getByRole('button', { name: '下载', exact: true }).click();
        const file = path.join(evidence, `${kind}-${answers ? 'answers' : 'no-answers'}-${notes ? 'notes' : 'no-notes'}.${format}`);
        await (await pending).saveAs(file);
        let text;
        if (format === 'docx') {
          const zip = await JSZip.loadAsync(fs.readFileSync(file));
          text = (await Promise.all(Object.values(zip.files).filter(f => f.name.endsWith('.xml')).map(f => f.async('string')))).join('\n');
          expect(text).toContain('<m:oMath');
          expect(text).toContain('<m:f>');
          const readback = execFileSync(process.env.MATERIALS_PANDOC_PATH || '/usr/bin/pandoc', ['--from=docx', '--to=json', file], { encoding: 'utf8' });
          expect(readback).toContain('"Math"');
          expect(readback).toContain('frac');
        } else text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
        expect(text.includes('仅教师答案')).toBe(answers);
        expect(text.includes('仅教师注记')).toBe(notes);
        expect(text).not.toContain('原始私密笔记');
      }
    }
  }
  await page.screenshot({ path: path.join(evidence, 'outputs.png') });
  await page.reload();
  await expect(page.locator('.r34-output-list article')).toHaveCount(24);
  await page.getByRole('button', { name: '返回课稿', exact: true }).click();
  await expect(page.getByLabel('环节名称 1')).toHaveValue('课堂练习');
  expect((await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).sections[0].references[0].questionVersion).toBe(3);
  expect(errors).toEqual([]);
});

test('课题新建、排序、归档恢复以及重启后保留顺序', async ({ page, browser }) => {
  const { lesson } = await setup(page);
  await page.getByRole('button', { name: '我的备课', exact: true }).click();
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('第二课时');
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', /saved|clean/);
  await page.getByRole('button', { name: '我的备课', exact: true }).click();
  await expect(page.locator('.wb-card-title')).toHaveText(['第二课时', '函数专题']);
  await page.getByRole('button', { name: '上移课题 函数专题', exact: true }).click();
  await expect(page.locator('.wb-card-title')).toHaveText(['函数专题', '第二课时']);
  await page.reload();
  await expect(page.locator('.wb-card-title')).toHaveText(['函数专题', '第二课时']);
  await page.getByRole('button', { name: /^函数专题/ }).click();
  await page.getByRole('button', { name: '备课操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '归档备课', exact: true }).click();
  await page.getByRole('dialog', { name: '归档备课' }).getByRole('button', { name: '归档备课', exact: true }).click();
  await expect(page).toHaveURL(/\/lessons$/);
  await expect(page.locator('.wb-card-title')).toHaveText(['第二课时']);
  await page.getByRole('button', { name: '备课列表选项', exact: true }).click();
  await page.getByRole('menuitem', { name: '查看已归档备课', exact: true }).click();
  await page.getByRole('button', { name: /^函数专题/ }).click();
  await page.getByRole('button', { name: '恢复备课', exact: true }).click();
  await expect(page).toHaveURL(/\/lessons$/);
  const directory = world.directory;
  await world.close(); world = await createIntegration({ directory });
  const fresh = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const reopened = await fresh.newPage();
    await reopened.goto(world.origin);
    await reopened.getByLabel('邮箱', { exact: true }).fill('manual-lessons@example.test');
    await reopened.getByLabel('密码', { exact: true }).fill('math-password');
    await reopened.getByRole('button', { name: '登录', exact: true }).click();
    await expect(reopened.locator('.wb-shell')).toBeVisible();
    await reopened.getByRole('button', { name: '知道了', exact: true }).click();
    await reopened.getByRole('complementary', { name: '工作台导航' }).getByRole('link', { name: /^备课/ }).click();
    await expect(reopened.locator('.wb-card-title')).toHaveText(['函数专题', '第二课时']);
    await reopened.getByRole('button', { name: /^函数专题/ }).click();
    await expect(reopened).toHaveURL(new RegExp(lesson.id));
    await expect(reopened.getByRole('heading', { name: '概念探究', exact: true })).toBeVisible();
  } finally { await fresh.close(); }
});

test('资源就地预览采用、引用排序移动、删除环节和来源更新', async ({ page }) => {
  const { call, client, lesson } = await setup(page);
  async function upload(name) {
    const boundary = `manual-${crypto.randomUUID()}`;
    const response = await client.request('POST', '/api/workbench/files', {
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      contentType: `multipart/form-data; boundary=${boundary}`,
      rawBody: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/pdf\r\n\r\n`), fs.readFileSync('apps/web/e2e/fixtures/materials/samples/c22.pdf'), Buffer.from(`\r\n--${boundary}--\r\n`)]),
    });
    expect(response.status).toBe(201); return response.json;
  }
  const file = await upload('课堂阅读.pdf');
  const resource = await call('POST', '/api/modules/resources/items', { title: '课堂阅读', fileId: file.id, folderId: null, tagIds: [], note: '资源私人笔记' }, 201);
  const q = await call('POST', Q, question('备用练习'), 201);
  await pick(page, '加入资源');
  await page.getByRole('button', { name: '课堂阅读', exact: true }).click();
  await page.getByRole('button', { name: '预览 课堂阅读.pdf', exact: true }).click();
  await expect(page.getByAltText('成品第 1 页')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: '关闭预览', exact: true }).click();
  await page.getByRole('checkbox', { name: '选择 课堂阅读', exact: true }).check();
  await page.getByRole('button', { name: /^加入 1 (道题|份材料)$/ }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(1);
  await pick(page, '加入题目');
  await page.getByRole('checkbox', { name: '选择 备用练习', exact: true }).check();
  await page.getByRole('button', { name: /^加入 1 (道题|份材料)$/ }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(2);
  await page.getByRole('button', { name: '材料操作 备用练习', exact: true }).click();
  await page.getByRole('menuitem', { name: '上移材料', exact: true }).click();
  await expect(page.locator('.wb-reference h4')).toHaveText(['备用练习', '课堂阅读']);
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', /saved|clean/);
  await page.reload();
  await expect(page.locator('.wb-reference h4')).toHaveText(['备用练习', '课堂阅读']);
  await sectionAction(page, '概念探究', '删除环节');
  await page.getByRole('button', { name: '移入备用材料并删除', exact: true }).click();
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', /saved|clean/);
  await page.getByRole('button', { name: '备用材料 · 2', exact: true }).click();
  await expect(page.locator('[data-region="materials"] [data-reference-id]')).toHaveCount(2);
  const newerFile = await upload('课堂阅读修订.pdf');
  await call('PUT', `/api/modules/resources/items/${resource.id}/file`, { baseVersion: resource.version, fileId: newerFile.id });
  await page.reload();
  await page.getByRole('button', { name: '有更新 · 查看', exact: true }).click();
  await page.getByRole('button', { name: '采用更新', exact: true }).click();
  await expect(page.getByRole('button', { name: '课堂阅读修订.pdf · 预览采用文件', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '保存备课', exact: true }).click();
  await expect(page.locator('[data-save-status]')).toHaveAttribute('data-save-status', /saved|clean/);
  const saved = await call('GET', `/api/modules/lessons/v3/${lesson.id}`);
  expect(saved.materials.map(ref => ref.questionId ?? ref.resourceId)).toEqual([q.id, resource.id]);
  expect(saved.materials[1].snapshot.fileId).toBe(newerFile.id);
  await page.getByRole('button', { name: '查看来源', exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(`/resources/${resource.id}`));
  await page.getByRole('button', { name: '返回备课现场', exact: true }).click();
  await expect(page.locator('[data-region="materials"] [data-reference-id]')).toHaveCount(2);
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.getByRole('button', { name: '展开侧栏', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: '工作台导航' })).toBeHidden();
  await expect(page.getByRole('button', { name: '保存备课', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(evidence, 'materials-tablet.png'), animations: 'disabled' });
});

test('输出可逐题筛选并分别留白，下载的 Word/PDF 与选择一致', async ({ page }) => {
  const { call, lesson } = await setup(page);
  for (const name of ['保留题甲', '排除题乙', '保留题丙']) {
    await call('POST', Q, { ...question(name), body: doc(`${name}的题面`),
      solution: doc(`${name}的答案`), answerStatus: 'present' }, 201);
  }
  await pick(page, '加入题目');
  for (const name of ['保留题甲', '排除题乙', '保留题丙'])
    await page.getByRole('checkbox', { name: `选择 ${name}`, exact: true }).check();
  await page.getByRole('button', { name: '加入 3 道题', exact: true }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(3);
  await page.getByRole('button', { name: '生成教学资料', exact: true }).click();
  await page.getByRole('radio', { name: /^练习/ }).click();
  await page.getByRole('checkbox', { name: /附上答案与解析/ }).check();
  await page.getByLabel('作答空白行', { exact: true }).fill('0');
  await page.getByRole('button', { name: '按材料细选与留白', exact: true }).click();
  await page.getByRole('checkbox', { name: '输出材料 2 排除题乙', exact: true }).uncheck();
  const first = page.locator('.lesson-export-reference').first();
  await first.getByRole('button', { name: '单独设置留白', exact: true }).click();
  await page.getByLabel('作答行数 1 保留题甲', { exact: true }).fill('2');
  await expect(page.locator('.lesson-export-summary')).toContainText('2 道题');
  for (const title of ['输出材料 1 保留题甲', '输出材料 3 保留题丙'])
    await page.getByRole('checkbox', { name: title, exact: true }).uncheck();
  await expect(page.getByRole('button', { name: '保存并生成', exact: true })).toBeDisabled();
  await expect(page.locator('.lesson-export-footer')).toContainText('至少选择一道题');
  for (const title of ['输出材料 1 保留题甲', '输出材料 3 保留题丙'])
    await page.getByRole('checkbox', { name: title, exact: true }).check();
  // Reopening preserves both selection and per-question spacing.
  await page.reload();
  await page.getByRole('button', { name: '按材料细选与留白', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '输出材料 2 排除题乙', exact: true })).not.toBeChecked();
  await expect(page.getByLabel('作答行数 1 保留题甲', { exact: true })).toHaveValue('2');
  const lessonBefore = await call('GET', `/api/modules/lessons/v3/${lesson.id}`);
  for (const format of ['docx', 'pdf']) {
    await page.getByRole('radio', { name: format === 'docx' ? /^Word/ : /^PDF/ }).check();
    await page.getByRole('button', { name: '保存并生成', exact: true }).click();
    const row = page.locator('.r34-output-list article').first();
    await expect(row.getByRole('button', { name: '下载', exact: true })).toBeVisible({ timeout: 60000 });
    const pending = page.waitForEvent('download');
    await row.getByRole('button', { name: '下载', exact: true }).click();
    const file = path.join(evidence, `selected-practice.${format}`);
    await (await pending).saveAs(file);
    let text;
    if (format === 'docx') {
      const zip = await JSZip.loadAsync(fs.readFileSync(file));
      const xml = await zip.file('word/document.xml').async('string');
      const { DOMParser } = await import('@xmldom/xmldom');
      const document = new DOMParser().parseFromString(xml, 'text/xml');
      const paragraphs = Array.from(document.getElementsByTagName('w:p')).map(p => p.textContent);
      const a = paragraphs.findIndex(t => t === '保留题甲的题面');
      const c = paragraphs.findIndex(t => t.includes('2. 保留题丙'));
      expect(paragraphs.slice(a + 1, c).map(t => t.trim())).toEqual(['', '']);
      text = paragraphs.join('\n');
    } else text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
    expect(text).toContain('保留题甲的题面');
    expect(text).toContain('保留题丙的答案');
    expect(text).not.toContain('排除题乙');
    expect(text).not.toContain('从定义出发');
  }
  expect(await call('GET', `/api/modules/lessons/v3/${lesson.id}`)).toEqual(lessonBefore);
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('link', { name: /账户：/ }).click();
    await page.getByRole('button', { name: theme === 'dark' ? '深色' : '浅色', exact: true }).click();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', theme);
    await page.getByRole('complementary', { name: '工作台导航' }).getByRole('link', { name: /^备课/ }).click();
    await page.getByRole('button', { name: '按材料细选与留白', exact: true }).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('.lesson-export-reference-list').scrollIntoViewIfNeeded();
      await expect(page.getByLabel('作答行数 1 保留题甲', { exact: true })).toBeInViewport();
      await expect(page.getByRole('button', { name: '保存并生成', exact: true })).toBeInViewport();
      await page.screenshot({ path: path.join(evidence, `output-selection-${theme}-${width}.png`), animations: 'disabled' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
  }
});

test('混排与资源原页进入真实 Word/PDF，采用旧文件且按需选择，不改变课稿', async ({ page }) => {
  const { call, lesson, client } = await setup(page);
  const q = await call('POST', Q, { ...question('穿插输出例题'), body: doc('混排题面标记') }, 201);
  const resources = [], sourceFiles = [];
  for (const [name, relative] of [['三页课件.pdf', 'materials/samples/c22.pdf'], ['原版文稿.docx', 'materials-resources/samples/w.docx']]) {
    const boundary = `resource-${crypto.randomUUID()}`;
    const response = await client.request('POST', '/api/workbench/files', { headers: { 'Idempotency-Key': crypto.randomUUID() },
      contentType: `multipart/form-data; boundary=${boundary}`, rawBody: Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
        fs.readFileSync(new URL(`./fixtures/${relative}`, import.meta.url)), Buffer.from(`\r\n--${boundary}--\r\n`),
      ]) });
    expect(response.status).toBe(201); sourceFiles.push(response.json);
    resources.push(await call('POST', '/api/modules/resources/items', { title: name, fileId: response.json.id, folderId: null, tagIds: [], note: '' }, 201));
  }
  const reference = { id: crypto.randomUUID(), kind: 'question', questionId: q.id, questionVersion: 1, note: '', afterBlock: 1 };
  const resourceRefs = resources.map(r => ({ id: crypto.randomUUID(), kind: 'resource', resourceId: r.id, resourceVersion: 1, note: '', afterBlock: 2 }));
  const before = await call('PUT', `/api/modules/lessons/v3/${lesson.id}`, { baseVersion: 1, title: lesson.title, intro: lesson.intro, materials: [],
    sections: [{ ...lesson.sections[0], content: { version: 2, blocks: [...doc('混排前讲解').blocks, ...doc('混排后总结').blocks] }, references: [reference, ...resourceRefs] }] });
  // The adopted PDF stays the original even when the library switches to Word.
  await call('PUT', `/api/modules/resources/items/${resources[0].id}/file`, { baseVersion: 1, fileId: sourceFiles[1].id });
  await page.reload(); await page.getByRole('button', { name: '生成教学资料', exact: true }).click();
  await page.getByRole('radio', { name: /^导学案/ }).click();
  await page.getByRole('button', { name: '按材料细选与留白', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '按原页插入', exact: true })).toHaveCount(2);
  await expect(page.getByRole('checkbox', { name: '按原页插入', exact: true }).first()).not.toBeChecked();
  for (const pages of [true, false]) {
    for (const box of await page.getByRole('checkbox', { name: '按原页插入', exact: true }).all()) await box.setChecked(pages);
    if (pages) {
      await expect(page.getByText(/原件页面作为图片加入/).first()).toBeVisible();
      await page.reload();
      await page.getByRole('button', { name: '按材料细选与留白', exact: true }).click();
      await expect(page.getByRole('checkbox', { name: '按原页插入', exact: true }).first()).toBeChecked();
    }
    for (const format of ['docx', 'pdf']) {
      await page.getByRole('radio', { name: format === 'docx' ? /^Word/ : /^PDF/ }).check();
      const count = await page.locator('.r34-output-list article').count();
      await page.getByRole('button', { name: '保存并生成', exact: true }).click();
      await expect(page.locator('.r34-output-list article')).toHaveCount(count + 1);
      const row = page.locator('.r34-output-list article').first();
      await expect(row.getByRole('button', { name: '下载', exact: true })).toBeVisible({ timeout: 60000 });
      const pending = page.waitForEvent('download'); await row.getByRole('button', { name: '下载', exact: true }).click();
      const filename = path.join(evidence, `mixed-resource-${pages ? 'pages' : 'titles'}.${format}`);
      await (await pending).saveAs(filename);
      let text;
      if (format === 'docx') {
        const zip = await JSZip.loadAsync(fs.readFileSync(filename));
        text = await zip.file('word/document.xml').async('string');
        const drawings = (text.match(/<w:drawing>/g) || []).length;
        if (pages) {
          const previews = await Promise.all(sourceFiles.map(file => call('GET', `/api/workbench/files/${file.id}/preview`)));
          expect(previews[0].pages).toHaveLength(3);
          expect(drawings).toBe(previews.reduce((count, preview) => count + preview.pages.length, 0));
          expect(previews.every(p => p.state === 'ready')).toBe(true);
        } else expect(drawings).toBe(0);
      } else {
        text = execFileSync('pdftotext', ['-layout', filename, '-'], { encoding: 'utf8' });
        const images = execFileSync('pdfimages', ['-list', filename], { encoding: 'utf8' }).trim().split('\n').slice(2).filter(line => line.trim().split(/\s+/)[2] === 'image');
        const previews = await Promise.all(sourceFiles.map(file => call('GET', `/api/workbench/files/${file.id}/preview`)));
        expect(images.length).toBe(pages ? previews.reduce((count, preview) => count + preview.pages.length, 0) : 0);
        if (pages) execFileSync('pdftoppm', ['-f', '2', '-l', '2', '-singlefile', '-scale-to', '1200', '-png', filename, path.join(evidence, 'resource-page-in-pdf')]);
      }
      expect(text.indexOf('混排前讲解')).toBeGreaterThan(-1);
      expect(text.indexOf('混排前讲解')).toBeLessThan(text.indexOf('混排题面标记'));
      expect(text.indexOf('混排题面标记')).toBeLessThan(text.indexOf('混排后总结'));
      expect(text).toContain('三页课件.pdf');
    }
  }
  const after = await call('GET', `/api/modules/lessons/v3/${lesson.id}`);
  expect(after.version).toBe(before.version);
  expect(after.sections[0].references[1].resourceVersion).toBe(1);
  expect(after.sections[0].references[1].snapshot.fileId).toBe(sourceFiles[0].id);
});
