import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register } from './fixtures/math-dynamic/helpers.mjs';
import { currentApi, installMathProbe, deviceMath, enterMath, savedMath } from './math-unified-helpers.mjs';
async function sourceA(base64) { const xml=await (await JSZip.loadAsync(base64,{base64:true})).file('geogebra.xml').async('text'); const point=xml.match(/<element type="point" label="A">[\s\S]*?<coords x="([^"]+)" y="([^"]+)" z="([^"]+)"/); return point?[+point[1]/+point[3],+point[2]/+point[3]]:null; }
// The reply and delayed callback are fixed mechanism probes, never a real model claim.
test('AI取消保留即时手拖内容，关闭辅助栏继续运行，迟到构造与刷新受保护',async({page},info)=>{
  const world=await createIntegration({webDist:path.resolve(process.env.WORKBENCH_WEB_DIST??'apps/web/dist')}); let passed=false;
  try {
    await installMathProbe(page);
    await page.addInitScript(()=>{
      window.mathCancelApi=()=>window.mathTestApis?.[document.querySelector('.mw-graph-host>div')?.id]??window.mathTestApi;
      window.addEventListener('message',event=>{const request=event.data;if(event.source!==window||request?.source!=='teachbuddy-workbench')return;const type={STATUS:'STATUS',CONNECT:'CONNECTED',SEND:'DONE'}[request.type];if(!type)return;
        window.postMessage({source:'teachbuddy-web-ai',type,connectionState:'ready',requestId:request.requestId,sessionId:request.sessionId,text:JSON.stringify({message:'修改A并添加B',changes:{operations:[{type:'setCoords',name:'A',coords:[8,9]},{type:'define',name:'B',expression:'(7,8)'}]}})},location.origin);});
    });
    await register(page,world,'unified-cancel@example.test'); const tutorial=page.getByRole('button',{name:'知道了',exact:true});if(await tutorial.isVisible())await tutorial.click();
    await page.getByRole('navigation',{name:'功能模块',exact:true}).getByRole('link',{name:/^数学工坊/}).click(); await page.getByRole('button',{name:'新建作品',exact:true}).click();
    await enterMath(page,'A=(2,3)','A'); const first=await savedMath(page);
    await page.getByRole('tab',{name:'AI 助理',exact:true}).click(); await page.getByLabel('向数学助理提问').fill('修改A并添加B');
    await page.evaluate(()=>{const api=mathCancelApi();const original=api.asyncEvalCommandGetLabels.bind(api);api.asyncEvalCommandGetLabels=command=>command.startsWith('B=')?new Promise((resolve,reject)=>{window.cancelTestRelease=()=>original(command).then(resolve,reject);}):original(command);});
    // Read view coordinates, then move A with real pointer input.
    const point=await page.evaluate(()=>{const api=mathCancelApi(),view=JSON.parse(api.getViewProperties(1));return{x:view.left+(api.getXcoord('A')-view.xMin)/view.invXscale,y:view.top+view.height-(api.getYcoord('A')-view.yMin)/view.invYscale};});
    await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+48,point.y-32,{steps:12});await page.mouse.up();
    await expect.poll(async()=>(await currentApi(page,'A'))?.coords).not.toEqual([2,3]); const manual=(await currentApi(page,'A')).coords;
    await page.getByRole('tab',{name:'AI 助理',exact:true}).click();
    await page.getByRole('button',{name:'发送消息',exact:true}).click();await page.waitForFunction(()=>typeof window.cancelTestRelease==='function');
    expect((await currentApi(page,'A')).coords).toEqual([8,9]);
    await page.getByRole('button',{name:'关闭辅助栏',exact:true}).last().click();await page.getByRole('banner').getByRole('button',{name:'打开 AI 助理',exact:true}).click();
    await expect(page.getByRole('button',{name:'停止生成',exact:true})).toBeVisible();await page.getByRole('button',{name:'停止生成',exact:true}).click();
    await expect(page.locator('.math-ai-stage')).toHaveText('已停止');await expect.poll(async()=>sourceA((await deviceMath(page)).draft.source.graph.base64),{timeout:90000}).toEqual(manual);
    await page.evaluate(()=>window.cancelTestRelease()).catch(()=>{});await expect.poll(async()=> (await currentApi(page,'B'))?.exists).toBe(false);
    expect((await currentApi(page,'A')).coords).toEqual(manual);await expect(page.locator('.math-ai-message.is-tool[data-state="applied"]')).toHaveCount(0);
    const saved=await savedMath(page);expect(saved.id).toBe(first.id);expect(await sourceA(saved.source.graph.base64)).toEqual(manual);
    await page.reload();await expect.poll(async()=> (await currentApi(page,'A'))?.coords,{timeout:90000}).toEqual(manual);expect((await currentApi(page,'B')).exists).toBe(false);
    passed=true;
  }finally{if(!passed){await page.screenshot({path:info.outputPath('failure.png')});fs.writeFileSync(info.outputPath('device.json'),JSON.stringify(await page.context().storageState()));fs.writeFileSync(info.outputPath('world.json'),JSON.stringify({directory:world.directory}));}await world.close();if(passed)fs.rmSync(world.directory,{recursive:true,force:true});}
});
