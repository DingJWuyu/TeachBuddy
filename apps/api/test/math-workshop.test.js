import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import sharp from 'sharp';
import JSZip from 'jszip';
import { createApp } from '../src/app.js';
import { validate } from '../src/modules/math/contract.js';
import { backup, restore, activate } from '../src/workbench/reliability/backup.js';
import { createWorkshopSource } from '@teachbuddy/shared/math/workshop';

const works = '/api/modules/math/v1/works';
const formula = (id, latex) => ({ id, latex, caption: '中文条件：a≠0', includeCaption: true, color: '#172554', fontSize: 32 });
const source = () => ({ ...createWorkshopSource(), formulas: [formula('root', 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'), formula('condition', '\\begin{cases}a>0\\\\b^2-4ac\\ge0\\end{cases}')],
  steps: [{ id: 'first', title: '公式', description: '先看求根公式', values: {}, visibleObjects: [], visibleFormulas: ['root'], view: 'plane' }, { id: 'second', title: '条件', description: '再看条件', values: {}, visibleObjects: [], visibleFormulas: ['root', 'condition'], view: 'plane' }], initialStepId: 'first' });
async function harness(directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-workshop-')), webDist) {
  let runtime;
  const start = async () => {
    runtime = createApp({ env: { nodeEnv: 'test', sqlitePath: path.join(directory, 'workspace.sqlite'), workbench: { mode: 'test-principal', testPrincipals: ['workshop-a', 'workshop-b'], trustedOrigins: ['http://localhost'], webDist, logDir: path.join(directory, 'logs') } } });
    await runtime.workbench.initialize();
  };
  await start();
  return { directory, get runtime() { return runtime; }, send(method, url, body, key = randomUUID(), account = 'workshop-a') {
    let req = request(runtime.app)[method](url).set('Cookie', runtime.workbench.identity.testPrincipalCookie(account).header.split(';')[0]).set('Origin', 'http://localhost').set('X-TeachBuddy-Request', '1').set('Idempotency-Key', key);
    return body === undefined ? req : req.send(body);
  }, async bytes(id) { const stream = await runtime.workbench.files.open({ accountKey: 'workshop-a' }, id); const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); }, async restart() { await runtime.close(); await start(); }, async close() { await runtime.close(); } };
}

test('workshop real HTTP/SQLite: complete formula source, version history, exports and replay', { timeout: 90000 }, async () => {
  const h = await harness(); let success = false;
  const evidence = path.resolve(process.env.MATH_WORKSHOP_EVIDENCE ?? 'test-results/math-unified/outputs/formulas');
  fs.mkdirSync(evidence, { recursive: true });
  try {
    const input = { title: '求根公式与条件', source: source(), originalFileId: null };
    const key = randomUUID(); const created = await h.send('post', works, input, key);
    assert.equal(created.status, 201, JSON.stringify(created.body)); const work = created.body;
    validate('Work', work); assert.equal(work.source.kind, 'workshop'); assert.equal(work.render.state, 'ready'); assert.equal(work.render.graphPosterFileId, null);
    const png = await h.bytes(work.render.posterFileId); assert.equal((await sharp(png).metadata()).format, 'png'); fs.writeFileSync(path.join(evidence, 'poster.png'), png);
    const classroom = await h.bytes(work.render.presentationFileId); const zip = await JSZip.loadAsync(classroom); const html = await zip.file('index.html').async('string'); assert.ok(html.includes('求根公式与条件')); assert.ok(!html.includes('runtime/loader.js')); assert.ok(!html.includes('/api/')); fs.writeFileSync(path.join(evidence, 'classroom.zip'), classroom);
    assert.deepEqual((await h.send('post', works, input, key)).body, work);
    assert.equal((await h.send('get', `${works}/${work.id}`, undefined, randomUUID(), 'workshop-b')).status, 404);
    for (const options of [{ format: 'source' }, { format: 'bundle' }, { format: 'png' }, { format: 'svg' }, { format: 'svg', selection: 'formula', formulaId: 'condition' }]) {
      const result = await h.send('post', `${works}/${work.id}/exports`, { version: 1, background: 'transparent', width: 1600, ...options });
      assert.equal(result.status, 201, JSON.stringify(result.body)); validate('WorkExport', result.body);
      const bytes = await h.bytes(result.body.file.id); if (options.format === 'source') assert.deepEqual(JSON.parse(bytes), input.source);
      if (options.format === 'bundle') { assert.equal(result.body.file.mediaType, 'application/zip'); assert.equal(result.body.offline, 'self-contained'); }
      fs.writeFileSync(path.join(evidence, `${options.selection ?? 'work'}.${options.format === 'bundle' ? 'zip' : options.format === 'source' ? 'json' : options.format}`), bytes);
    }
    const modified = structuredClone(input.source); modified.initialStepId = 'second'; const updated = await h.send('put', `${works}/${work.id}`, { baseVersion: 1, title: input.title, source: modified }); assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.deepEqual((await h.send('get', `${works}/${work.id}/versions/1`)).body.source, input.source);
    const invalidSource = structuredClone(modified); invalidSource.formulas[0].latex = '\\frac{';
    const invalid = await h.send('put', `${works}/${work.id}`, { baseVersion: 2, title: input.title, source: invalidSource }); assert.equal(invalid.status, 200, JSON.stringify(invalid.body)); assert.equal(invalid.body.render.state, 'invalid'); assert.equal(invalid.body.render.graphPosterFileId, null); assert.equal(invalid.body.render.presentationFileId, null);
    const rejected = await h.send('post', works, { ...input, source: { ...source(), initialStepId: 'missing' } }); assert.equal(rejected.status, 422);
    const paramError = source(); paramError.steps[0].values = { a: 1 }; assert.equal((await h.send('post', works, { ...input, source: paramError })).status, 422);
    await h.restart(); assert.deepEqual((await h.send('post', works, input, key)).body, work); assert.deepEqual((await h.send('get', `${works}/${work.id}/versions/1`)).body.source, input.source);
    const archived = await h.send('post', `${works}/${work.id}/deletion`, { baseVersion: 3, deleted: true }); assert.equal(archived.status, 200); assert.equal(archived.body.version, 4);
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ state: 'passed', identity: 'isolated-test-principal', workId: work.id, source: input.source }, null, 2)); success = true;
  } finally { await h.close(); if (success) fs.rmSync(h.directory, { recursive: true, force: true }); }
});

