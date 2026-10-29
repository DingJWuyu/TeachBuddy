import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { application, json, download, upload, worksPath, readFixture } from './helpers.js';

const samples = JSON.parse(fs.readFileSync(new URL('../fixtures/contracts/math-samples.json', import.meta.url)));
const sample = id => structuredClone(samples.find(entry => entry.id === id).value);
const svgDoc = bytes => new DOMParser().parseFromString(bytes.toString(), 'image/svg+xml');
const create = (client, input) => json(client, 'POST', worksPath, input, 201);
const exported = (client, work, format, options = {}) => json(client, 'POST', `${worksPath}/${work.id}/exports`, {
  version: work.version, format, background: 'transparent', width: format === 'source' || format === 'html' || format === 'bundle' ? 1600 : 800, ...options,
}, 201);
async function offlineBrowser(t) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  t.after(() => browser.close());
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.setOffline(true);
  const remote = [];
  await context.route(/^https?:/, route => { remote.push(route.request().url()); return route.abort(); });
  return { context, remote };
}

test('C4 旧公式与空间源保持可编辑，真实 SVG/PNG 保留数学结构', { timeout: 180000 }, async t => {
  const world = await application(t);
  const { client } = world;
  for (const kind of ['formula', 'plane', 'space']) {
    const input = sample(`create-${kind}`);
    const work = await create(client, input);
    assert.equal(work.render.state, 'ready');
    const poster = await sharp(await download(client, work.render.posterFileId)).metadata();
    assert.equal(poster.format, 'png');
    const source = await exported(client, work, 'source');
    assert.deepEqual(JSON.parse((await download(client, source.file.id)).toString()), input.source, '源码下载应保留全部可编辑源');
    const vector = await exported(client, work, 'svg');
    const bytes = await download(client, vector.file.id);
    const svg = svgDoc(bytes);
    assert.equal(svg.documentElement.localName, 'svg');
    if (kind === 'formula') {
      assert.ok(svg.getElementsByTagName('path').length > 0, '公式须具有实际矢量字形');
      assert.match(bytes.toString(), /判别式/, '公式说明须随输出保留');
    } else if (kind === 'space') {
      assert.match(bytes.toString(), /stroke-dasharray/, '正方体遮挡棱必须保留虚线');
      assert.match(bytes.toString(), /A1|C1/, '空间顶点标注应保留');
    } else {
      const circles = [...svg.getElementsByTagName('circle')];
      assert.equal(circles.length, 3, '抛物线须有顶点和两个零点');
      const points = circles.map(node => [Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))]);
      const [left, vertex, right] = points.sort((a, b) => a[0] - b[0]);
      const unit = (right[0] - left[0]) / 4;
      assert.ok(Math.abs(left[1] - right[1]) < 0.01, '两个零点应位于同一横轴');
      assert.ok(Math.abs(vertex[0] - (left[0] + right[0]) / 2) < 0.01, '顶点 x=1 应位于 -1 和 3 的中点');
      assert.ok(Math.abs(vertex[1] - left[1] - 4 * unit) < 0.01, '顶点 y=-4 的纵向距离须保持数学等比例');
      const group = [...svg.getElementsByTagName('g')].find(node => node.getAttribute('data-object') === 'f');
      const curve = [...group.getElementsByTagName('path')].flatMap(node => [...node.getAttribute('d').matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)]);
      assert.ok(curve.length > 20, '函数须产生实际曲线采样点');
      for (const point of curve) {
        const x = 1 + (Number(point[1]) - vertex[0]) / unit;
        const y = -4 - (Number(point[2]) - vertex[1]) / unit;
        assert.ok(Math.abs(y - (x * x - 2 * x - 3)) < 0.001, '实际 SVG 曲线应满足 y=x²-2x-3');
      }
    }
  }
  world.complete();
});

