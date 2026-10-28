import { test, expect, register, navigate } from './fixture.mjs';
import { replayRecognizer, sourceImage } from '../../../../test/fixtures/questions/recognition/replay.mjs';

test.use({ applicationOptions: async ({}, use) => {
  await use({ workbench: { recognition: { recognizer: await replayRecognizer() } } });
} });

test('真实图片经主应用整理、人工核对后保存为题目并重开', async ({ page, world }) => {
  await register(page, world);
  await navigate(page, '/questions');
  await page.getByRole('button', { name: '从资料收录', exact: true }).first().click();
  await page.getByRole('button', { name: /^上传图片/ }).click();
  await page.getByLabel('选择原稿').setInputFiles({ name: '实际试题.png', mimeType: 'image/png', buffer: sourceImage('I-1') });
  await page.getByRole('button', { name: '开始整理', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认这道题', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.q-review')).toContainText('对照');
  await expect(page.locator('.q-original')).toBeVisible();
  await page.getByRole('button', { name: '查看疑点位置', exact: true }).click();
  await page.getByRole('combobox', { name: /^请确认这道题在原稿中的位置/ }).selectOption('corrected');
  await page.getByRole('button', { name: '确认这道题', exact: true }).click();
  await page.getByRole('button', { name: '查看题目', exact: true }).click();
  await expect(page.getByRole('article', { name: '题干', exact: true })).toContainText('求函数');
  await page.reload();
  await expect(page.getByRole('article', { name: '题干', exact: true })).toContainText('的定义域。');
  await expect(page.getByRole('button', { name: '对照原稿', exact: true })).toBeVisible();
});