test('workshop actual classroom ZIP: file URL, cold offline browser, formulas and step controls', { timeout: 45000 }, async () => {
  const { chromium } = await import('playwright');
  const { renderWorkshop } = await import('../src/modules/math/workshop-render.js');
  const { workshopPresentation } = await import('../src/modules/math/workshop-presentation.js');
  const { pathToFileURL } = await import('node:url');
  const data = source(); const output = await renderWorkshop(data); const bytes = await workshopPresentation(data, { title: '求根公式与条件', formulaAssets: output.formulaAssets });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-workshop-offline-')); const zip = await JSZip.loadAsync(bytes);
  let browser; let success = false;
  try {
    for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir) { const filename = path.join(directory, name); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, await entry.async('nodebuffer')); }
    browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); const page = await context.newPage(); const errors = []; const network = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('request', req => { if (/^https?:/.test(req.url())) network.push(req.url()); });
    await page.goto(pathToFileURL(path.join(directory, 'index.html')).href); await page.getByRole('heading', { name: '求根公式与条件' }).waitFor();
    assert.equal(await page.locator('.formula-row').count(), 1); assert.equal(await page.locator('.graph').count(), 0);
    await page.getByRole('combobox', { name: '教学步骤' }).selectOption('second'); assert.equal(await page.locator('.formula-row').count(), 2); assert.equal(await page.locator('.step-description').textContent(), '再看条件');
    await page.getByRole('button', { name: '重置' }).click(); assert.equal(await page.locator('.formula-row').count(), 2); assert.deepEqual(errors, []); assert.deepEqual(network, []);
    const evidence = path.resolve(process.env.MATH_WORKSHOP_EVIDENCE ?? 'test-results/math-unified/outputs/formulas'); await page.screenshot({ path: path.join(evidence, 'classroom-offline.png'), fullPage: true }); fs.writeFileSync(path.join(evidence, 'classroom-offline.json'), JSON.stringify({ transport: 'file://', browser: 'Playwright Chromium', profile: 'fresh', offline: true, requests: network, errors, formulaRows: 2, steps: 'passed' }, null, 2)); success = true;
  } finally { await browser?.close(); if (success) fs.rmSync(directory, { recursive: true, force: true }); }
});

