import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';
let world;
test.beforeEach(async ({ page }, info) => {
  world = await createIntegration({ webDist: path.resolve(process.env.WORKBENCH_WEB_DIST ?? 'apps/web/dist') });
  await register(page, world, `unified-${info.testId.replace(/[^a-z0-9]/gi, '')}@example.test`);
  const tutorial = page.getByRole('button', { name: '知道了', exact: true }); if (await tutorial.isVisible()) await tutorial.click();
  await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) { fs.writeFileSync(info.outputPath('device-state.json'), JSON.stringify(await page.context().storageState(), null, 2)); fs.writeFileSync(info.outputPath('world.json'), JSON.stringify({ directory: world.directory, origin: world.origin }, null, 2)); }
  if (info.status !== info.expectedStatus) await page.screenshot({ path: info.outputPath('failure.png'), fullPage: true });
  await world?.close(); if (info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
});
test('统一作品：空白退出、公式自动保存、刷新、手动图形与步骤', async ({ page }, info) => {
  await page.screenshot({ path: info.outputPath('home.png') });
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await expect(page.locator('.mw-library-row')).toHaveCount(0);
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
    await page.locator('.math-ai-provider').click();
    const popover = page.locator('.math-ai-setup-popover');
    await expect(popover).toBeVisible();
    await expect(popover.getByRole('button', { name: '检查连接', exact: true })).toBeVisible();
    await expect(page.locator('.mw-save-state')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('empty-install-1440.png') });
    await page.setViewportSize({ width: 1024, height: 768 }); await page.screenshot({ path: info.outputPath('empty-install-1024.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: info.outputPath('empty-install-narrow.png') });
    expect(await page.locator('.math-ai-setup-popover').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.math-ai-setup-popover')).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await page.getByRole('button', { name: '添加公式', exact: true }).first().click();
  await page.locator('math-field').click(); await expect(page.locator('math-field')).toBeFocused(); await page.keyboard.type('x^2+1', { delay: 80 });
  await page.getByRole('button', { name: '加入作品', exact: true }).click();
  await expect(page.locator('.mw-formula-row')).toHaveCount(1);
  await expect(page.locator('.mw-save-state')).toHaveText('已保存', { timeout: 60000 });
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await expect(page.locator('.mw-library-row')).toHaveCount(1);
  await page.reload(); await page.locator('.mw-library-row>button').click();
  await expect(page.locator('.mw-formula-row')).toHaveCount(1);
  await expect(page.locator('.mw-formula-row img')).toBeVisible();
  await page.getByRole('button', { name: '添加图形', exact: true }).click();
  await page.getByLabel('图形表达式', { exact: true }).click(); await page.keyboard.type('f(x)=x^2'); await page.keyboard.press('Enter');
  const { deviceMath } = await import('./math-unified-helpers.mjs');
  await expect.poll(async () => Boolean((await deviceMath(page))?.draft?.source.graph), { timeout: 90000 }).toBe(true);
  await expect(page.getByRole('button', { name: '教学步骤', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '教学步骤', exact: true }).click();
  await expect(page.locator('.mw-step-rail nav button')).toHaveCount(1);
  await page.getByLabel('步骤标题', { exact: true }).click(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('观察抛物线'); await page.keyboard.press('Tab');
  await expect(page.locator('.mw-step-rail')).toContainText('观察抛物线');
  await expect(page.locator('.mw-save-state')).toHaveText('已保存', { timeout: 60000 });
  await page.screenshot({ path: info.outputPath('editor-desktop.png') });
  await page.getByRole('button', { name: '试演', exact: true }).click();
  await expect(page.getByRole('button', { name: '返回编辑', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回编辑', exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 768 }); await page.screenshot({ path: info.outputPath('editor-1024.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await expect(page.getByLabel('图形表达式', { exact: true })).toBeVisible();
  await expect(page.locator('.mw-formula-row img')).toBeVisible(); await page.screenshot({ path: info.outputPath('editor-narrow.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('公式编辑深浅主题与1024和窄屏布局', async ({ page }, info) => {
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('button', { name: '添加公式', exact: true }).first().click();
  await page.locator('math-field').click(); await expect(page.locator('math-field')).toBeFocused(); await page.keyboard.type('x^2+1', { delay: 60 });
  await page.getByRole('button', { name: '加入作品', exact: true }).click();
  await expect(page.locator('.mw-save-state')).toHaveText('已保存');
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await expect(page.locator('.mw-formula-row math-field')).toBeVisible();
  await page.screenshot({ path: info.outputPath('formula-light-1440.png') });
  await page.getByRole('link', { name: '账户：数学教师', exact: true }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
  await expect(page.locator('.mw-formula-row img')).toBeVisible();
  await page.screenshot({ path: info.outputPath('formula-dark-1440.png') });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: '添加公式', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '加入作品', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('formula-dark-1024.png') });
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '添加图形', exact: true }).click();
  await expect(page.getByRole('button', { name: '点', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('formula-dark-narrow-panel.png') });
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await page.screenshot({ path: info.outputPath('formula-dark-narrow.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  const workName = await page.locator('.mw-library-row strong').innerText();
  const search = page.getByRole('textbox', { name: '搜索作品', exact: true });
  await search.fill(workName);
  await expect(page.locator('.mw-library-row')).toHaveCount(1);
  await expect(search).toBeFocused();
  await page.mouse.move(280, 75);
  await page.screenshot({ path: info.outputPath('final-home-search-dark.png') });
});

test('自有图形工具真实点击建点线圆和多边形，参数与三维同作品', async ({ page }, info) => {
  const { installMathProbe, currentApi, savedMath, enterMath } = await import('./math-unified-helpers.mjs');
  // The page already loaded; install the read-only observation hook for the next engine load.
  await page.evaluate(() => { let Constructor; Object.defineProperty(window,'GGBApplet',{configurable:true,get:()=>Constructor,set:Value=>{Constructor=class extends Value{constructor(parameters,...rest){super({...parameters,appletOnLoad:api=>{(window.mathTestApis??={})[parameters.id]=api;window.mathTestApi=api;parameters.appletOnLoad?.(api);}},...rest);}};}}); });
  await page.getByRole('button',{name:'新建作品',exact:true}).click();
  async function choose(name) {
    await page.getByRole('button', { name: '添加图形', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.mw-drawing-hint')).toBeVisible();
    await expect(page.getByRole('complementary', { name: '辅助栏', exact: true })).toBeHidden();
    await expect.poll(() => page.evaluate(expectedMode => {
      const host = document.querySelector('.mw-graph-host');
      const native = host?.firstElementChild;
      const api = window.mathTestApis?.[native?.id];
      return !!api && !host.inert && !native.inert && api.getMode() === expectedMode;
    }, { 点: 1, 线段: 15, 圆: 10, 多边形: 16 }[name]), { timeout: 90000 }).toBe(true);
  }
  await choose('点'); let box=await page.locator('.mw-graph-host').boundingBox(); await page.mouse.click(box.x+box.width/2-120,box.y+box.height/2-80);
  await expect.poll(async()=> (await currentApi(page))?.types.some(([,type])=>type==='point')).toBe(true); await page.getByRole('button',{name:'完成',exact:true}).click();
  await choose('线段'); box=await page.locator('.mw-graph-host').boundingBox(); await page.mouse.click(box.x+box.width/2-80,box.y+box.height/2+40); await page.mouse.click(box.x+box.width/2+50,box.y+box.height/2+40);
  await expect.poll(async()=> (await currentApi(page))?.types.some(([,type])=>type==='segment')).toBe(true); await page.getByRole('button',{name:'完成',exact:true}).click();
  await choose('圆'); box=await page.locator('.mw-graph-host').boundingBox(); await page.mouse.click(box.x+box.width/2+140,box.y+box.height/2-80); await page.mouse.click(box.x+box.width/2+200,box.y+box.height/2-80);
  await expect.poll(async()=> (await currentApi(page))?.types.some(([,type])=>['circle','conic'].includes(type))).toBe(true); await page.getByRole('button',{name:'完成',exact:true}).click();
  await choose('多边形'); box=await page.locator('.mw-graph-host').boundingBox(); const points=[[box.x+box.width/2-180,box.y+box.height/2-40],[box.x+box.width/2-140,box.y+box.height/2-140],[box.x+box.width/2-80,box.y+box.height/2-40]]; for(const [x,y] of [...points,points[0]]) await page.mouse.click(x,y);
  await expect.poll(async()=> (await currentApi(page))?.types.some(([,type])=>['polygon','triangle','quadrilateral'].includes(type))).toBe(true); await page.getByRole('button',{name:'完成',exact:true}).click();
  await savedMath(page); await page.screenshot({path:info.outputPath('native-tools.png')});
  await page.getByRole('button',{name:'添加参数',exact:true}).click(); await page.getByRole('button',{name:'加入作品',exact:true}).click(); await expect(page.getByLabel('参数 a',{exact:true})).toBeVisible();
  await page.getByLabel('参数 a',{exact:true}).focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(async()=> (await currentApi(page,'a'))?.value).toBeGreaterThan(1);
  await page.getByRole('combobox',{name:'数学视图',exact:true}).selectOption('split'); await enterMath(page,'cube=Cube((0,0,0),(2,0,0))','cube'); const saved=await savedMath(page);
  expect(saved.source.view).toBe('split'); await page.screenshot({path:info.outputPath('native-split.png')});
  const resizePuts = [];
  page.on('request', request => { if (request.method() === 'PUT' && request.url().endsWith(`/works/${saved.id}`)) resizePuts.push(request.url()); });
  async function settledSplit() {
    await expect.poll(() => page.evaluate(() => {
      const host = document.querySelector('.mw-graph-host>div'), bounds = host?.getBoundingClientRect();
      const canvases = [...(host?.querySelectorAll('canvas') ?? [])].map(canvas => canvas.getBoundingClientRect()).filter(box => box.width > 1 && box.height > 1);
      return !!host && !host.inert && canvases.length === 2 && canvases.every(box => box.left >= bounds.left - 2 && box.top >= bounds.top - 2 && box.right <= bounds.right + 2 && box.bottom <= bounds.bottom + 2);
    }), { timeout: 15000 }).toBe(true);
    await expect(page.locator('.mw-notice[role=alert]').filter({ hasText: /未完成|失败|错误|超时|重新打开/ })).toHaveCount(0);
    expect((await currentApi(page, 'cube')).exists).toBe(true);
  }
  await settledSplit();
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await settledSplit();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '内容列表', exact: true }).click();
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await settledSplit();
  await page.waitForTimeout(2000); // Observe beyond autosave and manual edit debounce.
  expect(resizePuts).toEqual([]);
  const resized = await savedMath(page);
  expect(resized.source).toEqual(saved.source); expect(resized.version).toBe(saved.version);
  await page.screenshot({ path: info.outputPath('native-split-resized.png') });
});

test('下载入口交付整份PNG、公式SVG、可编辑源与离线课堂包', async ({page},info)=>{
  await page.getByRole('button',{name:'新建作品',exact:true}).click();
  await page.getByRole('button',{name:'添加公式',exact:true}).first().click();await page.locator('math-field').click();await page.keyboard.type('x^2+1',{delay:60});await page.getByRole('button',{name:'加入作品',exact:true}).click();
  await page.getByRole('button',{name:'添加图形',exact:true}).click();await page.getByLabel('图形表达式',{exact:true}).fill('f(x)=x^2');await page.getByLabel('图形表达式',{exact:true}).press('Enter');await expect(page.locator('.mw-graph-host')).toHaveClass(/has-graph/,{timeout:90000});await expect(page.locator('.mw-save-state')).toHaveText('已保存',{timeout:60000});
  await page.getByRole('button',{name:'下载',exact:true}).click();const dialog=page.getByRole('dialog',{name:'下载作品',exact:true});
  async function download(extension){const pending=page.waitForEvent('download',{timeout:90000});await dialog.getByRole('button',{name:'下载文件',exact:true}).click();const artifact=await pending;expect(await artifact.failure()).toBeNull();expect(artifact.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));const file=info.outputPath(`work.${extension}`);await artifact.saveAs(file);return fs.readFileSync(file);}
  const png=await download('png');expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  await dialog.getByRole('combobox',{name:'内容',exact:true}).selectOption('formula');await dialog.getByRole('combobox',{name:'格式',exact:true}).selectOption('svg');expect((await download('svg')).toString()).toContain('<svg');
  await dialog.getByRole('button',{name:'编辑文件',exact:true}).click();const source=JSON.parse((await download('json')).toString());expect(source.source?.kind??source.kind).toBe('workshop');
  await dialog.getByRole('button',{name:'课堂演示',exact:true}).click();const zip=await download('zip');const JSZip=(await import('jszip')).default;const bundle=await JSZip.loadAsync(zip);expect(bundle.file('index.html')).not.toBeNull();await page.screenshot({path:info.outputPath('download-classroom.png')});
});

test('自由点修改和AI续改刷新后坐标可读，关联点保留构造与点样式',async({page},info)=>{
  // Fixed local AI reply only verifies the UI/apply seam; real DeepSeek is verified separately.
  await page.evaluate(()=>{let rounds=0;window.addEventListener('message',event=>{const request=event.data;if(event.source!==window||request?.source!=='teachbuddy-workbench')return;const type={STATUS:'STATUS',CONNECT:'CONNECTED',SEND:'DONE'}[request.type];if(!type)return;window.postMessage({source:'teachbuddy-web-ai',type,connectionState:'ready',requestId:request.requestId,sessionId:request.sessionId,text:JSON.stringify(request.type==='SEND'&&rounds++===0?{message:'移动A',changes:{operations:[{type:'setCoords',name:'A',coords:[5,3]}]}}:{message:'已完成',changes:{}})},location.origin);});});
  await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByRole('button',{name:'添加图形',exact:true}).click();const field=page.getByLabel('图形表达式',{exact:true});await field.fill('A=(1,2)');await field.press('Enter');const tools=page.locator('.mw-tool-host');await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/\(1,\s*2\)/,{timeout:90000});
  await tools.getByRole('textbox',{name:'定义',exact:true}).fill('(4,3)');await tools.getByRole('button',{name:'应用修改',exact:true}).click();await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/\(4,\s*3\)/);
  await page.getByRole('tab',{name:'AI 助理',exact:true}).click();await page.getByLabel('向数学助理提问').fill('把A右移一个单位');await page.getByRole('button',{name:'发送消息',exact:true}).click();await expect(page.locator('.math-ai-message.is-assistant')).toContainText('已完成',{timeout:90000});await expect(page.locator('.mw-save-state')).toHaveText('已保存',{timeout:60000});
  await page.reload();await page.getByRole('button',{name:'内容列表',exact:true}).click().catch(()=>{});await page.getByRole('tab',{name:'编辑',exact:true}).click();await tools.locator('.mw-object-list button').filter({has:page.locator('strong',{hasText:/^A$/})}).click();await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/\(5,\s*3\)/);await expect(tools.locator('.mw-object-list')).toContainText(/\(5,\s*3\)/);
  await tools.getByText('样式',{exact:true}).click();await expect(tools.getByRole('spinbutton',{name:'点大小',exact:true})).toBeVisible();await expect(tools.getByRole('spinbutton',{name:'线宽',exact:true})).toHaveCount(0);
  if(!await field.isVisible())await page.getByRole('button',{name:'输入算式',exact:true}).click();await field.fill('B=(7,5)');await field.press('Enter');await expect(tools.locator('.mw-object-list')).toContainText('B');await field.fill('M=Midpoint(A,B)');await field.press('Enter');await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/Midpoint[\[(]/);await tools.getByRole('textbox',{name:'定义',exact:true}).fill('Midpoint(A,B)');await tools.getByRole('button',{name:'应用修改',exact:true}).click();await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/Midpoint[\[(]/);await page.screenshot({path:info.outputPath('point-coordinate-and-dependent.png')});
});

test('拖点后立即关闭辅助栏仍保存新坐标，纯尺寸变化不保存新版本', async ({ page }, info) => {
  const { installMathProbe, enterMath, currentApi, deviceMath, savedMath } = await import('./math-unified-helpers.mjs');
  let pageContext;
  page.on('request', request => {
    if (request.url().startsWith(`${world.origin}/api/modules/math/`) && request.headers()['x-teachbuddy-page']) pageContext = request.headers()['x-teachbuddy-page'];
  });
  await installMathProbe(page);
  await page.reload();
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('button', { name: '添加图形', exact: true }).click();
  await page.getByRole('button', { name: '点', exact: true }).click();
  await expect(page.getByRole('button', { name: '完成', exact: true })).toBeEnabled({ timeout: 90000 });
  await page.getByRole('button', { name: '取消绘图工具', exact: true }).click();
  await page.getByRole('button', { name: '添加图形', exact: true }).click();
  await page.getByRole('combobox', { name: '数学视图', exact: true }).selectOption('space');
  await expect.poll(async () => (await deviceMath(page))?.draft?.source.view).toBe('space');
  expect((await deviceMath(page)).draft.source.graph).toBeNull();
  expect((await deviceMath(page)).draft.id ?? null).toBeNull();
  await page.getByRole('combobox', { name: '数学视图', exact: true }).selectOption('plane');
  await expect.poll(async () => (await deviceMath(page))?.draft?.source.view).toBe('plane');
  await enterMath(page, 'A=(1,2)', 'A');
  const first = await savedMath(page);
  const canvas = await page.locator('.mw-graph-host canvas').first().boundingBox();
  const close = await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().boundingBox();
  const view = await page.evaluate(() => {
    const host = document.querySelector('.mw-graph-host > div');
    const raw = window.mathTestApis[host.id].getViewProperties(1);
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  });
  const point = (x, y) => ({ x: canvas.x + (x - view.xMin) / view.invXscale, y: canvas.y + view.height - (y - view.yMin) / view.invYscale });
  const from = point(1, 2), to = point(3, 3);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 25 });
  await page.mouse.up();
  // Real mouse events, with no assertion wait before the layout changes.
  await page.mouse.click(close.x + close.width / 2, close.y + close.height / 2);
  const dragged = (await currentApi(page, 'A')).coords;
  expect(dragged[0]).toBeCloseTo(3, 2);
  expect(dragged[1]).toBeCloseTo(3, 2);
  await expect.poll(async () => (await deviceMath(page))?.draft?.version, { timeout: 60000 }).toBeGreaterThan(first.version);
  const saved = await savedMath(page);
  expect(pageContext).toBeTruthy();
  const response = await page.request.get(`${world.origin}/api/modules/math/v1/works/${saved.id}`, { headers: { 'X-TeachBuddy-Page': pageContext } });
  expect(response.status()).toBe(200);
  const persisted = await response.json();
  expect(persisted.source).toEqual(saved.source);
  await page.reload();
  await expect.poll(async () => (await currentApi(page, 'A'))?.coords, { timeout: 90000 }).toEqual(dragged);
  await savedMath(page);

  const puts = [];
  page.on('request', request => { if (request.method() === 'PUT' && request.url().endsWith(`/works/${saved.id}`)) puts.push(request.url()); });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.setViewportSize({ width: 1440, height: 900 });
  // Observe beyond the 1400 ms autosave delay, including manual edit debounce.
  await page.waitForTimeout(2000);
  expect(puts).toEqual([]);
  expect((await deviceMath(page)).draft.source).toEqual(saved.source);
  expect((await (await page.request.get(`${world.origin}/api/modules/math/v1/works/${saved.id}`, { headers: { 'X-TeachBuddy-Page': pageContext } })).json()).version).toBe(saved.version);
  await expect(page.getByText('数学视图未完成布局，请重新打开作品。', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('drag-resize-reopened.png') });
});

test('英文切换覆盖制作工具与删除确认',async({page},info)=>{
  await page.getByRole('button',{name:'简体中文',exact:true}).click();await page.getByRole('menuitemradio',{name:/English/}).click();
  await page.getByRole('button',{name:'New work',exact:true}).click();await expect(page.getByRole('button',{name:'Add formula',exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Add graph',exact:true}).click();await page.getByLabel('Graph expression',{exact:true}).fill('A=(1,2)');await page.getByLabel('Graph expression',{exact:true}).press('Enter');
  const tools=page.locator('.mw-tool-host');await expect(tools.getByRole('textbox',{name:'Definition',exact:true})).toHaveValue(/\(1,\s*2\)/,{timeout:90000});
  await tools.getByRole('button',{name:'Delete object',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Delete A?');await expect(dialog.getByRole('button',{name:'Continue',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await page.screenshot({path:info.outputPath('english-workshop.png')});
});

test('历史海报失败重试、切版查看和恢复生成新版本',async({page},info)=>{
  await page.evaluate(()=>{let Constructor;Object.defineProperty(window,'GGBApplet',{configurable:true,get:()=>Constructor,set:Value=>{Constructor=class extends Value{constructor(parameters,...rest){super({...parameters,appletOnLoad:api=>{(window.mathTestApis??={})[parameters.id]=api;window.mathTestApi=api;parameters.appletOnLoad?.(api);}},...rest);}};}});});
  const {enterMath,savedMath,currentApi,installMathProbe}=await import('./math-unified-helpers.mjs');await installMathProbe(page);await page.getByRole('button',{name:'新建作品',exact:true}).click();await enterMath(page,'A=(1,2)','A');const first=await savedMath(page);await enterMath(page,'A=(5,3)','A');const second=await savedMath(page);expect(second.version).toBe(first.version+1);
  let intercepted=false;await page.route('**/api/workbench/files/*/content',route=>{if(!intercepted){intercepted=true;return route.abort('failed');}return route.continue();});
  await page.getByLabel('更多作品操作',{exact:true}).click();await page.getByRole('menuitem',{name:'历史版本',exact:true}).click();const history=page.getByRole('dialog',{name:'历史版本',exact:true});await expect(history.getByRole('alert')).toContainText('此版本预览暂时无法读取');expect((await currentApi(page,'A')).coords).toEqual([5,3]);await history.getByRole('button',{name:'重试',exact:true}).click();await expect(history.getByRole('img',{name:`版本 ${first.version} 预览`,exact:true})).toBeVisible();
  await history.getByRole('combobox',{name:'保存记录',exact:true}).selectOption(String(second.version));await expect(history.getByRole('img',{name:`版本 ${second.version} 预览`,exact:true})).toBeVisible();await history.getByRole('combobox',{name:'保存记录',exact:true}).selectOption(String(first.version));await expect(history.getByRole('img',{name:`版本 ${first.version} 预览`,exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('history-preview.png')});
  await history.getByRole('button',{name:'恢复版本',exact:true}).click();await expect.poll(async()=>(await currentApi(page,'A'))?.coords,{timeout:90000}).toEqual([1,2]);const restored=await savedMath(page);expect(restored.id).toBe(first.id);expect(restored.version).toBe(second.version+1);await page.reload();await expect.poll(async()=>(await currentApi(page,'A'))?.coords,{timeout:90000}).toEqual([1,2]);
});

test('界面路径：一键编辑、未连接输入保护、菜单键盘与下载确认', async ({ page }, info) => {
  const { savedMath } = await import('./math-unified-helpers.mjs');
  const shot = async name => { await page.mouse.move(280, 75); await page.screenshot({ path: info.outputPath(name) }); };
  await shot('final-home-empty-light.png');
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await expect(page.locator('.math-ai-connection').first()).toHaveClass(/is-missing/);
  await shot('final-empty-light.png');
  const input = page.getByRole('textbox', { name: '向数学助理提问', exact: true });
  await input.fill('画一条抛物线');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(input).toHaveValue('画一条抛物线');
  const popover = page.locator('.math-ai-setup-popover');
  await expect(popover).toBeVisible();
  await expect(popover.getByRole('button', { name: '检查连接', exact: true })).toBeVisible();
  await shot('final-connection-guide-light.png');
  await page.getByRole('button', { name: '添加公式', exact: true }).click();
  const field = page.locator('.mw-new-formula math-field');
  await expect(field).toBeFocused();
  await page.keyboard.type('y=x^2', { delay: 60 });
  await page.keyboard.press('Enter');
  await savedMath(page);
  await page.getByRole('button', { name: '内容列表', exact: true }).click();
  await page.getByRole('button', { name: '编辑公式 1', exact: true }).click();
  await expect(page.locator('.mw-formula-row math-field')).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('y=x^2+1', { delay: 60 });
  await page.keyboard.press('Enter');
  await expect(page.locator('.mw-formula-row math-field')).toHaveCount(0);
  await savedMath(page);
  await page.getByRole('button', { name: '添加图形', exact: true }).click();
  await page.getByLabel('图形表达式', { exact: true }).fill('f(x)=x^2+1');
  await page.getByLabel('图形表达式', { exact: true }).press('Enter');
  await expect(page.getByLabel('图形表达式', { exact: true })).toHaveValue('');
  await savedMath(page);
  await page.getByRole('button', { name: '收起算式', exact: true }).click();
  await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
  await page.getByRole('button', { name: '新对话', exact: true }).click();
  await expect(page.locator('.math-ai-connection').first()).toHaveClass(/is-missing/);
  await shot('final-work-light.png');
  await expect(page.getByRole('button', { name: '试演', exact: true })).toBeEnabled();
  const more = page.getByRole('button', { name: '更多作品操作', exact: true });
  await more.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: '立即保存', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: '课堂展示', exact: true })).toBeFocused();
  await shot('final-work-menu.png');
  await page.keyboard.press('Escape'); await expect(more).toBeFocused();
  await page.getByRole('button', { name: '下载', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '下载作品', exact: true });
  await expect(dialog.getByRole('combobox', { name: '内容', exact: true })).toBeFocused();
  await shot('final-download.png');
  const downloadedFiles = [];
  page.on('download', file => downloadedFiles.push(file));
  for (const name of ['下载文件', '关闭下载']) {
    await dialog.getByRole('button', { name, exact: true }).focus();
    for (const key of ['Shift+Enter', 'Control+Enter', 'Meta+Enter', 'Alt+Enter']) {
      const unintendedDownload = page.waitForEvent('download', { timeout: 600 }).then(() => true, () => false);
      await page.keyboard.press(key);
      expect(await unintendedDownload, `${name}: ${key}`).toBe(false);
      await expect(dialog).toBeVisible();
    }
  }
  expect(downloadedFiles).toHaveLength(0);
  await dialog.getByRole('button', { name: '关闭下载', exact: true }).focus();
  const downloaded = page.waitForEvent('download');
  await page.keyboard.down('Enter');
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/\.png$/);
  expect(await file.failure()).toBeNull();
  await file.saveAs(info.outputPath('keyboard-confirm.png'));
  await dialog.getByRole('button', { name: '关闭下载', exact: true }).focus();
  const repeatedDownload = page.waitForEvent('download', { timeout: 600 }).then(() => true, () => false);
  await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
  expect(await repeatedDownload).toBe(false); await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '下载文件', exact: true }).focus();
  const spaceDownload = page.waitForEvent('download'); await page.keyboard.press('Space');
  expect(await (await spaceDownload).failure()).toBeNull();
  await dialog.getByRole('button', { name: '关闭下载', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(dialog).toHaveCount(0);
  fs.writeFileSync(info.outputPath('dialog-keyboard.json'), JSON.stringify({ modifierDownloads: 0, repeatedDownloads: 0, plainEnter: file.suggestedFilename(), spaceDownloads: 1, closeSpace: true }, null, 2));
  await page.getByRole('button', { name: '下载', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '下载', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 1024, height: 768 }); await shot('final-work-1024.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await shot('final-work-narrow.png');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '输入算式', exact: true }).click();
  await expect(page.getByLabel('图形表达式', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: '收起算式', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await expect(page.locator('.mw-library-thumbnail img')).toBeVisible();
  await shot('final-home-light.png');
  const workName = await page.locator('.mw-library-row strong').innerText();
  const search = page.getByRole('textbox', { name: '搜索作品', exact: true });
  await search.fill('不存在的数学作品');
  await expect(page.getByRole('heading', { name: '没有找到作品', exact: true })).toBeVisible();
  await search.fill(workName);
  await expect(page.locator('.mw-library-row')).toHaveCount(1);
  await expect(search).toBeFocused();
  await shot('final-home-search-light.png');
  await search.clear();
  await page.getByRole('button', { name: '作品操作', exact: true }).click();
  await shot('final-home-menu.png');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.locator('.mw-library-row>button').click();
  await page.getByRole('button', { name: '编辑公式 1', exact: true }).click();
  await expect(page.locator('.mw-formula-row math-field')).toBeFocused();
  expect(await page.locator('math-field').evaluate(el => el.getValue('latex'))).toBe('y=x^2+1');
});

test('首页数学对话：缺连接保留输入，一次开始只执行一轮，离开后迟到回复失效', async ({ page }, info) => {
  const { savedMath, deviceMath } = await import('./math-unified-helpers.mjs');
  await page.getByRole('banner').getByRole('button', { name: 'AI 助理', exact: true }).click();
  await expect(page.locator('.math-web-assistant')).toBeVisible();
  await expect(page.locator('.math-ai-connection').first()).toHaveClass(/is-missing/);
  const input = page.getByRole('textbox', { name: '向数学助理提问', exact: true });
  const request = '写出 y=x^2，并保留这个完整描述';
  await input.fill(request);
  await input.press('Shift+Enter');
  await expect(input).toHaveValue(request + '\n');
  await input.press('Backspace');
  await input.press('Enter');
  await expect(input).toHaveValue(request);
  const homePopover = page.locator('.math-ai-setup-popover');
  await expect(homePopover).toBeVisible();
  await expect(homePopover.getByRole('button', { name: '检查连接', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: '想做什么数学作品？', exact: true }).click();
  await expect(page.locator('.math-ai-setup-popover')).toHaveCount(0);
  await page.locator('.math-ai-provider').click();
  await expect(page.locator('.math-ai-setup-popover')).toBeVisible();
  await page.evaluate(() => {
    window.mathUiRequests = []; window.mathUiEvents = [];
    window.addEventListener('message', event => {
      const request = event.data;
      if (event.source !== window || request?.source !== 'teachbuddy-workbench') return;
      window.mathUiEvents.push(request);
      const type = { STATUS: 'STATUS', CONNECT: 'CONNECTED', SEND: 'DONE' }[request.type];
      if (!type) return;
      if (request.type === 'SEND') {
        window.mathUiRequests.push(request);
        if (window.holdMathReply) { window.pendingMathReply = request; return; }
      }
      const first = request.type === 'SEND' && window.mathUiRequests.length === 1;
      setTimeout(() => window.postMessage({ source: 'teachbuddy-web-ai', type, connectionState: 'ready', requestId: request.requestId, sessionId: request.sessionId,
        text: JSON.stringify(first ? { message: '已加入公式', changes: { formulas: [{ id: 'home-formula', latex: 'y=x^2', caption: '', includeCaption: true, color: '#1e293b', fontSize: 32 }] } } : { message: '公式已加入，可以继续调整。', changes: {} }) }, location.origin), 50);
    });
  });
  await page.getByRole('button', { name: '检查连接', exact: true }).click();
  await expect(page.locator('.math-ai-setup')).toHaveCount(0);
  await page.getByRole('button', { name: '开始制作', exact: true }).click({ clickCount: 2 });
  await expect(page.locator('.mw-formula-row')).toHaveCount(1);
  await expect(page.locator('.math-ai-message.is-assistant')).toContainText('公式已加入');
  await savedMath(page);
  expect(await page.evaluate(() => window.mathUiRequests.length)).toBe(2);
  expect(await page.evaluate(() => JSON.parse(window.mathUiRequests[0].prompt.split('\n\n').at(-1)).request)).toBe(request);
  await expect(page.locator('.math-ai-message.is-user')).toHaveCount(1);
  await page.mouse.move(280, 75); await page.screenshot({ path: info.outputPath('final-connected-simulated.png') });
  await page.evaluate(() => { window.holdMathReply = true; });
  await input.fill('把公式改成 y=x^3');
  await input.press('Control+Enter');
  await input.press('Meta+Enter');
  await input.press('Alt+Enter');
  // This checks the composition guard only; native operating-system IME remains a manual boundary.
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
  expect(await page.evaluate(() => Boolean(window.pendingMathReply))).toBe(false);
  await page.keyboard.down('Enter');
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect.poll(() => page.evaluate(() => Boolean(window.pendingMathReply))).toBe(true);
  expect(await page.evaluate(() => window.mathUiRequests.length)).toBe(3);
  const previousWork = (await deviceMath(page)).draft;
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  await page.getByRole('banner').getByRole('button', { name: 'AI 助理', exact: true }).click();
  await expect(page.locator('.math-ai-message.is-user').last()).toContainText('把公式改成 y=x^3');
  await expect(page.getByRole('button', { name: '停止生成', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.mathUiEvents.some(item => item.type === 'CANCEL'))).toBe(false);
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await expect(page.locator('.math-web-assistant')).toBeVisible();
  await expect(page.getByText('一起准备下一堂课', { exact: true })).toHaveCount(0);
  fs.writeFileSync(info.outputPath('leave-active-state.json'), JSON.stringify(await page.evaluate(() => ({ events: window.mathUiEvents, text: document.querySelector('.math-web-assistant').textContent })), null, 2));
  await expect.poll(() => page.evaluate(() => window.mathUiEvents.some(item => item.type === 'CANCEL' && item.requestId === window.pendingMathReply.requestId))).toBe(true);
  await expect(page.locator('.math-ai-stage')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '新对话', exact: true })).toBeEnabled();
  await page.evaluate(() => { window.holdMathReply = false; });
  await input.fill('开始一个新的数学作品'); await input.press('Enter');
  await expect(page.getByRole('button', { name: '返回工坊', exact: true })).toBeVisible();
  await expect(page.locator('.math-ai-message.is-user').last()).toContainText('开始一个新的数学作品');
  await expect(page.getByRole('button', { name: '新对话', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const request = window.pendingMathReply;
    window.postMessage({ source: 'teachbuddy-web-ai', type: 'DONE', requestId: request.requestId, sessionId: request.sessionId,
      text: JSON.stringify({ message: '迟到回复', changes: { formulas: [{ id: 'late-formula', latex: 'y=x^3', caption: '', includeCaption: true, color: '#1e293b', fontSize: 32 }] } }) }, location.origin);
  });
  await page.waitForTimeout(1000);
  await expect(page.locator('.mw-formula-row')).toHaveCount(0);
  expect((await deviceMath(page)).draft.source.formulas).toEqual([]);
  await expect(page.locator('.math-ai-thread')).not.toContainText('迟到回复');
  await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  await page.locator('.mw-library-row > button').first().click();
  await expect(page.locator('.mw-formula-row')).toHaveCount(1);
  expect((await savedMath(page)).source.formulas).toEqual(previousWork.source.formulas);
  await page.screenshot({ path: info.outputPath('leave-active-recovered.png') });
});

test('参数取值：数值和滑杆同步，算式按需编辑，保存刷新保留', async ({ page }, info) => {
  const { installMathProbe, currentApi, savedMath } = await import('./math-unified-helpers.mjs');
  await installMathProbe(page); await page.reload();
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('button', { name: '添加参数', exact: true }).click();
  await page.getByRole('button', { name: '加入作品', exact: true }).click();
  const tools = page.locator('.mw-tool-host');
  const value = tools.getByRole('spinbutton', { name: '取值', exact: true });
  await expect(value).toHaveValue('1');
  await expect(tools.getByRole('textbox', { name: '定义', exact: true })).toBeHidden();
  await value.fill('3'); await value.press('Enter');
  await expect(value).not.toBeFocused();
  await expect.poll(async () => (await currentApi(page, 'a'))?.value).toBe(3);
  await savedMath(page);
  const slider = tools.getByRole('slider', { name: '参数 a', exact: true });
  await slider.focus(); await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await currentApi(page, 'a'))?.value).toBeCloseTo(2.9, 8);
  await expect(value).toHaveValue('2.9'); await savedMath(page);
  await page.reload();
  await page.getByRole('button', { name: '内容列表', exact: true }).click();
  await tools.locator('.mw-object-list button').filter({ has: page.locator('strong', { hasText: /^a$/ }) }).click();
  await expect(value).toHaveValue('2.9');
  await expect.poll(async () => (await currentApi(page, 'a'))?.value).toBeCloseTo(2.9, 8);
  fs.writeFileSync(info.outputPath('parameter-value-refresh.json'), JSON.stringify({ value: (await currentApi(page, 'a')).value, saved: await savedMath(page) }, null, 2));
  await page.mouse.move(280, 75); await page.screenshot({ path: info.outputPath('parameter-value.png') });
  await tools.locator('.wb-module-disclosure-trigger').filter({ hasText: /^改为算式$/ }).click();
  await tools.getByRole('textbox', { name: '定义', exact: true }).fill('2+2');
  await tools.locator('form').getByRole('button', { name: '改为算式', exact: true }).click();
  await expect.poll(async () => (await currentApi(page, 'a'))?.value).toBe(4);
  await savedMath(page); await page.reload();
  await page.getByRole('button', { name: '内容列表', exact: true }).click();
  await tools.locator('.mw-object-list button').filter({ has: page.locator('strong', { hasText: /^a$/ }) }).click();
  await expect(value).toHaveCount(0);
  await expect(slider).toHaveCount(0);
  await expect(tools.getByRole('textbox', { name: '定义', exact: true })).toHaveValue(/2\s*\+\s*2/);
  await expect.poll(async () => (await currentApi(page, 'a'))?.value).toBe(4);
});

test('参数转算式：取消保留滑杆与引用，确认清理取值和播放，刷新保留结果', async ({ page }, info) => {
  const { installMathProbe, currentApi, savedMath, deviceMath } = await import('./math-unified-helpers.mjs');
  await installMathProbe(page); await page.reload();
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('button', { name: '添加参数', exact: true }).click();
  await page.getByRole('button', { name: '加入作品', exact: true }).click();
  const tools = page.locator('.mw-tool-host');
  await tools.getByText('参数播放', { exact: true }).click();
  await tools.getByLabel('自动播放', { exact: true }).check();
  await page.getByRole('button', { name: '教学步骤', exact: true }).click();
  const before = (await savedMath(page)).source;
  expect(before.animation.parameter).toBe('a'); expect(before.steps[0].values.a).toBe(1);
  await page.getByRole('button', { name: '内容列表', exact: true }).click();
  await tools.locator('.mw-object-list button').filter({ has: page.locator('strong', { hasText: /^a$/ }) }).click();
  await tools.locator('.wb-module-disclosure-trigger').filter({ hasText: /^改为算式$/ }).click();
  await expect(tools).toContainText('改为算式后，不再使用滑杆。');
  await tools.getByRole('textbox', { name: '定义', exact: true }).fill('2+2');
  await tools.locator('form').getByRole('button', { name: '改为算式', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('相关步骤、播放或轨迹会随之调整。是否继续？');
  await dialog.getByRole('button', { name: '取消', exact: true }).focus();
  for (const key of ['Shift+Enter', 'Control+Enter', 'Meta+Enter', 'Alt+Enter']) {
    await page.keyboard.press(key); await expect(dialog).toBeVisible();
  }
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('.mw-notice')).toHaveCount(0);
  await expect(tools.getByRole('slider', { name: '参数 a', exact: true })).toBeVisible();
  await expect.poll(async () => (await currentApi(page, 'a'))?.value).toBe(1);
  const cancelled = (await deviceMath(page)).draft.source;
  expect(cancelled.animation).toEqual(before.animation); expect(cancelled.steps).toEqual(before.steps);
  await tools.locator('form').getByRole('button', { name: '改为算式', exact: true }).click();
  await dialog.getByRole('button', { name: '继续', exact: true }).click();
  await expect(tools.getByRole('slider', { name: '参数 a', exact: true })).toHaveCount(0);
  const converted = (await savedMath(page)).source;
  expect(converted.animation).toBeNull(); expect(converted.steps[0].values).not.toHaveProperty('a');
  expect(converted.steps[0].visibleObjects).toContain('a');
  await page.reload(); await savedMath(page);
  await expect.poll(async () => (await currentApi(page, 'a'))?.value).toBe(4);
  const refreshed = (await deviceMath(page)).draft.source;
  expect(refreshed.animation).toBeNull(); expect(refreshed.steps).toEqual(converted.steps);
  fs.writeFileSync(info.outputPath('parameter-conversion.json'), JSON.stringify({ before, cancelled, converted, refreshed }, null, 2));
});

test('按需展开：参数、连接与算式连续开合，快速反向和末项可达', async ({ page }, info) => {
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('button', { name: '添加参数', exact: true }).click();
  await page.getByRole('button', { name: '加入作品', exact: true }).click();
  async function sample(root, trigger, name, opening) {
    await root.evaluate(el => {
      window.mathFoldFrames = [];
      // Arm first, then sample from the real click after Playwright's actionability waits.
      el.addEventListener('click', () => {
        const frame = time => {
          const grid = el.querySelector('.wb-module-disclosure-grid');
          window.mathFoldFrames.push({ time, height: el.getBoundingClientRect().height, opacity: Number(grid ? getComputedStyle(grid).opacity : getComputedStyle(el, el.classList.contains('wb-module-presence') ? null : '::details-content').opacity) });
          if (window.mathFoldFrames.length < 26) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }, { once: true, capture: true });
    });
    await trigger.click();
    await expect.poll(() => page.evaluate(() => window.mathFoldFrames.length)).toBe(26);
    const frames = await page.evaluate(() => window.mathFoldFrames);
    fs.writeFileSync(info.outputPath(`${name}-${opening ? 'open' : 'close'}.json`), JSON.stringify(frames, null, 2));
    const heights = [...new Set(frames.map(f => Math.round(f.height * 10) / 10))];
    expect(heights.length, `${name} continuous height`).toBeGreaterThan(3);
    expect(frames.some(f => f.opacity > 0 && f.opacity < 1), `${name} continuous opacity`).toBe(true);
    if (opening) {
      await page.mouse.move(280, 75); await page.screenshot({ path: info.outputPath(`${name}-open.png`) });
      const last = root.locator('input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), a').last();
      await last.focus(); await expect(last).toBeFocused();
      expect(await last.evaluate(el => { const section = el.closest('.wb-module-disclosure'); return !section || el.getBoundingClientRect().bottom <= section.getBoundingClientRect().bottom + 1; })).toBe(true);
    }
  }
  const tools = page.locator('.mw-tool-host');
  for (const name of ['改为算式', '参数范围', '样式', '参数播放']) {
    const trigger = tools.locator('summary, button.wb-module-disclosure-trigger').filter({ hasText: new RegExp(`^${name}$`) });
    const root = trigger.locator('..');
    await sample(root, trigger, name, true); await sample(root, trigger, name, false);
  }
  const conversion = tools.getByRole('button', { name: '改为算式', exact: true }).first();
  const box = await conversion.boundingBox();
  await conversion.locator('..').evaluate(el => {
    window.mathReverseFrames = [];
    el.addEventListener('click', () => {
      const frame = time => { const grid = el.querySelector('.wb-module-disclosure-grid'); window.mathReverseFrames.push({ time, height: el.getBoundingClientRect().height, opacity: Number(getComputedStyle(grid).opacity) }); if (window.mathReverseFrames.length < 30) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    }, { once: true, capture: true });
  });
  await page.mouse.click(box.x + 20, box.y + box.height / 2);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.mouse.click(box.x + 20, box.y + box.height / 2);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.mouse.click(box.x + 20, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => window.mathReverseFrames.length)).toBe(30);
  const reverse = await page.evaluate(() => window.mathReverseFrames);
  fs.writeFileSync(info.outputPath('改为算式-reverse.json'), JSON.stringify(reverse, null, 2));
  expect(new Set(reverse.map(f => Math.round(f.height))).size).toBeGreaterThan(3);
  expect(reverse.some(f => f.opacity > 0 && f.opacity < 1)).toBe(true);
  await expect(conversion).toHaveAttribute('aria-expanded', 'true');
  await expect(tools.getByRole('textbox', { name: '定义', exact: true })).toBeVisible();
  await tools.getByRole('textbox', { name: '定义', exact: true }).fill('2+2');
  await page.getByRole('tab', { name: 'AI 助理', exact: true }).click();
  const provider = page.locator('.math-ai-provider');
  await expect(page.locator('.math-ai-connection').first()).toHaveClass(/is-missing/);
  await provider.evaluate(button => {
    window.mathPopoverFrames = [];
    button.addEventListener('click', () => {
      const frame = time => {
        const el = document.querySelector('.math-ai-setup-popover');
        window.mathPopoverFrames.push({ time, opacity: el ? Number(getComputedStyle(el).opacity) : 0, visible: Boolean(el && el.getBoundingClientRect().height > 0) });
        if (window.mathPopoverFrames.length < 26) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, { once: true, capture: true });
  });
  await provider.click();
  const popover = page.locator('.math-ai-setup-popover');
  await expect(popover).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.mathPopoverFrames.length)).toBe(26);
  const popoverFrames = await page.evaluate(() => window.mathPopoverFrames);
  fs.writeFileSync(info.outputPath('连接-popover-open.json'), JSON.stringify(popoverFrames, null, 2));
  expect(popoverFrames.some(f => f.visible)).toBe(true);
  expect(await popover.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  const last = popover.locator('input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), a').last();
  await last.focus();
  await expect(last).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
  await expect(provider).toBeFocused();
  await page.getByRole('button', { name: '关闭辅助栏', exact: true }).last().click();
  const expression = page.locator('.mw-expression-disclosure');
  const toggle = page.getByRole('button', { name: '输入算式', exact: true });
  await toggle.evaluate(button => {
    window.mathExpressionFrames = [];
    // Start at the actual click so actionability waits cannot consume the animation samples.
    button.addEventListener('click', () => {
      const frame = time => { const el = document.querySelector('.mw-expression-disclosure'); window.mathExpressionFrames.push({ time, height: el?.getBoundingClientRect().height ?? 0, opacity: el ? Number(getComputedStyle(el).opacity) : 0 }); if (window.mathExpressionFrames.length < 26) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    }, { once: true, capture: true });
  });
  await toggle.click();
  await expect(page.getByLabel('图形表达式', { exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.mathExpressionFrames.length)).toBe(26);
  const frames = await page.evaluate(() => window.mathExpressionFrames);
  fs.writeFileSync(info.outputPath('输入算式-open.json'), JSON.stringify(frames, null, 2));
  expect(new Set(frames.map(f => Math.round(f.height))).size).toBeGreaterThan(3);
  expect(frames.some(f => f.opacity > 0 && f.opacity < 1)).toBe(true);
  await sample(expression, page.getByRole('button', { name: '收起算式', exact: true }), '输入算式', false);
  await expect(expression).toHaveCount(0);
  await toggle.evaluate(button => {
    window.mathExpressionReverse = [];
    button.addEventListener('click', () => {
      const frame = time => { const el = document.querySelector('.mw-expression-disclosure'); window.mathExpressionReverse.push({ time, height: el?.getBoundingClientRect().height ?? 0, opacity: el ? Number(getComputedStyle(el).opacity) : 0 }); if (window.mathExpressionReverse.length < 30) requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    }, { once: true, capture: true });
  });
  const toggleBox = await toggle.boundingBox();
  for (let index = 0; index < 3; index += 1) {
    await page.mouse.click(toggleBox.x + 20, toggleBox.y + toggleBox.height / 2);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await expect.poll(() => page.evaluate(() => window.mathExpressionReverse.length)).toBe(30);
  const expressionReverse = await page.evaluate(() => window.mathExpressionReverse);
  fs.writeFileSync(info.outputPath('输入算式-reverse.json'), JSON.stringify(expressionReverse, null, 2));
  expect(new Set(expressionReverse.map(f => Math.round(f.height))).size).toBeGreaterThan(3);
  expect(expressionReverse.some(f => f.opacity > 0 && f.opacity < 1)).toBe(true);
  await expect(page.getByLabel('图形表达式', { exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath('展开终态.png') });
});

test('数学助理按钮：深浅主题开始、发送和停止可见，真实停止挂起请求', async ({ page }, info) => {
  await page.evaluate(() => {
    window.mathButtonEvents = [];
    window.addEventListener('message', event => {
      const request = event.data;
      if (event.source !== window || request?.source !== 'teachbuddy-workbench') return;
      window.mathButtonEvents.push(request);
      if (request.type === 'SEND') { window.mathButtonPending = request; return; }
      const type = { STATUS: 'STATUS', CONNECT: 'CONNECTED' }[request.type];
      if (type) window.postMessage({ source: 'teachbuddy-web-ai', type, connectionState: 'ready', requestId: request.requestId, sessionId: request.sessionId }, location.origin);
    });
  });
  const records = [];
  async function record(button, theme, state) {
    await expect(button).toBeEnabled();
    const value = await button.evaluate(el => {
      const style = getComputedStyle(el);
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => { const c = Number(value) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const a = luminance(style.color), b = luminance(style.backgroundColor);
      return { color: style.color, background: style.backgroundColor, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), svg: el.querySelector('svg') ? getComputedStyle(el.querySelector('svg')).color : null, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height };
    });
    records.push({ theme, state, ...value });
    await page.mouse.move(280, 75); await page.screenshot({ path: info.outputPath(`${theme}-${state}.png`) });
  }
  for (const [theme, name] of [['light', '浅色'], ['dark', '深色']]) {
    await page.getByRole('link', { name: '账户：数学教师', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.wb-shell')).toHaveAttribute('data-theme', theme);
    await page.getByRole('navigation', { name: '功能模块', exact: true }).getByRole('link', { name: /^数学工坊/ }).click();
    if (!await page.locator('.math-web-assistant').isVisible()) await page.getByRole('banner').getByRole('button', { name: 'AI 助理', exact: true }).click();
    await expect(page.locator('.math-ai-setup')).toHaveCount(0);
    const input = page.getByLabel('向数学助理提问', { exact: true });
    await input.fill('制作一个可调节的函数');
    await record(page.getByRole('button', { name: '开始制作', exact: true }), theme, 'start');
    await page.getByRole('button', { name: '新建作品', exact: true }).click();
    await input.fill('制作一个可调节的函数');
    const send = page.getByRole('button', { name: '发送消息', exact: true });
    await expect(send).toBeEnabled();
    await record(send, theme, 'send');
    await input.press('Enter');
    await expect.poll(() => page.evaluate(() => Boolean(window.mathButtonPending))).toBe(true);
    const stop = page.getByRole('button', { name: '停止生成', exact: true });
    await record(stop, theme, 'stop');
    await stop.click();
    await expect.poll(() => page.evaluate(() => window.mathButtonEvents.some(item => item.type === 'CANCEL' && item.requestId === window.mathButtonPending.requestId))).toBe(true);
    await expect(stop).toHaveCount(0);
    await expect(page.locator('.math-ai-stage')).toHaveText('已停止');
    await page.evaluate(() => { window.mathButtonPending = null; });
    await page.getByRole('button', { name: '返回工坊', exact: true }).click();
  }
  fs.writeFileSync(info.outputPath('button-colors.json'), JSON.stringify(records, null, 2));
  for (const record of records) {
    expect(record.contrast, `${record.theme} ${record.state}`).toBeGreaterThanOrEqual(4.5);
    if (record.svg) expect(record.svg).toBe(record.color);
    expect(record.height).toBe(32);
    if (record.state !== 'start') expect(record.width).toBe(32);
  }
});
