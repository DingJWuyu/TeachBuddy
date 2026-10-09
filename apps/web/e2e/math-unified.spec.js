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
  await expect(page.getByRole('link', { name: '下载连接扩展' })).toBeVisible();
  await expect(page.locator('.mw-save-state')).toHaveCount(0);
  await page.screenshot({path:info.outputPath('empty-install-1440.png')});
  await page.setViewportSize({width:1024,height:768}); await page.screenshot({path:info.outputPath('empty-install-1024.png')});
  await page.setViewportSize({width:390,height:844}); await page.screenshot({path:info.outputPath('empty-install-narrow.png')});
  expect(await page.locator('.math-ai-setup').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:900});
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
  await page.getByRole('button',{name:'双视图',exact:true}).click(); await enterMath(page,'cube=Cube((0,0,0),(2,0,0))','cube'); const saved=await savedMath(page);
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
  await page.getByRole('button', { name: '打开辅助栏', exact: true }).click();
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
  await page.getByLabel('图形表达式',{exact:true}).fill('f(x)=x^2');await page.getByLabel('图形表达式',{exact:true}).press('Enter');await expect(page.locator('.mw-graph-host')).toHaveClass(/has-graph/,{timeout:90000});await expect(page.locator('.mw-save-state')).toHaveText('已保存',{timeout:60000});
  await page.getByRole('button',{name:'下载',exact:true}).click();const dialog=page.getByRole('dialog',{name:'下载作品',exact:true});
  async function download(extension){const pending=page.waitForEvent('download',{timeout:90000});await dialog.getByRole('button',{name:'下载文件',exact:true}).click();const artifact=await pending;expect(await artifact.failure()).toBeNull();expect(artifact.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));const file=info.outputPath(`work.${extension}`);await artifact.saveAs(file);return fs.readFileSync(file);}
  const png=await download('png');expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  await dialog.getByRole('combobox',{name:'内容',exact:true}).selectOption('formula');await dialog.getByRole('combobox',{name:'格式',exact:true}).selectOption('svg');expect((await download('svg')).toString()).toContain('<svg');
  await dialog.getByRole('button',{name:'可编辑源',exact:true}).click();const source=JSON.parse((await download('json')).toString());expect(source.source?.kind??source.kind).toBe('workshop');
  await dialog.getByRole('button',{name:'课堂演示',exact:true}).click();const zip=await download('zip');const JSZip=(await import('jszip')).default;const bundle=await JSZip.loadAsync(zip);expect(bundle.file('index.html')).not.toBeNull();await page.screenshot({path:info.outputPath('download-classroom.png')});
});

