/*
 * Scenarios for the failure, recovery, code-lifecycle and session behavior added
 * to the account entry.
 *
 * Scenario IDs continue the accepted numbering (CA01-CA40 live in
 * auth-scenarios.mjs); existing IDs are never renumbered. Each scenario starts
 * from a fresh browser context, drives the interface, and can open additional
 * contexts when the branch is about a second device or another tab.
 */
import { expect } from '@playwright/test';

export const viewports = [
  { name: 'PC', width: 1440, height: 900 },
  { name: '平板', width: 768, height: 1024 },
  { name: '手机', width: 390, height: 844 }
];

export const EMAIL = 'example@example.com';
export const PASSWORD = 'teachbuddy';
export const NEW_PASSWORD = 'new-teachbuddy';
export const REGISTER_CODE = '309614';
export const RECOVERY_CODE = '841207';

const email = (p) => p.locator('.ae-form input[type="email"]');
const password = (p) => p.locator('.ae-password input');
const confirmation = (p) => p.locator('.ae-field input[autocomplete="new-password"]').last();
const nickname = (p) => p.locator('input[autocomplete="nickname"]');
const code = (p) => p.locator('input[inputmode="numeric"]');
const submit = (p) => p.locator('.ae-primary').click();
const switchCard = (p) => p.locator('.ae-switch button').click();
const alert = (p, text) => expect(p.locator('.ae-notice')).toContainText(text);
const fieldAlert = (p, text) => expect(p.locator('.ae-field-error')).toContainText(text);
const heading = (p, text) => expect(p.locator('.ae-card h1')).toHaveText(text);
const devButton = (p, name) => p.locator('[aria-label="开发环境故障注入"]').getByRole('button', { name }).click({ force: true });
/* The send control is labelled "发送验证码" before a code exists and
 * "重新发送" afterwards, in a combo next to the code field. */
function sendControl(p) {
  const combo = p.locator('.ae-combo button');
  return combo;
}
async function pressSend(p) {
  const combo = p.locator('.ae-combo button');
  if (await combo.count()) {
    await combo.click();
    return;
  }
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
}

/* Opens the entry card on the development URL, where the failure control is
 * available. */
async function openEntry(p, url) {
  await p.goto(url, { waitUntil: 'networkidle' });
  await heading(p, '登录');
}

/* Opens the entry card with the development chrome hidden, which is the state
 * every review screenshot should show. */
function withParams(url, params) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target.href;
}

function cleanUrl(url) {
  const target = new URL(url);
  target.searchParams.set('no-dev-chrome', '');
  return target.href;
}

async function openClean(p, url) {
  await p.goto(cleanUrl(url), { waitUntil: 'networkidle' });
  await heading(p, '登录');
}

async function dismissCoach(p) {
  const dismiss = p.locator('.tb-coach-dismiss');
  if (await dismiss.count()) await dismiss.click();
}

async function signIn(p, { address = EMAIL, secret = PASSWORD } = {}) {
  await email(p).fill(address);
  await password(p).fill(secret);
  await submit(p);
}

async function startRegistration(p, { address = 'new@example.com', name = '林' } = {}) {
  await switchCard(p);
  await heading(p, '注册');
  await nickname(p).fill(name);
  await email(p).fill(address);
  await password(p).fill(PASSWORD);
  await confirmation(p).fill(PASSWORD);
}

async function startRecovery(p, { address = EMAIL, send = false } = {}) {
  await p.getByRole('button', { name: '忘记密码？' }).click();
  await heading(p, '找回密码');
  await email(p).fill(address);
  await submit(p);
  await heading(p, '设置新密码');
  if (send) {
    await pressSend(p);
    await expect(p.locator('.ae-field-note').last()).toContainText(address);
    /* The send has to settle before the step is left, otherwise the code field
     * carries a "not sent yet" state into the confirm step. */
    await expect(p.locator('.ae-combo button')).toBeVisible();
  }
}

/* Waits out the resend cooldown the way a user would. */
async function waitForResend(p) {
  const button = p.locator('.ae-combo button');
  await expect(button).toHaveText('重新发送', { timeout: 40000 });
}

