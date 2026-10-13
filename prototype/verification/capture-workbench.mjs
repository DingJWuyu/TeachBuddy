// Current four-module walkthrough and shell surfaces, captured at three widths.
// Historical CW reports belong to their fixed Git version, not this runner.
import { chromium, expect } from '@playwright/test';
import { openWorkbench } from './session.mjs';
import { evidencePaths } from './evidence-paths.mjs';
import { writeFileSync } from 'node:fs';
if (process.argv.length > 2) throw new Error('当前脚本运行完整场景，不接受旧 --only 参数');
const base=process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const paths=evidencePaths('workbench');
const browser=await chromium.launch();const results=[];
try {
 for(const viewport of [{width:1440,height:900},{width:768,height:1024},{width:390,height:844}]) {
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const shot=async name=>{
   await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().endTime!==Infinity).map(animation=>animation.finished.catch(()=>{})));
   });
   await page.screenshot({path:`${paths.screenshots}/${viewport.width}-${name}.png`});
  };
  async function go(id){
   if(viewport.width<=700)await page.locator('.tb-mobile-menu').click();
   await page.locator(`[data-drop-module="${id}"]`).click();
   if(viewport.width<=700)await expect.poll(()=>page.locator('.tb-sidebar').evaluate(node=>node.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
   // On tablet, an open tools pane occupies the available task area.
   if(viewport.width<=1050 && await page.getByRole('button',{name:'关闭右侧辅助栏',exact:true}).isVisible()) await page.getByRole('button',{name:'关闭右侧辅助栏',exact:true}).click();
  }
  await openWorkbench(page,base,{dismissCoach:true});
  await expect(page.getByRole('complementary',{name:'Agent 工作区'})).toBeVisible();await shot('home');
  await go('bank');await page.getByRole('button',{name:'编辑',exact:true}).click();
  await page.locator('textarea:visible').first().fill('跨模块保留的题目内容');
  await page.getByRole('button',{name:'完成编辑',exact:true}).click();
  await expect(page.getByLabel('当前题目内容').getByText('跨模块保留的题目内容',{exact:true})).toBeVisible();await shot('bank');
  await go('resources');await page.locator('.wb-resource-card').first().click();
  await expect(page.getByRole('button',{name:'返回资源',exact:true})).toBeVisible();await shot('resource');
  await page.getByRole('button',{name:'返回资源',exact:true}).click();
  await go('studio');
  const slider=page.frameLocator('iframe[title="观察二次函数的变化"]').getByRole('slider',{name:'参数 a'});
  await slider.focus();await slider.press('ArrowRight');await expect(slider).toHaveValue('0.1');await shot('studio');
  await go('bank');await expect(page.getByLabel('当前题目内容').getByText('跨模块保留的题目内容',{exact:true})).toBeVisible();
  await page.locator('[data-surface="search"]').click();
  await expect(page.getByRole('searchbox',{name:'搜索模块',exact:true})).toBeVisible();
  await page.getByRole('searchbox').fill('备课');await expect(page.locator('.tb-search-empty')).toBeVisible();await shot('search');await page.keyboard.press('Escape');
  await page.locator('[data-surface="notifications"]').click();await expect(page.locator('.tb-popover-notifications')).toBeVisible();
  await expect(page.locator('.tb-notification')).toHaveCount(0);await page.keyboard.press('Escape');
  await page.locator('[data-surface="feedback"]').click();await expect(page.locator('.tb-popover-feedback')).toBeVisible();await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
  await openWorkbench(page,new URL('/modules/prep',base).href,{dismissCoach:true});
  if(viewport.width<=1050 && await page.getByRole('button',{name:'关闭右侧辅助栏',exact:true}).isVisible())await page.getByRole('button',{name:'关闭右侧辅助栏',exact:true}).click();
  await expect(page.getByRole('heading',{name:'页面不存在',exact:true})).toBeVisible();
  expect(errors).toEqual([]);results.push({viewport,pass:true});await page.close();
 }
} finally {writeFileSync(paths.results+'/workbench-current.json',JSON.stringify(results,null,2));await browser.close();}