test('自由点修改和AI续改刷新后坐标可读，关联点保留构造与点样式',async({page},info)=>{
  // Fixed local AI reply only verifies the UI/apply seam; real DeepSeek is verified separately.
  await page.evaluate(()=>{let rounds=0;window.addEventListener('message',event=>{const request=event.data;if(event.source!==window||request?.source!=='teachbuddy-workbench')return;const type={STATUS:'STATUS',CONNECT:'CONNECTED',SEND:'DONE'}[request.type];if(!type)return;window.postMessage({source:'teachbuddy-web-ai',type,connectionState:'ready',requestId:request.requestId,sessionId:request.sessionId,text:JSON.stringify(request.type==='SEND'&&rounds++===0?{message:'移动A',changes:{operations:[{type:'setCoords',name:'A',coords:[5,3]}]}}:{message:'已完成',changes:{}})},location.origin);});});
  await page.getByRole('button',{name:'新建作品',exact:true}).click();const field=page.getByLabel('图形表达式',{exact:true});await field.fill('A=(1,2)');await field.press('Enter');const tools=page.locator('.mw-tool-host');await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/\(1,\s*2\)/,{timeout:90000});
  await tools.getByRole('textbox',{name:'定义',exact:true}).fill('(4,3)');await tools.getByRole('button',{name:'应用修改',exact:true}).click();await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/\(4,\s*3\)/);
  await page.getByRole('tab',{name:'AI 助理',exact:true}).click();await page.getByLabel('向数学助理提问').fill('把A右移一个单位');await page.getByRole('button',{name:'发送消息',exact:true}).click();await expect(page.locator('.math-ai-message.is-assistant')).toContainText('已完成',{timeout:90000});await expect(page.locator('.mw-save-state')).toHaveText('已保存',{timeout:60000});
  await page.reload();await page.getByRole('button',{name:'打开辅助栏',exact:true}).click().catch(()=>{});await page.getByRole('tab',{name:'工具',exact:true}).click();await tools.locator('.mw-object-list button').filter({has:page.locator('strong',{hasText:/^A$/})}).click();await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/\(5,\s*3\)/);await expect(tools.locator('.mw-object-list')).toContainText(/\(5,\s*3\)/);
  await tools.getByText('样式',{exact:true}).click();await expect(tools.getByRole('spinbutton',{name:'点大小',exact:true})).toBeVisible();await expect(tools.getByRole('spinbutton',{name:'线宽',exact:true})).toHaveCount(0);
  await field.fill('B=(7,5)');await field.press('Enter');await expect(tools.locator('.mw-object-list')).toContainText('B');await field.fill('M=Midpoint(A,B)');await field.press('Enter');await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/Midpoint[\[(]/);await tools.getByRole('textbox',{name:'定义',exact:true}).fill('Midpoint(A,B)');await tools.getByRole('button',{name:'应用修改',exact:true}).click();await expect(tools.getByRole('textbox',{name:'定义',exact:true})).toHaveValue(/Midpoint[\[(]/);await page.screenshot({path:info.outputPath('point-coordinate-and-dependent.png')});
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
  await page.getByRole('button', { name: '三维', exact: true }).click();
  await expect.poll(async () => (await deviceMath(page))?.draft?.source.view).toBe('space');
  expect((await deviceMath(page)).draft.source.graph).toBeNull();
  expect((await deviceMath(page)).draft.id ?? null).toBeNull();
  await page.getByRole('button', { name: '平面', exact: true }).click();
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
  await page.getByLabel('Graph expression',{exact:true}).fill('A=(1,2)');await page.getByLabel('Graph expression',{exact:true}).press('Enter');
  const tools=page.locator('.mw-tool-host');await expect(tools.getByRole('textbox',{name:'Definition',exact:true})).toHaveValue(/\(1,\s*2\)/,{timeout:90000});
  await tools.getByRole('button',{name:'Delete object',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Delete A?');await expect(dialog.getByRole('button',{name:'Continue',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await page.screenshot({path:info.outputPath('english-workshop.png')});
});

test('历史海报失败重试、切版查看和恢复生成新版本',async({page},info)=>{
  await page.evaluate(()=>{let Constructor;Object.defineProperty(window,'GGBApplet',{configurable:true,get:()=>Constructor,set:Value=>{Constructor=class extends Value{constructor(parameters,...rest){super({...parameters,appletOnLoad:api=>{(window.mathTestApis??={})[parameters.id]=api;window.mathTestApi=api;parameters.appletOnLoad?.(api);}},...rest);}};}});});
  const {enterMath,savedMath,currentApi,installMathProbe}=await import('./math-unified-helpers.mjs');await installMathProbe(page);await page.getByRole('button',{name:'新建作品',exact:true}).click();await enterMath(page,'A=(1,2)','A');const first=await savedMath(page);await enterMath(page,'A=(5,3)','A');const second=await savedMath(page);expect(second.version).toBe(first.version+1);
  let intercepted=false;await page.route('**/api/workbench/files/*/content',route=>{if(!intercepted){intercepted=true;return route.abort('failed');}return route.continue();});
  await page.getByLabel('更多作品操作',{exact:true}).click();await page.getByRole('button',{name:'历史版本',exact:true}).click();const history=page.getByRole('dialog',{name:'历史版本',exact:true});await expect(history.getByRole('alert')).toContainText('此版本预览暂时无法读取');expect((await currentApi(page,'A')).coords).toEqual([5,3]);await history.getByRole('button',{name:'重试',exact:true}).click();await expect(history.getByRole('img',{name:`版本 ${first.version} 预览`,exact:true})).toBeVisible();
  await history.getByRole('combobox',{name:'保存记录',exact:true}).selectOption(String(second.version));await expect(history.getByRole('img',{name:`版本 ${second.version} 预览`,exact:true})).toBeVisible();await history.getByRole('combobox',{name:'保存记录',exact:true}).selectOption(String(first.version));await expect(history.getByRole('img',{name:`版本 ${first.version} 预览`,exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('history-preview.png')});
  await history.getByRole('button',{name:'恢复此版本',exact:true}).click();await expect.poll(async()=>(await currentApi(page,'A'))?.coords,{timeout:90000}).toEqual([1,2]);const restored=await savedMath(page);expect(restored.id).toBe(first.id);expect(restored.version).toBe(second.version+1);await page.reload();await expect.poll(async()=>(await currentApi(page,'A'))?.coords,{timeout:90000}).toEqual([1,2]);
});
