// 悬停细节图：全局导航悬停、侧栏收起键悬停、窄轨图标提示。
//
// 1440x900、开发切换器可见、首次引导已关闭。
//
// 用法（仓库根目录，先跑 npm run prototype:sidebar）：
//   node prototype/verification/capture-hover-details.mjs
//
// PROTOTYPE_URL 覆盖目标地址，PROTOTYPE_EVIDENCE_DIR 覆盖产物目录。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?prototype=sidebar';
const OUT = process.env.PROTOTYPE_EVIDENCE_DIR || fileURLToPath(new URL('../evidence/screenshots/workbench/', import.meta.url));

const browser = await chromium.launch();

async function open() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await openWorkbench(page, BASE);
  await page.waitForTimeout(600);
  /* 首次引导会压暗外壳并吞掉点击，先按用户的做法关掉它。 */
  await page.click('.tb-coach-dismiss').catch(() => {});
  await page.waitForTimeout(250);
  return page;
}

/** 收起键只在顶栏被悬停时才可点，脚本照真实操作先悬停顶栏。 */
async function revealToggle(page) {
  await page.hover('.tb-topbar');
  await page.waitForTimeout(250);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log(name);
}

{
  const page = await open();
  await page.hover('.tb-global-nav .tb-nav-item:nth-of-type(2)');
  await page.waitForTimeout(250);
  await shot(page, 'PC-CW05-nav-hover.png');
  await page.close();
}

{
  const page = await open();
  await revealToggle(page);
  await page.hover('.tb-sidebar-toggle');
  await page.waitForTimeout(250);
  await shot(page, 'PC-CW03-toggle-hover.png');
  await page.close();
}

{
  const page = await open();
  await revealToggle(page);
  await page.click('.tb-sidebar-toggle');
  await page.waitForTimeout(500);
  await page.locator('.tb-module-row').nth(1).hover();
  await page.waitForTimeout(300);
  await shot(page, 'PC-CW04-rail-tooltip.png');
  await page.close();
}

await browser.close();
