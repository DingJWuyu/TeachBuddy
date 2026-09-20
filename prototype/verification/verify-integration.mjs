import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { openWorkbench, openWithLayout } from './session.mjs';

const base = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const browser = await chromium.launch();
const checks = [];
async function test(name, run) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(4000);
  try {
    await openWorkbench(page, base);
    await page.locator('.tb-coach-dismiss').click();
    await run(page);
    checks.push({ name, status: 'passed' });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, status: 'failed', error: error.message });
    console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
  } finally { await page.close(); }
}

await test('支持入口保留真实链接', async (page) => {
  await page.locator('[data-surface="support"]').hover();
  await expect(page.locator('.tb-support-menu a[href^="/settings"]')).toBeVisible();
});
await test('搜索结果保留真实链接', async (page) => {
  await page.locator('[data-surface="search"]').click();
  await expect(page.locator('.tb-search-results a[href]').first()).toBeVisible();
});
await test('未知地址显示不存在页', async (page) => {
  await openWorkbench(page, new URL('/not-a-page', base).href);
  await expect(page.locator('.tb-empty-page h1')).toHaveText('页面不存在');
  expect(new URL(page.url()).pathname).toBe('/not-a-page');
});
await test('未知模块地址显示不存在页', async (page) => {
  await openWorkbench(page, new URL('/modules/not-a-module', base).href);
  await expect(page.locator('.tb-empty-page h1')).toHaveText('页面不存在');
  expect(new URL(page.url()).pathname).toBe('/modules/not-a-module');
});
await test('缺失模块的持久化布局整份回落默认', async (page) => {
  await openWithLayout(page, base, (key) => localStorage.setItem(key, JSON.stringify({
    version: 1, layout: { groups: [{id:'ungrouped',name:'未分组',moduleIds:[]}],hiddenModuleIds:[] }
  })));
  await expect(page.locator('[data-drop-module]')).toHaveCount(9);
});
await test('手机弹层完整落在视口内', async (page) => {
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.tb-sidebar-toggle')).toBeHidden();
  for (const name of ['notifications','feedback','tutorial','privacy']) {
    await page.locator(`[data-surface="${name}"]`).click();
    await page.waitForTimeout(220);
    const rect=await page.locator(`.tb-popover-${name}`).boundingBox();
    expect(rect.x, `${name} left edge`).toBeGreaterThanOrEqual(0);
    expect(rect.x+rect.width, `${name} right edge`).toBeLessThanOrEqual(390);
    await page.keyboard.press('Escape');
  }
});
await test('目的页面没有开发说明', async (page) => {
  await page.locator('.tb-global-nav a').nth(1).click();
  await expect(page.locator('.tb-empty-page')).not.toContainText('没有开始设计');
});
await test('窄轨名称提示完整可见', async (page) => {
  await page.locator('.tb-topbar').hover();
  await page.locator('.tb-sidebar-toggle').click();
  await page.waitForTimeout(250);
  const row = page.locator('.tb-module-row').nth(1);
  await row.hover();
  await page.waitForTimeout(250);
  const clipped = await row.evaluate((node) => {
    const tip = document.querySelector('.tb-rail-tooltip');
    if (tip) {
      const b = tip.getBoundingClientRect();
      return b.right > innerWidth || b.left < 0 || b.width < 30;
    }
    const nav = node.closest('.tb-module-nav');
    return ['hidden', 'auto', 'scroll'].includes(getComputedStyle(nav).overflowX);
  });
  expect(clipped).toBe(false);
});
await test('减少动态效果直接显示终态', async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-surface="notifications"]').click();
  const motion = await page.evaluate(() => ({
    panel: getComputedStyle(document.querySelector('.tb-popover')).animationName,
    page: getComputedStyle(document.querySelector('.tb-page')).animationName,
    collapse: getComputedStyle(document.querySelector('.tb-module-collapse')).transitionDuration
  }));
  expect(motion).toEqual({ panel: 'none', page: 'none', collapse: '0s' });
});
await browser.close();
console.log(`${checks.filter((check) => check.status === 'passed').length}/${checks.length} passed`);
if (checks.some((check) => check.status === 'failed')) process.exitCode = 1;
