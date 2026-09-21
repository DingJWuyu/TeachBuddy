// The home page is now an empty placeholder like every other destination.
// Checks the placeholder renders, the dashboard is gone from the DOM, and the
// shell still navigates.
import { chromium } from 'playwright';
import { openWorkbench } from './session.mjs';
import { evidencePaths } from './evidence-paths.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const paths = evidencePaths('home-empty');
const OUT = `${paths.screenshots}/`;
mkdirSync(OUT, { recursive: true });

const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const browser = await chromium.launch();
const checks = [];
const problems = [];

const record = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
p.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
p.on('pageerror', (e) => problems.push(String(e)));
await openWorkbench(p, BASE);
await p.click('.tb-coach-dismiss').catch(() => {});
await p.waitForTimeout(400);

// 1. Home renders the shared empty placeholder.
const home = await p.evaluate(() => ({
  path: location.pathname,
  empty: !!document.querySelector('.tb-empty-page'),
  title: document.querySelector('.tb-empty-page h1')?.textContent.trim(),
  mark: !!document.querySelector('.tb-empty-page-mark svg'),
  dashboardNodes: document.querySelectorAll('.tb-dashboard-grid, .tb-card, .tb-timeline, .tb-calendar-grid').length,
  mainClasses: document.querySelector('.tb-main')?.className
}));
record('首页渲染空占位', home.empty && home.title === '首页' && home.mark,
  `empty=${home.empty} title=${home.title} main=${home.mainClasses}`);
record('首页正文已清空', home.dashboardNodes === 0, `dashboardNodes=${home.dashboardNodes}`);
await p.screenshot({ path: `${OUT}PC-home-empty.png` });

// 2. The home page matches the shape of an already-empty destination.
// Client-side navigation only: a document load would drop the in-memory session.
const shape = () => p.evaluate(() => {
  const el = document.querySelector('.tb-main');
  const cs = getComputedStyle(el);
  return { classes: el.className, padding: cs.padding, title: document.querySelector('.tb-empty-page h1')?.textContent.trim() };
});
const homeShape = await shape();
await p.click('.tb-topbar a[href^="/calendar"]');
await p.waitForTimeout(600);
const calendar = await shape();
record('首页与空页形状一致',
  homeShape.classes === calendar.classes && homeShape.padding === calendar.padding,
  `home=${homeShape.classes}/${homeShape.padding} calendar=${calendar.classes}/${calendar.padding}`);

// 3. The shell still navigates: sidebar module row, then the brand back home.
await p.click('.tb-module-row');
await p.waitForTimeout(600);
const afterModule = await p.evaluate(() => ({ path: location.pathname, shell: !!document.querySelector('.tb-shell') }));
await p.click('.tb-brand');
await p.waitForTimeout(600);
const backHome = await p.evaluate(() => ({
  path: location.pathname,
  title: document.querySelector('.tb-empty-page h1')?.textContent.trim(),
  shell: !!document.querySelector('.tb-shell')
}));
record('外壳跳转仍正常',
  afterModule.path.startsWith('/modules/') && afterModule.shell && backHome.path === '/' && backHome.shell,
  `module=${afterModule.path} back=${backHome.path} title=${backHome.title}`);

// 4. The sidebar head this package reworked is untouched by the change.
const head = await p.evaluate(() => ({
  account: !!document.querySelector('.tb-account-row'),
  language: !!document.querySelector('.tb-language-row'),
  semester: document.querySelector('.tb-term-name')?.textContent.trim()
}));
record('侧栏头部不受影响', head.account && head.language && !!head.semester,
  `account=${head.account} language=${head.language} semester=${head.semester}`);

const failed = checks.filter((c) => !c.pass);
writeFileSync(`${paths.results}/home-empty.json`, JSON.stringify({ checks, problems }, null, 2));
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (problems.length) console.log(`console problems: ${problems.join(' | ')}`);
console.error(`Screenshots: ${OUT}`);
await browser.close();
if (failed.length) process.exitCode = 1;
