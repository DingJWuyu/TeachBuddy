// Current destination bodies, search, notification empty state and feedback simulation.
import { chromium, expect } from '@playwright/test';
import { openWorkbench } from './session.mjs';
import { evidencePaths } from './evidence-paths.mjs';
import { writeFileSync } from 'node:fs';
if (process.argv.length > 2) throw new Error('当前脚本运行完整场景，不接受旧 --only 参数');
const base=process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const paths=evidencePaths('navigation-notifications-feedback');
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try {
 await openWorkbench(page,base,{dismissCoach:true});
 const token=await page.evaluate(()=>window.navigationProbe=crypto.randomUUID());
 for(const [id,title] of [['bank','题库'],['studio','数学工坊'],['resources','资源库'],['classes','班级教学']]){
  await page.locator(`[data-drop-module="${id}"]`).click();
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.navigationProbe)).toBe(token);
 }
 await page.locator('.tb-brand').click();await expect(page.getByRole('complementary',{name:'Agent 工作区'})).toBeVisible();
 await page.locator('[data-surface="search"]').click();await page.getByRole('searchbox').fill('题库');
 await page.locator('.tb-search-results a').first().click();await expect(page).toHaveURL(/\/modules\/bank/);
 await page.locator('[data-surface="notifications"]').click();await expect(page.locator('.tb-popover-notifications')).toBeVisible();
 await expect(page.locator('.tb-notification')).toHaveCount(0);
 await page.locator('[data-surface="feedback"]').click();await expect(page.locator('.tb-popover-notifications')).toHaveCount(0);
 const dialog=page.getByRole('dialog',{name:'发送反馈',exact:true});await expect(dialog).toBeVisible();
 const submit=dialog.locator('.tb-button-primary');await expect(submit).toBeDisabled();
 await page.getByRole('textbox',{name:'反馈内容'}).fill('原型本地反馈示例');await submit.click();
 await expect(page.getByRole('heading',{name:'已收到，谢谢你的反馈！'})).toBeVisible();
 await page.screenshot({path:paths.screenshots+'/feedback.png'});
 await page.getByRole('button',{name:'知道了',exact:true}).click();await expect(page.locator('.tb-popover-feedback')).toHaveCount(0);
 expect(errors).toEqual([]);writeFileSync(paths.results+'/navigation-notifications-feedback.txt','PASS four module bodies, home, no reload, search route, empty notifications, surface exclusivity and local feedback confirmation\n');
} finally {await browser.close();}
