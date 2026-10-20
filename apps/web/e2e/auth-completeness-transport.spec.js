import { confirmLogout } from './teaching-time-auth/helpers.mjs';
import net from 'node:net';
import { test, expect, registrationForm, register, signIn, openSettings, password } from './fixtures/auth-completeness.js';

// Hold the real HTTPS response after the real operation has run. Unlike a
// Playwright route, this lets Chromium receive headers while its body is pending.
function holdResponse(world, pathname, { partialBody = true, headers = true } = {}) {
  const held = [];
  world.app.use((request, response, next) => {
    if (request.path !== pathname) return next();
    const end = response.end.bind(response);
    response.end = (body) => {
      response.removeHeader('content-length');
      response.removeHeader('etag');
      if (headers) response.flushHeaders();
      const text = body?.toString() || '';
      const prefix = partialBody ? text.slice(0, 1) : '';
      if (prefix) response.write(prefix);
      held.push({ response, finish: () => end(text.slice(prefix.length)) });
      return response;
    };
    next();
  });
  const layer = world.app.router.stack.pop();
  world.app.router.stack.unshift(layer);
  return { held, remove: () => {
    const index = world.app.router.stack.indexOf(layer);
    if (index >= 0) world.app.router.stack.splice(index, 1);
  } };
}

async function logout(page) {
  await openSettings(page);
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await confirmLogout(page);
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
}

test('昵称已保存但正文超时后读取核实，不重放且保持工作台', async ({ page, world }) => {
  await register(page, world, 'profile-timeout@example.test');
  await openSettings(page);
  const mounted = await page.locator('.wb-shell').elementHandle();
  const held = holdResponse(world, '/api/auth/profile');
  let writes = 0;
  page.on('request', request => { if (request.url().endsWith('/api/auth/profile')) writes++; });
  await page.getByRole('button', { name: '修改昵称', exact: true }).click();
  const input = page.getByRole('textbox', { name: '昵称', exact: true });
  await input.fill('正文超时后已核实'); await input.press('Enter');
  await expect.poll(() => held.held.length).toBe(1);
  await expect(page.getByRole('button', { name: '修改昵称', exact: true })).toHaveText('正文超时后已核实', { timeout: 16000 });
  await expect(page.locator('.tb-account-row')).toContainText('正文超时后已核实');
  expect(writes).toBe(1);
  expect(await mounted.evaluate(element => element.isConnected)).toBe(true);
  held.remove();
});

for (const partialBody of [false, true]) {
  test(`登录收到${partialBody ? '部分 JSON' : '仅响应头'}后仍完整超时，并能继续登录`, async ({ page, world }, info) => {
    const email = 'transport-login@example.test';
    await register(page, world, email);
    await logout(page);
    const stall = holdResponse(world, '/api/auth/login', { partialBody });
    // A rejected credential keeps server state unchanged, so the next explicit
    // retry can prove the form is usable without an unrelated pending session.
    const wrongPassword = 'transport-wrong-password';
    await page.getByLabel('邮箱', { exact: true }).fill(email);
    await page.getByLabel('密码', { exact: true }).fill(wrongPassword);
    await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();
    await expect.poll(() => stall.held.length).toBe(1);
    await expect(page.getByRole('button', { name: '登录中', exact: true })).toBeDisabled();
    await expect(page.locator('.ae-notice')).toContainText('请求超时', { timeout: 12_000 });
    await expect(page.getByRole('button', { name: /^登录(?: ›)?$/ })).toBeEnabled();
    await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue(email);
    await expect(page.getByLabel('密码', { exact: true })).toHaveValue(wrongPassword);
    expect(stall.held).toHaveLength(1);
    await page.screenshot({ path: info.outputPath('complete-response-timeout.png'), mask: [page.getByLabel('密码', { exact: true })] });
    stall.remove();
    await signIn(page, email);
  });
}

test('已提交注册的正文超时保持未知和输入，不自动重放，可显式登录恢复', async ({ page, world }) => {
  const email = 'transport-register@example.test';
  await registrationForm(page, world, email);
  const stall = holdResponse(world, '/api/auth/register');
  await page.getByRole('button', { name: '注册', exact: true }).click();
  await expect.poll(() => stall.held.length).toBe(1);
  expect(world.workbench.db.prepare('SELECT count(*) n FROM auth_accounts WHERE email=?').get(email).n).toBe(1);
  await expect(page.locator('.ae-notice')).toContainText('注册结果暂未确认', { timeout: 12_000 });
  await expect(page.locator('.ae-notice')).toHaveAttribute('role', 'status');
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue(password);
  await expect(page.getByLabel('确认密码', { exact: true })).toHaveValue(password);
  await expect(page.getByLabel('邮箱验证码')).toHaveValue(world.mailer.lastCode('registration', email));
  await expect(page.getByRole('checkbox')).toBeChecked();
  await expect(page.locator('.wb-shell')).toHaveCount(0);
  expect(stall.held).toHaveLength(1);
  stall.remove();
  await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();
  await signIn(page, email);
});

