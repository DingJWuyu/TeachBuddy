import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import request from 'supertest';
import sharp from 'sharp';
import JSZip from 'jszip';
import { createApp } from '../src/app.js';

const source = JSON.parse(fs.readFileSync(new URL('./fixtures/math-workshop/saved-plane-view-source.json', import.meta.url)));
const evidence = path.resolve('test-results/math-unified/outputs/repair');
fs.mkdirSync(evidence, { recursive: true });

async function axisPosition(bytes) {
  const { data, info } = await sharp(bytes).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const columns = new Array(info.width).fill(0), rows = new Array(info.height).fill(0);
  for (let y = 8; y < info.height - 8; y++) for (let x = 8; x < info.width - 8; x++) {
    const offset = (y * info.width + x) * info.channels;
    const [r, g, b] = data.subarray(offset, offset + 3);
    if (r < 210 && g < 210 && b < 210 && Math.max(r, g, b) - Math.min(r, g, b) < 8) { columns[x]++; rows[y]++; }
  }
  return { width: info.width, height: info.height, x: columns.indexOf(Math.max(...columns)), y: rows.indexOf(Math.max(...rows)) };
}

test('workshop saved viewport: real HTTP PNG/SVG, whole poster and editable DOCX retain the saved opening view', { timeout: 120000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-workshop-view-'));
  const runtime = createApp({ env: { nodeEnv: 'test', sqlitePath: path.join(directory, 'workspace.sqlite'), workbench: { mode: 'test-principal', testPrincipals: ['view-a'], trustedOrigins: ['http://localhost'], webDist: path.resolve(process.env.MATH_WORKSHOP_VIEW_WEB_DIST ?? 'apps/web/public'), logDir: path.join(directory, 'logs') } } });
  await runtime.workbench.initialize(); let success = false;
  try {
    const send = (method, url, body) => {
      const req = request(runtime.app)[method](url).set('Cookie', runtime.workbench.identity.testPrincipalCookie('view-a').header.split(';')[0]).set('Origin', 'http://localhost').set('X-TeachBuddy-Request', '1').set('Idempotency-Key', randomUUID());
      return body === undefined ? req : req.send(body);
    };
    const bytesFor = async id => { const stream = await runtime.workbench.files.open({ accountKey: 'view-a' }, id); const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); };
    const response = await send('post', '/api/modules/math/v1/works', { title: '保存视区回归', source, originalFileId: null });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const bytes = await bytesFor(response.body.render.graphPosterFileId); fs.writeFileSync(path.join(evidence, 'graph-http.png'), bytes);
    const origin = await axisPosition(bytes); const checks = { savedGraph: origin };
    assert.ok(origin.x / origin.width > 0.4 && origin.x / origin.width < 0.6, `saved origin must stay centered: ${JSON.stringify(origin)}`);
    assert.ok(origin.y / origin.height > 0.4 && origin.y / origin.height < 0.6, `saved vertical range must stay centered: ${JSON.stringify(origin)}`);
    const poster = await bytesFor(response.body.render.posterFileId); fs.writeFileSync(path.join(evidence, 'whole-http.png'), poster); const wholeOrigin = await axisPosition(poster); checks.wholePoster = wholeOrigin; assert.ok(Math.abs(wholeOrigin.x / wholeOrigin.width - 0.5) < 0.02);
    for (const width of [400, 1600]) for (const format of ['png', 'svg']) {
      const exported = await send('post', `/api/modules/math/v1/works/${response.body.id}/exports`, { version: 1, selection: 'graph', format, width, background: 'white' });
      assert.equal(exported.status, 201, JSON.stringify(exported.body)); const image = await bytesFor(exported.body.file.id); fs.writeFileSync(path.join(evidence, `graph-${width}.${format}`), image);
      if (format === 'svg') { assert.ok(image.includes(Buffer.from('<path'))); assert.ok(!image.includes(Buffer.from('<image'))); }
      const exportedOrigin = await axisPosition(image); checks[`${format}${width}`] = exportedOrigin;
      assert.ok(Math.abs(exportedOrigin.x / exportedOrigin.width - origin.x / origin.width) < 0.015, JSON.stringify(exportedOrigin));
      assert.ok(Math.abs(exportedOrigin.y / exportedOrigin.height - origin.y / origin.height) < 0.02, JSON.stringify(exportedOrigin));
    }
    const materialId = randomUUID(); const lesson = await send('post', '/api/modules/lessons/v3', { title: '视区讲义', intro: { version: 1, blocks: [] }, sections: [], materials: [{ id: materialId, kind: 'math', workId: response.body.id, workVersion: 1, note: '' }] });
    assert.equal(lesson.status, 201, JSON.stringify(lesson.body)); const accepted = await send('post', `/api/modules/lessons/v3/${lesson.body.id}/exports`, { baseVersion: 1, kind: 'handout', format: 'docx', includeAnswers: false, includeTeacherNotes: false, sectionIds: [], materialReferenceIds: [materialId], answerSpaceLines: 4 });
    assert.equal(accepted.status, 202, JSON.stringify(accepted.body)); let job;
    for (let attempt = 0; attempt < 300; attempt++) { job = (await send('get', `/api/workbench/jobs/${accepted.body.jobId}`)).body; if (!['queued', 'running'].includes(job.state)) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.equal(job.state, 'succeeded', JSON.stringify(job)); const docx = await bytesFor(job.outputFileIds[0]); fs.writeFileSync(path.join(evidence, 'handout.docx'), docx); const document = await JSZip.loadAsync(docx);
    const xml = await document.file('word/document.xml').async('string'); assert.equal((xml.match(/<m:oMath>/g) ?? []).length, 1);
    const images = Object.keys(document.files).filter(name => /^word\/media\/[^/]+$/.test(name)); assert.equal(images.length, 1);
    const documentGraph = await document.file(images[0]).async('nodebuffer'); assert.deepEqual(documentGraph, bytes); fs.writeFileSync(path.join(evidence, 'graph-docx.png'), documentGraph);
    checks.docx = { editableFormulas: 1, images: 1, fixedGraphIdentical: true }; fs.writeFileSync(path.join(evidence, 'graph-http-origin.json'), JSON.stringify(checks, null, 2));
    assert.deepEqual(response.body.source, source); fs.writeFileSync(path.join(evidence, 'classroom.zip'), await bytesFor(response.body.render.presentationFileId)); success = true;
  } finally { await runtime.dataStore.close(); if (success) fs.rmSync(directory, { recursive: true, force: true }); }
});

