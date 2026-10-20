import { expect } from '@playwright/test';

// Operate the same date/time pickers used by teachers, without changing React state.
export async function setScheduleField(page, label, value, { keyboard = false } = {}) {
  const pick = async locator => { if (keyboard) { await locator.focus(); await locator.press('Enter'); } else await locator.click(); };
  await page.locator('.tbx-sheet').getByRole('button', { name: label, exact: true }).click();
  const popover = page.locator('.tbx-popover:not([inert])').last();
  if (label.includes('时间')) {
    const [hour, minute] = value.split(':');
    await pick(popover.getByRole('listbox', { name: '时', exact: true }).getByRole('option', { name: hour, exact: true }));
    await pick(popover.getByRole('listbox', { name: '分', exact: true }).getByRole('option', { name: minute, exact: true }));
    return;
  }
  const [year, month] = value.split('-').map(Number);
  await popover.getByRole('button', { name: '选择年月', exact: true }).click();
  await popover.getByRole('button', { name: '选择年份', exact: true }).click();
  const targetYear = popover.getByRole('button', { name: String(year), exact: true });
  while (!await targetYear.count()) {
    const firstYear = Number(await popover.locator('.tbx-datepicker-cells button').first().textContent());
    await popover.getByRole('button', { name: year < firstYear ? '上一页' : '下一页', exact: true }).click();
  }
  await targetYear.click();
  await popover.getByRole('button', { name: `${month}月`, exact: true }).click();
  await pick(popover.getByRole('button', { name: value, exact: true }));
}

export async function expectScheduleField(page, label, value) {
  const field = page.locator('.tbx-sheet').getByRole('button', { name: label, exact: true });
  if (label.includes('时间')) await expect(field).toHaveText(value);
  else await expect(field).toContainText(`${Number(value.slice(5, 7))}月${Number(value.slice(8))}日`);
}

export async function openRepeat(page) {
  await page.locator('.tbx-sheet').getByRole('button', { name: /^重复/ }).click();
  await page.getByRole('menuitem', { name: '自定义…', exact: true }).click();
}

export async function scheduleAction(page, name) {
  const editor = page.locator('.tbx-sheet');
  if (name === '设置提醒') return editor.getByRole('button', { name: /^提醒/ }).click();
  if (name === '全天') return editor.getByRole('switch', { name: '全天', exact: true }).click();
  if (name === '重复') return openRepeat(page);
  if (name === '删除任务') return editor.getByRole('button', { name: '删除', exact: true }).click();
  throw new Error(`Unsupported schedule action: ${name}`);
}
