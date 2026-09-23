import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';
import Database from 'better-sqlite3';

const evidence = path.resolve('test-results/evidence/R31/v1');
fs.mkdirSync(evidence, { recursive: true });
const dataDir = path.resolve('test-results/r31-complete/browser-data');
const port = 48331,
  origin = `http://localhost:${port}`;
const checks = [];
let child, browser, activePage;
async function start(reset = false) {
  child = spawn(
    process.execPath,
    [
      'scripts/materials/start.mjs',
      '--data-dir',
      dataDir,
      '--port',
      String(port),
      ...(reset ? ['--reset'] : [])
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  await new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes('R31 fixture:')) resolve();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.once('exit', (code) => reject(new Error(`Fixture exited ${code}: ${output}`)));
  });
}
async function stop() {
  if (!child) return;
  const stopped = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await stopped;
  child = null;
}
try {
  await start(true);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  activePage = page;
  page.on('response', async (r) => {
    if (r.status() >= 400) console.log('HTTP failure', r.status(), r.url(), await r.text());
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/fixture/session`);
  await expect(page.getByLabel('文稿段落 1', { exact: true })).toHaveValue('已知原稿');
  await page.getByLabel('文稿段落 1', { exact: true }).fill('中文编辑与行内公式 $\\frac{x+1}{2}$');
  await page.getByRole('button', { name: '公式', exact: true }).click();
  await page
    .getByLabel('文稿公式 1源', { exact: true })
    .fill('\\begin{cases}x^2 & x>0\\\\-x & x\\le 0\\end{cases}');
  await page.getByRole('button', { name: '标题', exact: true }).click();
  await page.getByLabel('文稿标题 1', { exact: true }).fill('函数与图像');
  await page.getByRole('button', { name: '列表', exact: true }).click();
  await page.getByLabel('文稿列表 1用途').selectOption('subquestions');
  await page.getByLabel('文稿列表 1项目 1标号').fill('(1)');
  await page.getByLabel('文稿列表 1项目 1段落 1', { exact: true }).fill('求定义域');
  await page.getByRole('button', { name: '添加项目', exact: true }).click();
  await page.getByLabel('文稿列表 1项目 2标号').fill('(2)');
  await page.getByLabel('文稿列表 1项目 2段落 1', { exact: true }).fill('讨论单调性');
  await page.getByRole('button', { name: '上移文稿列表 1项目 2', exact: true }).click();
  await page.getByRole('button', { name: '表格', exact: true }).click();
  const table = page.getByLabel('编辑文稿').locator('.material-table-scroll');
  await table.getByRole('button', { name: '段落', exact: true }).first().click();
  await page.getByLabel('文稿表格 1第 1 行第 1 列段落 1', { exact: true }).fill('范围');
  await table.getByRole('button', { name: '添加行', exact: true }).click();
  await page.getByRole('button', { name: '教师注记', exact: true }).click();
  await page.getByLabel('文稿教师注记 1段落 1', { exact: true }).fill('提醒检查端点');
  const imagePath = path.join(dataDir, 'figure.png');
  await sharp({ create: { width: 240, height: 120, channels: 3, background: '#d8e8f4' } })
    .png()
    .toFile(imagePath);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '图片', exact: true }).last().click();
  await (await chooser).setFiles(imagePath);
  await page.getByLabel('文稿图片 1说明').fill('已知示意图');
  await expect(page.getByLabel('文稿预览').getByRole('img', { name: '已知示意图' })).toBeVisible();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '已保存' })).toBeVisible();
  const persisted = await (await context.request.get(`${origin}/fixture/document`)).json();
  fs.writeFileSync(path.join(evidence, 'edited-document.json'), JSON.stringify(persisted, null, 2));
  await page.reload();
  await expect(page.getByLabel('文稿段落 1', { exact: true })).toHaveValue(
    '中文编辑与行内公式 $\\frac{x+1}{2}$'
  );
  await page.screenshot({ path: path.join(evidence, 'document-desktop.png'), fullPage: true });
  checks.push(
    '真实 UI 编辑文字、行内/独立公式、标题、小问增序、表格、教师注记、上传图片，HTTP 保存和刷新回读'
  );
  // DB failure is real, not an intercepted success/failure response.
  const db = new Database(path.join(dataDir, 'workbench.sqlite'));
  db.exec(
    "CREATE TRIGGER fixture_fail_document BEFORE UPDATE ON fixture_documents BEGIN SELECT RAISE(ABORT, 'fixture refuses write'); END"
  );
  await page.getByLabel('文稿段落 1', { exact: true }).fill('失败后保留编辑');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '保存结果未确认' })).toBeVisible();
  await expect(page.getByLabel('文稿段落 1', { exact: true })).toHaveValue('失败后保留编辑');
  await page.screenshot({ path: path.join(evidence, 'document-save-failed.png'), fullPage: true });
  await page.getByLabel('文稿段落 1', { exact: true }).fill('失败后继续编辑的新稿');
  db.exec('DROP TRIGGER fixture_fail_document');
  db.close();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '已保存' })).toBeVisible();
  const recovered = await (await context.request.get(`${origin}/fixture/document`)).json();
  expect(recovered.blocks[0].runs).toEqual([{ type: 'text', text: '失败后继续编辑的新稿' }]);
  let releaseResponse, serverCommitted;
  const release = new Promise((resolve) => {
    releaseResponse = resolve;
  });
  const committed = new Promise((resolve) => {
    serverCommitted = resolve;
  });
  await page.route('**/fixture/document', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    const response = await route.fetch();
    serverCommitted();
    await release;
    await route.fulfill({ response });
  });
  await page.getByLabel('文稿段落 1', { exact: true }).fill('保存中的原稿');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await committed;
  await page.getByLabel('文稿段落 1', { exact: true }).fill('保存中继续编辑');
  releaseResponse();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: '尚未保存' })).toBeVisible();
  await page.unroute('**/fixture/document');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '已保存' })).toBeVisible();
  const finalSaved = await (await context.request.get(`${origin}/fixture/document`)).json();
  expect(finalSaved.blocks[0].runs).toEqual([{ type: 'text', text: '保存中继续编辑' }]);
  await stop();
  await start();
  await page.reload();
  await expect(page.getByLabel('文稿段落 1', { exact: true })).toHaveValue('保存中继续编辑');
  expect(await (await context.request.get(`${origin}/fixture/document`)).json()).toEqual(
    finalSaved
  );
  checks.push(
    '真实 SQLite 拒写后继续编辑、旧键确认后新稿保存、保存中编辑不误报成功、进程重启及原图回读'
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: path.join(evidence, 'document-pad.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('文稿公式 1源').fill('\\input{secret}');
  await expect(
    page.getByLabel('文稿预览').getByText('公式预览失败：\\input{secret}')
  ).toBeVisible();
  await page.getByLabel('文稿段落 1', { exact: true }).fill('<img src=x onerror=alert(1)>');
  await expect(
    page.getByLabel('文稿预览').getByText('<img src=x onerror=alert(1)>', { exact: true })
  ).toBeVisible();
  expect(await page.getByLabel('文稿预览').locator('img[src="x"]').count()).toBe(0);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '已保存' })).toBeVisible();
  checks.push('HTML 转义呈现；危险数学命令保留源码并拒绝执行；Pad 无整页横向溢出');
  await stop();
  const unknown = { version: 99, blocks: [{ type: 'future', original: '<script>raw</script>' }] };
  const rawDb = new Database(path.join(dataDir, 'workbench.sqlite'));
  rawDb
    .prepare('UPDATE fixture_documents SET value=? WHERE accountKey=?')
    .run(JSON.stringify(unknown), 'r31-a');
  rawDb.close();
  await start();
  await page.reload();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
  await expect(
    page.getByLabel('编辑文稿').getByText('文档版本 99 暂不支持，原数据只读保留。')
  ).toBeVisible();
  expect(await (await context.request.get(`${origin}/fixture/document`)).json()).toEqual(unknown);
  await page.screenshot({
    path: path.join(evidence, 'document-unknown-version.png'),
    fullPage: true
  });
  checks.push('未知版本原样只读，保存禁用，无有损回写');
  expect(errors).toEqual([]);
  fs.writeFileSync(
    path.join(evidence, 'browser.json'),
    JSON.stringify({ status: 'PASS', origin, dataDir, checks, errors }, null, 2)
  );
  console.log(JSON.stringify({ status: 'PASS', checks }, null, 2));
} catch (error) {
  if (activePage) {
    await activePage.screenshot({
      path: path.join(evidence, 'browser-failure.png'),
      fullPage: true
    });
    console.log(await activePage.locator('body').innerText());
  }
  throw error;
} finally {
  await browser?.close();
  await stop();
}