test('workshop saved viewport: actual offline classroom contains the opening range and preserves live panning on resize', { timeout: 60000 }, async () => {
  const { chromium } = await import('playwright');
  const { workshopFormulaAssets } = await import('../src/modules/math/workshop-render.js');
  const { workshopPresentation } = await import('../src/modules/math/workshop-presentation.js');
  const runtimeDirectory = path.resolve(process.env.MATH_WORKSHOP_VIEW_WEB_DIST ?? 'apps/web/public', 'vendor/math/geogebra');
  const bytes = await workshopPresentation(source, { title: '保存视区课堂', formulaAssets: await workshopFormulaAssets(source), runtimeDirectory });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-workshop-view-classroom-')); let browser; let success = false;
  try {
    const zip = await JSZip.loadAsync(bytes);
    for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir) { const filename = path.join(directory, name); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, await entry.async('nodebuffer')); }
    browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ offline: true, serviceWorkers: 'block', viewport: { width: 1400, height: 1000 } });
    await context.addInitScript(() => {
      let Applet;
      Object.defineProperty(window, 'GGBApplet', { configurable: true, get: () => Applet, set: Original => {
        Applet = class extends Original { constructor(parameters) { super({ ...parameters, appletOnLoad: api => { window.classroomApi = api; parameters.appletOnLoad(api); } }); } };
      } });
    });
    const page = await context.newPage(); const errors = [], requests = [], views = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('request', req => { if (/^https?:/.test(req.url())) requests.push(req.url()); });
    await page.goto(pathToFileURL(path.join(directory, 'index.html')).href); await page.waitForFunction(() => document.querySelector('.status')?.textContent === '');
    const view = async name => { const properties = await page.evaluate(() => JSON.parse(window.classroomApi.getViewProperties(1))); const result = { name, ...properties, centerX: properties.xMin + properties.width * properties.invXscale / 2, centerY: properties.yMin + properties.height * properties.invYscale / 2 }; views.push(result); return result; };
    const assertSaved = properties => {
      // Native canvas borders can change reported dimensions by two pixels.
      const toleranceX = 2 * properties.invXscale, toleranceY = 2 * properties.invYscale;
      assert.ok(Math.abs(properties.centerX) <= toleranceX, JSON.stringify(properties)); assert.ok(Math.abs(properties.centerY - 0.14) <= toleranceY, JSON.stringify(properties));
      assert.ok(properties.xMin <= -4.16 + toleranceX && properties.xMin + properties.width * properties.invXscale >= 4.16 - toleranceX);
      assert.ok(properties.yMin <= -4.25 + toleranceY && properties.yMin + properties.height * properties.invYscale >= 4.53 - toleranceY);
      assert.ok(Math.abs(properties.invXscale / properties.invYscale - 1) <= 2 / Math.min(properties.width, properties.height));
    };
    assertSaved(await view('initial')); await page.screenshot({ path: path.join(evidence, 'classroom-initial.png'), fullPage: true });
    const initial = views[0]; await page.evaluate(properties => window.classroomApi.setCoordSystem(properties.xMin + 2, properties.xMin + properties.width * properties.invXscale + 2, properties.yMin + 0.5, properties.yMin + properties.height * properties.invYscale + 0.5), initial);
    const panned = await view('panned'); await page.setViewportSize({ width: 900, height: 1200 }); await page.waitForTimeout(250); const resized = await view('resized');
    assert.ok(Math.abs(resized.centerX - panned.centerX) <= 2 * resized.invXscale, JSON.stringify({ panned, resized })); assert.ok(Math.abs(resized.centerY - panned.centerY) <= 2 * resized.invYscale, JSON.stringify({ panned, resized }));
    const slider = page.getByRole('slider', { name: 'a' }); await slider.fill('2'); await slider.dispatchEvent('input');
    const changed = await view('parameter'); assert.equal(changed.xMin, resized.xMin); assert.equal(changed.yMin, resized.yMin);
    await page.getByRole('button', { name: '重置', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.controls').inert && document.querySelector('.parameter input[type=range]')?.value === '1');
    assertSaved(await view('reset'));
    await page.getByRole('combobox', { name: '教学步骤' }).selectOption(source.steps[1].id); await page.waitForFunction(() => !document.querySelector('.controls').inert && document.querySelector('.parameter input[type=range]')?.value === '3'); assertSaved(await view('second-step'));
    await page.setViewportSize({ width: 1400, height: 1000 }); await page.waitForTimeout(250); assertSaved(await view('wider'));
    assert.deepEqual(requests, []); assert.deepEqual(errors, []); await page.screenshot({ path: path.join(evidence, 'classroom-resized.png'), fullPage: true });
    fs.writeFileSync(path.join(evidence, 'classroom.zip'), bytes); fs.writeFileSync(path.join(evidence, 'classroom-views.json'), JSON.stringify({ state: 'passed', transport: 'file://', offline: true, requests, errors, views }, null, 2)); success = true;
  } finally { await browser?.close(); if (success) fs.rmSync(directory, { recursive: true, force: true }); }
});