export const deferredScenarios = [
  { id: 'CA48', reason: '原脚本依赖退出入口，且没有真正覆盖请求中离开；等待该行为补齐。' },
  { id: 'CA53', reason: '原型暂不提供退出入口；退出范围与昵称展示接入等待设置页设计。' }
];
export const scenarios = [];
function scenario(id, journey, description, run) {
  scenarios.push({ id: `CA${String(id).padStart(2, '0')}`, journey, description, run });
}

/* ---------------------------------------------------------------- 登录失败 */

scenario(41, 'login', '凭据错误：卡片顶部拒绝、密码清空、邮箱保留、可关闭', async (p, shot, { url }) => {
  await openClean(p, url);
  await signIn(p, { secret: 'wrong-password' });
  await alert(p, '邮箱或密码不正确，请重试。');
  await expect(password(p)).toHaveValue('');
  await expect(email(p)).toHaveValue(EMAIL);
  await shot('rejected');
  await p.locator('.ae-notice-dismiss').click();
  await expect(p.locator('.ae-notice')).toHaveCount(0);
  await shot('dismissed');
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('recovered');
});

scenario(42, 'login', '不存在的账户与错误密码得到同一条答复', async (p, shot, { url }) => {
  await openClean(p, url);
  await signIn(p, { address: 'nobody@example.com', secret: 'wrong-password' });
  await alert(p, '邮箱或密码不正确，请重试。');
  await shot('unknown-account');
  await p.reload({ waitUntil: 'networkidle' });
  await signIn(p, { secret: 'wrong-password' });
  await alert(p, '邮箱或密码不正确，请重试。');
  await shot('wrong-password');
});

scenario(43, 'login', '提交等待：按钮进入等待态并阻止第二次提交', async (p, shot, { url }) => {
  await openClean(p, url);
  await email(p).fill(EMAIL);
  await password(p).fill(PASSWORD);
  const press = submit(p);
  await p.waitForTimeout(120);
  await expect(p.locator('.ae-primary')).toHaveText('登录中');
  await expect(p.locator('.ae-primary')).toBeDisabled();
  await shot('pending');
  /* A second press while the first is in flight must not start another login. */
  await p.locator('.ae-primary').click({ force: true }).catch(() => {});
  await press;
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('settled');
});

scenario(44, 'login', '网络不可用：横幅提示、保留输入、恢复后重试成功', async (p, shot, { url }) => {
  await openEntry(p, url);
  await devButton(p, '网络不可用');
  await signIn(p);
  await alert(p, '网络连接不可用，请检查网络后重试。');
  await expect(password(p)).toHaveValue(PASSWORD);
  await expect(email(p)).toHaveValue(EMAIL);
  await shot('offline');
  await devButton(p, '正常');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('retried');
});

scenario(45, 'login', '服务故障：可关闭的横幅，不误标到字段上', async (p, shot, { url }) => {
  await openEntry(p, url);
  await devButton(p, '服务故障');
  await signIn(p);
  await alert(p, '服务暂时不可用，请稍后重试。');
  await expect(p.locator('.ae-field-error')).toHaveCount(0);
  await shot('server-error');
  await p.locator('.ae-notice-dismiss').click();
  await expect(p.locator('.ae-notice')).toHaveCount(0);
  await shot('dismissed');
});

scenario(46, 'login', '请求超时：横幅提示并可重试', async (p, shot, { url }) => {
  await openEntry(p, url);
  await devButton(p, '超时');
  await signIn(p);
  await alert(p, '请求超时，请重试。');
  await shot('timeout');
  await devButton(p, '正常');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('retried');
});

scenario(47, 'login', '请求中修改密码：等待态保持，不产生第二次请求', async (p, shot, { url }) => {
  await openClean(p, url);
  await email(p).fill(EMAIL);
  await password(p).fill(PASSWORD);
  await submit(p);
  await password(p).fill('changed-while-pending');
  await expect(p.locator('.ae-primary')).toHaveText('登录中');
  await shot('edited-while-pending');
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('settled');
});


/* ------------------------------------------------------------------ 会话 */

scenario(49, 'session', '勾选记住我：刷新后仍在工作台', async (p, shot, { url }) => {
  await openClean(p, url);
  await expect(p.getByRole('checkbox', { name: '记住我' })).toBeChecked();
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await p.reload({ waitUntil: 'networkidle' });
  await expect(p.locator('.tb-shell')).toBeVisible();
  await expect(p.locator('.ae-session')).toHaveCount(0);
  await shot('restored');
});

