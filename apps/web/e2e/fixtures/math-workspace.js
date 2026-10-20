import { expect } from '@playwright/test';
import fs from 'node:fs';
import { dynamicSource } from '../../src/features/math/model.js';
const samples = JSON.parse(fs.readFileSync(new URL('../../../api/test/fixtures/contracts/math-samples.json', import.meta.url), 'utf8'));

// Legacy sources are still supported through the product's real JSON importer.
export async function importLegacy(page, kind, title = `兼容 ${kind}`, source = kind === 'dynamic' ? dynamicSource() : samples.find(sample => sample.id === `create-${kind}`).value.source) {
  return importMathSource(page, source, title);
}
export async function importMathSource(page, source, title = '兼容作品') {
  const response = page.waitForResponse(r => r.request().method() === 'POST'
    && new URL(r.url()).pathname === '/api/modules/math/v1/works');
  await chooseFile(page, '导入作品', { name: `${title}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) });
  const imported = await response;
  expect(imported.status(), await imported.text()).toBe(201);
  await expect(page.getByLabel('作品名称', { exact: true })).toHaveValue(title);
  return imported.json();
}
export async function chooseFile(page, action, file) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('complementary', { name: '数学工坊导航', exact: true }).getByRole('button', { name: new RegExp(`^${action}`) }).click();
  await (await chooser).setFiles(file);
}

export async function openTool(page, name) {
  await page.getByRole('button', { name: { objects: '图形与标注', parameters: '设置滑杆', steps: '编排步骤', canvas: '画布设置' }[name], exact: true }).click();
}
export async function addGraphic(page, name) {
  await page.getByRole('button', { name: '添加图形', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
export async function selectObject(page, id) {
  await openTool(page, 'objects');
  await page.getByLabel('图形列表', { exact: true }).getByRole('button').filter({ has: page.locator('strong', { hasText: new RegExp(`^${id}$`) }) }).click();
}
export async function disclosure(page, title) {
  const button = page.getByRole('button', { name: title, exact: true });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}
export async function saveLegacy(page) {
  const response = page.waitForResponse(r => ['POST', 'PUT'].includes(r.request().method())
    && /\/api\/modules\/math\/v1\/works(?:\/[^/]+)?$/.test(new URL(r.url()).pathname));
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const saved = await response;
  expect(saved.ok(), await saved.text()).toBeTruthy();
  await expect(page.locator('.math-workspace-status')).toHaveText('已保存');
  return saved.json();
}
export async function downloadLegacy(page, format, target) {
  const toggle = page.getByRole('button', { name: /^下载(图片|演示)$/ });
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await page.getByLabel('导出格式', { exact: true }).selectOption(format);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载作品', exact: true }).click();
  await (await event).saveAs(target);
  return target;
}
