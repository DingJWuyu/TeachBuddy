import { expect, test } from '@playwright/test';
import { accountFor, registerTeacher } from './helpers.js';

const API_BASE = 'http://127.0.0.1:4100/api';

async function apiCall(page, requestPath, options = {}) {
  return page.evaluate(async ({ apiBase, path, method, body }) => {
    const response = await fetch(apiBase + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return {
      status: response.status,
      body: await response.json()
    };
  }, {
    apiBase: API_BASE,
    path: requestPath,
    method: options.method || 'GET',
    body: options.body
  });
}

test('a teacher can enter an empty home, open settings, and persist layout data', async ({ page }, testInfo) => {
  await registerTeacher(page, accountFor('empty-workspace', testInfo, 'empty workspace password'));

  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('.workspace-home')).toBeVisible();
  await expect(page.getByText('暂无模块')).toHaveCount(0);
  await expect(page.getByText('选择下一步')).toHaveCount(0);

  // The old bearer module directory endpoint is retired (`GET /api/modules` is
  // the same-origin workbench catalog now), so this shell reads no server module
  // list; the layout contract below is what it still owns.
  const layout = {
    hiddenModuleIds: [],
    groups: [{ id: 'daily', name: '日常', moduleIds: [] }],
    ungroupedModuleIds: []
  };
  const savedLayout = await apiCall(page, '/workspace/layout', { method: 'PUT', body: layout });
  expect(savedLayout).toEqual({ status: 200, body: layout });

  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '工作台设置' })).toBeVisible();
  await page.getByRole('button', { name: '工作台首页' }).click();
  await expect(page.locator('.workspace-home')).toBeVisible();
});
