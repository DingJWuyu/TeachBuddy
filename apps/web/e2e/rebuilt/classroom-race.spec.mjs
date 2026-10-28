import { test, expect, register, navigate } from './fixture.mjs';

test('标签改名回执迟到时，重新打开的草稿仍可继续保存', async ({ page, world }, info) => {
  await register(page, world);
  await navigate(page, '/classroom');
  await page.locator('.tbx-rail').getByRole('button', { name: /^题目标签/ }).click();
  const newTag = page.getByRole('textbox', { name: '新标签', exact: true });
  await newTag.fill('标签甲');
  await page.locator('.cr-tagnew').getByRole('button', { name: '添加', exact: true }).click();
  await expect(newTag).toHaveValue('');
  const edit = async name => {
    await page.locator('.cr-tags > li').filter({ hasText: name })
      .getByRole('button', { name: '标签操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '改名', exact: true }).click();
  };
  await edit('标签甲');
  const input = page.getByRole('textbox', { name: '标签名称', exact: true });
  await input.fill('第一次已保存');
  let release, saved, delivered;
  const gate = new Promise(resolve => { release = resolve; });
  const committed = new Promise(resolve => { saved = resolve; });
  const complete = new Promise(resolve => { delivered = resolve; });
  await page.route('**/api/modules/classroom/tags/*', async route => {
    const response = await route.fetch();
    expect(response.status(), '第一笔改名必须已经真实提交').toBe(200);
    saved();
    await gate;
    try { await route.fulfill({ response }); } finally { delivered(); }
  }, { times: 1 });
  await input.press('Enter');
  await committed;
  let releaseReload, reloadEntered;
  const reloadGate = new Promise(resolve => { releaseReload = resolve; });
  const reloading = new Promise(resolve => { reloadEntered = resolve; });
  await page.route('**/api/modules/classroom/tags', async route => {
    const response = await route.fetch();
    reloadEntered();
    await reloadGate;
    await route.fulfill({ response });
  }, { times: 1 });
  try {
    await page.keyboard.press('Escape');
    await edit('标签甲');
    await input.fill('继续编辑的新名称');
  } finally { release(); await complete; }
  await expect(input).toHaveValue('继续编辑的新名称');
  await reloading;
  const save = page.locator('.cr-tag-edit').getByRole('button', { name: '保存', exact: true });
  try {
    await expect(save, '前一笔改名的版本尚未读回时，保留新草稿并等待读回').toBeDisabled();
    await input.press('Enter');
    await expect(input).toHaveValue('继续编辑的新名称');
  } finally { releaseReload(); }
  await expect(save).toBeEnabled();
  const response = page.waitForResponse(value => value.request().method() === 'PUT' && value.url().includes('/api/modules/classroom/tags/'));
  await save.click();
  expect((await response).status(), '原改名已确认后，当前草稿应使用新版本成功保存').toBe(200);
  await expect(input).toHaveCount(0);
  await expect(page.locator('.cr-tags')).toContainText('继续编辑的新名称');
  await page.reload();
  await page.locator('.tbx-rail').getByRole('button', { name: /^题目标签/ }).click();
  await expect(page.locator('.cr-tags')).toContainText('继续编辑的新名称');
  await page.screenshot({ path: info.outputPath('tag-renamed.png'), animations: 'disabled' });
});
