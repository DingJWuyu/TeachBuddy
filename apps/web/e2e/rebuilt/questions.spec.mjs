import { test, expect, register, navigate, createQuestion, onNewDevice } from './fixture.mjs';

test('题目改编独立保存，跨模块保留编辑草稿，刷新仍可找到原题和副本', async ({ page, world }) => {
  await register(page, world);
  await createQuestion(page, '二次函数原题', '求函数 y=x² 的最小值。');
  await page.getByRole('button', { name: '复制改编', exact: true }).click();
  await page.getByRole('textbox', { name: '题目标题', exact: true }).fill('二次函数改编');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('求函数 y=x²+3 的最小值。');
  await navigate(page, '/resources');
  await navigate(page, '/questions');
  await expect(page.getByRole('textbox', { name: '题目标题', exact: true })).toHaveValue('二次函数改编');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '二次函数改编', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '二次函数改编', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: '题干', exact: true })).toContainText('y=x²+3');
  await onNewDevice(page, world, async fresh => {
    await navigate(fresh, '/questions');
    await fresh.locator('.q-list').getByText('二次函数改编', { exact: true }).click();
    await expect(fresh.getByRole('article', { name: '题干', exact: true })).toContainText('y=x²+3');
  });
  await page.getByRole('button', { name: '查看原题', exact: true }).click();
  await expect(page.getByRole('heading', { name: '二次函数原题', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: '题干', exact: true })).toHaveText('求函数 y=x² 的最小值。');
});

test('B-R2 创建未知期间继续输入，原键核实不覆盖新稿且新设备读回唯一题目', async ({ page, world }) => {
  await register(page, world);
  await navigate(page, '/questions');
  await page.getByRole('button', { name: '新建题目', exact: true }).first().click();
  await page.getByRole('textbox', { name: '题目标题', exact: true }).fill('结果待确认的题');
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('计算 7+8。');
  const writes = [];
  let committed, releaseResponse;
  const submitted = new Promise(resolve => { committed = resolve; });
  const responseGate = new Promise(resolve => { releaseResponse = resolve; });
  await page.route('**/api/**', async route => {
    const request = route.request();
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/modules/questions/v2/items') {
      writes.push({ key: request.headers()['idempotency-key'], body: request.postData() });
      if (writes.length === 1) { await route.fetch(); committed(); await responseGate; await route.abort('connectionreset'); return; }
    }
    await route.continue();
  });
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await submitted;
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('计算 7+8，并解释你的计算方法。');
  releaseResponse();
  await expect(page.getByRole('button', { name: '确认上次请求', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('计算 7+8，并解释你的计算方法。');
  await page.getByRole('button', { name: '确认上次请求', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('计算 7+8，并解释你的计算方法。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('heading', { name: '结果待确认的题', exact: true })).toBeVisible();
  expect(writes.length).toBeGreaterThanOrEqual(2);
  expect(writes[1]).toEqual(writes[0]);
  await page.reload();
  await expect(page.locator('.q-list').getByText('结果待确认的题', { exact: true })).toHaveCount(1);
  await onNewDevice(page, world, async fresh => {
    await navigate(fresh, '/questions');
    await fresh.locator('.q-list').getByText('结果待确认的题', { exact: true }).click();
    await expect(fresh.getByRole('article', { name: '题干', exact: true })).toHaveText('计算 7+8，并解释你的计算方法。');
  });
});

test('不同页面修改形成真实冲突，保留草稿并由老师明确采用服务器版本', async ({ page, context, world }, info) => {
  await register(page, world);
  await createQuestion(page, '冲突题', '原始内容。');
  const other = await context.newPage();
  await other.goto(world.origin + '/questions');
  await other.locator('.q-list').getByText('冲突题', { exact: true }).click();
  await page.getByRole('button', { name: '编辑题目', exact: true }).click();
  await page.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('本页尚未保存的内容。');
  await other.getByRole('button', { name: '编辑题目', exact: true }).click();
  await other.getByRole('textbox', { name: '题干段落 1', exact: true }).fill('另一页已保存的内容。');
  await other.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(other.getByRole('article', { name: '题干', exact: true })).toHaveText('另一页已保存的内容。');
  await page.getByRole('button', { name: '保存题目', exact: true }).click();
  await expect(page.getByRole('region', { name: '版本冲突对照', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('本页尚未保存的内容。');
  const draftVersions = await page.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.includes('questions-materials-draft:question:'))
    .map(([key, value]) => ({ key, version: (JSON.parse(value).value ?? JSON.parse(value)).version })));
  const reread = page.waitForResponse(response => response.request().method() === 'GET'
    && /\/api\/modules\/questions\/v2\/items\/[0-9a-f-]{36}$/.test(new URL(response.url()).pathname));
  await page.reload();
  const serverVersion = (await (await reread).json()).version;
  await info.attach('conflict-versions', { body: JSON.stringify({ draftVersions, serverVersion }), contentType: 'application/json' });
  await expect(page.getByRole('region', { name: '版本冲突对照', exact: true }), '刷新后仍须显示未解决冲突对照').toBeVisible();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('本页尚未保存的内容。');
  await page.getByRole('button', { name: '采用服务器版本', exact: true }).click();
  const confirmation = page.getByRole('dialog');
  if (await confirmation.isVisible()) await confirmation.getByRole('button', { name: /确认|采用/ }).click();
  await expect(page.getByRole('textbox', { name: '题干段落 1', exact: true })).toHaveValue('另一页已保存的内容。');
  await page.getByRole('button', { name: '返回题目', exact: true }).click();
  await expect(page.getByRole('article', { name: '题干', exact: true })).toHaveText('另一页已保存的内容。');
  await other.close();
});