test('workshop real authenticated HTTPS: physical backup and restore retain mixed renderer versions and every fixed file', { timeout: 90000 }, async () => {
  const { createIntegration } = await import('./fixtures/auth-integration/harness.js');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-workshop-auth-')); const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'math-workshop-archives-'));
  let world = await createIntegration({ directory, webDist: path.resolve('apps/web/public') }); let success = false;
  const email = 'workshop-backup@example.test'; const password = 'Workshop-backup-123';
  const authenticate = async (registration) => {
    const client = world.client(); await client.request('POST', '/api/auth/session', { body: { action: 'bootstrap' } });
    let response;
    if (registration) {
      const code = await client.request('POST', '/api/auth/registration-codes', { body: { email } });
      response = await client.request('POST', '/api/auth/register', { body: { email, nickname: '数学老师', password, termsAccepted: true, rememberMe: true, challengeId: code.json.challengeId, verificationCode: world.mailer.lastCode('registration', email) } });
      assert.equal(response.status, 201, response.text);
    } else { response = await client.request('POST', '/api/auth/login', { body: { email, password, rememberMe: true } }); assert.equal(response.status, 200, response.text); }
    assert.equal((await client.request('POST', '/api/auth/session', { body: { action: 'activate', sessionId: response.json.id, rememberMe: true } })).status, 200);
    return client;
  };
  const write = (client, method, url, body, key = randomUUID()) => client.request(method, url, { body, headers: { 'Idempotency-Key': key } });
  try {
    let client = await authenticate(true); const input = { title: '备份统一数学作品', source: JSON.parse(fs.readFileSync(new URL('./fixtures/math-workshop/combined-source.json', import.meta.url))), originalFileId: null }; const key = randomUUID();
    const created = await write(client, 'POST', works, input, key); assert.equal(created.status, 201, created.text); const work = created.json;
    const legacySource = { schemaVersion: 1, kind: 'formula', ...formula('old', 'a+b') }; delete legacySource.id;
    const legacy = await write(client, 'POST', works, { title: '原生公式', originalFileId: null, source: legacySource }); assert.equal(legacy.status, 201, legacy.text); assert.notEqual(legacy.json.rendererVersion, work.rendererVersion);
    const download = async id => { assert.equal((await client.request('GET', `/api/workbench/files/${id}/content`)).status, 200); const accountKey = (await client.request('GET', '/api/workbench/context')).json.accountKey; const stream = await world.workbench.files.open({ accountKey }, id); const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); };
    const poster = await download(work.render.posterFileId); const classroom = await download(work.render.presentationFileId); const graph = await download(work.render.graphPosterFileId); assert.ok(poster.length > 1000); assert.ok(classroom.length > 1000); assert.ok(graph.length > 1000);
    const backupTarget = path.join(archiveRoot, 'backup'); const restoreTarget = path.join(archiveRoot, 'restored'); await world.close(); world = null;
    assert.equal((await backup({ database: path.join(directory, 'workspace.sqlite'), files: path.join(directory, 'files'), target: backupTarget, stopped: true })).state, 'backed-up');
    assert.equal(restore({ source: backupTarget, target: restoreTarget, stopped: true }).state, 'prepared'); assert.equal(activate({ target: restoreTarget, stopped: true }).state, 'activated');
    world = await createIntegration({ directory: restoreTarget, webDist: path.resolve('apps/web/public') }); client = await authenticate(false);
    const reloaded = await client.request('GET', `${works}/${work.id}`); assert.deepEqual(reloaded.json, work); assert.deepEqual((await write(client, 'POST', works, input, key)).json, work);
    assert.deepEqual(await download(work.render.posterFileId), poster); assert.deepEqual(await download(work.render.graphPosterFileId), graph); assert.deepEqual(await download(work.render.presentationFileId), classroom);
    const evidence = path.resolve(process.env.MATH_WORKSHOP_EVIDENCE ?? 'test-results/math-unified/outputs/formulas'); fs.writeFileSync(path.join(evidence, 'backup-restored.json'), JSON.stringify({ state: 'passed', identity: 'real-cookie-session', source: 'physical SQLite+files backup', mixedRenderers: true, preserved: ['complete-source', 'poster', 'graph-poster', 'classroom', 'idempotency-receipt'] }, null, 2)); success = true;
  } finally { await world?.close(); if (success) { fs.rmSync(directory, { recursive: true, force: true }); fs.rmSync(archiveRoot, { recursive: true, force: true }); } }
});