test('已提交重置等待完整回执超时仍未知，不自动重放，可使用新密码恢复', async ({ page, world }) => {
  const email = 'transport-reset@example.test';
  await register(page, world, email);
  await logout(page);
  await page.getByRole('button', { name: '忘记密码？', exact: true }).click();
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(page.getByRole('heading', { name: '设置新密码', exact: true })).toBeVisible();
  const newPassword = 'transport-new-password';
  await page.getByLabel('验证码', { exact: true }).fill(world.mailer.lastCode('password-reset', email));
  await page.getByLabel('新密码', { exact: true }).fill(newPassword);
  await page.getByLabel('确认新密码', { exact: true }).fill(newPassword);
  // I05 succeeds with 204. Hold its complete header block, rather than invent
  // a JSON body which that operation does not return.
  const stall = holdResponse(world, '/api/auth/password-reset', { headers: false, partialBody: false });
  await page.getByRole('button', { name: '重置密码', exact: true }).click();
  await expect.poll(() => stall.held.length).toBe(1);
  expect(world.workbench.db.prepare('SELECT passwordVersion FROM auth_accounts WHERE email=?').get(email).passwordVersion).toBe(2);
  await expect(page.locator('.ae-notice')).toContainText('重置结果暂未确认', { timeout: 12_000 });
  await expect(page.locator('.ae-notice')).toHaveAttribute('role', 'status');
  await expect(page.getByLabel('新密码', { exact: true })).toHaveValue(newPassword);
  await expect(page.getByLabel('确认新密码', { exact: true })).toHaveValue(newPassword);
  await expect(page.getByLabel('验证码', { exact: true })).toHaveValue(world.mailer.lastCode('password-reset', email));
  expect(stall.held).toHaveLength(1);
  await expect(page.locator('.wb-shell')).toHaveCount(0);
  stall.remove();
  await page.getByRole('button', { name: /^返回登录(?: ›)?$/ }).click();
  await signIn(page, email, { password: newPassword });
  await logout(page);
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();
  await expect(page.getByRole('alert')).toContainText('邮箱或密码不正确');
  await signIn(page, email, { password: newPassword });
});

for (const outcome of ['success', 'disconnect', 'timeout']) {
  test(`正文等待期间切卡，迟到${outcome}不能覆盖新的注册表单`, async ({ page, world }) => {
    const email = 'transport-cancel@example.test';
    await register(page, world, email);
    await logout(page);
    const stall = holdResponse(world, '/api/auth/login');
    await page.getByLabel('邮箱', { exact: true }).fill(email);
    await page.getByLabel('密码', { exact: true }).fill(password);
    await page.getByRole('button', { name: /^登录(?: ›)?$/ }).click();
    await expect.poll(() => stall.held.length).toBe(1);
    await page.getByRole('button', { name: /^创建账户(?: ›)?$/ }).click();
    await page.getByLabel('昵称', { exact: true }).fill('迟到响应后的新昵称');
    await page.getByLabel('邮箱', { exact: true }).fill('transport-fresh@example.test');
    const settled = page.waitForEvent(outcome === 'success' ? 'requestfinished' : 'requestfailed',
      request => request.url().endsWith('/api/auth/login'));
    if (outcome === 'success') stall.held[0].finish();
    if (outcome === 'disconnect') stall.held[0].response.destroy();
    await settled;
    // Flush the application's promise chain after the browser consumed the body.
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    await expect(page.getByRole('heading', { name: /^创建账户(?: ›)?$/ })).toBeVisible();
    await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('迟到响应后的新昵称');
    await expect(page.getByLabel('邮箱', { exact: true })).toHaveValue('transport-fresh@example.test');
    await expect(page.locator('.ae-notice')).toHaveCount(0);
    await expect(page.locator('.wb-shell')).toHaveCount(0);
  });
}

// Browsers can open speculative TCP connections before a TLS handshake or HTTP
// request exists. The isolated server must release those during fixture cleanup.
test('隔离 HTTPS 清理不等待尚未完成 TLS 握手的连接', async ({ world }) => {
  const origin = new URL(world.origin);
  const socket = net.connect({ host: origin.hostname, port: Number(origin.port) });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  const closing = world.close();
  let timer;
  try {
    const closedBeforeRelease = await Promise.race([
      closing.then(() => true),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), 1000); }),
    ]);
    expect(closedBeforeRelease).toBe(true);
  } finally {
    clearTimeout(timer);
    socket.destroy();
    await closing;
  }
});
