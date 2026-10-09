import { expect } from '@playwright/test';
export async function installMathProbe(page) {
  await page.addInitScript(() => {
    let Constructor; Object.defineProperty(window, 'GGBApplet', { configurable: true, get: () => Constructor, set: Value => { Constructor = class extends Value { constructor(parameters, ...rest) { super({ ...parameters, appletOnLoad: api => { (window.mathTestApis ??= {})[parameters.id] = api; window.mathTestApi = api; parameters.appletOnLoad?.(api); } }, ...rest); } }; } });
  });
}
export async function deviceMath(page) {
  return page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.endsWith(':math-workspace')).map(([, value]) => JSON.parse(value)).find(value => value.draft?.source.kind === 'workshop'));
}
export async function currentApi(page, expression) {
  return page.evaluate(expression => {
    const host = document.querySelector('.mw-graph-host > div');
    const api = window.mathTestApis?.[host?.id] ?? window.mathTestApi;
    if (typeof api?.exists !== 'function') return null;
    try {
    if (!expression) return { names: api.getAllObjectNames(), types: api.getAllObjectNames().map(name => [name, api.getObjectType(name)]) };
    const exists = api.exists(expression); const type = exists ? api.getObjectType(expression) : '';
    return { exists, coords: type === 'point' ? [api.getXcoord(expression), api.getYcoord(expression)] : null, value: ['numeric', 'angle'].includes(type) ? api.getValue(expression) : null };
    } catch { return null; }
  }, expression);
}
export async function enterMath(page, definition, object) {
  const field = page.getByLabel('图形表达式', { exact: true }); await field.click(); await field.fill(definition); await field.press('Enter');
  await expect.poll(async () => (await currentApi(page, object))?.exists, { timeout: 90000 }).toBe(true);
}
export async function savedMath(page) {
  await expect(page.locator('.mw-save-state')).toHaveText('已保存', { timeout: 60000 });
  return (await deviceMath(page)).draft;
}
export async function forceMathSave(page) {
  await page.getByLabel('更多作品操作', { exact: true }).click();
  await page.getByRole('button', { name: '立即保存', exact: true }).click();
}
