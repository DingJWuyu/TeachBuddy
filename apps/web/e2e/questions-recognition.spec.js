import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from '../../api/test/fixtures/math-real.mjs';
import { pageNames, sourceImage, replayRecognizer } from '../../../test/fixtures/questions/recognition/replay.mjs';
import { documentText, images, walkBlocks } from '../../api/src/workbench/content/document.js';

const base = '/api/modules/questions/v2';
let world, client, recognizer, beforePage, email;
test.beforeEach(async () => {
  beforePage = async () => {};
  recognizer = await replayRecognizer({beforePage: (...args) => beforePage(...args)});
  world = await createIntegration({directory: fs.mkdtempSync(path.join(os.tmpdir(), 'questions-recognition-')),
    workbench: {recognition: {recognizer}}});
  email = 'questions-recognition@example.test';
  ({client} = await registerMath(world, email));
});
test.afterEach(async ({}, info) => {
  await world.close();
  if (info.status === info.expectedStatus) fs.rmSync(world.directory, {recursive: true, force: true});
  else console.log('保留识别回放现场：' + world.directory);
});
async function request(method, url, body, options = {}) {
  const response = await client.request(method, url, {body, headers: {'Idempotency-Key': randomUUID()}, ...options});
  expect(response.status, response.text).toBeGreaterThanOrEqual(200);
  expect(response.status, response.text).toBeLessThan(300);
  return response.json;
}
async function upload(page) {
  const boundary = `questions-${randomUUID()}`;
  return request('POST', '/api/workbench/files', undefined, {
    contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${page}.png"\r\nContent-Type: image/png\r\n\r\n`),
      sourceImage(page), Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
}
async function importPages(names = pageNames) {
  const files = [];
  for (const name of names) files.push(await upload(name));
  return request('POST', `${base}/imports`, {title: '扫描练习与原有答案', origin: '真实 OCR 产物离线回放',
    input: {kind: 'files', fileIds: files.map(file => file.id), pages: []}});
}
async function waitJob(id) {
  let job;
  await expect.poll(async () => {
    job = await request('GET', `/api/workbench/jobs/${id}`);
    return ['queued', 'running', 'cancelling'].includes(job.state);
  }, {timeout: 20000}).toBe(false);
  return job;
}
const read = id => request('GET', `${base}/imports/${id}`);
function assertSix(material) {
  expect(material.drafts.map(d => d.title)).toEqual(['Q1.', 'Q2.', 'Q3.', 'Q4.', 'Q5.', 'Q6.']);
  expect(material.drafts.map(d => d.answerStatus)).toEqual(['present', 'present', 'present', 'present', 'present', 'absent']);
  expect(material.drafts.map(d => images(d.body).length)).toEqual([0, 1, 0, 0, 1, 1]);
  expect(material.drafts[5].solution.blocks).toEqual([]);
  const geometry = [];
  walkBlocks(material.drafts[5].body.blocks, b => {
    for (const run of b.runs ?? []) if (run.type === 'math') geometry.push(run.latex);
  });
  expect(geometry).toEqual(['ABCD-A_{1}B_{1}C_{1}D_{1}', 'AC_{1}']);
  expect(documentText(material.drafts[3].body)).not.toContain('文字层');
  expect(material.fragments.some(f => f.text.includes('文字层'))).toBe(true);
  const formulae = [];
  walkBlocks(material.drafts[2].body.blocks, b => {
    for (const run of b.runs ?? []) if (run.type === 'math') formulae.push(run.latex);
  });
  expect(formulae).toContain(' f(x) = \\begin{cases} ax + 1, & x < 0 \\\\ x^2 - 1, & x \\geq 0 \\end{cases} ');
  expect(material.drafts[0].parts.find(p => p.role === 'solution').locations[0].fileId)
    .not.toBe(material.drafts[0].parts[0].locations[0].fileId);
}

test('HTTP：共用 OCR 生成六题、五答案、三图，校对入库后刷新仍可读', async () => {
  const created = await importPages();
  expect((await waitJob(created.jobId)).state).toBe('succeeded');
  let material = await read(created.id);
  assertSix(material);
  expect(recognizer.calls).toEqual(pageNames);
  for (const draft of material.drafts) {
    for (const id of images(draft.body)) {
      const response = await client.request('GET', `/api/workbench/files/${id}/content`);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image/png');
    }
  }
  material = await request('PUT', `${base}/imports/${material.id}`, {baseVersion: material.version,
    drafts: material.drafts.map(d => ({...d, issues: d.issues.map(i => ({...i, resolution: 'acknowledged'}))})),
    fragments: material.fragments});
  const uncorrected = await client.request('POST', `${base}/imports/${material.id}/commit`, {
    body: {baseVersion: material.version, draftIds: material.drafts.map(d => d.id)}, headers: {'Idempotency-Key': randomUUID()},
  });
  expect(uncorrected.status).toBe(409);
  // The shared mapper restores bounded geometry notation. Teacher review
  // confirms the machine body without retyping subscripts or adding answers.
  const machineGeometry = structuredClone(material.drafts[5].body);
  material = await request('PUT', `${base}/imports/${material.id}`, {baseVersion: material.version,
    drafts: material.drafts.map(d => ({...d, issues: d.issues.map(i => ({...i, resolution: 'corrected'}))})),
    fragments: material.fragments});
  const committed = await request('POST', `${base}/imports/${material.id}/commit`, {
    baseVersion: material.version, draftIds: material.drafts.map(d => d.id),
  });
  expect(committed.questions).toHaveLength(6);
  expect(committed.questions[5].body).toEqual(machineGeometry);
  expect((await request('GET', `${base}/items`)).items).toHaveLength(6);
  for (const question of committed.questions) {
    const reopened = await request('GET', `${base}/items/${question.id}`);
    expect(reopened.body).toEqual(question.body);
    expect(reopened.solution).toEqual(question.solution);
    expect(reopened.source).toEqual(question.source);
  }
  const again = await request('POST', `${base}/imports`, {title: '采用已有识别页', origin: '', input: created.input});
  expect((await waitJob(again.jobId)).state).toBe('succeeded');
  assertSix(await read(again.id));
  expect(recognizer.calls).toEqual(pageNames);
});

test('HTTP：答案页失败后只重试失败页，保留人工校对并单列新候选', async () => {
  beforePage = async name => { if (name === 'PS-4') throw new Error('Controlled failed page'); };
  const created = await importPages();
  expect((await waitJob(created.jobId)).state).toBe('partial');
  let material = await read(created.id);
  expect(material.drafts).toHaveLength(6);
  expect(material.drafts.every(d => d.answerStatus === 'unresolved')).toBe(true);
  const edited = {...material.drafts[0], title: '老师已校对的题目'};
  material = await request('PUT', `${base}/imports/${created.id}`, {baseVersion: material.version,
    drafts: [edited, ...material.drafts.slice(1)], fragments: material.fragments});
  beforePage = async () => {};
  const retry = await request('POST', `/api/workbench/jobs/${material.jobId}/retry`, {unitIds: []});
  expect((await waitJob(retry.id)).state).toBe('succeeded');
  material = await read(created.id);
  expect(recognizer.calls).toEqual([...pageNames, 'PS-4']);
  expect(material.drafts.find(d => d.id === edited.id)).toEqual(edited);
  expect(material.drafts.filter(d => d.answerStatus === 'present')).toHaveLength(5);
  expect(material.drafts.filter(d => d.title === 'Q6.')[0].answerStatus).toBe('absent');
  expect((await read(created.id)).drafts).toEqual(material.drafts);
});

test('HTTP：重复题号的答案保持未分配，不按上传顺序猜测归属', async () => {
  const created = await importPages(['I-1', 'I-1', 'PS-4']);
  expect((await waitJob(created.jobId)).state).toBe('succeeded');
  const material = await read(created.id);
  expect(material.drafts).toHaveLength(4);
  expect(material.drafts.every(d => d.answerStatus === 'unresolved')).toBe(true);
  expect(material.fragments.some(f => f.text.includes('根号内非负'))).toBe(true);
  expect(recognizer.calls).toEqual(['I-1', 'PS-4']);
});

test('HTTP：取消时清理未确认按失败上报，保留此前题目且不继续后续页', async () => {
  let entered;
  const reached = new Promise(resolve => { entered = resolve; });
  beforePage = async (name, signal) => {
    if (name !== 'I-2') return;
    await new Promise((resolve, reject) => {
      entered();
      signal.addEventListener('abort', () => reject(Object.assign(new Error('Scope cleanup failed'), {code: 'recognition-cleanup'})), {once: true});
    });
  };
  const created = await importPages();
  await reached;
  await request('POST', `/api/workbench/jobs/${created.jobId}/cancel`, {});
  const job = await waitJob(created.jobId);
  expect(job.state).toBe('failed');
  expect(job.issues[0].detail).toContain('尚未确认识别进程停止');
  const fileId = created.input.fileIds[1];
  const machine = await request('GET', `/api/workbench/files/${fileId}/recognition/pages/1?renditionFileId=${fileId}`);
  expect(machine.state).toBe('failed');
  expect(machine.issues[0].code).toBe('recognition-cleanup');
  const material = await read(created.id);
  expect(material.drafts).toHaveLength(2);
  expect(material.drafts.every(d => d.answerStatus === 'unresolved')).toBe(true);
  expect(recognizer.calls).toEqual(['I-1', 'I-2']);
});

test('HTTP：取消后的迟到原稿和题图绑定旧任务，重试不能覆盖旧证据', async () => {
  let entered;
  const reached = new Promise(resolve => { entered = resolve; });
  const original = recognizer.run.bind(recognizer);
  recognizer.run = async input => {
    const result = await original({...input, signal: new AbortController().signal});
    if (recognizer.calls.at(-1) === 'I-3') await new Promise(resolve => {
      input.signal.addEventListener('abort', resolve, {once:true});
      entered();
    });
    return result;
  };
  const created = await importPages();
  await reached;
  await request('POST', `/api/workbench/jobs/${created.jobId}/cancel`, {});
  const cancelled = await waitJob(created.jobId);
  expect(cancelled.state).toBe('cancelled');
  expect(cancelled.outputFileIds).toHaveLength(5);
  expect((await read(created.id)).drafts).toHaveLength(4);
  const task = () => JSON.parse(world.workbench.db.prepare('SELECT value FROM questions_materials_tasks WHERE id=?').get(created.jobId).value);
  const oldTask = task();
  const evidence = Object.values(oldTask.lateResults)[0];
  expect(evidence.source.fileId).toBe(created.input.fileIds[2]);
  expect(evidence.source.page).toBe(1);
  expect(evidence.originalAssetFileIds).toHaveLength(2);
  expect(oldTask.completed).not.toContain(`file:${created.input.fileIds[2]}:page:1`);
  expect(oldTask.machineResults[`file:${created.input.fileIds[2]}:page:1`]).toBeUndefined();
  expect(cancelled.outputFileIds).toEqual([evidence.rawFileId, ...evidence.assetFileIds]);
  const oldRaw = (await client.request('GET', `/api/workbench/files/${evidence.rawFileId}/content`)).text;
  recognizer.run = original;
  const retry = await request('POST', `/api/workbench/jobs/${created.jobId}/retry`, {unitIds:[]});
  expect((await waitJob(retry.id)).state).toBe('succeeded');
  assertSix(await read(created.id));
  expect(recognizer.calls).toEqual(['I-1','I-2','I-3','I-3','PS-4']);
  expect(task().lateResults).toEqual(oldTask.lateResults);
  expect((await request('GET', `/api/workbench/jobs/${created.jobId}`)).outputFileIds).toEqual(cancelled.outputFileIds);
  for (const id of cancelled.outputFileIds) expect((await client.request('GET', `/api/workbench/files/${id}/content`)).status).toBe(200);
  expect((await client.request('GET', `/api/workbench/files/${evidence.rawFileId}/content`)).text).toBe(oldRaw);
  const fileId = created.input.fileIds[2];
  const latest = await request('GET', `/api/workbench/files/${fileId}/recognition/pages/1?renditionFileId=${fileId}`);
  expect(latest.rawFileId).not.toBe(evidence.rawFileId);
  const exported = await request('POST', '/api/reliability/v1/exports', {});
  let archive;
  await expect.poll(async () => {
    archive = await request('GET', `/api/reliability/v1/exports/${exported.id}`);
    return archive.state;
  }, {timeout:20000}).toBe('ready');
  expect((await client.request('GET', archive.downloadPath)).status).toBe(200);
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(world.directory, 'personal-exports', `${exported.id}.zip`)));
  const supplemental = JSON.parse(await zip.file('data/supplemental.json').async('string'));
  const fixed = supplemental.questionRecognitionEvidence.find(item => item.jobId === created.jobId);
  expect(fixed).toEqual({jobId:created.jobId, importId:created.id, lateResults:oldTask.lateResults});
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  for (const id of cancelled.outputFileIds) {
    const entry = manifest.files.find(file => file.path.startsWith(`files/${id}/`));
    expect(entry).toBeTruthy();
    expect((await zip.file(entry.path).async('nodebuffer')).length).toBe(entry.bytes);
    if (id === evidence.rawFileId) expect(await zip.file(entry.path).async('string')).toBe(oldRaw);
  }
});