test('workshop saved viewport: panned construction and missing saved size use finite native views', { timeout: 60000 }, async () => {
  const { renderWorkshopGraph, readSavedWorkshopPlaneViewport } = await import('../src/modules/math/workshop-render.js');
  const runtimeDirectory = path.resolve(process.env.MATH_WORKSHOP_VIEW_WEB_DIST ?? 'apps/web/public', 'vendor/math/geogebra');
  const zip = await JSZip.loadAsync(Buffer.from(source.graph.base64, 'base64')); const original = await zip.file('geogebra.xml').async('string');
  const panned = structuredClone(source); zip.file('geogebra.xml', original.replace('xZero="208"', 'xZero="312"')); panned.graph.base64 = await zip.generateAsync({ type: 'base64' });
  const png = (await renderWorkshopGraph(panned, { width: 1600, background: 'white', runtimeDirectory })).bytes; const origin = await axisPosition(png);
  assert.ok(origin.x / origin.width > 0.63 && origin.x / origin.width < 0.67, JSON.stringify(origin)); fs.writeFileSync(path.join(evidence, 'graph-panned.png'), png);
  const missing = structuredClone(source); zip.file('geogebra.xml', original.replace(/(<euclidianView>[\s\S]*?)<size[^>]*\/>/, '$1')); missing.graph.base64 = await zip.generateAsync({ type: 'base64' });
  assert.equal(await readSavedWorkshopPlaneViewport(missing.graph.base64), null);
  const fallback = (await renderWorkshopGraph(missing, { width: 400, background: 'white', runtimeDirectory })).bytes; assert.equal((await sharp(fallback).metadata()).width, 400);
  fs.writeFileSync(path.join(evidence, 'graph-fallback.png'), fallback); fs.writeFileSync(path.join(evidence, 'fallback.json'), JSON.stringify({ state: 'passed', pannedOrigin: origin, missingSavedSize: 'native opening view retained' }, null, 2));
});

