import { test, expect, register, navigate } from './fixture.mjs';

test('D17 工坊主应用连接网页助理并执行，停止后匹配原请求的迟到回复不污染作品与新输入', async ({ page, world }) => {
  await page.addInitScript(() => {
    window.bridgeRequests = [];
    let sends = 0;
    const formulaId = crypto.randomUUID();
    const reply = (request, type, text) => window.postMessage({ source: 'teachbuddy-web-ai', type,
      requestId: request.requestId, sessionId: request.sessionId, extensionVersion: '0.2.0', connectionState: 'available', ...(text ? { text } : {}) }, location.origin);
    window.addEventListener('message', event => {
      const request = event.data;
      if (event.source === window && request?.source === 'teachbuddy-web-ai' && request.text?.includes('迟到回复禁止应用')) window.lateBridgeReplyDelivered = true;
      if (event.source !== window || request?.source !== 'teachbuddy-workbench') return;
      window.bridgeRequests.push(request);
      if (request.type === 'STATUS') reply(request, 'STATUS');
      if (request.type === 'CONNECT') reply(request, 'CONNECTED');
      if (request.type === 'CANCEL') window.cancelledBridgeRequest = request;
      if (request.type === 'SEND') {
        sends++;
        if (sends === 1) reply(request, 'DONE', JSON.stringify({ message: '加入一个公式', changes: { formulas: [
          { id: formulaId, latex: 'x+7', caption: '', includeCaption: false, color: '#2563eb', fontSize: 32 },
        ] } }));
        else if (sends === 2) reply(request, 'DONE', JSON.stringify({ message: '公式已应用，请核对作品。', changes: {} }));
        else window.heldBridgeRequest = request;
      }
    });
  });
  await register(page, world);
  await navigate(page, '/math');
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  const open = page.getByRole('button', { name: '打开 AI 助理', exact: true });
  if (await open.isVisible()) await open.click();
  const input = page.getByRole('textbox', { name: '向数学助理提问', exact: true });
  await input.fill('请在当前作品加入 x+7。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect(page.getByText('公式已应用，请核对作品。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '编辑公式 1', exact: true })).toBeVisible();
  await expect(page.locator('.mw-save-state')).toHaveText('已保存');
  const first = await page.evaluate(() => window.bridgeRequests.filter(request => request.type === 'SEND'));
  expect(first).toHaveLength(2);
  expect(await page.evaluate(() => window.bridgeRequests.some(request => request.type === 'CONNECT'))).toBe(true);
  expect(JSON.parse(first[1].prompt.slice(first[1].prompt.lastIndexOf('\n\n') + 2)).current.source.formulas[0].latex).toBe('x+7');

  await input.fill('这轮先不要执行，等待我确认。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.heldBridgeRequest))).toBe(true);
  await page.getByRole('button', { name: '停止生成', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(window.cancelledBridgeRequest))).toBe(true);
  await input.fill('下一轮尚未发送的想法');
  await page.evaluate(() => {
    const request = window.heldBridgeRequest;
    window.postMessage({ source: 'teachbuddy-web-ai', type: 'DONE', requestId: request.requestId,
      sessionId: request.sessionId, extensionVersion: '0.2.0', text: JSON.stringify({ message: '迟到回复禁止应用', changes: {
        formulas: [{ id: crypto.randomUUID(), latex: '999', caption: '', includeCaption: false, color: '#2563eb', fontSize: 32 }],
      } }) }, location.origin);
  });
  await expect.poll(() => page.evaluate(() => window.lateBridgeReplyDelivered)).toBe(true);
  await expect(input).toHaveValue('下一轮尚未发送的想法');
  await expect(page.getByText('迟到回复禁止应用', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '编辑公式 1', exact: true }).click();
  await expect.poll(() => page.locator('math-field').evaluate(field => field.value)).toBe('x+7');
  const requests = await page.evaluate(() => ({ held: window.heldBridgeRequest, cancelled: window.cancelledBridgeRequest }));
  expect(requests.cancelled.requestId).toBe(requests.held.requestId);
  expect(requests.cancelled.sessionId).toBe(requests.held.sessionId);
});