test('C4 旧动态作品下载后停服务禁网冷开，参数、步骤与重置仍影响实际图形', { timeout: 180000 }, async t => {
  const world = await application(t);
  const work = await create(world.client, sample('create-dynamic'));
  const artifact = await exported(world.client, work, 'html');
  assert.equal(artifact.offline, 'self-contained');
  const filename = path.join(world.directory, 'dynamic.html');
  fs.writeFileSync(filename, await download(world.client, artifact.file.id));
  await world.close();
  const { context, remote } = await offlineBrowser(t);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(pathToFileURL(filename).href);
  const scene = page.frameLocator('iframe');
  const a = scene.getByRole('spinbutton', { name: 'a 数值' });
  assert.equal(await a.inputValue(), '1');
  const before = await scene.locator('[data-object="scaled"] path').getAttribute('d');
  const initialX = Number(await scene.locator('[data-object="vertex"] circle').getAttribute('cx'));
  const unit = initialX - 400;
  await a.fill('-2');
  await scene.getByRole('spinbutton', { name: 'h 数值' }).fill('0');
  await scene.getByRole('spinbutton', { name: 'k 数值' }).fill('1');
  assert.notEqual(await scene.locator('[data-object="scaled"] path').getAttribute('d'), before, '参数改变应改变曲线路径');
  const vertex = scene.locator('[data-object="vertex"] circle');
  assert.equal(Number(await vertex.getAttribute('cx')), 400);
  assert.ok(Math.abs(Number(await vertex.getAttribute('cy')) - (360 - unit)) < 0.001, '当前顶点应位于 (0,1)');
  await scene.getByRole('button', { name: '重置', exact: true }).click();
  assert.equal(await a.inputValue(), '1');
  assert.equal(await scene.getByRole('spinbutton', { name: 'h 数值' }).inputValue(), '1');
  await scene.getByRole('button', { name: '母函数', exact: true }).click();
  assert.equal(await scene.locator('[data-object="scaled"] path').count(), 0, '教学步骤应切换实际可见对象');
  assert.equal(await scene.locator('[data-object="mother"]').count(), 1);
  assert.deepEqual(remote, [], '离线动态成果不应请求远端资源');
  await context.close();
  world.complete();
});

