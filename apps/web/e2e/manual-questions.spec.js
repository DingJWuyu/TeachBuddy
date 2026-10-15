import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
const evidence = path.resolve('test-results/evidence/MANUAL-QUESTIONS/v1/browser');
fs.mkdirSync(evidence, { recursive: true });
let world;
test.afterEach(async ({context}, info) => {
  await context.close(); await world?.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true });
  else fs.writeFileSync(info.outputPath('fixture-directory.txt'), world.directory);
});
async function start(page) {
  world = await createIntegration({directory: fs.mkdtempSync(path.join(os.tmpdir(), 'mq-'))});
  await page.goto(world.origin);
  await page.getByRole('button', {name:'创建账户'}).click();
  await page.getByLabel('昵称', {exact:true}).fill('题库老师');
  await page.getByLabel('邮箱', {exact:true}).fill('questions@example.test');
  await page.getByLabel('密码', {exact:true}).fill('Questions-test-123');
  await page.getByLabel('确认密码', {exact:true}).fill('Questions-test-123');
  await page.getByRole('button', {name:'发送验证码'}).click();
  await expect.poll(() => world.mailer.lastCode('registration','questions@example.test')).toBeTruthy();
  await page.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration','questions@example.test'));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', {name:'注册',exact:true}).click();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await page.getByRole('navigation', { name: '功能模块' }).getByRole('link', { name: /^题库/ }).click();
}
async function create(page, title) {
  await page.locator('.q-finder').getByRole('button', { name: '手动录题', exact: true }).click();
  await page.getByLabel('题目标题').fill(title);
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('已知 $x^2=4$，求 $x$。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}
async function capture(page, kind) {
  await page.locator('.q-finder').getByRole('button', { name: '从资料收录', exact: true }).click();
  await page.getByRole('button', { name: { PDF: /上传 PDF/, Word: /上传 Word/, 图片: /上传图片/, 文字: /粘贴文字/ }[kind] }).click();
}
async function editReview(page) {
  await page.getByRole('button', { name: '修改题目', exact: true }).click();
  await expect(page.getByLabel('草稿标题')).toBeVisible();
}
async function confirmReview(page) {
  for (const issue of await page.locator('.q-issue select').all()) await issue.selectOption('corrected');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看题目', exact: true })).toBeVisible();
}
async function cropVisibleOriginal(page) {
  await page.getByRole('button', { name: '调整原稿选区', exact: true }).click();
  const original = page.locator('.q-page');
  await original.hover({ position: { x: 50, y: 50 } });
  const image = await original.boundingBox();
  await page.mouse.down();
  await page.mouse.move(image.x + 180, image.y + 150, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: '裁图加入题面', exact: true }).click();
}
test('有文字层的 PDF 自动拆题，保留原稿并可确认', async ({page}) => {
  await start(page);
  await capture(page, 'PDF');
  await page.getByLabel('选择原稿').setInputFiles('test/fixtures/questions/P.pdf');
  await page.getByRole('button',{name:'开始整理'}).click();
  await expect(page.getByRole('article', { name: '待检查题干' })).toBeVisible({ timeout: 30000 });
  await editReview(page);
  await expect(page.locator('.q-original img').first()).toBeVisible();
  await expect(page.getByRole('button',{name:'6 待检查',exact:true})).toBeVisible();
  await expect(page.getByLabel('答案状态',{exact:true})).toHaveValue('present');
  await expect(page.getByRole('region', { name: '答案与解析', exact: true })).toContainText('根号内非负');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button',{name:'下载原稿',exact:true}).click();
  const original = await downloading;
  expect(original.suggestedFilename()).toBe('P.pdf');
  await original.saveAs(path.join(evidence,'original.pdf'));
  expect(fs.readFileSync(path.join(evidence,'original.pdf'))).toEqual(fs.readFileSync('test/fixtures/questions/P.pdf'));
  await confirmReview(page);
  await expect(page.getByRole('button',{name:'查看题目',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'2 待检查',exact:true}).click();
  await expect(page.locator('.q-review-result img').first()).toBeVisible();
  await page.screenshot({path:path.join(evidence,'pdf-review.png')});
});


test('文字拆题、第二题原稿定位及出处回看', async ({page}) => {
  await start(page);
  await capture(page, '文字');
  await page.getByLabel('原始文字').fill('1. 计算 $1+1$。\n答案：2\n2. 求 $x^2=9$ 的解。\n答案：$x=\\pm3$');
  await page.getByRole('button', { name: '材料名称、出处与处理范围', exact: true }).click();
  await page.getByRole('textbox', { name: /^出处/ }).fill('自编练习 2026');
  await page.getByRole('button',{name:'开始整理'}).click();
  await page.getByRole('button',{name:'2 待检查',exact:true}).click();
  await editReview(page);
  await page.getByLabel('草稿标题').fill('第二道收录题');
  await confirmReview(page);
  await page.getByRole('button',{name:'查看题目',exact:true}).click();
  await expect(page.getByRole('heading', { name: '第二道收录题', exact: true })).toBeVisible();
  await page.getByRole('button',{name:'对照原稿',exact:true}).click();
  await expect(page.getByRole('article', { name: '待检查题干' })).toContainText('9');
  await expect(page.locator('.q-main')).toContainText('自编练习 2026');
});

test('较慢的旧搜索响应不会覆盖最新搜索', async ({page}) => {
  await start(page);
  await create(page,'搜索保留题');
  let release, received;
  const gate = new Promise(resolve => {release=resolve;});
  const arrived = new Promise(resolve => {received=resolve;});
  await page.route('**/api/modules/questions/v2/items?**', async route => {
    if (new URL(route.request().url()).searchParams.get('q') !== '不存在') return route.continue();
    const response = await route.fetch();
    received();
    await gate;
    await route.fulfill({response});
  });
  await page.getByLabel('搜索题目').fill('不存在');
  await arrived;
  await page.getByLabel('搜索题目').fill('搜索保留');
  await expect(page.locator('.q-list-entry')).toHaveCount(1);
  const response = page.waitForResponse(r => new URL(r.url()).searchParams.get('q') === '不存在');
  release();
  await response;
  await expect(page.locator('.q-list-entry')).toHaveCount(1);
  await expect(page.getByLabel('搜索题目')).toHaveValue('搜索保留');
});

test('Word 原稿与原生配图可对照，图片识别失败后补充草稿及裁图可恢复', async ({page}) => {
  await start(page);
  await capture(page, 'Word');
  await page.getByLabel('选择原稿').setInputFiles('test/fixtures/questions/W.docx');
  await page.getByRole('button',{name:'开始整理'}).click();
  await expect(page.getByRole('article', { name: '待检查题干' })).toBeVisible();
  await editReview(page);
  await expect(page.getByRole('button',{name:'6 待检查',exact:true})).toBeVisible();
  await page.getByLabel('原稿视图').selectOption('paragraphs');
  await expect(page.locator('.q-original')).toContainText('求函数');
  await page.getByLabel('原稿视图').selectOption('pages');
  await page.getByRole('button',{name:'2 待检查',exact:true}).click();
  await expect(page.locator('.q-review-result img').first()).toBeVisible();
  await page.screenshot({path:path.join(evidence,'word-original.png')});
  await page.getByRole('button',{name:'返回题库',exact:true}).click();
  await capture(page, '图片');
  await page.getByLabel('选择原稿').setInputFiles('test/fixtures/questions/I-clear.jpg');
  await page.getByRole('button',{name:'开始整理'}).click();
  await expect(page.locator('.q-original img')).toBeVisible();
  await expect(page.locator('.q-main')).toContainText('本地识别暂不可用，原稿已保存；配置恢复后可重试本页。');
  await page.getByRole('button', { name: '材料操作', exact: true }).click();
  await page.getByRole('button',{name:'补充题目草稿',exact:true}).click();
  await editReview(page);
  await page.getByLabel('草稿标题').fill('图片校对题');
  await page.locator('.q-review-result textarea').first().fill('已知 $x^2=4$，求 $x$。');
  await cropVisibleOriginal(page);
  await expect(page.locator('.q-review-result img')).toBeVisible();
  await page.getByRole('button',{name:'保存检查进度',exact:true}).click();
  await page.reload();
  await expect(page.getByLabel('草稿标题')).toHaveValue('图片校对题');
  await expect(page.locator('.q-review-result img')).toBeVisible();
  await page.screenshot({path:path.join(evidence,'image-correction.png')});
});

test('旧 DOC 本机转换后自动读取，对照校对并保存重开', async ({page,browser}) => {
  expect(process.env.MATERIALS_OFFICE_ROOT, '需提供已有 Office 工具目录').toBeTruthy();
  test.setTimeout(180000);
  await start(page);
  await capture(page, 'Word');
  await page.getByLabel('选择原稿').setInputFiles('test/fixtures/materials/w.doc');
  await page.getByRole('button', { name: '材料名称、出处与处理范围', exact: true }).click();
  await page.getByRole('textbox', { name: /^出处/ }).fill('旧 DOC 本机转换校对');
  await page.getByRole('button',{name:'开始整理'}).click();
  await expect(page.getByRole('article', { name: '待检查题干' })).toBeVisible({ timeout: 120000 });
  await editReview(page);
  await expect(page.locator('.q-original img').first()).toBeVisible();
  const previewResponse = page.waitForResponse(r => /\/files\/[^/]+\/preview$/.test(new URL(r.url()).pathname) && r.status() === 200);
  await page.reload();
  const response = await previewResponse;
  const preview = await response.json();
  const headers = {'X-TeachBuddy-Page': response.request().headers()['x-teachbuddy-page']};
  expect(preview.state).toBe('limited');
  expect(preview.issues).toContain('legacy-object-loss');
  expect(preview.pageCount).toBe(4);
  const converted = await page.request.get(`${world.origin}/api/workbench/files/${preview.renditionFileId}/content`, {headers});
  expect(converted.ok()).toBeTruthy();
  fs.writeFileSync(path.join(evidence,'legacy-doc.pdf'), await converted.body());
  await expect(page.getByRole('button',{name:'保存检查进度',exact:true})).toBeEnabled();
  await expect(page.locator('.q-original')).toContainText('旧版 DOC 转换可能丢失公式或嵌入对象');
  console.log('DOC preview', JSON.stringify(preview));
  const automaticText = await page.locator('.q-review-result textarea').allTextContents();
  expect(automaticText.join('\n')).toContain('求函数');
  console.log('DOC extracted', automaticText);
  await page.screenshot({path:path.join(evidence,'legacy-doc-review.png')});
  const downloading = page.waitForEvent('download');
  await page.getByRole('button',{name:'下载原稿',exact:true}).click();
  const original = await downloading;
  expect(original.suggestedFilename()).toBe('w.doc');
  expect(fs.readFileSync(await original.path())).toEqual(fs.readFileSync('test/fixtures/materials/w.doc'));
  await page.getByLabel('草稿标题').fill('旧 DOC 校对保存题');
  const body = page.getByRole('textbox', { name: '题干段落 1', exact: true });
  const extracted = await body.inputValue();
  expect(extracted.trim().length).toBeGreaterThan(0);
  await body.fill(`${extracted}\n校对备注：已核对旧 DOC 转换原稿。`);
  // The converted page has visual formulas that its text layer cannot expose.
  // Add a visible region by hand; this is not automatic recognition.
  await cropVisibleOriginal(page);
  await expect(page.locator('.q-review-result img').first()).toBeVisible();
  for (const issue of await page.locator('.q-issue select').all()) await issue.selectOption('corrected');
  await page.getByRole('button',{name:'保存检查进度',exact:true}).click();
  await page.reload();
  await expect(page.getByLabel('草稿标题')).toHaveValue('旧 DOC 校对保存题');
  await expect(page.locator('.q-review-result textarea').first()).toContainText('校对备注');
  await confirmReview(page);
  await page.getByRole('button',{name:'查看题目',exact:true}).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '旧 DOC 校对保存题', exact: true })).toBeVisible();
  await expect(page.locator('.q-reading-body')).toContainText('校对备注');
  await page.getByRole('button',{name:'对照原稿',exact:true}).click();
  await page.getByLabel('原稿视图').selectOption('pages');
  await expect(page.locator('.q-original img').first()).toBeVisible();
  await expect(page.locator('.q-original')).toContainText('旧 DOC 本机转换校对');
  await page.getByRole('button',{name:'查看题目',exact:true}).click();
  await expect(page.getByRole('heading', { name: '旧 DOC 校对保存题', exact: true })).toBeVisible();
  const questionPath = new URL(page.url()).pathname + new URL(page.url()).search;
  const directory = world.directory, storageState = await page.context().storageState();
  await world.close();
  world = await createIntegration({directory});
  const fresh = await browser.newContext({storageState,ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
  try {
    const reopened = await fresh.newPage();
    await reopened.goto(world.origin + questionPath);
    await reopened.getByRole('button', { name: '知道了', exact: true }).click();
    await reopened.locator('.q-list-entry').filter({ hasText: '旧 DOC 校对保存题' }).click();
    await expect(reopened.getByRole('heading', { name: '旧 DOC 校对保存题', exact: true })).toBeVisible();
    await expect(reopened.locator('.q-reading-body')).toContainText('校对备注');
    await expect(reopened.locator('.q-question img').first()).toBeVisible();
    await reopened.getByRole('button',{name:'对照原稿',exact:true}).click();
    await reopened.getByLabel('原稿视图').selectOption('pages');
    await expect(reopened.locator('.q-original img').first()).toBeVisible();
    await expect(reopened.locator('.q-original')).toContainText('旧版 DOC 转换可能丢失公式或嵌入对象');
    await reopened.screenshot({path:path.join(evidence,'legacy-doc-reopened.png')});
  } finally { await fresh.close(); }
});

test('列表与对照宽度可调整，刷新后恢复且小屏不横溢出', async ({page}) => {
  await start(page);
  await create(page,'调宽验证');
  const finder = page.locator('.q-finder');
  const before = (await finder.boundingBox()).width;
  const divider = page.getByRole('separator',{name:'调整题目列表宽度'});
  const grip = await divider.boundingBox();
  await page.mouse.move(grip.x+grip.width/2,grip.y+80);
  await page.mouse.down();
  await page.mouse.move(grip.x+grip.width/2+80,grip.y+80,{steps:8});
  await page.mouse.up();
  expect((await finder.boundingBox()).width).toBeGreaterThan(before+60);
  const width = (await finder.boundingBox()).width;
  await page.reload();
  await expect(page.getByRole('heading', { name: '调宽验证', exact: true })).toBeVisible();
  expect(Math.abs((await finder.boundingBox()).width-width)).toBeLessThan(2);
  await page.getByRole('button',{name:'复制改编',exact:true}).click();
  const compare = page.getByRole('separator',{name:'调整原题对照宽度'});
  await compare.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(compare).toHaveAttribute('aria-valuenow','48');
  await page.setViewportSize({width:768,height:1024});
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-sidebar', 'rail');
  await expect(page.getByRole('button', { name: '展开侧栏', exact: true })).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:path.join(evidence,'comparison-tablet.png'), animations:'disabled'});
});
