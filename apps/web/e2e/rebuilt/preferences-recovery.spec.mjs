import { test, expect, register } from './fixture.mjs';

for (const recoveryButton of ['重新读取', '重试保存']) {
  test(`偏好丢响应和刷新读取失败后通过${recoveryButton}接续原请求，保留新选择`, async ({ page, world }, info) => {
    await register(page, world);
    await page.getByRole('link', { name: /^账户：/ }).click();
    await expect(page.getByRole('button', { name: '深色', exact: true })).toBeEnabled();
    let failReads = false, dropped = false;
    let faultDone;
    const injected = new Promise(resolve => { faultDone = resolve; });
    const writes = [];
    let reads = 0;
    await page.route('**/api/reliability/v1/preferences', async route => {
      const request = route.request();
      if (request.method() === 'PUT') {
        writes.push({ key: request.headers()['idempotency-key'], body: request.postData() });
        if (!dropped) {
          dropped = true;
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          await route.abort('connectionreset');
          faultDone(); return;
        }
      } else {
        reads++;
        if (failReads) {
          await route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: '/problems/workbench/temporarily-unavailable', status: 503 }) });
          return;
        }
      }
      await route.continue();
    });
    await page.getByRole('button', { name: '深色', exact: true }).click();
    await injected;
    await expect(page.getByRole('button', { name: '重试保存', exact: true })).toBeVisible();
    failReads = true;
    await page.reload();
    await expect(page.getByRole('button', { name: '重新读取', exact: true })).toBeVisible();
    // This choice belongs to a later save, while the original dark request is pending.
    await page.getByRole('button', { name: '浅色', exact: true }).click();
    const before = reads;
    failReads = false;
    await page.getByRole('button', { name: recoveryButton, exact: true }).click();
    if (recoveryButton === '重新读取') {
      await expect(page.getByRole('button', { name: '确认上次保存', exact: true })).toBeVisible();
      expect(writes).toHaveLength(1);
      await expect(page.getByRole('button', { name: '浅色', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: '确认上次保存', exact: true }).click();
    }
    await expect(page.locator('.settings-save-status')).toHaveText('已保存');
    expect(reads).toBeGreaterThan(before);
    expect(writes).toHaveLength(3);
    expect(writes[1]).toEqual(writes[0]);
    expect(writes[2].key).not.toBe(writes[0].key);
    expect(JSON.parse(writes[1].body).values.theme).toBe('dark');
    expect(JSON.parse(writes[2].body).values.theme).toBe('light');
    await expect(page.getByRole('button', { name: '重新读取', exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('preferences-recovered.png'), fullPage: true, animations: 'disabled' });
    await page.reload();
    await expect(page.getByRole('button', { name: '浅色', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.settings-save-status')).toHaveText('已保存');
  });
}
