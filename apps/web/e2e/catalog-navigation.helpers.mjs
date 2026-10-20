import { expect } from '@playwright/test';

export const moduleRow = (page, id) => page.locator(`.tbx-side-nav [data-row="${id}"]`);
export const navigationGroup = (page, name) => page.locator('.tbx-side-nav [data-group]').filter({ has: page.locator('.tbx-group-name', { hasText: new RegExp(`^${name}$`) }) });

export async function pointerDrag(page, source, target, { top = false } = {}) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  expect(from).toBeTruthy(); expect(to).toBeTruthy();
  const x = from.x + Math.min(30, from.width / 2);
  const y = from.y + from.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 8, y, { steps: 3 });
  await page.mouse.move(to.x + Math.min(50, to.width / 2), top ? to.y + 2 : to.y + to.height / 2, { steps: 16 });
  await page.mouse.up();
}
export async function addNavigationGroup(page, name) {
  await page.getByRole('button', { name: '新建分组', exact: true }).click();
  await page.getByRole('textbox', { name: '新分组名称', exact: true }).fill(name);
  await page.getByRole('textbox', { name: '新分组名称', exact: true }).press('Enter');
  await expect(navigationGroup(page, name)).toBeVisible();
}
export async function toggleAssistant(page) {
  await page.locator('.tbx-panel-toggle').click();
}
