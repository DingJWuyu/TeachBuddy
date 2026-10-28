import { test, expect, register, navigate, onNewDevice } from './fixture.mjs';

// Observe the actual local engine without replacing commands, listeners or results.
async function observeEngine(page) {
  const install = () => {
    let Constructor;
    Object.defineProperty(window, 'GGBApplet', {
      configurable: true, get: () => Constructor,
      set: Value => {
        Constructor = class extends Value {
          constructor(options, ...rest) {
            const loaded = options.appletOnLoad;
            super({ ...options, appletOnLoad(api) { window.rebuiltEngine = api; loaded?.(api); } }, ...rest);
          }
        };
      },
    });
  };
  await page.addInitScript(install);
  await page.evaluate(install);
}

test('B-R1 统一制作加入公式与点，真实画布拖动后自动保存并刷新读回实际坐标', async ({ page, world }, info) => {
  test.setTimeout(120_000);
  await observeEngine(page);
  await register(page, world);
  await navigate(page, '/math');
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByRole('textbox', { name: '作品名', exact: true }).fill('真实制作与手动保存');
  await page.getByRole('button', { name: /写公式/ }).click();
  const formula = page.locator('math-field');
  await formula.pressSequentially('x+1');
  await page.getByRole('button', { name: '加入作品', exact: true }).click();
  await page.locator('.mw-formula-edit math-field').press('Enter');
  await expect(page.getByRole('button', { name: '编辑公式 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '添加图形', exact: true }).click();
  const expression = page.getByRole('textbox', { name: '图形表达式', exact: true });
  await expression.fill('A=(1,2)');
  await expression.press('Enter');
  await expect.poll(() => page.evaluate(() => window.rebuiltEngine?.getXcoord('A')), { timeout: 90_000 }).toBe(1);
  await expect(page.locator('.mw-save-state')).toHaveText('已保存', { timeout: 60_000 });
  await page.getByRole('button', { name: '收起算式', exact: true }).click();
  await expect(page.locator('.mw-expression-disclosure')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const host = document.querySelector('.mw-graph-host');
    const view = JSON.parse(window.rebuiltEngine.getViewProperties(1));
    return !host.firstElementChild.inert && Math.abs(view.height - host.clientHeight) < 2;
  })).toBe(true);
  const view = await page.evaluate(() => JSON.parse(window.rebuiltEngine.getViewProperties(1)));
  const box = await page.locator('.mw-graph-host').boundingBox();
  const px = view.left + (1 - view.xMin) / view.invXscale;
  const py = view.top + view.height - (2 - view.yMin) / view.invYscale;
  await info.attach('view-before-drag', { body: JSON.stringify({ view, box }), contentType: 'application/json' });
  let point;
  await Promise.all([
    page.waitForResponse(response => response.ok() && response.request().method() === 'PUT' && response.url().includes('/api/modules/math/v1/works/')),
    (async () => {
      await page.mouse.move(px, py);
      await page.mouse.down();
      await page.mouse.move(px + 70, py - 35, { steps: 12 });
      await page.mouse.up();
      await expect.poll(() => page.evaluate(() => window.rebuiltEngine.getXcoord('A'))).not.toBe(1);
      point = await page.evaluate(() => [window.rebuiltEngine.getXcoord('A'), window.rebuiltEngine.getYcoord('A')]);
    })(),
  ]);
  await expect(page.locator('.mw-save-state')).toHaveText('已保存', { timeout: 60_000 });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.rebuiltEngine?.exists('A')), { timeout: 90_000 }).toBe(true);
  const restored = await page.evaluate(() => [window.rebuiltEngine.getXcoord('A'), window.rebuiltEngine.getYcoord('A')]);
  expect(restored[0]).toBeCloseTo(point[0], 5);
  expect(restored[1]).toBeCloseTo(point[1], 5);
  await expect(page.getByRole('button', { name: '编辑公式 1', exact: true })).toBeVisible();
  await onNewDevice(page, world, async fresh => {
    await observeEngine(fresh);
    await navigate(fresh, '/math');
    await fresh.getByText('真实制作与手动保存', { exact: true }).first().click();
    await expect.poll(() => fresh.evaluate(() => window.rebuiltEngine?.exists('A')), { timeout: 90_000 }).toBe(true);
    const saved = await fresh.evaluate(() => [window.rebuiltEngine.getXcoord('A'), window.rebuiltEngine.getYcoord('A')]);
    expect(saved[0], '新设备必须读到实际手动修改后保存的坐标').toBeCloseTo(point[0], 5);
    expect(saved[1]).toBeCloseTo(point[1], 5);
    await expect(fresh.getByRole('button', { name: '编辑公式 1', exact: true })).toBeVisible();
  });
});
