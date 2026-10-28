import { test, expect, register, navigate } from './fixture.mjs';
import { provider } from '../../../api/test/fixtures/c26/provider.js';

test.use({ applicationOptions: async ({}, use) => {
  const model = await provider([
    [{ type: 'toolCall', id: 'review-plan', name: 'wb_propose_teaching_card', arguments: {
      card: { kind: 'plan', title: '函数课安排建议', entryTitle: '函数课备课', steps: ['先回顾定义域', '再讨论最值'] },
    } }],
    [{ type: 'text', text: '安排已整理，请查看卡片后决定是否加入日程。' }],
  ]);
  await use({ agent: model.config });
} });

test('助理提案跨首页与侧栏延续，明确点击后才保存日程且刷新可核实', async ({ page, world }) => {
  await register(page, world);
  const start = page.getByRole('button', { name: '新对话', exact: true });
  await start.first().click();
  await page.getByRole('textbox', { name: 'AI 输入', exact: true }).fill('给我一个函数课备课安排建议。');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('button', { name: '加到日程', exact: true })).toBeVisible();
  await navigate(page, '/calendar');
  await expect(page.getByText('函数课备课', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '打开 AI 助理', exact: true }).click();
  await expect(page.getByText('函数课安排建议', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '加到日程', exact: true }).click();
  await expect(page.getByRole('button', { name: '已加到待安排', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '收起 AI 助理', exact: true }).click();
  await expect(page.getByText('函数课备课', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('函数课备课', { exact: true })).toBeVisible();
});