test('HTTP：明确续题沿用唯一归并，数字列表不会吞掉题号', async () => {
  // Controlled transcription exercises generic layout forms missing from the
  // fixed accuracy corpus. It is not recorded as real OCR fidelity evidence.
  let calls = 0;
  recognizer.run = async ({width, height}) => {
    const content = calls++ === 0 ? '1. 已知集合 A。\n2. 求整数个数。' : '续第1题\n求集合 A 的补集。';
    return {width, height, assets: [], markdown: content, raw: {
      width, height, parsing_res_list: [
        {block_id: 0, block_label: 'text', block_bbox: [width * 0.1, height * 0.1, width * 0.9, height * 0.5], block_content: content},
      ],
    }};
  };
  const created = await importPages(['I-1', 'I-2']);
  expect((await waitJob(created.jobId)).state).toBe('succeeded');
  const material = await read(created.id);
  expect(material.drafts).toHaveLength(2);
  expect(material.drafts[0].title).toBe('1.');
  expect(documentText(material.drafts[0].body)).toContain('求集合 A 的补集');
  expect(material.drafts[0].parts.filter(p => p.role === 'body')).toHaveLength(2);
  expect(material.drafts[1].title).toBe('2.');
});

test('HTTP：另一份同题号材料不能抢走本原件内明确匹配的答案', async () => {
  let calls = 0;
  recognizer.run = async ({width, height}) => {
    const content = calls++ === 0 ? '1. 计算 2+3。\n答案：5。' : '1. 计算 8+9。';
    return {width, height, assets: [], raw: {width, height, parsing_res_list: [
      {block_id: 0, block_label: 'text', block_bbox: [0, 0, width, height / 2], block_content: content},
    ]}};
  };
  const created = await importPages(['I-1', 'I-2']);
  expect((await waitJob(created.jobId)).state).toBe('succeeded');
  const material = await read(created.id);
  expect(material.drafts).toHaveLength(2);
  expect(material.drafts[0].answerStatus).toBe('present');
  expect(documentText(material.drafts[0].solution)).toContain('5');
  expect(material.drafts[1].solution.blocks).toEqual([]);
});