test('workshop graph HTTP: fixed static asset root, trusted plane/space posters, source exports', { timeout: 120000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-workshop-graph-api-'));
  const webDist = path.join(directory, 'candidate-web'); fs.mkdirSync(webDist); fs.writeFileSync(path.join(webDist, 'index.html'), '<!doctype html><title>isolated candidate</title>');
  const h = await harness(path.join(directory, 'data'), webDist); let success = false;
  const data = JSON.parse(fs.readFileSync(new URL('./fixtures/math-workshop/combined-source.json', import.meta.url)));
  const evidence = path.resolve('test-results/math-unified/outputs/graphs'); fs.mkdirSync(evidence, { recursive: true });
  try {
    const input = { title: '平方函数与立方体', source: data, originalFileId: null };
    const absent = await h.send('post', works, input); assert.equal(absent.status, 503, JSON.stringify(absent.body)); assert.equal(h.runtime.workbench.db.prepare('SELECT count(*) AS n FROM math_works').get().n, 0);
    const candidateRuntime = path.join(webDist, 'vendor/math/geogebra'); fs.mkdirSync(path.dirname(candidateRuntime), { recursive: true }); fs.cpSync(path.resolve('apps/web/public/vendor/math/geogebra'), candidateRuntime, { recursive: true });
    fs.appendFileSync(path.join(candidateRuntime, 'loader.js'), '\nwindow.workshopStaticCandidateProof="isolated-static-build";\n');
    const result = await h.send('post', works, input); assert.equal(result.status, 201, JSON.stringify(result.body)); const work = result.body; validate('Work', work); assert.equal(work.render.state, 'ready'); assert.ok(work.render.graphPosterFileId); assert.notEqual(work.render.posterFileId, work.render.graphPosterFileId);
    const poster = await h.bytes(work.render.posterFileId); const graph = await h.bytes(work.render.graphPosterFileId); fs.writeFileSync(path.join(evidence, 'saved-workshop.png'), poster); fs.writeFileSync(path.join(evidence, 'saved-graph.png'), graph);
    assert.equal((await sharp(poster).metadata()).format, 'png'); assert.equal((await sharp(graph).metadata()).format, 'png');
    const bundle = await JSZip.loadAsync(await h.bytes(work.render.presentationFileId)); assert.ok((await bundle.file('runtime/loader.js').async('string')).includes('isolated-static-build'), 'classroom uses the same configured static runtime as browser');
    for (const options of [{ format: 'png', selection: 'work', background: 'white', width: 1000 }, { format: 'png', selection: 'graph', background: 'white', width: 1000 }, { format: 'ggb', selection: 'graph', background: 'transparent', width: 1600 }, { format: 'bundle', background: 'transparent', width: 1600 }]) {
      const exported = await h.send('post', `${works}/${work.id}/exports`, { version: 1, ...options }); assert.equal(exported.status, 201, JSON.stringify(exported.body)); const bytes = await h.bytes(exported.body.file.id); if (options.format === 'ggb') assert.deepEqual(bytes, Buffer.from(data.graph.base64, 'base64'));
      fs.writeFileSync(path.join(evidence, `export-${options.selection ?? 'work'}.${options.format === 'bundle' ? 'zip' : options.format}`), bytes);
    }
    const transparency = await h.send('post', `${works}/${work.id}/exports`, { version: 1, format: 'png', selection: 'graph', background: 'transparent', width: 1000 }); assert.equal(transparency.status, 422); assert.equal(transparency.body.reason, 'opaque-three-dimensional-background');
    const badRef = structuredClone(data); badRef.steps[0].visibleObjects.push('missing'); assert.equal((await h.send('post', works, { ...input, source: badRef })).status, 422);
    const plane = structuredClone(data); plane.view = plane.steps[0].view = 'plane'; const changed = await h.send('put', `${works}/${work.id}`, { title: input.title, source: plane, baseVersion: 1 }); assert.equal(changed.status, 200, JSON.stringify(changed.body));
    const vector = await h.send('post', `${works}/${work.id}/exports`, { version: 2, format: 'svg', selection: 'graph', background: 'transparent', width: 1000 }); assert.equal(vector.status, 201, JSON.stringify(vector.body)); const svg = await h.bytes(vector.body.file.id); assert.ok(svg.includes(Buffer.from('<path'))); assert.ok(!svg.includes(Buffer.from('<image'))); fs.writeFileSync(path.join(evidence, 'export-plane.svg'), svg);
    await h.restart(); assert.deepEqual((await h.send('get', `${works}/${work.id}/versions/1`)).body.source, data);
    fs.writeFileSync(path.join(evidence, 'http-result.json'), JSON.stringify({ state: 'passed', identity: 'isolated-test-principal', absentConfiguredRuntime: 503, staticRuntimeMarker: 'isolated-static-build', source: data, workId: work.id, graphCount: 1 }, null, 2)); success = true;
  } finally { await h.close(); if (success) fs.rmSync(directory, { recursive: true, force: true }); }
});

