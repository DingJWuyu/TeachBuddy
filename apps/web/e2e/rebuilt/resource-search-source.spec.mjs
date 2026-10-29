import fs from 'node:fs';
import { test, expect, register, navigate } from './fixture.mjs';
import { json, upload, preview, filesPath } from '../../../api/test/rebuilt-outputs/helpers.js';

const root = '/api/modules/resources/items';
async function authenticatedClient(page, world) {
  const client = world.client();
  const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/modules/resources/items');
  await navigate(page, '/resources');
  client.pageId = (await request).headers()['x-teachbuddy-page'];
  for (const cookie of await page.context().cookies()) client.jar.set(cookie.name, cookie.value);
  return client;
}
async function pdf(page, text) {
  const generator = await page.context().newPage();
  try { await generator.setContent(`<h1>${text}</h1>`); return await generator.pdf({ format: 'A4' }); }
  finally { await generator.close(); }
}
const add = (client, file, title) => json(client, 'POST', root, { title, note: '', folderId: null, tagIds: [], fileId: file.id }, 201);
async function search(page, query) {
  await navigate(page, '/questions');
  await navigate(page, '/resources');
  await page.getByRole('textbox', { name: '搜索资料', exact: true }).fill(query);
}

test('正文轮询换源后打开匹配的新PDF，命中后再次换源明确拒绝', async ({ page, world }, info) => {
  await register(page, world);
  const client = await authenticatedClient(page, world);
  const old = await upload(client, 'old.pdf', await pdf(page, 'OLD DOCUMENT WITHOUT TARGET'));
  const newer = await upload(client, 'new.pdf', await pdf(page, 'NEW DOCUMENT needleword CURRENT CONTENT'));
  for (const file of [old, newer]) await preview(client, file.id);
  let target = await add(client, old, '并发替换资料');
  await json(client, 'GET', `${root}?q=warmup`);
  for (let index = 0; index < 2; index++) await add(client,
    await upload(client, `pending-${index}.pdf`, await pdf(page, `PENDING ${index}`)), `待索引${index}`);
  await navigate(page, '/questions');
  await navigate(page, '/resources');
  await expect(page.getByText('并发替换资料', { exact: true })).toBeVisible();
  let requests = 0;
  await page.route('**/api/modules/resources/items?*', async route => {
    if (new URL(route.request().url()).searchParams.get('q') !== 'needleword') return route.continue();
    if (++requests === 2) target = await json(client, 'PUT', `${root}/${target.id}/file`, { baseVersion: target.version, fileId: newer.id });
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await page.getByRole('textbox', { name: '搜索资料', exact: true }).fill('needleword');
  await expect(page.getByText('NEW DOCUMENT needleword CURRENT CONTENT', { exact: false })).toBeVisible();
  await page.getByText('并发替换资料', { exact: true }).click();
  await expect(page.locator('.res-pdf-text')).toContainText('NEW DOCUMENT needleword CURRENT CONTENT');
  await page.screenshot({ path: info.outputPath('native-current-source.png'), animations: 'disabled' });
  await page.locator('.res-back-button').click();
  await expect(page.getByText('NEW DOCUMENT needleword CURRENT CONTENT', { exact: false })).toBeVisible();
  target = await json(client, 'PUT', `${root}/${target.id}/file`, { baseVersion: target.version, fileId: old.id });
  await page.getByText('并发替换资料', { exact: true }).click();
  await expect(page.getByText('资料文件已更新，请在最新搜索结果中重新打开。', { exact: true })).toBeVisible();
  await expect(page.locator('.res-pdf-text')).toHaveCount(0);
});

for (const kind of ['office', 'supplement', 'history']) test(`原生正文 ${kind} 以实际PDF来源打开，旧命中失配拒绝`, async ({ page, world }, info) => {
  await register(page, world);
  const client = await authenticatedClient(page, world);
  const query = kind === 'office' ? '定义域' : 'sourcemarker';
  const original = kind === 'office'
    ? await upload(client, 'W.docx', fs.readFileSync('test/fixtures/questions/W.docx'))
    : await upload(client, 'original.pdf', await pdf(page, 'ORIGINAL sourcemarker MATCH'));
  await preview(client, original.id);
  let resource = await add(client, original, `来源-${kind}`);
  let source = original;
  const other = await upload(client, 'other.pdf', await pdf(page, 'OTHER WITHOUT MATCH'));
  await preview(client, other.id);
  if (kind === 'supplement') {
    source = await upload(client, 'supplement.pdf', await pdf(page, 'SUPPLEMENT sourcemarker MATCH'));
    await preview(client, source.id);
    resource = await json(client, 'PUT', `${root}/${resource.id}/supplement-preview`, {
      baseVersion: resource.version, fileId: original.id, supplementPreviewFileId: source.id,
    });
  }
  if (kind === 'history') {
    resource = await json(client, 'PUT', `${root}/${resource.id}/file`, { baseVersion: resource.version, fileId: other.id });
    resource = await json(client, 'POST', `${root}/${resource.id}/restore-file`, { baseVersion: resource.version, fileVersion: 1 });
  }
  const response = await json(client, 'GET', `${root}?q=${encodeURIComponent(query)}`);
  const match = response.search.matches[resource.id];
  expect(match.native.fileId).toBe(source.id);
  const view = await json(client, 'GET', `${filesPath}/${source.id}/preview`);
  expect(match.native.renditionFileId).toBe(view.renditionFileId);
  expect(match.native.textFileId).toBe(kind === 'office' ? view.renditionFileId : source.id);
  await search(page, query);
  await expect(page.getByText(`来源-${kind}`, { exact: true })).toBeVisible();
  await page.getByText(`来源-${kind}`, { exact: true }).click();
  await expect(page.locator('.res-pdf-text')).toContainText(query);
  await page.getByRole('button', { name: '查找本页', exact: true }).click();
  await page.getByRole('textbox', { name: '查找本页文字', exact: true }).fill(query);
  await expect(page.locator('.res-find-status')).toContainText(/1 \/ [1-9]\d* 处/);
  await page.screenshot({ path: info.outputPath(`${kind}-native-source.png`), animations: 'disabled' });
  await page.locator('.res-back-button').click();
  await expect(page.getByText(`来源-${kind}`, { exact: true })).toBeVisible();
  await json(client, 'PUT', `${root}/${resource.id}/file`, { baseVersion: resource.version, fileId: other.id });
  await page.getByText(`来源-${kind}`, { exact: true }).click();
  await expect(page.getByText('资料文件已更新，请在最新搜索结果中重新打开。', { exact: true })).toBeVisible();
  await expect(page.locator('.res-pdf-text')).toHaveCount(0);
});


test.describe('OCR命中来源', () => {
  test.use({ applicationOptions: async ({}, use) => {
    const { replayRecognizer } = await import('../../../../test/fixtures/questions/recognition/replay.mjs');
    await use({ workbench: { recognition: { recognizer: await replayRecognizer() } } });
  } });
  test('识别正文仍验证固定来源，换原件后不能打开旧OCR命中', async ({ page, world }) => {
    await register(page, world);
    const client = await authenticatedClient(page, world);
    const file = await upload(client, 'OCR原页.png', fs.readFileSync('test/fixtures/questions/recognition/I-1/page.png'));
    const view = await preview(client, file.id);
    const job = await json(client, 'POST', `${filesPath}/${file.id}/recognition`, { renditionFileId: view.renditionFileId, pages: [1] }, 202);
    const { finished } = await import('../../../api/test/rebuilt-outputs/helpers.js');
    expect((await finished(client, job.id)).state).toBe('succeeded');
    const resource = await add(client, file, 'OCR固定来源');
    const response = await json(client, 'GET', `${root}?q=${encodeURIComponent('定义域')}`);
    expect(response.search.matches[resource.id].recognition.location.fileId).toBe(file.id);
    await search(page, '定义域');
    await page.getByText('OCR固定来源', { exact: true }).click();
    await expect(page.getByRole('region', { name: '第 1 页识别正文', exact: true })).toContainText('定义域');
    await page.locator('.res-back-button').click();
    await expect(page.getByText('OCR固定来源', { exact: true })).toBeVisible();
    const other = await upload(client, 'replacement.pdf', await pdf(page, 'REPLACED'));
    await preview(client, other.id);
    await json(client, 'PUT', `${root}/${resource.id}/file`, { baseVersion: resource.version, fileId: other.id });
    await page.getByText('OCR固定来源', { exact: true }).click();
    await expect(page.getByText('资料文件已更新，请在最新搜索结果中重新打开。', { exact: true })).toBeVisible();
    await expect(page.locator('.res-recognition-document')).toHaveCount(0);
  });
});