test('HTTP：未拆开的教学表格保留为未分配内容，活动标题不生成假题目', async () => {
  recognizer.run = async ({width, height}) => ({width, height, assets: [], raw: {width, height, parsing_res_list: [
    {block_id: 0, block_label: 'paragraph_title', block_bbox: [0, 0, width, height * 0.1], block_content: '教学环节：初步应用'},
    {block_id: 1, block_label: 'table', block_bbox: [0, height * 0.2, width, height * 0.8],
      block_content: '<table><tr><th>教学内容</th><th>师生活动</th></tr><tr><td>判断函数奇偶性</td><td>教师引导学生讨论</td></tr></table>'},
  ]}});
  const created = await importPages(['I-1']);
  const job = await waitJob(created.jobId);
  expect(job.state).toBe('partial');
  expect(job.issues[0].detail).toContain('尚未可靠区分');
  const material = await read(created.id);
  expect(material.drafts).toEqual([]);
  expect(material.fragments.map(f => f.text).join('\n')).toContain('教师引导学生讨论');
  expect(material.fragments.some(f => f.text === '教学环节：初步应用')).toBe(true);
});

test('HTTP：首格是教学环节的表格仍提示结构未拆开，不能作为普通标题跳过', async () => {
  recognizer.run = async ({width, height}) => ({width, height, assets: [], raw: {width, height, parsing_res_list: [
    {block_id: 0, block_label: 'table', block_bbox: [0, 0, width, height],
      block_content: '<table><tr><td>教学环节：初步应用</td><td>判断函数奇偶性</td></tr><tr><td>师生活动</td><td>教师引导学生讨论</td></tr></table>'},
  ]}});
  const created = await importPages(['I-1']);
  const job = await waitJob(created.jobId);
  expect(job.state).toBe('partial');
  expect(job.issues.some(issue => issue.detail?.includes('尚未可靠区分'))).toBe(true);
  const material = await read(created.id);
  expect(material.drafts).toEqual([]);
  const text = material.fragments.map(fragment => fragment.text).join('\n');
  expect(text).toContain('教学环节：初步应用');
  expect(text).toContain('判断函数奇偶性');
  expect(text).toContain('教师引导学生讨论');
});

