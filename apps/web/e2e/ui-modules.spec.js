import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { registerMath } from './fixtures/math-static/real.mjs';

let world;
test.afterEach(async ({ context }) => { await context.close(); await world?.close(); });
test.beforeEach(async ({ page }) => {
  world = await createIntegration();
  await registerMath(world, 'ui-modules@example.test');
  await page.goto(world.origin);
  await page.getByLabel('邮箱', { exact: true }).fill('ui-modules@example.test');
  await page.getByLabel('密码', { exact: true }).fill('math-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.wb-shell')).toBeVisible();
  const welcome = page.getByRole('button', { name: '知道了', exact: true });
  if (await welcome.isVisible()) await welcome.click();
});

async function openLesson(page) {
  await page.getByRole('complementary', { name: '工作台导航' }).locator('a[href="/lessons"]').click();
  await page.getByRole('button', { name: '新建备课', exact: true }).click();
  await page.getByLabel('课题', { exact: true }).fill('函数的单调性');
}

test('紧凑文稿编辑保留结构、键盘菜单与保存刷新', async ({ page }) => {
  await openLesson(page);
  await page.getByRole('button', { name: '段落', exact: true }).click();
  await page.getByLabel('开头文稿段落 1', { exact: true }).fill('观察图像，理解增减与区间的关系。');
  await page.getByRole('button', { name: '更多内容', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '标题', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: '列表', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: '教师注记', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await page.getByLabel('开头文稿标题 1', { exact: true }).fill('先观察，再表达');
  await page.getByRole('button', { name: '添加环节', exact: true }).click();
  await page.getByLabel('环节名称 1', { exact: true }).fill('探究图像的变化');
  await page.locator('[data-section-id]').getByRole('button', { name: '段落', exact: true }).click();
  await page.getByLabel('环节文稿 1段落 1', { exact: true }).fill('选择两个自变量，比较函数值。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).not.toHaveURL(/\/new$/);
  await expect(page.locator('.wb-save-status')).toContainText('已保存');
  await page.reload();
  await expect(page.getByLabel('课题', { exact: true })).toHaveValue('函数的单调性');
  await expect(page.getByLabel('开头文稿标题 1', { exact: true })).toHaveValue('先观察，再表达');
  await expect(page.getByLabel('环节文稿 1段落 1', { exact: true })).toHaveValue('选择两个自变量，比较函数值。');
  await page.getByRole('button', { name: '输出', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存并生成', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回文稿', exact: true }).click();
  await expect(page.getByLabel('开头文稿标题 1', { exact: true })).toHaveValue('先观察，再表达');
  await page.setViewportSize({ width: 1024, height: 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function armMotion(page, event, selector) {
  await page.evaluate(({ event, selector }) => {
    window.moduleMotion = { samples: [], done: false };
    document.addEventListener(event, () => {
      const started = performance.now();
      const sample = () => {
        const element = document.querySelector(selector);
        window.moduleMotion.samples.push(element ? Number(getComputedStyle(element).opacity) : null);
        if (performance.now() - started < 320) requestAnimationFrame(sample);
        else window.moduleMotion.done = true;
      };
      requestAnimationFrame(sample);
    }, { once: true, capture: true });
  }, { event, selector });
}
async function motionSamples(page) {
  await page.waitForFunction(() => window.moduleMotion.done);
  return page.evaluate(() => window.moduleMotion.samples);
}

test('模块菜单进入、退出和快速反向连续，退出后恢复键盘焦点', async ({ page }) => {
  await openLesson(page);
  const trigger = page.getByRole('button', { name: '更多内容', exact: true });
  const menu = page.getByRole('menu', { name: '更多内容', exact: true });
  await armMotion(page, 'pointerdown', '.wb-module-popover [role="menu"]');
  await trigger.click();
  const entered = await motionSamples(page);
  expect(entered.some(value => value !== null && value > 0 && value < 1)).toBe(true);
  expect(entered.at(-1)).toBe(1);
  await armMotion(page, 'keydown', '.wb-module-popover [role="menu"]');
  await page.keyboard.press('Escape');
  const exited = await motionSamples(page);
  expect(exited.some(value => value !== null && value > 0 && value < 1)).toBe(true);
  expect(exited.at(-1)).toBe(null);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('班级低频操作菜单可改名并保留教学记录', async ({ page }) => {
  await page.getByRole('complementary', { name: '工作台导航' }).locator('a[href="/classes"]').click();
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByLabel('班级名称', { exact: true }).fill('高一一班');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await page.getByLabel('写一句', { exact: true }).fill('例题二尚需巩固。');
  await page.locator('[data-region="record-composer"]').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('例题二尚需巩固。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '班级操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '重命名', exact: true }).click();
  await page.getByLabel('班级名称', { exact: true }).fill('高一实验班');
  await page.locator('[name="save-class-name"]').click();
  await expect(page.getByRole('heading', { name: '高一实验班', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('例题二尚需巩固。', { exact: true })).toBeVisible();
});

test('减少动效与视口切换不会留下不可操作的模块菜单', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLesson(page);
  const trigger = page.getByRole('button', { name: '更多内容', exact: true });
  const menu = page.getByRole('menu', { name: '更多内容', exact: true });
  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await trigger.click();
  await expect(menu).toBeVisible();
  await page.setViewportSize({ width: 900, height: 800 });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toHaveCount(0);
});