test('C4 统一作品课堂包禁网 file 冷开，完整构造与参数步骤可用', { timeout: 180000 }, async t => {
  const world = await application(t);
  const source = JSON.parse(fs.readFileSync(new URL('../fixtures/math-workshop/saved-plane-view-source.json', import.meta.url)));
  const work = await create(world.client, { title: '统一课堂作品', source, originalFileId: null });
  assert.equal(work.render.state, 'ready');
  const construction = await exported(world.client, work, 'ggb', { selection: 'graph', width: 1600 });
  assert.deepEqual(await download(world.client, construction.file.id), Buffer.from(source.graph.base64, 'base64'), '构造文件下载须保留保存版本的完整原字节');
  const artifact = await exported(world.client, work, 'bundle', { selection: 'work' });
  assert.equal(artifact.offline, 'self-contained');
  assert.equal(artifact.file.id, work.render.presentationFileId, '课堂下载须复用 revision 的固定成果，不能重新解释源');
  const zip = await JSZip.loadAsync(await download(world.client, artifact.file.id));
  assert.deepEqual(JSON.parse(await zip.file('workshop.json').async('string')), source, '课堂包应包含同一已保存完整制作源');
  const directory = path.join(world.directory, 'classroom');
  for (const entry of Object.values(zip.files).filter(entry => !entry.dir)) {
    const destination = path.resolve(directory, entry.name);
    assert.ok(destination.startsWith(directory + path.sep), '课堂包不能包含逃逸路径');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, await entry.async('nodebuffer'));
  }
  await world.close();
  const { context, remote } = await offlineBrowser(t);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(pathToFileURL(path.join(directory, 'index.html')).href);
  const slider = page.getByRole('slider', { name: 'a', exact: true });
  await slider.waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(() => document.querySelector('.status')?.textContent === '');
  assert.equal(await slider.inputValue(), '1');
  assert.equal(await page.evaluate(() => window.ggbApplet.getValue('f(2)')), 4, '初态实际函数须满足 f(2)=4');
  const savedViewport = async () => {
    const view = await page.evaluate(() => JSON.parse(window.ggbApplet.getViewProperties(1)));
    const spanX = view.width * view.invXscale, spanY = view.height * view.invYscale;
    assert.ok(Math.abs(view.xMin + spanX / 2) < 1e-6, '保存视区中心 x=0 应保持');
    assert.ok(Math.abs(view.yMin + spanY / 2 - .14) < 1e-6, '保存视区中心 y=0.14 应保持');
    assert.ok(Math.abs(view.invXscale / view.invYscale - 1) < 1e-6, '数学单位须保持等比例');
    // Fixed GGB has 416x439 px at scale 50: contain its 8.32x8.78 world rectangle.
    assert.ok(spanX >= 8.32 - 1e-6 && spanY >= 8.78 - 1e-6);
    assert.ok(Math.abs(Math.min(spanX / 8.32, spanY / 8.78) - 1) < 1e-6, '视区须按已保存范围适配，不能换回默认缩放');
  };
  await savedViewport();
  assert.equal(await page.locator('.formula-row').count(), source.formulas.length, '公式和构造应同存于课堂作品');
  assert.ok(await page.locator('.formula-row svg').count() >= 1, '公式须具有真实矢量字形');
  assert.match(await page.locator('.formula-row').textContent(), /参数 a=1 的初态公式/);
  const maximum = Number(await slider.getAttribute('max'));
  await slider.focus();
  await slider.press('End');
  assert.equal(Number(await page.locator('.parameter output').textContent()), maximum, '键盘调整须写入真实数学参数');
  assert.equal(await page.evaluate(() => window.ggbApplet.getValue('f(2)')), 4 * maximum, '滑杆必须改变真实函数对象，不能只改变控件输出');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[aria-label="a"]')?.value === '1' && !document.querySelector('.controls')?.inert);
  await page.getByRole('combobox', { name: '教学步骤' }).selectOption(source.steps[1].id);
  await page.waitForFunction(() => document.querySelector('input[aria-label="a"]')?.value === '3' && !document.querySelector('.controls')?.inert);
  assert.equal(await page.locator('.step-description').textContent(), source.steps[1].description);
  assert.equal(await page.evaluate(() => window.ggbApplet.getValue('f(2)')), 12, '教学步骤须应用到真实构造');
  await page.setViewportSize({ width: 960, height: 720 });
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.controls')?.inert);
  await savedViewport();
  assert.deepEqual(remote, [], '完整统一作品应携带本地引擎');
  await context.close();
  world.complete();
});

