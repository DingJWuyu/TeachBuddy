import { test, expect, register, navigate } from './fixture.mjs';

test.use({ timezoneId: 'America/Phoenix' });

test('D15 真实网格拖动保存后新设备读回，系统时区检测保留当地钟点', async ({ page, context, world }, info) => {
  await register(page, world);
  await navigate(page, '/calendar');
  await page.getByRole('button', { name: '新建待安排任务', exact: true }).click();
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('跨时区拖动安排');
  await page.getByRole('textbox', { name: '标题', exact: true }).press('Enter');
  await expect(page.locator('.tbx-sheet-status')).toHaveText('自动保存');
  await page.getByRole('button', { name: '放进日历，变成任务', exact: true }).click();
  await page.getByRole('button', { name: '开始时间', exact: true }).click();
  const atNine = page.waitForResponse(async response => response.ok() && response.request().method() === 'PUT'
    && response.url().includes('/api/modules/schedule/entries/') && (await response.json()).time?.startTime === '09:00');
  await page.getByRole('listbox', { name: '时', exact: true }).getByRole('option', { name: '09', exact: true }).click();
  await page.getByRole('listbox', { name: '分', exact: true }).getByRole('option', { name: '00', exact: true }).click();
  const before = await (await atNine).json();
  await page.locator('.tbx-sheet').getByRole('button', { name: '完成', exact: true }).click();
  const card = page.locator('.fc-timegrid-event').filter({ hasText: '跨时区拖动安排' }).first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  const box = await card.boundingBox();
  const column = await page.locator('.fc-timegrid-col[data-date]').first().boundingBox();
  const moved = page.waitForResponse(response => response.ok() && response.request().method() === 'PUT' && response.url().includes('/api/modules/schedule/entries/'));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + column.width, box.y + box.height / 2, { steps: 14 });
  await page.mouse.up();
  const saved = await (await moved).json();
  const nextDay = new Date(before.time.date + 'T12:00:00Z'); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  await info.attach('schedule-horizontal-result', { body: JSON.stringify({ before: before.time, saved: saved.time, box, column }), contentType: 'application/json' });
  expect(saved.time.date).toBe(nextDay.toISOString().slice(0, 10));
  expect(saved.time.startTime).toBe('09:00');

  const hourHeight = await page.locator('.fc-timegrid-slot-lane[data-time="10:00:00"]').evaluate(node => node.getBoundingClientRect().top)
    - await page.locator('.fc-timegrid-slot-lane[data-time="09:00:00"]').evaluate(node => node.getBoundingClientRect().top);
  expect(hourHeight).toBeCloseTo(104, 0);
  const verticalBox = await card.boundingBox();
  const vertical = page.waitForResponse(response => response.ok() && response.request().method() === 'PUT' && response.url().includes('/api/modules/schedule/entries/'));
  await page.mouse.move(verticalBox.x + verticalBox.width / 2, verticalBox.y + verticalBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(verticalBox.x + verticalBox.width / 2, verticalBox.y + verticalBox.height / 2 + hourHeight / 2, { steps: 14 });
  await page.mouse.up();
  const shifted = await (await vertical).json();
  expect(shifted.time.startTime).toBe('09:30');
  expect(shifted.time.durationMinutes).toBe(60);
  await card.hover();
  const handle = await card.locator('.fc-event-resizer-end').boundingBox();
  const resized = page.waitForResponse(response => response.ok() && response.request().method() === 'PUT' && response.url().includes('/api/modules/schedule/entries/'));
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + hourHeight / 4, { steps: 14 });
  await page.mouse.up();
  const finalEntry = await (await resized).json();
  expect(finalEntry.time.startTime).toBe('09:30');
  expect(finalEntry.time.durationMinutes).toBe(75);
  await page.screenshot({ path: info.outputPath('schedule-five-minute-hits.png') });
  const device = await context.browser().newContext({ ignoreHTTPSErrors: true, timezoneId: undefined,
    viewport: { width: 1440, height: 900 }, storageState: { cookies: await context.cookies(), origins: [] } });
  try {
    const fresh = await device.newPage();
    const cdp = await device.newCDPSession(fresh);
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Phoenix' });
    await fresh.goto(world.origin + '/calendar');
    await expect(fresh.locator('.wb-shell')).toBeVisible();
    await fresh.getByRole('button', { name: '知道了', exact: true }).click();
    await fresh.getByText('跨时区拖动安排', { exact: true }).filter({ visible: true }).first().click();
    await expect(fresh.getByRole('button', { name: '开始时间', exact: true })).toHaveText('09:30');
    await expect(fresh.getByRole('button', { name: '结束时间', exact: true })).toHaveText('10:45');
    const dateText = `${Number(saved.time.date.slice(5, 7))}月${Number(saved.time.date.slice(8))}日`;
    await expect(fresh.getByRole('button', { name: '开始日期', exact: true })).toContainText(dateText);
    await page.bringToFront();
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: '' });
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Shanghai' });
    const migrated = fresh.waitForResponse(response => response.ok() && response.request().method() === 'PUT' && new URL(response.url()).pathname === '/api/modules/schedule/settings');
    await fresh.bringToFront();
    await migrated;
    await expect(fresh.locator('.cal-time-zone')).toContainText('Asia/Shanghai');
    await expect(fresh.getByRole('button', { name: '开始时间', exact: true })).toHaveText('09:30');
    await expect(fresh.getByRole('button', { name: '结束时间', exact: true })).toHaveText('10:45');
    await expect(fresh.getByRole('button', { name: '开始日期', exact: true })).toContainText(dateText);
  } finally { await device.close(); }
});
