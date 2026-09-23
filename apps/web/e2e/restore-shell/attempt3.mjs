import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createIntegration } from '../../../api/test/fixtures/auth-integration/harness.js';

const out = process.env.SHELL_EVIDENCE || '/tmp/rs3/check';
fs.mkdirSync(out, { recursive: true });
const world = await createIntegration();
const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1680, height: 910 } });
const p = await context.newPage(), r = await context.newPage();
const failures = [], metrics = [], requests = [], errors = [];
p.on('pageerror', error => errors.push(error.message));
p.on('response', res => { if (res.url().includes('/api/')) requests.push({ path: new URL(res.url()).pathname, status: res.status(), method: res.request().method() }); });
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures.push(label); };
const settle = page => page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
});
const shot = async (page, name) => { await settle(page); await page.screenshot({ path: path.join(out, `${name}.png`) }); };
const measure = (page, selectors) => page.evaluate(selectors => Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
  const el = document.querySelector(selector); if (!el) return [key, null];
  const rect = el.getBoundingClientRect(), css = getComputedStyle(el);
  return [key, { x: rect.x, y: rect.y, w: rect.width, h: rect.height, size: css.fontSize, gap: css.gap, color: css.color }];
})), selectors);
try {
  await p.goto(world.origin);
  await p.getByRole('button', { name: '创建账户' }).click();
  for (const [label, value] of [['昵称', '林老师'], ['邮箱', 'attempt3@example.test'], ['密码', 'attempt3-password'], ['确认密码', 'attempt3-password']]) await p.getByLabel(label, { exact: true }).fill(value);
  await p.getByRole('button', { name: '发送验证码' }).click();
  await p.getByLabel('邮箱验证码').fill(world.mailer.lastCode('registration', 'attempt3@example.test'));
  await p.getByRole('checkbox').check();
  await p.getByRole('button', { name: '注册', exact: true }).click();
  await p.locator('.wb-shell').waitFor();
  await r.goto(process.env.PROTOTYPE_ORIGIN || 'http://127.0.0.1:4198');
  await r.locator('input[autocomplete="email"]').fill('example@example.com');
  await r.locator('input[autocomplete="current-password"]').fill('teachbuddy');
  await r.getByRole('button', { name: '登录', exact: true }).click();
  await r.locator('.tb-topbar').waitFor();
  for (const page of [p, r]) if (await page.locator('.tb-coach-dismiss').isVisible()) await page.locator('.tb-coach-dismiss').click();
  for (const width of [1680, 390]) {
    const pair = [];
    for (const [page, kind] of [[p, 'product'], [r, 'prototype']]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 910 });
      await shot(page, `${kind}-home-${width}`);
      pair.push(await measure(page, {
        title: kind === 'product' ? '.restored-welcome h1' : '.wb-agent-welcome h2',
        composer: kind === 'product' ? '.restored-start' : '.wb-composer',
        send: kind === 'product' ? '.restored-send' : '.wb-send',
        suggestions: kind === 'product' ? '.restored-suggestions' : '.wb-prompt-suggestions',
        actions: '.tb-top-actions'
      }));
    }
    metrics.push({ width, product: pair[0], prototype: pair[1] });
    for (const key of ['title', 'composer', 'send', 'suggestions']) for (const prop of ['x', 'y', 'w', 'h', 'size']) {
      const a = pair[0][key]?.[prop], b = pair[1][key]?.[prop];
      check(typeof a === 'number' ? Math.abs(a - b) <= 1 : a === b, `RUI-02 ${width} ${key}.${prop}: ${a} / ${b}`);
    }
    check(pair[0].actions.gap === pair[1].actions.gap, `RUI-01 ${width} top actions gap`);
    await expect(p.getByRole('button', { name: '新对话', exact: true })).not.toBeVisible();
    await expect(p.getByRole('button', { name: '对话历史', exact: true })).not.toBeVisible();
  }
  for (const [page, kind] of [[p, 'product'], [r, 'prototype']]) {
    await page.getByRole('button', { name: '打开工作台导航', exact: true }).click();
    await shot(page, `${kind}-narrow-nav`);
    const m = await measure(page, { sidebar: '.tb-sidebar', account: '.tb-account-row', term: '.tb-term-button', heading: '.tb-workspace-heading' });
    metrics.push({ kind, drawer: m });
  }
  const [actual, reference] = metrics.slice(-2).map(m => m.drawer);
  for (const key of Object.keys(reference)) for (const prop of ['x', 'y', 'w', 'h']) check(Math.abs(actual[key][prop] - reference[key][prop]) <= 1, `RUI-01 ${key}.${prop}: ${actual[key][prop]} / ${reference[key][prop]}`);
  await p.locator('.tb-module-nav a[href="/classes"]').click();
  await expect(p.locator('.tb-sidebar')).not.toBeVisible();
  await p.setViewportSize({ width: 1680, height: 910 });
  await p.getByRole('button', { name: '新建班级', exact: true }).click();
  await p.getByLabel('班级名称', { exact: true }).fill('独立验收班级');
  await p.getByRole('button', { name: '创建', exact: true }).click();
  await expect(p.getByText('独立验收班级', { exact: true }).first()).toBeVisible();
  await p.reload();
  await expect(p.getByText('独立验收班级', { exact: true }).first()).toBeVisible();
  await p.getByRole('button', { name: '全局搜索', exact: true }).click();
  await p.getByRole('searchbox').fill('独立验收班级');
  const result = p.locator('.tb-search-results a').filter({ hasText: '独立验收班级' });
  try { await expect(result).toBeVisible({ timeout: 3000 }); } catch { /* Capture the exact missing-result symptom. */ }
  await shot(p, 'search-class');
  check(await result.isVisible(), 'RUI-03 persisted class is searchable');
  if (await result.isVisible()) {
    const destination = await result.getAttribute('href');
    await result.click();
    await expect(p).toHaveURL(world.origin + destination);
    await expect(p.getByRole('dialog', { name: '全局搜索' })).not.toBeVisible();
    await expect(p.getByRole('heading', { name: '独立验收班级', exact: true })).toBeVisible();
    await shot(p, 'search-class-open');
  } else await p.keyboard.press('Escape');
  await p.locator('.tb-module-nav a[href="/lessons"]').click();
  await p.getByRole('button', { name: '新建备课', exact: true }).click();
  await p.getByLabel('课题', { exact: true }).fill('独立验收备课');
  await p.getByRole('button', { name: '保存', exact: true }).click();
  await expect(p.locator('.wb-main').getByRole('status').first()).toContainText('已保存');
  await p.reload();
  await expect(p.getByLabel('课题', { exact: true })).toHaveValue('独立验收备课');
  await p.getByRole('button', { name: '全局搜索', exact: true }).click();
  await p.getByRole('searchbox').fill('独立验收备课');
  const lesson = p.locator('.tb-search-results a').filter({ hasText: '独立验收备课' });
  try { await expect(lesson).toBeVisible({ timeout: 3000 }); } catch { /* Preserve screenshot on baseline. */ }
  await shot(p, 'search-lesson');
  check(await lesson.isVisible(), 'RUI-03 persisted lesson is searchable');
  if (await lesson.isVisible()) {
    const destination = await lesson.getAttribute('href');
    await lesson.click();
    await expect(p).toHaveURL(world.origin + destination);
    await expect(p.getByRole('dialog', { name: '全局搜索' })).not.toBeVisible();
    await expect(p.getByLabel('课题', { exact: true })).toHaveValue('独立验收备课');
    await shot(p, 'search-lesson-open');
  } else await p.keyboard.press('Escape');
  if (!failures.length) {
    // Each open reloads real saved data; partial failure must retain usable results.
    await p.route('**/api/modules/lessons/v3?*', route => route.abort('failed'));
    await p.getByRole('button', { name: '全局搜索', exact: true }).click();
    await expect(p.locator('.tb-search-state[role="alert"]')).toContainText('备课读取失败');
    await p.getByRole('searchbox').fill('独立验收班级');
    await expect(result).toBeVisible();
    await shot(p, 'search-partial-error');
    await p.unroute('**/api/modules/lessons/v3?*');
    await p.getByRole('button', { name: '重试', exact: true }).click();
    await expect(p.locator('.tb-search-state')).toHaveCount(0);
    await p.getByRole('searchbox').fill('完全不存在的课题');
    await expect(p.getByText('没有匹配「完全不存在的课题」的结果')).toBeVisible();
    await p.keyboard.press('Escape');
    await p.setViewportSize({ width: 390, height: 844 });
    for (const [query, path] of [['独立验收班级', '/classes/'], ['独立验收备课', '/lessons/']]) {
      await p.getByRole('button', { name: '全局搜索', exact: true }).click();
      await p.getByRole('searchbox').fill(query);
      const target = p.locator('.tb-search-item').filter({ hasText: query });
      await expect(target).toBeVisible();
      const destination = await target.getAttribute('href');
      check(destination.startsWith(path), 'RUI-03 narrow detail destination');
      await shot(p, path.includes('classes') ? 'narrow-search-class' : 'narrow-search-lesson');
      await p.keyboard.press('ArrowDown');
      await p.keyboard.press('Enter');
      await expect(p).toHaveURL(world.origin + destination);
      await expect(p.getByRole('dialog', { name: '全局搜索' })).not.toBeVisible();
    }
    for (const route of ['questions', 'lessons', 'math', 'resources', 'classes']) {
      await p.getByRole('button', { name: '打开工作台导航' }).click();
      await p.locator(`.tb-module-nav .tb-module-row[href^="/${route}"]`).click();
      await expect(p.locator('.tb-sidebar')).not.toBeVisible();
      check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `RUI-01 narrow ${route} no overflow`);
    }
    await p.getByRole('button', { name: '打开工作台导航' }).click();
    await p.locator('.tb-mobile-nav a[href="/"]').click();
    await p.getByRole('button', { name: '梳理一节课的讲解顺序', exact: true }).click();
    await expect(p.getByRole('textbox', { name: 'AI 输入', exact: true })).toHaveValue('梳理一节课的讲解顺序');
    await expect(p.getByRole('textbox', { name: 'AI 输入', exact: true })).toBeFocused();
    const send = await p.locator('.wb-ai-actions button[type="submit"]').boundingBox();
    check(send.width === 29 && send.height === 29, 'RUI-02 live composer retains prototype square send button');
    await shot(p, 'narrow-home-input');
    await p.setViewportSize({ width: 1680, height: 910 });
    await p.locator('.tb-module-nav a[href^="/lessons"]').click();
    await p.locator('.tb-global-nav a[href="/"]').click();
    await expect(p.getByRole('textbox', { name: 'AI 输入', exact: true })).toHaveValue('梳理一节课的讲解顺序');
    check(true, 'RUI-02 suggestion creates real draft, focuses input and preserves it across navigation');
  }
  check(errors.length === 0, `No page errors: ${errors.join('; ')}`);
} catch (error) {
  failures.push(error.message); console.error(error); await shot(p, 'failure');
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ failures, metrics, requests }, null, 2));
  console.log('Isolated world', world.origin, world.directory);
  await browser.close(); await world.close();
  if (!failures.length) fs.rmSync(world.directory, { recursive: true, force: true });
}
if (failures.length) process.exitCode = 1;
