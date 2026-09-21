import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { evidencePaths } from './evidence-paths.mjs';
import { openWorkbench } from './session.mjs';
import { activate } from './pointer-input.mjs';

const paths = evidencePaths('sidebar-head');
const url = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?no-dev-chrome';
const viewports = { PC: { width: 1440, height: 900 }, 平板: { width: 768, height: 1024 }, 手机: { width: 390, height: 844 } };
const browser = await chromium.launch();
const checks = [];
const cases = [];
const test = (name, run) => cases.push({ name, run });
const expectVisible = async (page, selector) => assert.equal(await page.locator(selector).isVisible(), true, `${selector} must remain visible`);
const openList = async (page) => { await activate(page.locator('.tb-term-button')); };
const create = async (page) => { await openList(page); await activate(page.locator('.tb-semester-create')); };
const edit = async (page) => { await openList(page); await activate(page.locator('.tb-semester-edit').first()); };
const fields = async (page, name = '2027春季学期') => {
  await page.locator('#tb-semester-name').fill(name);
  await page.locator('#tb-semester-start').fill('2027-03-01');
  await page.locator('#tb-semester-end').fill('2027-07-01');
};
const chooseCopy = async (page) => {
  await activate(page.getByRole('button', { name: '从已有学期复制' }));
  await activate(page.locator('.tb-copy-source'));
  await activate(page.locator('.tb-copy-source-option').first());
  await activate(page.getByRole('checkbox', { name: '班级', exact: true }));
};

for (const key of ['Enter', 'Space']) test(`CW49 编辑按钮 ${key}`, async (page) => {
  const before = await page.locator('.tb-term-name').textContent();
  await openList(page);
  await page.locator('.tb-semester-edit').first().focus();
  await page.keyboard.press(key);
  await expectVisible(page, '.tb-dialog');
  assert.equal(await page.locator('.tb-term-name').textContent(), before);
  assert.equal(await page.locator('.tb-dialog-title').textContent(), '编辑学期');
});

test('CW49 更多 Escape 保留未提交表单并恢复焦点', async (page) => {
  await edit(page);
  await page.locator('#tb-semester-name').fill('尚未提交');
  await activate(page.locator('.tb-dialog-more'));
  await page.keyboard.press('Escape');
  await expectVisible(page, '.tb-dialog');
  assert.equal(await page.locator('.tb-dialog-more-menu').count(), 0);
  assert.equal(await page.locator('#tb-semester-name').inputValue(), '尚未提交');
  await expect(page.locator('.tb-dialog-more')).toBeFocused();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.tb-dialog').count(), 0);
  await expect(page.locator('.tb-term-button')).toBeFocused();
});

test('CW49 来源 Escape 保留表单并恢复焦点', async (page) => {
  await edit(page);
  await activate(page.locator('.tb-copy-source'));
  await page.keyboard.press('Escape');
  await expectVisible(page, '.tb-dialog');
  assert.equal(await page.locator('.tb-copy-source-menu').count(), 0);
  await expect(page.locator('.tb-copy-source')).toBeFocused();
});

