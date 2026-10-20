import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { createIntegration } from '../../api/test/fixtures/c26/harness.js';
import { provider } from '../../api/test/fixtures/c26/provider.js';
import { registerMath } from '../../api/test/fixtures/math-real.mjs';

const answer = String.raw`行内公式 $\frac{x+1}{2}$ 与中文说明。

$$
\begin{pmatrix}1&2\\3&4\end{pmatrix}
$$

危险链接 $\href{javascript:alert(1)}{打开}$ 保持不可信。

未知命令 $\notARealMathCommand{x}$ 保留错误源码。`;

test('受控Agent回答的中文、行内与独立公式可读，错误源码和不可信链接刷新后保持', async ({ page }, info) => {
  const model = await provider([[{ type: 'text', text: answer }]]);
  const world = await createIntegration({ agent: model.config });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let passed = false;
  try {
    await registerMath(world, 'rendering@example.test');
    await page.goto(world.origin);
    await page.getByLabel('邮箱', { exact: true }).fill('rendering@example.test');
    await page.getByLabel('密码', { exact: true }).fill('math-password');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.getByRole('button', { name: '知道了', exact: true }).click();
    await page.locator('.tbx-composer.is-placeholder').click();
    await page.getByRole('textbox', { name: 'AI 输入', exact: true }).fill('请解释公式，保留中文。');
    await page.getByRole('button', { name: '发送', exact: true }).click();
    const reply = page.locator('.tbx-msg:not(.is-user)');
    for (const reloaded of [false, true]) {
      if (reloaded) await page.reload();
      await expect(reply).toContainText('行内公式');
      await expect(reply.locator('.katex-display')).toHaveCount(1);
      await expect(reply.locator('.katex').first()).toBeVisible();
      await expect(reply.locator('.katex').filter({ hasText: 'notARealMathCommand' })).toBeVisible();
      await expect(reply.locator('a[href^="javascript:"]')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(model.requests()).toBe(1);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('agent-math.png') });
    passed = true;
  } finally {
    await page.context().close();
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
    else console.log('保留Agent公式验证现场：' + world.directory);
  }
});