test('浏览器：图片批次逐题校对，几何下标自动恢复后入库并刷新', async ({page}, info) => {
  await page.goto(world.origin);
  await page.getByLabel('邮箱', {exact:true}).fill(email);
  await page.getByLabel('密码', {exact:true}).fill('math-password');
  await page.getByRole('button', {name:'登录', exact:true}).click();
  await page.getByRole('button', {name:'知道了', exact:true}).click();
  await page.getByRole('navigation', {name:'功能模块'}).getByRole('link', {name:/^题库/}).click();
  await page.locator('.q-finder').getByRole('button', {name:'从资料收录', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'从资料收录题目'});
  await dialog.getByRole('button', {name:/上传图片/}).click();
  await dialog.getByLabel('选择原稿').setInputFiles(pageNames.map(name => ({name:name+'.png', mimeType:'image/png', buffer:sourceImage(name)})));
  const accepted = page.waitForResponse(response => response.url().endsWith(`${base}/imports`) && response.request().method() === 'POST');
  await dialog.getByRole('button', {name:'开始整理'}).click();
  const created = await (await accepted).json();
  expect((await waitJob(created.jobId)).state).toBe('succeeded');
  const tabs = page.getByRole('navigation', {name:'选择待检查题目'}).getByRole('button');
  await expect(tabs).toHaveCount(6);
  await expect(page.locator('.q-reading-body .katex').first()).toBeVisible();
  await tabs.nth(1).click();
  const figure = page.locator('.q-reading-body img');
  await expect(figure).toBeVisible();
  await expect.poll(() => figure.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.screenshot({path:info.outputPath('question-2-light.png'),fullPage:true});
  for (let i = 0; i < 6; i++) {
    await tabs.nth(i).click();
    if (i === 2) {
      await expect(page.locator('.q-reading-body .katex .mtable')).toBeVisible();
      await page.screenshot({path:info.outputPath('question-3-cases.png'),fullPage:true});
    }
    if (i === 5) {
      await expect(page.getByText('原稿中未提供答案', {exact:true})).toBeVisible();
      await expect(page.locator('.q-reading-body .katex')).toHaveCount(2);
    }
    for (const select of await page.locator('.q-review-checks select').all()) await select.selectOption('corrected');
    await page.getByRole('button', {name:'确认这道题',exact:true}).click();
    await expect(page.getByText('这道题已入库', {exact:true})).toBeVisible();
  }
  expect((await request('GET',`${base}/items`)).items).toHaveLength(6);
  await page.reload();
  await expect(tabs).toHaveCount(6);
  await expect(tabs.nth(5)).toContainText('已入库');
  await tabs.nth(5).click();
  await expect(page.getByText('原稿中未提供答案', {exact:true})).toBeVisible();
  await page.getByRole('button', {name:'查看题目',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Q6.',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.locator('.q-reading-body img')).toBeVisible();
  await expect(page.locator('.q-reading-body .katex')).toHaveCount(2);
  await page.getByRole('link', {name:'账户：数学教师'}).click();
  await page.getByRole('button', {name:'深色',exact:true}).click();
  await page.getByRole('navigation', {name:'功能模块'}).getByRole('link', {name:/^题库/}).click();
  await expect(page.locator('html')).toHaveAttribute('data-workbench-theme','dark');
  for (const width of [1440,600]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await expect(page.getByRole('button', {name:'编辑题目',exact:true})).toBeVisible();
    await page.screenshot({path:info.outputPath(`question-6-dark-${width}.png`),fullPage:true});
  }
});