for (const [label, trigger, menu, tabs] of [
  ['更多', '.tb-dialog-more', '.tb-dialog-more-menu', ['Tab']],
  ['来源', '.tb-copy-source', '.tb-copy-source-menu', ['Shift+Tab', 'Shift+Tab']]
]) test(`CW49 ${label}焦点移出后 Escape 仍只关闭子菜单`, async (page) => {
  await edit(page);
  await page.locator('#tb-semester-name').fill('焦点移出后保留草稿');
  await activate(page.locator(trigger));
  for (const key of tabs) await page.keyboard.press(key);
  assert.equal(await page.locator(menu).evaluate(el => el.parentElement.contains(document.activeElement)), false);
  await page.keyboard.press('Escape');
  await expect(page.locator(menu)).toHaveCount(0);
  await expect(page.locator('#tb-semester-name')).toHaveValue('焦点移出后保留草稿');
  await expect(page.locator(trigger)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tb-dialog')).toHaveCount(0);
});

test('CW49 对话框焦点进入、循环与取消', async (page) => {
  await create(page);
  await expect.poll(() => page.locator('.tb-dialog').evaluate(el => el.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.tb-dialog').evaluate(el => el.contains(document.activeElement)), true);
  }
  await activate(page.locator('.tb-dialog-cancel'));
  await expect(page.locator('.tb-term-button')).toBeFocused();
});

test('CW48 菜单与搜索互斥', async (page) => {
  await activate(page.locator('.tb-language-row'));
  await page.keyboard.press('Control+k');
  await expectVisible(page, '.tb-search-panel');
  assert.equal(await page.locator('.tb-language-menu').count(), 0);
  assert.equal(await page.locator('.tb-search-input').evaluate(el => {
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
  }), true, 'Search must not be covered by the mobile drawer');
});

test('CW48 浏览器后退与前进关闭浮层', async (page) => {
  await activate(page.locator('.tb-account-row'));
  await page.waitForURL('**/settings*');
  if (page.viewportSize().width <= 700) await activate(page.locator('.tb-mobile-menu'));
  await activate(page.locator('.tb-language-row'));
  await page.goBack();
  assert.equal(new URL(page.url()).pathname, '/');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.tb-language-menu').count(), 0);
  if (page.viewportSize().width <= 700) await activate(page.locator('.tb-mobile-menu'));
  await openList(page);
  await page.goForward();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.tb-semester-popover').count(), 0);
});

test('CW50 从复制返回从头开始不复制', async (page) => {
  await create(page);
  await fields(page);
  await chooseCopy(page);
  await activate(page.getByRole('button', { name: '从头开始' }));
  await activate(page.locator('.tb-dialog-submit'));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[aria-live]').textContent(), '已创建 2027春季学期');
});

test('CW50 只选来源未选分类不报告复制', async (page) => {
  await create(page);
  await fields(page);
  await activate(page.getByRole('button', { name: '从已有学期复制' }));
  await activate(page.locator('.tb-copy-source'));
  await activate(page.locator('.tb-copy-source-option').first());
  await activate(page.locator('.tb-dialog-submit'));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[aria-live]').textContent(), '已创建 2027春季学期');
});

test('CW48 语言菜单宽度与全部资源', async (page) => {
  await activate(page.locator('.tb-language-row'));
  await page.waitForTimeout(200);
  const state = await page.locator('.tb-language-menu').evaluate(el => ({
    width: el.clientWidth, right: el.getBoundingClientRect().right, viewport: innerWidth,
    images: [...el.querySelectorAll('img')].map(img => ({ complete: img.complete, width: img.naturalWidth }))
  }));
  assert.ok(state.width >= 200 && state.right <= state.viewport, JSON.stringify(state));
  assert.equal(state.images.length, 20);
  assert.ok(state.images.every(img => img.complete && img.width > 0), 'Every flag must load in dev and build');
});

test('CW51 复制区与字段可访问且不横向溢出', async (page) => {
  await create(page);
  await chooseCopy(page);
  await page.locator('.tb-copy-item').last().scrollIntoViewIfNeeded();
  const boxes = await page.evaluate(() => ['.tb-dialog', '.tb-dialog-preview', '.tb-copy-list'].map(selector => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    return { selector, width: r.width, left: r.left, right: r.right, scroll: el.scrollWidth, client: el.clientWidth, viewport: innerWidth };
  }));
  for (const box of boxes) assert.ok(box.width > 200 && box.left >= 0 && box.right <= box.viewport && box.scroll <= box.client + 1, JSON.stringify(box));
});

test('CW49 减弱动效直接落终态', async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await activate(page.locator('.tb-language-row'));
  assert.equal(await page.locator('.tb-language-menu').evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.keyboard.press('Escape');
  await create(page);
  assert.equal(await page.locator('.tb-dialog').evaluate(el => getComputedStyle(el).animationName), 'none');
});

try {
  for (const [viewport, dimensions] of Object.entries(viewports)) {
    for (const { name, run } of cases) {
      const context = await browser.newContext({ viewport: dimensions, hasTouch: viewport === '手机' });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      try {
        await openWorkbench(page, url, { dismissCoach: true });
        if (viewport === '手机') await activate(page.locator('.tb-mobile-menu'));
        await run(page);
        assert.deepEqual(errors, []);
        checks.push({ name, viewport, dimensions, input: viewport === '手机' ? 'touch + keyboard' : 'mouse + keyboard', pass: true });
        console.log(`PASS ${viewport} ${name}`);
      } catch (error) {
        checks.push({ name, viewport, dimensions, pass: false, error: error.message, console: errors });
        console.log(`FAIL ${viewport} ${name}: ${error.message.split('\n')[0]}`);
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }
const pass = checks.length === cases.length * Object.keys(viewports).length && checks.every(check => check.pass);
writeFileSync(`${paths.results}/sidebar-head${pass ? '' : '-failed'}.json`, JSON.stringify({ pass, checks }, null, 2));
if (!pass) process.exitCode = 1;
