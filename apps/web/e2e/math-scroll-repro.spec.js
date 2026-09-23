import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createIntegration } from '../../api/test/fixtures/auth-integration/harness.js';
import { register, save } from './fixtures/math-scroll/helpers.mjs';

// Same user path as M44-LOCAL-001, with this task's own database and artifacts.
test('ordinary wheel: math tools must expose dynamic steps', async ({ page, context }) => {
  const out = path.join(process.env.M43_SCROLL_EVIDENCE || 'docs/acceptance/evidence/M43/v1/scroll-fix/green', 'minimal');
  fs.mkdirSync(out, { recursive: true });
  const world = await createIntegration();
  try {
    await register(page, world, 'm44-scroll@example.test');
    await page.getByRole('button', { name: '新建演示', exact: true }).first().click();
    await page.getByRole('button', {name:'作品与工具',exact:true}).click();
    await page.getByRole('button', {name:'二次函数起点',exact:true}).click();
    await page.getByLabel('作品名称').fill('M44 滚动可达性');
    await save(page);
    const measure = () => page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      regions: [...document.querySelectorAll('.wb-aux,.wb-aux-body,.math-tools-panel')].map(e => ({
        className: e.className,
        clientHeight: e.clientHeight,
        scrollHeight: e.scrollHeight,
        scrollTop: e.scrollTop,
        overflowY: getComputedStyle(e).overflowY,
        rect: e.getBoundingClientRect().toJSON(),
      })),
      steps: [...document.querySelectorAll('summary')]
        .filter(e => e.textContent === '步骤')
        .map(e => e.getBoundingClientRect().toJSON()),
    }));
    const before = await measure();
    await page.mouse.move(1340, 700);
    await page.mouse.wheel(0, 2600);
    await page.screenshot({ path: path.join(out, 'after-wheel.png') });
    const after = await measure();
    let clickError = null;
    try {
      await page.getByText('步骤', { exact: true }).click({ timeout: 2500 });
    } catch (error) {
      clickError = error.message;
    }
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({
      origin: world.origin, directory: world.directory, before, after, clickError,
    }, null, 2));
    await page.screenshot({ path: path.join(out, 'steps-click.png') });
    expect(clickError, 'ordinary step click must be reachable').toBeNull();
  } finally {
    await context.close();
    await world.close();
  }
});