test('workshop saved viewport: split and 3D still render and retain the saved camera in an offline classroom', { timeout: 90000 }, async () => {
  const { chromium } = await import('playwright');
  const { renderWorkshopGraph, workshopFormulaAssets } = await import('../src/modules/math/workshop-render.js');
  const { workshopPresentation } = await import('../src/modules/math/workshop-presentation.js');
  const runtimeDirectory = path.resolve(process.env.MATH_WORKSHOP_VIEW_WEB_DIST ?? 'apps/web/public', 'vendor/math/geogebra');
  const combined = JSON.parse(fs.readFileSync(new URL('./fixtures/math-workshop/combined-source.json', import.meta.url)));
  const original = structuredClone(combined);
  for (const view of ['split', 'space']) {
    const data = structuredClone(combined); data.steps[0].view = view;
    const result = await renderWorkshopGraph(data, { width: 1000, background: 'white', runtimeDirectory });
    assert.equal((await sharp(result.bytes).metadata()).width, 1000); assert.ok(result.objects.some(object => object.name === 'solid'), JSON.stringify(result.objects.map(object => ({ name: object.name, type: object.type }))));
    fs.writeFileSync(path.join(evidence, `${view}.png`), result.bytes);
  }
  assert.deepEqual(combined, original);
  combined.steps.push({ ...structuredClone(combined.steps[0]), id: 'space-step', title: '空间', view: 'space' });
  const bytes = await workshopPresentation(combined, { title: '并排与三维', formulaAssets: await workshopFormulaAssets(combined), runtimeDirectory });
  const zip = await JSZip.loadAsync(bytes); const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'math-workshop-view-space-')); let browser; let success = false;
  try {
    for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir) { const filename = path.join(directory, name); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, await entry.async('nodebuffer')); }
    browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ offline: true, serviceWorkers: 'block', viewport: { width: 1200, height: 1000 } });
    await context.addInitScript(() => { let Applet; Object.defineProperty(window, 'GGBApplet', { get: () => Applet, set: Original => { Applet = class extends Original { constructor(parameters) { super({ ...parameters, appletOnLoad: api => { window.classroomApi = api; parameters.appletOnLoad(api); } }); } }; } }); });
    const page = await context.newPage(); const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('request', req => { if (/^https?:/.test(req.url())) requests.push(req.url()); });
    await page.goto(pathToFileURL(path.join(directory, 'index.html')).href); await page.waitForFunction(() => document.querySelector('.status')?.textContent === '');
    const visibleCanvases = () => page.locator('canvas').evaluateAll(canvases => canvases.filter(canvas => { const box = canvas.getBoundingClientRect(); return box.width > 100 && box.height > 100; }).map(canvas => ({ width: canvas.width, height: canvas.height })));
    const splitCanvases = await visibleCanvases(); assert.equal(splitCanvases.length, 2); await page.screenshot({ path: path.join(evidence, 'classroom-split.png'), fullPage: true });
    const camera = () => page.evaluate(() => { const xml = new DOMParser().parseFromString(window.classroomApi.getXML(), 'application/xml'); return Object.fromEntries(Array.from(xml.querySelector('euclidianView3D coordSystem').attributes).map(attribute => [attribute.name, Number(attribute.value)])); });
    const splitCamera = await camera(); await page.getByRole('combobox', { name: '教学步骤' }).selectOption('space-step'); await page.waitForFunction(() => !document.querySelector('.controls').inert && document.querySelector('.controls select').value === 'space-step');
    assert.equal((await visibleCanvases()).length, 1); assert.deepEqual(await camera(), splitCamera);
    await page.setViewportSize({ width: 900, height: 1200 }); await page.waitForTimeout(250); assert.deepEqual(await camera(), splitCamera);
    await page.getByRole('button', { name: '重置', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.controls').inert); assert.deepEqual(await camera(), splitCamera);
    await page.screenshot({ path: path.join(evidence, 'classroom-space.png'), fullPage: true }); assert.deepEqual(requests, []); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(evidence, 'space-classroom.json'), JSON.stringify({ state: 'passed', splitCanvases, camera: splitCamera, offline: true, requests, errors }, null, 2)); success = true;
  } finally { await browser?.close(); if (success) fs.rmSync(directory, { recursive: true, force: true }); }
});