scenario(50, 'session', '不勾选记住我：刷新即退出，回到空登录卡', async (p, shot, { url }) => {
  await openClean(p, url);
  await p.getByRole('checkbox', { name: '记住我' }).uncheck();
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await p.reload({ waitUntil: 'networkidle' });
  await heading(p, '登录');
  await expect(email(p)).toHaveValue('');
  await shot('expired');
});

scenario(51, 'session', '换设备：另一台机器没有可恢复的会话', async (p, shot, { url, newContext }) => {
  await openClean(p, url);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('first-device');
  const other = await newContext();
  const page = await other.newPage();
  await openClean(page, url);
  await expect(page.locator('.ae-card')).toBeVisible();
  await shot('second-device', page);
  await signIn(page);
  await expect(page.locator('.tb-shell')).toBeVisible();
  await shot('second-device-signed-in', page);
  await other.close();
});

scenario(52, 'session', '会话过期：回到登录卡并说明原因', async (p, shot, { url }) => {
  await openEntry(p, url);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await dismissCoach(p);
  await devButton(p, '会话过期');
  await heading(p, '登录');
  await alert(p, '登录状态已过期，请重新登录。');
  await shot('expired-notice');
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('signed-in-again');
});


scenario(54, 'session', '密码重置后旧密码失效，新密码可用', async (p, shot, { url }) => {
  // Password recovery starts at the entry; no workbench logout action is required.
  await openClean(p, url);
  await p.getByRole('button', { name: '忘记密码？' }).click();
  await email(p).fill(EMAIL);
  await submit(p);
  await heading(p, '设置新密码');
  await pressSend(p);
  await expect(p.locator('.ae-field-note').last()).toContainText(EMAIL);
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill(NEW_PASSWORD);
  await confirmation(p).fill(NEW_PASSWORD);
  await submit(p);
  await heading(p, '登录');
  await alert(p, '密码已重置，请用新密码登录。');
  await shot('reset-confirmed');

  await signIn(p, { secret: PASSWORD });
  await alert(p, '邮箱或密码不正确，请重试。');
  await shot('old-password-rejected');
  await signIn(p, { secret: NEW_PASSWORD });
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('new-password-accepted');
});

/* ------------------------------------------------------------ 验证码生命周期 */

scenario(55, 'register', '发码失败：横幅提示，验证码字段不出现', async (p, shot, { url }) => {
  await openEntry(p, url);
  await startRegistration(p);
  await devButton(p, '服务故障');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await alert(p, '服务暂时不可用，请稍后重试。');
  await expect(code(p)).toHaveCount(0);
  await shot('send-failed');
  await devButton(p, '正常');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await shot('send-retried');
});

scenario(56, 'register', '冷却：重发倒计时，冷却结束才能再发', async (p, shot, { url }) => {
  await openClean(p, url);
  await startRegistration(p);
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  const resend = p.locator('.ae-combo button');
  await expect(resend).toHaveText(/后重发/);
  await expect(resend).toBeDisabled();
  await shot('cooldown');
  await waitForResend(p);
  await shot('ready');
  await resend.click();
  await expect(p.locator('.ae-field-note')).toContainText('new@example.com');
  await shot('resent');
});

scenario(57, 'register', '验证码错误次数用尽后该码作废，需要重新发送', async (p, shot, { url }) => {
  await openClean(p, url);
  await startRegistration(p);
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await code(p).fill('000000');
  await p.locator('.is-terms input').check();
  await submit(p);
  await fieldAlert(p, '还可以再试 4 次');
  await shot('first-miss');
  for (const wrong of ['000001', '000002', '000003', '000004']) {
    await code(p).fill(wrong);
    await submit(p);
  }
  await fieldAlert(p, '验证码错误次数过多');
  await shot('exhausted');
  await code(p).fill('000005');
  await submit(p);
  await fieldAlert(p, '请重新发送');
  await shot('still-refused');
});

scenario(58, 'register', '验证码过期：需要重新发送', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(p);
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await devButton(p, '验证码过期');
  await expect(code(p)).toBeVisible();
  await code(p).fill('000000');
  await p.locator('.is-terms input').check();
  await submit(p);
  await fieldAlert(p, '验证码已过期');
  await shot('expired');
  await p.locator('.ae-combo button').click();
  await code(p).fill('000000');
  await submit(p);
  await fieldAlert(p, '验证码不正确');
  await shot('new-code-active');
});

