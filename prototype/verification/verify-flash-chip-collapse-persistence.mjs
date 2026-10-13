// Current shell navigation, collapse persistence and synthetic drag-image mechanism.
import { chromium, expect } from '@playwright/test';
import { openWorkbench } from './session.mjs';
import { evidencePaths } from './evidence-paths.mjs';
import { writeFileSync } from 'node:fs';
if (process.argv.length > 2) throw new Error('当前脚本运行完整场景，不接受旧 --only 参数');
const base=process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const paths=evidencePaths('flash-chip-collapse-persistence');
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try {
 await openWorkbench(page,base,{dismissCoach:true});
 const token=await page.evaluate(()=>window.navigationProbe=crypto.randomUUID());
 for(const id of ['bank','studio','resources','classes']){
  await page.locator(`[data-drop-module="${id}"]`).click();
  await expect(page).toHaveURL(new RegExp('/modules/'+id));
  expect(await page.evaluate(()=>window.navigationProbe)).toBe(token);
 }
 const toggle=page.getByRole('button',{name:'收起分组 教学',exact:true});await toggle.click();
 await expect(page.getByRole('button',{name:'展开分组 教学',exact:true})).toHaveAttribute('aria-expanded','false');
 await openWorkbench(page,page.url(),{dismissCoach:true});
 await page.getByRole('button',{name:'展开分组 教学',exact:true}).click();
 await expect(page.locator('[data-drop-module="bank"]')).toBeVisible();
 // Synthetic events test the custom chip and target handling, not native touch gestures.
 await page.locator('[data-drop-module="bank"]').evaluate(node=>{
  window.dragProbe={node,transfer:new DataTransfer()};
  node.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:window.dragProbe.transfer,clientX:300,clientY:400}));
 });
 await expect(page.locator('.tb-drag-chip')).toBeVisible();
 await expect(page.locator('.tb-drag-chip svg path').first()).toBeAttached();
 const box=await page.locator('.tb-drag-chip').boundingBox();expect(Math.round(box.width)).toBe(32);expect(Math.round(box.height)).toBe(32);
 await page.screenshot({path:paths.screenshots+'/drag-chip.png'});
 await page.locator('[data-drop-group="ungrouped"] .tb-group-heading').evaluate(node=>{
  const box=node.getBoundingClientRect();const event={bubbles:true,cancelable:true,dataTransfer:window.dragProbe.transfer,clientX:box.x+box.width/2,clientY:box.y+box.height/2};
  node.dispatchEvent(new DragEvent('dragover',event));node.dispatchEvent(new DragEvent('drop',event));
  window.dragProbe.node.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:window.dragProbe.transfer}));
 });
 await expect(page.locator('.tb-drag-chip')).toHaveCount(0);
 await expect(page.locator('[data-drop-group="ungrouped"] [data-drop-module="bank"]')).toBeVisible();
 await openWorkbench(page,page.url(),{dismissCoach:true});
 await expect(page.locator('[data-drop-group="ungrouped"] [data-drop-module="bank"]')).toBeVisible();
 expect(errors).toEqual([]);writeFileSync(paths.results+'/flash-chip-collapse-persistence.txt','PASS client navigation, group collapse/reopen/reload, book drag chip, empty-group drop and reload\n');
} finally {await browser.close();}