test('C4 外部 HTML 原件与修改源分离，运行副本无法读取父身份或写业务', { timeout: 180000 }, async t => {
  const world = await application(t);
  const original = readFixture('math/mx-model-revised.html');
  const file = await upload(world.client, '外部数学.html', original);
  const work = await create(world.client, { title: '外部数学', source: { schemaVersion: 1, kind: 'html', fileId: file.id }, originalFileId: file.id });
  const malicious = Buffer.from(`<script>window.probe={};for(const k of ['cookie','parent','storage']){try{window.probe[k]=k==='cookie'?parent.document.cookie:k==='parent'?parent.document.body.textContent:parent.localStorage.getItem('credential')}catch{window.probe[k]='blocked'}}fetch('/api/modules/math/v1/works',{method:'POST',body:'stolen'}).catch(()=>{});</script><h1>恶意读取检查</h1>`);
  const revised = await upload(world.client, '修改源.html', malicious);
  const saved = await json(world.client, 'PUT', `${worksPath}/${work.id}`, { baseVersion: work.version, title: work.title, source: { ...work.source, fileId: revised.id } });
  assert.equal(saved.originalFileId, file.id);
  assert.deepEqual(await download(world.client, file.id), original, '编辑不得覆盖外部原件');
  const source = await exported(world.client, saved, 'source');
  assert.deepEqual(await download(world.client, source.file.id), malicious);
  const artifact = await exported(world.client, saved, 'html');
  assert.equal(artifact.offline, 'unverified');
  const wrapper = await download(world.client, artifact.file.id);
  assert.ok(!wrapper.includes(Buffer.from(world.origin)), '运行副本不能混入制作服务地址');
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block' });
  const attempts = [];
  await context.route('**/*', route => {
    if (route.request().url() === 'https://isolation.test/') return route.fulfill({ contentType: 'text/html', body: '<h1>父层私密身份</h1>' });
    attempts.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  await page.goto('https://isolation.test/');
  await page.evaluate(() => { localStorage.setItem('credential', 'private-account'); document.cookie = 'session=secret'; });
  await page.evaluate(html => { const frame = document.createElement('iframe'); frame.srcdoc = html; document.body.append(frame); }, wrapper.toString());
  const isolated = page.frameLocator('iframe').frameLocator('iframe');
  await isolated.getByRole('heading', { name: '恶意读取检查' }).waitFor({ timeout: 15000 });
  assert.deepEqual(await isolated.locator('body').evaluate(() => window.probe), { cookie: 'blocked', parent: 'blocked', storage: 'blocked' });
  assert.deepEqual(attempts, [], 'CSP 应拒绝运行副本的业务网络请求');
  await context.close();
  world.complete();
});

test('C4 数学表达式无定义时保留原源，修正后生成新成果且历史仍可取回', { timeout: 180000 }, async t => {
  const world = await application(t);
  const input = sample('create-plane');
  input.source.scene.elements[0].expression = '1/(x-x)';
  const invalid = await create(world.client, input);
  assert.equal(invalid.render.state, 'invalid');
  assert.equal(invalid.render.posterFileId, null);
  const read = await json(world.client, 'GET', `${worksPath}/${invalid.id}`);
  assert.deepEqual(read.source, input.source, '未定义的数学表达式也须保留教师源');
  const rejected = await world.client.request('POST', `${worksPath}/${invalid.id}/exports`, {
    headers: { 'Idempotency-Key': randomUUID() },
    body: { version: invalid.version, format: 'svg', background: 'transparent', width: 800 },
  });
  assert.equal(rejected.status, 422, '无定义作品不能伪造为成功矢量图');
  const repairedSource = sample('create-plane').source;
  const repaired = await json(world.client, 'PUT', `${worksPath}/${invalid.id}`, { baseVersion: invalid.version, title: invalid.title, source: repairedSource });
  assert.equal(repaired.render.state, 'ready');
  const old = await exported(world.client, invalid, 'source');
  assert.deepEqual(JSON.parse((await download(world.client, old.file.id)).toString()), input.source, '修正不能改写旧 revision');
  world.complete();
});


test('C4 纯公式统一作品可保存编辑源并导出真实透明公式', { timeout: 180000 }, async t => {
  const world = await application(t);
  const original = sample('create-formula').source;
  const formula = Object.fromEntries(['latex', 'caption', 'includeCaption', 'color', 'fontSize'].map(field => [field, original[field]]));
  const source = {
    schemaVersion: 1, kind: 'workshop', formulas: [{ id: 'quadratic', ...formula }],
    graph: null, view: 'plane', steps: [], initialStepId: null, animation: null, traceObjects: [],
  };
  const work = await create(world.client, { title: '纯公式制作', source, originalFileId: null });
  assert.equal(work.render.state, 'ready');
  assert.equal(work.render.graphPosterFileId, null, '纯公式不能产生虚构数学画布');
  const savedSource = await exported(world.client, work, 'source', { selection: 'work' });
  assert.deepEqual(JSON.parse((await download(world.client, savedSource.file.id)).toString()), source);
  const artifact = await exported(world.client, work, 'png', { selection: 'formula', formulaId: 'quadratic' });
  const bytes = await download(world.client, artifact.file.id);
  const metadata = await sharp(bytes).metadata();
  const stats = await sharp(bytes).stats();
  assert.equal(metadata.hasAlpha, true);
  assert.ok(stats.channels[3].min === 0 && stats.channels[3].max === 255, '公式须包含透明留白与真实字形');
  const classroom = await exported(world.client, work, 'bundle', { selection: 'work' });
  assert.equal(classroom.file.id, work.render.presentationFileId);
  const zip = await JSZip.loadAsync(await download(world.client, classroom.file.id));
  const filename = path.join(world.directory, 'formula-classroom.html');
  fs.writeFileSync(filename, await zip.file('index.html').async('nodebuffer'));
  await world.close();
  const { context, remote } = await offlineBrowser(t);
  const page = await context.newPage();
  await page.goto(pathToFileURL(filename).href);
  await page.locator('.formula-row svg path').first().waitFor();
  assert.match(await page.locator('.formula-row').textContent(), /判别式/, '课堂公式须保留原说明与实际矢量字形');
  assert.equal(await page.locator('.graph').count(), 0, '纯公式课堂无需图形引擎');
  assert.deepEqual(remote, [], '纯公式课堂也不能依赖 CDN 或制作服务');
  await context.close();
  world.complete();
});


test('C-R4 三维统一作品输出与禁网课堂包都保留真实正方体和完整构造', { timeout: 180000 }, async t => {
  const world = await application(t);
  const source = JSON.parse(fs.readFileSync(new URL('../fixtures/math-workshop/combined-source.json', import.meta.url)));
  source.view = 'space';
  source.steps[0].view = 'space';
  const work = await create(world.client, { title: '棱长二的正方体', source, originalFileId: null });
  assert.equal(work.render.state, 'ready');
  const picture = await exported(world.client, work, 'png', { selection: 'graph', background: 'white' });
  const pixels = await sharp(await download(world.client, picture.file.id)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = 0; i < pixels.data.length; i += pixels.info.channels)
    if (pixels.data[i] < 200 || pixels.data[i + 1] < 200 || pixels.data[i + 2] < 200) ink++;
  assert.ok(ink > 1000, '三维图像应实际绘出空间构造');
  const artifact = await exported(world.client, work, 'bundle', { selection: 'work' });
  const zip = await JSZip.loadAsync(await download(world.client, artifact.file.id));
  assert.deepEqual(JSON.parse(await zip.file('workshop.json').async('string')), source);
  const directory = path.join(world.directory, 'space-classroom');
  for (const entry of Object.values(zip.files).filter(entry => !entry.dir)) {
    const destination = path.resolve(directory, entry.name);
    assert.ok(destination.startsWith(directory + path.sep));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, await entry.async('nodebuffer'));
  }
  await world.close();
  const { context, remote } = await offlineBrowser(t);
  const page = await context.newPage();
  await page.goto(pathToFileURL(path.join(directory, 'index.html')).href);
  await page.waitForFunction(() => window.ggbApplet && document.querySelector('.status')?.textContent === '', null, { timeout: 45000 });
  const actual = await page.evaluate(() => ({
    type: window.ggbApplet.getObjectType('solid'), volume: window.ggbApplet.getValue('solid'),
    x: window.ggbApplet.getXcoord('G'), y: window.ggbApplet.getYcoord('G'), z: window.ggbApplet.getZcoord('G'),
    f: window.ggbApplet.getValue('f(2)'),
  }));
  assert.equal(actual.type, 'cube', '本地三维引擎应建立真实正方体');
  assert.equal(actual.volume, 8, '棱长二的正方体体积须为八');
  assert.deepEqual([actual.x, actual.y, actual.z], [2, 2, 2], '空间顶点必须保留三维坐标');
  assert.equal(actual.f, 8, '同一保存构造中的二维函数与参数也须保留');
  assert.deepEqual(remote, [], '三维课堂包须自带本地引擎');
  await context.close();
  world.complete();
});