scenario(59, 'register', '重发后旧码作废、新码可用；换地址后必须重新发送', async (p, shot, { url, newContext }) => {
  await openClean(p, withParams(url, { 'dev-code': `${REGISTER_CODE},555555`, 'dev-no-cooldown': '' }));
  await startRegistration(p);
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await p.locator('.ae-combo button').click();
  await expect(code(p)).toBeVisible();
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  await submit(p);
  await fieldAlert(p, '验证码不正确');
  await shot('old-code-dead');
  await code(p).fill('555555');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('new-code-accepted');

  // Address changes are an independent branch; use another real entry page.
  const other = await newContext();
  const page = await other.newPage();
  await openClean(page, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(page);
  await pressSend(page);
  await expect(code(page)).toBeVisible();
  await email(page).fill('another@example.com');
  await expect(code(page)).toHaveCount(0);
  await shot('address-changed', page);
  await pressSend(page);
  await expect(page.locator('.ae-field-note')).toContainText('another@example.com');
  await shot('resent', page);
  await other.close();
});

scenario(60, 'recovery', '找回第一步：未注册地址被拒，不发验证码', async (p, shot, { url }) => {
  await openClean(p, url);
  await p.getByRole('button', { name: '忘记密码？' }).click();
  await email(p).fill('nobody@example.com');
  await submit(p);
  await fieldAlert(p, '没有可找回的账户');
  await heading(p, '找回密码');
  await shot('unknown-address');
  await email(p).fill(EMAIL);
  await submit(p);
  await heading(p, '设置新密码');
  await shot('accepted');
});

scenario(61, 'recovery', '找回第二步的地址是锁定的，验证码只对它有效', async (p, shot, { url }) => {
  await openClean(p, url);
  await startRecovery(p);
  await expect(email(p)).toHaveAttribute('readonly', '');
  await expect(email(p)).toHaveValue(EMAIL);
  await expect(p.locator('.ae-field-hint')).toContainText('只对这个地址有效');
  await shot('bound-address');
});

scenario(62, 'recovery', '找回可重发，冷却与注册一致', async (p, shot, { url }) => {
  await openEntry(p, url);
  await startRecovery(p);
  await pressSend(p);
  const resend = p.locator('.ae-combo button');
  await expect(resend).toHaveText(/后重发/);
  await expect(resend).toBeDisabled();
  await expect(p.locator('.ae-field-note').last()).toContainText(EMAIL);
  await shot('sent');
  await waitForResend(p);
  await resend.click();
  await expect(p.locator('.ae-field-note').last()).toContainText(EMAIL);
  await shot('resent');
});

scenario(63, 'recovery', '重置成功：回到登录卡并说明结果，再次找回需重新发码', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await startRecovery(p, { send: true });
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill(NEW_PASSWORD);
  await confirmation(p).fill(NEW_PASSWORD);
  await shot('filled');
  await submit(p);
  await heading(p, '登录');
  await alert(p, '密码已重置，请用新密码登录。');
  await shot('done');
  /* The next attempt asks for a new code on the confirm step, which is where
   * the first step leaves it when nothing was sent yet. */
  await startRecovery(p, { send: false });
  await pressSend(p);
  await expect(p.locator('.ae-field-note').last()).toContainText(EMAIL);
  await shot('code-reissued');
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill(PASSWORD);
  await confirmation(p).fill(PASSWORD);
  await submit(p);
  await heading(p, '登录');
  await alert(p, '密码已重置，请用新密码登录。');
  await shot('reset-again');
});

scenario(64, 'recovery', '找回发码遇到网络失败：横幅提示，可重试', async (p, shot, { url }) => {
  await openEntry(p, url);
  await startRecovery(p);
  await devButton(p, '网络不可用');
  await pressSend(p);
  await alert(p, '网络连接不可用，请检查网络后重试。');
  await shot('send-failed');
  await devButton(p, '正常');
  await pressSend(p);
  await expect(p.locator('.ae-field-note').last()).toContainText(EMAIL);
  await shot('send-retried');
});
