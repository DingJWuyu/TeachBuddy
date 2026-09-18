import { expect, test } from '@playwright/test';
import { accountFor, registerTeacher } from './helpers.js';

const API_BASE = 'http://127.0.0.1:4100/api';

async function apiCall(page, requestPath) {
  return page.evaluate(async ({ apiBase, path }) => {
    const token = window.localStorage.getItem('refatos-token') || '';
    const response = await fetch(apiBase + path, {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    });
    return {
      status: response.status,
      body: await response.json()
    };
  }, { apiBase: API_BASE, path: requestPath });
}

test('an authenticated teacher sees an empty module directory and stable core navigation', async ({ page }, testInfo) => {
  await registerTeacher(page, accountFor('empty-module-directory', testInfo, 'empty directory password'));

  const modulesResponse = await apiCall(page, '/modules');
  expect(modulesResponse.status).toBe(200);
  expect(modulesResponse.body).toEqual({ items: [] });
  await expect(page.locator('aside').getByRole('button', { name: '工作台首页', exact: true })).toBeVisible();
  await expect(page.locator('aside').getByRole('button', { name: '设置', exact: true })).toBeVisible();
  await expect(page.locator('[data-layout-module]')).toHaveCount(0);
  await expect(page.getByText('暂无模块')).toHaveCount(0);
  await expect(page.getByText('选择下一步')).toHaveCount(0);
});