test('workshop complete classroom ZIP: offline file URL, split and 3D, parameters, steps, playback and reset', { timeout: 60000 }, async () => {
  const { chromium } = await import('playwright'); const { pathToFileURL } = await import('node:url');
  const { renderWorkshop } = await import('../src/modules/math/workshop-render.js'); const { workshopPresentation } = await import('../src/modules/math/workshop-presentation.js');
  const data = JSON.parse(fs.readFileSync(new URL('./fixtures/math-workshop/combined-source.json', import.meta.url)));
  data.steps.push({ ...structuredClone(data.steps[0]), id: 'second', title: '观察立方体', description: '三维观察', values: { h: 3 }, view: 'space' });
  data.animation = { parameter: 'h', seconds: 8, mode: 'loop' };
  const output = await renderWorkshop(data); const bytes = await workshopPresentation(data, { title: '平方函数与立方体', formulaAssets: output.formulaAssets }); const zip = await JSZip.loadAsync(bytes);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-workshop-graph-offline-')); let browser; let success = false;
  try {
    for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir) { const file = path.join(directory, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, await entry.async('nodebuffer')); }
    browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const context = await browser.newContext({ offline: true, viewport: { width: 1400, height: 1000 }, serviceWorkers: 'block' }); const page = await context.newPage(); const requests = [], errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('request', req => { if (/^https?:/.test(req.url())) requests.push(req.url()); });
    await page.goto(pathToFileURL(path.join(directory, 'index.html')).href); await page.waitForFunction(() => document.querySelector('.status')?.textContent === '', null, { timeout: 30000 });
    const slider = page.getByRole('slider', { name: 'h' }); assert.equal(await slider.inputValue(), '2'); assert.equal(await page.locator('.formula-row').count(), 1);
    await slider.fill('3'); await slider.dispatchEvent('input'); assert.equal(await page.locator('.parameter output').textContent(), '3');
    await page.evaluate(() => {
      window.workshopOriginalAnimationFrame = window.requestAnimationFrame;
      window.workshopPlaybackSamples = [];
      window.requestAnimationFrame = callback => window.workshopOriginalAnimationFrame(timestamp => {
        callback(timestamp - 1000);
        window.workshopPlaybackSamples.push(Number(document.querySelector('.parameter output').textContent));
      });
    });
    await page.getByRole('button', { name: '播放', exact: true }).click(); await page.waitForTimeout(100); await page.getByRole('button', { name: '暂停', exact: true }).click();
    const playbackBounds = await slider.evaluate(input => ({ min: Number(input.min), max: Number(input.max), samples: window.workshopPlaybackSamples }));
    assert.ok(playbackBounds.samples.length > 0); assert.ok(playbackBounds.samples.includes(playbackBounds.min), JSON.stringify(playbackBounds));
    assert.ok(playbackBounds.samples.every(value => Number.isFinite(value) && value >= playbackBounds.min && value <= playbackBounds.max), JSON.stringify(playbackBounds));
    await page.evaluate(() => { window.requestAnimationFrame = window.workshopOriginalAnimationFrame; });
    await page.getByRole('button', { name: '播放', exact: true }).click(); await page.waitForTimeout(400); await page.getByRole('button', { name: '暂停', exact: true }).click(); assert.notEqual(await slider.inputValue(), '3');
    await page.getByRole('button', { name: '重置', exact: true }).click(); await page.waitForFunction(() => document.querySelector('input[type=range]')?.value === '2');
    await page.getByRole('combobox', { name: '教学步骤' }).selectOption('second'); await page.waitForFunction(() => document.querySelector('.step-description')?.textContent === '三维观察'); assert.equal(await slider.inputValue(), '3');
    await page.getByRole('combobox', { name: '教学步骤' }).selectOption('step1'); await page.waitForFunction(() => document.querySelector('input[type=range]')?.value === '2');
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    const evidence = path.resolve('test-results/math-unified/outputs/graphs'); fs.mkdirSync(evidence, { recursive: true }); fs.writeFileSync(path.join(evidence, 'classroom.zip'), bytes); await page.screenshot({ path: path.join(evidence, 'classroom-offline.png'), fullPage: true }); fs.writeFileSync(path.join(evidence, 'classroom-offline.json'), JSON.stringify({ state: 'passed', transport: 'file://', browser: 'fresh Playwright Chromium', offline: true, requests, errors, parameters: 'passed', playback: 'passed', playbackBounds, earlierFirstFrameMilliseconds: 1000, reset: 'passed', steps: 'split -> space -> split', formulas: 1 }, null, 2)); success = true;
  } finally { await browser?.close(); if (success) fs.rmSync(directory, { recursive: true, force: true }); }
});
