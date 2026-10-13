import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {createIntegration} from '../../api/test/fixtures/auth-integration/harness.js';

let world, directory, pageKey;
const evidence = process.env.QUESTIONS_INTAKE_EVIDENCE;
const phase = process.env.CASE_PHASE ?? 'green';
async function capture(page, name, data) {
  if (!evidence) return;
  fs.mkdirSync(evidence, {recursive:true});
  await page.screenshot({path:path.join(evidence,`${phase}-${name}.png`)});
  if(data) fs.writeFileSync(path.join(evidence,`${phase}-${name}.json`),JSON.stringify(data,null,2));
}
async function start(page) {
  directory=fs.mkdtempSync(path.join(os.tmpdir(),'questions-intake-copy-'));
  world=await createIntegration({directory,workbench:{filesDir:path.join(directory,'files')}});
  const client=world.client(), email='intake-copy@example.test', password='Questions-Intake-2026';
  await client.request('POST','/api/auth/session',{body:{action:'bootstrap'}});
  const code=await client.request('POST','/api/auth/registration-codes',{body:{email}});
  const registration=await client.request('POST','/api/auth/register',{body:{email,nickname:'补录验证老师',password,challengeId:code.json.challengeId,verificationCode:world.mailer.lastCode('registration',email),termsAccepted:true,rememberMe:true}});
  expect(registration.status).toBe(201);
  pageKey=undefined;
  page.on('request',request=>{if(request.url().includes('/api/modules/questions'))pageKey=request.headers()['x-teachbuddy-page'];});
  await page.goto(world.origin);
  await page.getByLabel('邮箱',{exact:true}).fill(email);
  await page.getByLabel('密码',{exact:true}).fill(password);
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.getByRole('button',{name:'知道了',exact:true}).click();
  await page.getByRole('navigation',{name:'功能模块'}).getByRole('link',{name:/^题库/}).click();
}
async function get(page, route) {
  const response=await page.request.get(world.origin+'/api/modules/questions/v2'+route,{headers:{'X-TeachBuddy-Page':pageKey}});
  expect(response.status()).toBe(200);
  return response.json();
}
test.afterEach(async({context},info)=>{await context.close();await world?.close();world=undefined;if(directory){if(info.status===info.expectedStatus)fs.rmSync(directory,{recursive:true,force:true});else console.log('保留失败现场：'+directory);}});
async function photo(name, text) {
  return {name,mimeType:'image/png',buffer:await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/><text x="40" y="120" font-size="28">${text}</text></svg>`)).png().toBuffer()};
}

test('补充草稿采用当前第二张原稿，保存刷新入库后仍定位原稿2',async({page})=>{
  await start(page);
  await page.locator('.q-finder').getByRole('button',{name:'从资料收录',exact:true}).click();
  await page.getByRole('button',{name:/上传图片/}).click();
  await page.getByLabel('选择原稿').setInputFiles([await photo('page-1.png','1. Compute 1 + 1.'),await photo('page-2.png','2. Solve x + 3 = 5.')]);
  await page.getByRole('button',{name:'开始整理',exact:true}).click();
  await expect(page.locator('.q-review-heading')).toContainText(/整理失败|部分内容待处理/);
  await page.getByLabel('原稿文件').selectOption({index:1});
  const selectedFile=await page.getByLabel('原稿文件').inputValue();
  await expect(page.locator('.q-original img').first()).toBeVisible();
  await page.getByRole('button',{name:'材料操作',exact:true}).click();
  await page.getByRole('button',{name:'补充题目草稿',exact:true}).click();
  await page.getByRole('button',{name:'修改题目',exact:true}).click();
  await page.getByLabel('题干段落 1',{exact:true}).fill('解方程 $x+3=5$。');
  await page.getByRole('button',{name:'完成修改',exact:true}).click();
  await page.getByRole('button',{name:'保存检查进度',exact:true}).click();
  await expect(page.getByText('校对已保存',{exact:true})).toBeVisible();
  const entry=(await get(page,'/imports')).items[0];
  const saved=await get(page,'/imports/'+entry.id);
  await capture(page,'photo-saved',{selectedFile,saved});
  expect(saved.drafts[0].parts[0].locations[0]).toEqual({kind:'page',fileId:selectedFile,renditionFileId:selectedFile,page:1,box:null});
  await page.reload();
  await page.getByRole('button',{name:'确认这道题',exact:true}).click();
  await page.getByRole('button',{name:'查看题目',exact:true}).click();
  const committed=await get(page,'/imports/'+entry.id);
  const question=await get(page,'/items/'+committed.drafts[0].questionId);
  expect(question.source.parts).toEqual(saved.drafts[0].parts);
  await page.getByRole('button',{name:'对照原稿',exact:true}).click();
  await expect(page.getByLabel('原稿文件')).toHaveValue(selectedFile);
  await page.reload();
  await expect(page.getByLabel('原稿文件')).toHaveValue(selectedFile);
  await capture(page,'photo-reopened',{question});
});
async function manualQuestion(page) {
  await start(page);
  await page.locator('.q-finder').getByRole('button',{name:'手动录题',exact:true}).click();
  await page.getByLabel('题目标题',{exact:true}).fill('完整文字与公式复制');
  await page.getByLabel('题干段落 1',{exact:true}).fill('已知 $x^2=9$，求 $x$。\n说明：保留完整题面。');
  await page.getByRole('button',{name:'保存题目',exact:true}).click();
  await expect(page.getByRole('button',{name:'编辑题目',exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'复制文字或下载图片',exact:true}).click();
}
test('复制文字与公式源直接写入真实剪贴板且可粘贴',async({page,context})=>{
  await manualQuestion(page);
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:world.origin});
  await page.evaluate(()=>navigator.clipboard.writeText('CLIPBOARD_SENTINEL'));
  await page.getByRole('button',{name:'复制文字与公式源',exact:true}).click();
  const expected='已知 $x^2=9$，求 $x$。\n说明：保留完整题面。';
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(expected);
  await expect(page.getByText('文字与公式源已复制',{exact:true})).toBeVisible();
  await page.evaluate(()=>{const input=document.createElement('textarea');input.setAttribute('aria-label','验证粘贴目标');document.body.append(input);});
  await page.getByLabel('验证粘贴目标').focus();
  await page.keyboard.press('Control+v');
  await expect(page.getByLabel('验证粘贴目标')).toHaveValue(expected);
  await page.getByLabel('验证粘贴目标').evaluate(node=>node.remove());
  await capture(page,'clipboard-success',{clipboard:await page.evaluate(()=>navigator.clipboard.readText())});
});

test('剪贴板权限拒绝后无成功误报，可就近手动复制完整源文本',async({page,context})=>{
  await manualQuestion(page);
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:world.origin});
  await page.evaluate(()=>navigator.clipboard.writeText('CLIPBOARD_SENTINEL'));
  const denyClipboard=async route=>{
    const response=await route.fetch();
    await route.fulfill({response,headers:{...response.headers(),'permissions-policy':'clipboard-write=()'}});
  };
  await page.route(world.origin+'/**',denyClipboard);
  await page.reload();
  await page.getByRole('button',{name:'复制文字或下载图片',exact:true}).click();
  expect(await page.evaluate(async()=>{try{await navigator.clipboard.writeText('DENIAL_PROBE');return 'allowed';}catch(error){return error.name;}})).toBe('NotAllowedError');
  await page.getByRole('button',{name:'复制文字与公式源',exact:true}).click();
  await expect(page.getByText('未能自动复制，请复制下方已选文字',{exact:true})).toBeVisible();
  await expect(page.getByText('文字与公式源已复制',{exact:true})).toHaveCount(0);
  const source=page.getByLabel('可复制文字公式源');
  await expect(source).toBeFocused();
  expect(await source.evaluate(node=>node.selectionEnd-node.selectionStart)).toBe((await source.inputValue()).length);
  await capture(page,'clipboard-denied',{selectedText:await source.inputValue()});
  await page.keyboard.press('Control+c');
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(await source.inputValue());
  await page.unroute(world.origin+'/**',denyClipboard);
  await page.reload();
  await page.getByRole('button',{name:'复制文字或下载图片',exact:true}).click();
  await page.getByRole('button',{name:'复制文字与公式源',exact:true}).click();
  await expect(page.getByText('文字与公式源已复制',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'公式 1 源',exact:true}).click();
  await expect(source).toHaveValue('x^2=9');
  await expect(page.getByText('文字与公式源已复制',{exact:true})).toHaveCount(0);
});
test('浏览器无剪贴板API时保留可选文本且不报告成功',async({page})=>{
  await manualQuestion(page);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
  await page.getByRole('button',{name:'复制文字与公式源',exact:true}).click();
  await expect(page.getByText('未能自动复制，请复制下方已选文字',{exact:true})).toBeVisible();
  await expect(page.getByLabel('可复制文字公式源')).toBeFocused();
  await expect(page.getByLabel('可复制文字公式源')).toHaveValue('已知 $x^2=9$，求 $x$。\n说明：保留完整题面。');
  await expect(page.getByText('文字与公式源已复制',{exact:true})).toHaveCount(0);
  await capture(page,'clipboard-unsupported');
});

async function addDraftAndSave(page, title) {
  await page.getByRole('button',{name:'材料操作',exact:true}).click();
  await page.getByRole('button',{name:'补充题目草稿',exact:true}).click();
  await page.getByRole('button',{name:'修改题目',exact:true}).click();
  await page.getByLabel('题干段落 1',{exact:true}).fill(title);
  await page.getByRole('button',{name:'完成修改',exact:true}).click();
  await page.getByRole('button',{name:'保存检查进度',exact:true}).click();
  await expect(page.getByText('校对已保存',{exact:true})).toBeVisible();
  const entry=(await get(page,'/imports')).items[0];
  const saved=await get(page,'/imports/'+entry.id);
  return {entry,saved,draft:saved.drafts.find(d=>d.body.blocks.some(block=>block.runs?.some(run=>run.text===title)))};
}
test('纯文字补录保留文字定位，补充照片后采用当前可见照片',async({page})=>{
  await start(page);
  await page.locator('.q-finder').getByRole('button',{name:'从资料收录',exact:true}).click();
  await page.getByRole('button',{name:/^粘贴文字/}).click();
  await page.getByLabel('原始文字',{exact:true}).fill('1. 求 $1+1$。');
  await page.getByRole('button',{name:'开始整理',exact:true}).click();
  await expect(page.getByRole('button',{name:'材料操作',exact:true})).toBeVisible();
  await expect(page.locator('.q-review-heading')).toContainText('整理完成');
  const text=await addDraftAndSave(page,'文字补充');
  expect(text.draft.parts[0].locations[0]).toEqual({kind:'text',start:0,end:[...'1. 求 $1+1$。'].length});
  await page.getByRole('button',{name:'材料操作',exact:true}).click();
  const chooser=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'补充照片',exact:true}).click();
  await (await chooser).setFiles([await photo('supplement-1.png','3. Compute 2 + 2.'),await photo('supplement-2.png','4. Solve x + 4 = 6.')]);
  await expect(page.getByLabel('原稿文件')).toBeVisible();
  await page.getByLabel('原稿文件').selectOption({index:1});
  await expect(page.locator('.q-original img').first()).toBeVisible();
  const file=await page.getByLabel('原稿文件').inputValue();
  const result=await addDraftAndSave(page,'照片补充题目');
  expect(result.entry.supplementFileIds).toContain(file);
  expect(result.draft.parts[0].locations[0]).toEqual({kind:'page',fileId:file,renditionFileId:file,page:1,box:null});
  await page.reload();
  await page.getByRole('button',{name:'确认这道题',exact:true}).click();
  await page.getByRole('button',{name:'查看题目',exact:true}).click();
  await page.getByRole('button',{name:'对照原稿',exact:true}).click();
  await expect(page.getByLabel('原稿文件')).toHaveValue(file);
  await capture(page,'supplement-reopened',{saved:result.saved});
});
test('PDF当前第2页补录保存真实原件、预览版本与页码',async({page})=>{
  await start(page);
  await page.locator('.q-finder').getByRole('button',{name:'从资料收录',exact:true}).click();
  await page.getByRole('button',{name:/^上传 PDF/}).click();
  await page.getByLabel('选择原稿').setInputFiles('apps/web/e2e/fixtures/materials-questions/P.pdf');
  await page.getByRole('button',{name:'开始整理',exact:true}).click();
  await expect(page.locator('.q-review-heading')).toContainText(/整理完成|部分内容待处理|整理失败/,{timeout:60000});
  await page.getByLabel('原稿页码').selectOption('2');
  await expect(page.getByAltText('原稿第 2 页')).toBeVisible();
  const result=await addDraftAndSave(page,'第2页补充题目');
  const file=result.entry.input.fileIds[0];
  const preview=await page.request.get(world.origin+`/api/workbench/files/${file}/preview`,{headers:{'X-TeachBuddy-Page':pageKey}});
  const rendition=(await preview.json()).renditionFileId;
  expect(result.draft.parts[0].locations[0]).toEqual({kind:'page',fileId:file,renditionFileId:rendition,page:2,box:null});
  await page.reload();
  await page.getByRole('button',{name:'确认这道题',exact:true}).click();
  await page.getByRole('button',{name:'查看题目',exact:true}).click();
  await page.getByRole('button',{name:'对照原稿',exact:true}).click();
  await expect(page.getByLabel('原稿页码')).toHaveValue('2');
  await capture(page,'pdf-reopened',{saved:result.saved});
});
