// Current module visibility, persisted layout normalization, and empty-group restore.
import { chromium, expect } from '@playwright/test';
import { openWorkbench } from './session.mjs';
import { evidencePaths } from './evidence-paths.mjs';
import { writeFileSync } from 'node:fs';
if (process.argv.length > 2) throw new Error('当前脚本运行完整场景，不接受旧 --only 参数');
const base=process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const paths=evidencePaths('hidden-page-redirect');
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',error=>errors.push(String(error)));
try {
  await openWorkbench(page,base,{dismissCoach:true});
  await page.locator('[data-drop-module="bank"]').click();
  await expect(page).toHaveURL(/\/modules\/bank/);
  const token=await page.evaluate(()=>window.navigationProbe=crypto.randomUUID());
  await page.locator('[data-drop-module="bank"]').press('Delete');
  await expect(page).toHaveURL(url=>url.pathname==='/');
  await expect(page.getByRole('complementary',{name:'Agent 工作区'})).toBeVisible();
  expect(await page.evaluate(()=>window.navigationProbe)).toBe(token);
  await expect(page.locator('[data-drop-module="bank"]')).toHaveCount(0);
  await openWorkbench(page,page.url(),{dismissCoach:true});
  await expect(page.locator('[data-drop-module="bank"]')).toHaveCount(0);
  await page.locator('[data-trash-toggle]').click();
  await page.locator('.tb-hidden-panel button').filter({hasText:'题库'}).click();
  await expect(page.locator('[data-drop-group="ungrouped"] [data-drop-module="bank"]')).toBeVisible();
  await page.keyboard.press('Escape');
  for(const id of ['studio','resources']) await page.locator(`[data-drop-module="${id}"]`).press('Delete');
  await expect(page.locator('[data-drop-group="teaching-group"] .tb-module-row')).toHaveCount(0);
  await expect(page.locator('[data-drop-group="teaching-group"]')).toBeVisible();
  await page.screenshot({path:paths.screenshots+'/empty-group.png'});
  // Stored retired/unknown ids must never become routable rows after normalization.
  await page.evaluate(()=>{
    const key='teachbuddy-prototype-layout';const stored=JSON.parse(localStorage.getItem(key));
    stored.layout.groups[0].moduleIds.push('prep','unknown-module');
    localStorage.setItem(key,JSON.stringify(stored));
  });
  await openWorkbench(page,page.url(),{dismissCoach:true});
  await expect(page.locator('[data-drop-module="prep"], [data-drop-module="unknown-module"]')).toHaveCount(0);
  // Removing only the group keeps its modules visible and the active page open.
  await page.evaluate(()=>localStorage.removeItem('teachbuddy-prototype-layout'));
  await openWorkbench(page,base,{dismissCoach:true});
  await page.locator('[data-drop-module="studio"]').click();
  await page.locator('[data-drop-group="teaching-group"] .tb-group-heading').click({button:'right'});
  await page.getByRole('menuitem',{name:'移到未分组',exact:true}).click();
  await expect(page.locator('[data-drop-group="teaching-group"]')).toHaveCount(0);
  await expect(page.locator('[data-drop-group="ungrouped"] .tb-module-row')).toHaveCount(4);
  await expect(page).toHaveURL(/\/modules\/studio/);
  await openWorkbench(page,page.url(),{dismissCoach:true});
  await expect(page.locator('[data-drop-group="ungrouped"] .tb-module-row')).toHaveCount(4);
  expect(errors).toEqual([]);
  writeFileSync(paths.results+'/hidden-page-redirect.txt','PASS hide current page, client navigation, reload, restore, empty group, retired layout ids and group removal\n');
} finally {await browser.close();}
