import { test, expect, register, navigate } from './fixture.mjs';

for (const kind of ['classes', 'students', 'exams']) {
  test(`${kind} 表单确认写入后保留读回现场，原样重试只读、改字段续写同一对象`, async ({ page, world }, info) => {
    await register(page, world);
    await navigate(page, '/classroom');
    if (kind === 'students') {
      await page.getByRole('button', { name: '新建班级', exact: true }).first().click();
      await page.getByLabel('班级名称').fill('提交接续班');
      await page.getByRole('button', { name: '创建班级', exact: true }).click();
      await page.getByRole('tab', { name: '学生', exact: true }).click();
      await page.getByRole('button', { name: '添加学生', exact: true }).first().click();
    } else if (kind === 'classes') {
      await page.getByRole('button', { name: '新建班级', exact: true }).first().click();
    } else {
      await page.locator('.tbx-rail').getByRole('button', { name: /^考试/ }).click();
      await page.getByRole('button', { name: '新建考试', exact: true }).first().click();
      await page.getByRole('textbox', { name: '题数', exact: true }).fill('1');
      await page.getByRole('textbox', { name: '每题满分', exact: true }).fill('100');
      await page.getByRole('dialog').getByRole('button', { name: '添加', exact: true }).click();
    }
    const dialog = page.getByRole('dialog');
    const input = dialog.getByLabel(kind === 'classes' ? '班级名称' : kind === 'students' ? '姓名' : '考试名称', { exact: true });
    const save = dialog.getByRole('button', { name: kind === 'classes' ? '创建班级' : kind === 'students' ? '保存并继续添加' : '创建考试', exact: true });
    await input.fill('第一份资料');
    const writes = [];
    let failRead = true, entered, release;
    const reading = new Promise(resolve => { entered = resolve; });
    let gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/modules/classroom/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (['POST', 'PUT'].includes(request.method()) && url.pathname.includes(`/${kind}`)) {
        const response = await route.fetch();
        writes.push({ method: request.method(), body: request.postDataJSON(), saved: await response.json() });
        await route.fulfill({ response });
      } else if (url.pathname.endsWith('/classes') && writes.length && failRead) {
        entered();
        if (gate) { await gate; gate = null; }
        await route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ type: '/problems/workbench/temporarily-unavailable', title: 'unavailable', status: 503 }) });
      } else await route.continue();
    });
    await save.click();
    await reading;
    try {
      await expect(input).toBeDisabled();
      await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
    } finally { release(); }
    await expect(dialog.locator('.cr-error')).toHaveText('班级暂时无法读取');
    await expect(input).toHaveValue('第一份资料');
    expect(writes).toHaveLength(1);
    await save.click();
    await expect(dialog.locator('.cr-error')).toHaveText('班级暂时无法读取');
    expect(writes, '原样重试不再POST或PUT').toHaveLength(1);
    await input.fill('继续修改的资料');
    await save.click();
    await expect(dialog.locator('.cr-error')).toHaveText('班级暂时无法读取');
    expect(writes).toHaveLength(2);
    expect(writes[1].method).toBe('PUT');
    expect(writes[1].body.baseVersion).toBe(writes[0].saved.version);
    expect(writes[1].saved.id).toBe(writes[0].saved.id);
    expect(writes[1].saved.version).toBe(writes[0].saved.version + 1);
    await page.screenshot({ path: info.outputPath(`${kind}-read-failure.png`), animations: 'disabled' });
    failRead = false;
    await save.click();
    if (kind === 'students') {
      await expect(input).toHaveValue('');
      await input.fill('下一位学生');
      await save.click();
      await expect(input).toHaveValue('');
      expect(writes).toHaveLength(3);
      expect(writes[2].method).toBe('POST');
      expect(writes[2].saved.id).not.toBe(writes[0].saved.id);
      await dialog.getByRole('button', { name: '取消', exact: true }).click();
    } else {
      await expect(dialog).toHaveCount(0);
      expect(writes).toHaveLength(2);
    }
    await page.reload();
    await expect(page.getByText('继续修改的资料', { exact: true }).first()).toBeVisible();
    await info.attach('confirmed-writes', { body: JSON.stringify(writes), contentType: 'application/json' });
  });
}
