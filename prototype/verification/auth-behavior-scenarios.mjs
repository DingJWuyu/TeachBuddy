/*
 * Scenarios for the failure, recovery, code-lifecycle and session behavior added
 * to the account entry.
 *
 * Scenario IDs continue the accepted numbering (CA01-CA40 live in
 * auth-scenarios.mjs); existing IDs are never renumbered. Each scenario starts
 * from a fresh browser context, drives the interface, and can open additional
 * contexts when the branch is about a second device or another tab.
 */
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { chromium } from 'playwright';

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

const email = (p) => p.locator('.ae-form input[autocomplete="email"]');
const password = (p) => p.locator('.ae-password input');
const confirmation = (p) => p.locator('.ae-field input[autocomplete="new-password"]').last();
const nickname = (p) => p.locator('input[autocomplete="nickname"]');
const code = (p) => p.locator('input[inputmode="numeric"]');
const submit = (p) => p.locator('.ae-primary').click();
const switchCard = (p) => p.locator('.ae-switch button').click();
const alert = (p, text) => expect(p.locator('.ae-notice')).toContainText(text);
const fieldAlert = (p, text) => expect(p.locator('.ae-field-error')).toContainText(text);
const heading = (p, text) => expect(p.locator('.ae-card h1')).toHaveText(text);
// Only the fixture state is injected. Submission, feedback and retry still use
// the product interface, which never renders development controls.
const setFailureMode = (p, mode) => p.evaluate(async (value) => {
  // Vite adds a version query after a source edit. Import the URL the page
  // actually loaded so the test changes the same module instance as the app.
  const loaded = performance.getEntriesByType('resource')
    .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
  if (!loaded) throw new Error('Prototype auth fixtures were not loaded');
  const fixtures = await import(loaded.name);
  fixtures.setFailureMode(value);
}, mode);

async function patchAuthMethod(p, method, source) {
  await p.evaluate(async ({ method: name, source: implementation }) => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const fixtures = await import(loaded.name);
    fixtures.PrototypeAuth.prototype[name] = eval(`(${implementation})`);
  }, { method, source: source.toString() });
}

async function blockStorageKey(p, key, { once = false } = {}) {
  await p.evaluate(({ key: blockedKey, once: firstOnly }) => {
    const original = Storage.prototype.setItem;
    let writes = 0;
    window.__restoreTeachBuddyStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function blockedSetItem(name, value) {
      if (name === blockedKey && (!firstOnly || writes++ === 0)) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return original.call(this, name, value);
    };
  }, { key, once });
}

async function blockStorageRead(p, key) {
  await p.evaluate((blockedKey) => {
    const original = Storage.prototype.getItem;
    window.__restoreTeachBuddyStorage = () => { Storage.prototype.getItem = original; };
    Storage.prototype.getItem = function blockedGetItem(name) {
      if (name === blockedKey) throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, name);
    };
  }, key);
}

async function restoreStorage(p) {
  await p.evaluate(() => window.__restoreTeachBuddyStorage?.());
}

async function markReset(p, address = EMAIL) {
  await p.evaluate(async (target) => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { RESET_KEY } = await import(loaded.name);
    const resets = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
    localStorage.setItem(RESET_KEY, JSON.stringify({ ...resets, [target]: Date.now() }));
  }, address);
}

async function corruptStorage(p, key, value) {
  await p.evaluate(({ key: target, value: contents }) => localStorage.setItem(target, contents), { key, value });
}
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

/* Fault injection uses Vite's source module URL; no page controls are needed. */
async function openEntry(p, url) {
  await p.goto(url, { waitUntil: 'networkidle' });
  await heading(p, '登录');
  await expect(p.locator('[aria-label="开发环境故障注入"], [aria-label="开发环境界面切换"]')).toHaveCount(0);
}

function withParams(url, params) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target.href;
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
  await expect(p.locator('.ae-field-note').last()).toContainText(address);
  await expect(code(p)).toBeVisible();
  await p.waitForTimeout(650);
}

/* Waits out the resend cooldown the way a user would. */
async function waitForResend(p) {
  const button = p.locator('.ae-combo button');
  await expect(button).toHaveText('重新发送', { timeout: 40000 });
}

export const deferredScenarios = [
  { id: 'CA53', reason: '原型暂不提供退出入口；这是用户约定的暂缺，退出范围与设置页设计另行处理。' }
];
export const scenarios = [];
function scenario(id, journey, description, run) {
  scenarios.push({ id: `CA${String(id).padStart(2, '0')}`, journey, description, run });
}

/* ---------------------------------------------------------------- 登录失败 */

scenario(41, 'login', '凭据错误：卡片顶部拒绝、密码清空、邮箱保留、可关闭', async (p, shot, { url }) => {
  await openEntry(p, url);
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
  await openEntry(p, url);
  await signIn(p, { address: 'nobody@example.com', secret: 'wrong-password' });
  await alert(p, '邮箱或密码不正确，请重试。');
  await shot('unknown-account');
  await p.reload({ waitUntil: 'networkidle' });
  await signIn(p, { secret: 'wrong-password' });
  await alert(p, '邮箱或密码不正确，请重试。');
  await shot('wrong-password');
});

scenario(43, 'login', '提交等待：按钮进入等待态并阻止第二次提交', async (p, shot, { url }) => {
  await openEntry(p, url);
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
  await setFailureMode(p, 'offline');
  await signIn(p);
  await alert(p, '网络连接不可用，请检查网络后重试。');
  await expect(password(p)).toHaveValue(PASSWORD);
  await expect(email(p)).toHaveValue(EMAIL);
  await shot('offline');
  await setFailureMode(p, 'normal');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('retried');
});

scenario(45, 'login', '服务故障：可关闭的横幅，不误标到字段上', async (p, shot, { url }) => {
  await openEntry(p, url);
  await setFailureMode(p, 'server');
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
  await setFailureMode(p, 'timeout');
  await signIn(p);
  await alert(p, '请求超时，请重试。');
  await shot('timeout');
  await setFailureMode(p, 'normal');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('retried');
});

scenario(47, 'login', '请求中修改密码：迟到结果不清空新输入或进入工作台', async (p, shot, { url }) => {
  await openEntry(p, url);
  await email(p).fill(EMAIL);
  await password(p).fill(PASSWORD);
  await submit(p);
  await expect(p.locator('.ae-primary')).toHaveText('登录中');
  await shot('pending');
  await password(p).fill('changed-while-pending');
  await expect(p.locator('.ae-primary')).toHaveText('登录');
  await shot('edited-while-pending');
  await heading(p, '登录');
  await expect(password(p)).toHaveValue('changed-while-pending');
  await expect(p.locator('.ae-notice')).toHaveCount(0);
  await shot('stale-result-dropped');
  await password(p).fill(PASSWORD);
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('recovered');
});

scenario(48, 'login', '请求中切换到注册：迟到结果不污染新表单', async (p, shot, { url }) => {
  await openEntry(p, url);
  await email(p).fill(EMAIL);
  await password(p).fill('wrong-password');
  const request = submit(p);
  await p.waitForTimeout(100);
  await switchCard(p);
  await request;
  await heading(p, '注册');
  await expect(nickname(p)).toBeVisible();
  await expect(p.locator('.ae-notice')).toHaveCount(0);
  await shot('switched');
});


/* ------------------------------------------------------------------ 会话 */

scenario(49, 'session', '勾选记住我：刷新后仍在工作台', async (p, shot, { url }) => {
  await openEntry(p, url);
  await expect(p.getByRole('checkbox', { name: '记住我' })).toBeChecked();
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await p.reload({ waitUntil: 'networkidle' });
  await expect(p.locator('.tb-shell')).toBeVisible();
  await expect(p.locator('.ae-session')).toHaveCount(0);
  await shot('restored');
});

scenario(50, 'session', '不勾选记住我：刷新即退出，回到空登录卡', async (p, shot, { url }) => {
  await openEntry(p, url);
  await p.getByRole('checkbox', { name: '记住我' }).uncheck();
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await p.reload({ waitUntil: 'networkidle' });
  await heading(p, '登录');
  await expect(email(p)).toHaveValue('');
  await shot('expired');
});

scenario(51, 'session', '换设备：另一台机器没有可恢复的会话', async (p, shot, { url, newContext }) => {
  await openEntry(p, url);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('first-device');
  const other = await newContext();
  const page = await other.newPage();
  await openEntry(page, url);
  await expect(page.locator('.ae-card')).toBeVisible();
  await shot('second-device', page);
  await signIn(page);
  await expect(page.locator('.tb-shell')).toBeVisible();
  await shot('second-device-signed-in', page);
  await other.close();
});

scenario(52, 'session', '会话在另一标签页失效：回到登录卡并说明原因', async (p, shot, { url }) => {
  await openEntry(p, url);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await dismissCoach(p);
  // Removing the remembered session in a second tab sends a real storage event
  // to this page. Do not fabricate a user-facing logout action or React state.
  const other = await p.context().newPage();
  try {
    await other.goto(url, { waitUntil: 'networkidle' });
    await other.evaluate(async () => {
      const { SESSION_KEY } = await import('/src/auth/demo-data.js');
      if (!localStorage.getItem(SESSION_KEY)) throw new Error('Expected a remembered session');
      localStorage.removeItem(SESSION_KEY);
    });
  } finally {
    await other.close();
  }
  await heading(p, '登录');
  await alert(p, '登录状态已过期，请重新登录。');
  await shot('expired-notice');
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('signed-in-again');
});


scenario(54, 'session', '密码重置后旧密码失效，新密码可用', async (p, shot, { url }) => {
  // Password recovery starts at the entry; no workbench logout action is required.
  await openEntry(p, url);
  await p.getByRole('button', { name: '忘记密码？' }).click();
  await email(p).fill(EMAIL);
  await submit(p);
  await heading(p, '设置新密码');
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
  await setFailureMode(p, 'server');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await alert(p, '服务暂时不可用，请稍后重试。');
  await expect(code(p)).toHaveCount(0);
  await shot('send-failed');
  await setFailureMode(p, 'normal');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await shot('send-retried');
});

scenario(56, 'register', '冷却：重发倒计时，冷却结束才能再发', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-cooldown': '200' }));
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
  await expect(resend).toHaveText('重新发送');
  await expect(p.locator('.ae-field-note')).toContainText('new@example.com');
  await shot('resent');
});

scenario(57, 'register', '验证码错误次数用尽后该码作废，需要重新发送', async (p, shot, { url }) => {
  await openEntry(p, url);
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
  // Advance Date beyond the code's real fixture lifetime without waiting ten
  // minutes. Request timers still run normally and no component is required.
  const expiredAt = await p.evaluate(async () => {
    const { CODE_TTL_MS } = await import('/src/auth/demo-data.js');
    return Date.now() + CODE_TTL_MS + 1;
  });
  await p.clock.setFixedTime(expiredAt);
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
  await openEntry(p, withParams(url, { 'dev-code': `${REGISTER_CODE},555555`, 'dev-no-cooldown': '' }));
  await startRegistration(p);
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await p.locator('.ae-combo button').click();
  await expect(code(p)).toBeVisible();
  await p.waitForTimeout(650);
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
  await openEntry(page, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
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
  await openEntry(p, url);
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
  await openEntry(p, url);
  await startRecovery(p);
  await expect(email(p)).toHaveAttribute('readonly', '');
  await expect(email(p)).toHaveValue(EMAIL);
  await expect(p.locator('.ae-field-hint').first()).toContainText('只对这个地址有效');
  await shot('bound-address');
});

scenario(62, 'recovery', '找回可重发，冷却与注册一致', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-cooldown': '1200' }));
  await startRecovery(p);
  const resend = p.locator('.ae-combo button');
  await expect(resend).toHaveText(/后重发/);
  await expect(resend).toBeDisabled();
  await expect(p.locator('.ae-field-note').last()).toContainText(EMAIL);
  await shot('sent');
  await waitForResend(p);
  await resend.click();
  await expect(resend).toHaveText('重新发送');
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
  await p.waitForTimeout(650);
  await heading(p, '登录');
  await alert(p, '密码已重置，请用新密码登录。');
  await shot('done');
  /* The next attempt sends a fresh challenge from the first recovery step. */
  await startRecovery(p, { send: false });
  await expect(p.locator('.ae-field-note').last()).toContainText(EMAIL);
  await shot('code-reissued');
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill(PASSWORD);
  await confirmation(p).fill(PASSWORD);
  await submit(p);
  await p.waitForTimeout(650);
  await heading(p, '登录');
  await alert(p, '密码已重置，请用新密码登录。');
  await shot('reset-again');
});

scenario(64, 'recovery', '找回发码遇到网络失败：横幅提示，可重试', async (p, shot, { url }) => {
  await openEntry(p, url);
  await p.getByRole('button', { name: '忘记密码？' }).click();
  await heading(p, '找回密码');
  await email(p).fill(EMAIL);
  await setFailureMode(p, 'offline');
  await submit(p);
  await alert(p, '网络连接不可用，请检查网络后重试。');
  await heading(p, '找回密码');
  await shot('send-failed');
  await setFailureMode(p, 'normal');
  await submit(p);
  await heading(p, '设置新密码');
  await expect(p.locator('.ae-field-note').last()).toContainText(EMAIL);
  await shot('send-retried');
});

/* ----------------------------------------------------------- 收口分支 */

scenario(65, 'register', '注册能力关闭：已填写并发码的页面收到可见拒绝并回登录', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, {
    'dev-code': REGISTER_CODE,
    'dev-no-cooldown': '',
    'dev-register-closes-after': '6000'
  }));
  await startRegistration(p);
  await pressSend(p);
  await expect(code(p)).toBeVisible();
  await p.waitForTimeout(4500);
  await expect(p.locator('.ae-closed-state')).toContainText('暂时不能创建新账户');
  await shot('closed-after-code');
  await p.getByRole('button', { name: '返回登录' }).first().click();
  await heading(p, '登录');
  await shot('return-login');
});

scenario(66, 'register', '注册关闭发生在提交等待中：不创建账户、不消费验证码', async (p, shot, { url }) => {
  const address = 'closing-submit@example.com';
  await p.clock.install({ time: Date.now() });
  await p.clock.pauseAt(Date.now());
  await openEntry(p, withParams(url, {
    'dev-code': REGISTER_CODE,
    'dev-no-cooldown': '',
    'dev-register-closes-after': '700'
  }));
  await startRegistration(p, { address, name: '关闭时提交' });
  const sendRequest = pressSend(p);
  await expect(p.getByRole('button', { name: '发送中', exact: true })).toBeVisible();
  await p.clock.runFor(450);
  await sendRequest;
  await expect(code(p)).toBeVisible();
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  const submitRequest = submit(p);
  await expect(p.locator('.ae-primary')).toHaveText('注册中');
  await p.clock.runFor(500);
  await submitRequest;
  await expect(p.locator('.ae-closed-state')).toContainText('暂时不能创建新账户');
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await p.clock.resume();
  await shot('closed-during-submit');
  await p.getByRole('button', { name: '返回登录' }).first().click();
  await email(p).fill(address);
  await password(p).fill(PASSWORD);
  await submit(p);
  await alert(p, '邮箱或密码不正确');
  await shot('account-not-created');
});

scenario(67, 'register', '注册响应丢失：保留输入，回登录使用已创建账户恢复', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, {
    'dev-code': REGISTER_CODE,
    'dev-no-cooldown': '',
    'dev-result': 'register'
  }));
  const address = 'unknown-register-scenario@example.com';
  await startRegistration(p, { address, name: '结果待确认' });
  await pressSend(p);
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  await submit(p);
  await alert(p, '结果暂未确认');
  await shot('unknown-result');
  await p.getByRole('button', { name: '登录', exact: true }).last().click();
  await email(p).fill(address);
  await password(p).fill(PASSWORD);
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('recovered-by-login');
});

scenario(68, 'recovery', '重置响应丢失：保留新密码，回登录用新密码恢复', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, {
    'dev-no-cooldown': '',
    'dev-result': 'reset'
  }));
  await startRecovery(p);
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill('unknown-result-reset');
  await confirmation(p).fill('unknown-result-reset');
  await submit(p);
  await alert(p, '结果暂未确认');
  await shot('unknown-result');
  await p.getByRole('button', { name: '返回登录', exact: true }).last().click();
  await email(p).fill(EMAIL);
  await password(p).fill('unknown-result-reset');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('recovered-by-new-password');
});

scenario(69, 'register', '账户持久写入失败：注册失败但验证码可用，恢复后同码重试', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(p, { address: 'account-write-retry@example.com', name: '账户写入重试' });
  await pressSend(p);
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  await blockStorageKey(p, 'teachbuddy-prototype-accounts');
  await submit(p);
  await alert(p, '暂时无法完成，请重试');
  await shot('write-failed');
  await restoreStorage(p);
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('write-retried');
});

scenario(70, 'recovery', '密码持久写入失败：重置失败但验证码可用，恢复后同码重试', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await startRecovery(p);
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill('storage-reset-retry');
  await confirmation(p).fill('storage-reset-retry');
  await blockStorageKey(p, 'teachbuddy-prototype-accounts');
  await submit(p);
  await alert(p, '暂时无法完成，请重试');
  await shot('write-failed');
  await restoreStorage(p);
  await submit(p);
  await heading(p, '登录');
  await alert(p, '密码已重置');
  await shot('write-retried');
});

scenario(71, 'session', '记住我写入失败：继续当前会话或重试保存，不重复登录业务', async (p, shot, { url }) => {
  await openEntry(p, url);
  await blockStorageKey(p, 'teachbuddy-prototype-session', { once: true });
  await signIn(p);
  await expect(p.locator('.ae-session-recovery')).toBeVisible();
  await alert(p, '登录状态未保存');
  await shot('save-failed');
  await restoreStorage(p);
  await p.getByRole('button', { name: '重试保存登录状态' }).click();
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('save-retried');
});

scenario(72, 'session', '会话恢复失败：等待卡不闪现登录，重试后恢复', async (p, shot, { url }) => {
  await openEntry(p, url);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await p.goto(withParams(url, { 'dev-restore': 'fail' }), { waitUntil: 'domcontentloaded' });
  await expect(p.locator('.ae-restore-card h1')).toHaveText('恢复失败');
  await expect(p.locator('.ae-form')).toHaveCount(0);
  await shot('restore-failed');
  await p.getByRole('button', { name: '重试' }).click();
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('restore-retried');
});

scenario(73, 'session', '会话恢复等待：等待期间不显示登录表单或工作台，成功后交接', async (p, shot, { url }) => {
  await openEntry(p, url);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await p.goto(withParams(url, { 'dev-restore': 'slow' }), { waitUntil: 'domcontentloaded' });
  await expect(p.locator('.ae-restore-card')).toContainText('正在恢复');
  await expect(p.locator('.ae-form, .tb-shell')).toHaveCount(0);
  await shot('restore-waiting');
  await expect(p.locator('.tb-shell')).toBeVisible({ timeout: 5000 });
  await shot('restore-success');
});

scenario(74, 'register', '验证码形状与条款优先级：本地错误先于业务值校验', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(p, { address: 'terms-order@example.com', name: '条款顺序' });
  await pressSend(p);
  await code(p).fill('12');
  await submit(p);
  await fieldAlert(p, '6 位数字验证码（0-9）');
  await shot('code-shape-first');
  await code(p).fill('000000');
  await submit(p);
  await fieldAlert(p, '同意服务条款');
  await shot('terms-before-code-value');
  await p.locator('.is-terms input').check();
  await submit(p);
  await fieldAlert(p, '还可以再试 4 次');
  await shot('value-checked-after-terms');
});

scenario(75, 'register', '邮箱规范化：输入保留原样，发码与账户身份使用 trim 后小写', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  const raw = '  Normalize@Example.COM  ';
  await startRegistration(p, { address: raw, name: '  归一化老师  ' });
  await expect(email(p)).toHaveValue(raw);
  await pressSend(p);
  await expect(p.locator('.ae-field-note')).toContainText('normalize@example.com');
  await shot('normalized-destination');
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await expect(p.locator('.tb-account-name')).toHaveText('归一化老师');
  await p.reload({ waitUntil: 'networkidle' });
  await expect(p.locator('.tb-account-name')).toHaveText('归一化老师');
  await shot('normalized-account-restored');
});

scenario(76, 'session', '长昵称：账号行省略但可访问名称完整，头像使用完整 Unicode 字符', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  const longName = ['😀', ...Array(39).fill('长')].join('');
  expect(Array.from(longName)).toHaveLength(40);
  await startRegistration(p, { address: 'long-nickname@example.com', name: longName });
  await pressSend(p);
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await expect(p.locator('.tb-account-row')).toHaveAttribute('aria-label', `账户：${longName}`);
  await expect(p.locator('.tb-account-row')).toHaveAttribute('title', longName);
  await expect(p.locator('.tb-avatar')).toHaveText(Array.from(longName)[0]);
  await dismissCoach(p);
  const mobileMenu = p.locator('.tb-mobile-menu');
  if (await mobileMenu.count() && await mobileMenu.isVisible()) await mobileMenu.click();
  await expect(p.locator('.tb-account-row')).toBeVisible();
  const geometry = await p.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    nameWidth: document.querySelector('.tb-account-name')?.scrollWidth,
    nameClientWidth: document.querySelector('.tb-account-name')?.clientWidth
  }));
  expect(geometry.overflow).toBe(false);
  expect(geometry.nameWidth).toBeGreaterThanOrEqual(geometry.nameClientWidth);
  await shot('long-name-account-row');
});

scenario(77, 'login', '未知异常：显示统一可重试文案并保留凭据输入', async (p, shot, { url }) => {
  await openEntry(p, url);
  await patchAuthMethod(p, 'signIn', async function signIn() { throw new Error('PRIVATE_INTERNAL_STACK'); });
  await email(p).fill(EMAIL);
  await password(p).fill(PASSWORD);
  await submit(p);
  await alert(p, '暂时无法完成，请重试');
  await expect(password(p)).toHaveValue(PASSWORD);
  await expect(p.locator('.ae-notice')).not.toContainText('PRIVATE_INTERNAL_STACK');
  await shot('unknown-error');
});

scenario(78, 'recovery', '未收邮件：显示等待、冷却、重发和更换邮箱路径', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-cooldown': '1400' }));
  await startRecovery(p);
  await expect(p.locator('.ae-field-hint').last()).toContainText('没有收到验证码');
  await expect(p.locator('.ae-combo button')).toBeDisabled();
  await shot('waiting-and-cooldown');
  await p.waitForTimeout(900);
  await expect(p.locator('.ae-combo button')).toHaveText('重新发送');
  await p.locator('.ae-combo button').click();
  await expect(p.locator('.ae-combo button')).toHaveText('重新发送');
  await shot('resent');
  await p.getByRole('button', { name: '更换邮箱' }).click();
  await heading(p, '找回密码');
  await expect(email(p)).not.toHaveAttribute('readonly');
  await shot('change-address');
});

scenario(79, 'session', '待处理登录状态被外部重置：存储事件回到登录并说明过期', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await blockStorageKey(p, 'teachbuddy-prototype-session');
  await signIn(p);
  await expect(p.locator('.ae-session-recovery')).toBeVisible();
  const other = await p.context().newPage();
  try {
    await other.goto(withParams(url, { 'dev-no-cooldown': '' }), { waitUntil: 'networkidle' });
    await other.evaluate(async () => {
      const loaded = performance.getEntriesByType('resource')
        .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
      const { RESET_KEY } = await import(loaded.name);
      const resets = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
      localStorage.setItem(RESET_KEY, JSON.stringify({ ...resets, ["example@example.com"]: Date.now() }));
    });
  } finally {
    await other.close();
  }
  await expect(p.locator('.ae-session-recovery')).toHaveCount(0);
  await expect(p.locator('.ae-form')).toBeVisible();
  await alert(p, '登录状态已过期');
  await shot('revoked-by-storage');
});

scenario(80, 'session', '继续当前会话前重新核验：已重置的待处理身份不能进入工作台', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await blockStorageKey(p, 'teachbuddy-prototype-session');
  await signIn(p);
  await expect(p.locator('.ae-session-recovery')).toBeVisible();
  await p.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { RESET_KEY } = await import(loaded.name);
    const resets = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
    localStorage.setItem(RESET_KEY, JSON.stringify({ ...resets, ["example@example.com"]: Date.now() }));
  });
  await p.getByRole('button', { name: '继续进入工作台' }).click();
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await expect(p.locator('.ae-form')).toBeVisible();
  await alert(p, '登录状态已过期');
  await shot('continue-rejected');
});

scenario(81, 'session', '重试保存前重新核验：已重置的待处理身份不能写回会话', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await blockStorageKey(p, 'teachbuddy-prototype-session');
  await signIn(p);
  await expect(p.locator('.ae-session-recovery')).toBeVisible();
  await p.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { RESET_KEY } = await import(loaded.name);
    const resets = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
    localStorage.setItem(RESET_KEY, JSON.stringify({ ...resets, ["example@example.com"]: Date.now() }));
  });
  await p.getByRole('button', { name: '重试保存登录状态' }).click();
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await expect(p.locator('.ae-form')).toBeVisible();
  await alert(p, '登录状态已过期');
  await shot('retry-rejected');
});

scenario(82, 'register', '注册发码等待：按钮锁定，重复点击不重复发起请求', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(p, { address: 'register-send-pending@example.com', name: '发码等待' });
  const send = p.locator('.ae-send.is-block');
  const request = send.click();
  await p.waitForTimeout(80);
  await expect(send).toHaveText('发送中');
  await expect(send).toBeDisabled();
  await send.click({ force: true }).catch(() => {});
  await shot('pending');
  await request;
  await expect(code(p)).toBeVisible();
  await expect(p.locator('.ae-field-note')).toHaveCount(1);
  await shot('settled');
});

scenario(83, 'register', '注册提交等待：按钮锁定，重复点击不重复创建账户', async (p, shot, { url }) => {
  const address = 'register-submit-pending@example.com';
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(p, { address, name: '提交等待' });
  await pressSend(p);
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  const primary = p.locator('.ae-primary');
  const request = primary.click();
  await p.waitForTimeout(80);
  await expect(primary).toHaveText('注册中');
  await expect(primary).toBeDisabled();
  await primary.click({ force: true }).catch(() => {});
  await shot('pending');
  await request;
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('settled');
});

scenario(84, 'recovery', '找回首次发码等待：按钮锁定，重复点击不重复发码', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await p.getByRole('button', { name: '忘记密码？' }).click();
  await email(p).fill(EMAIL);
  const primary = p.locator('.ae-primary');
  const request = primary.click();
  await p.waitForTimeout(80);
  await expect(primary).toHaveText('发送中');
  await expect(primary).toBeDisabled();
  await primary.click({ force: true }).catch(() => {});
  await shot('pending');
  await request;
  await heading(p, '设置新密码');
  await expect(code(p)).toBeVisible();
  await shot('settled');
});

scenario(85, 'recovery', '找回重发等待：按钮锁定，重复点击不重复发码', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await startRecovery(p);
  const resend = p.locator('.ae-combo button');
  const request = resend.click();
  await p.waitForTimeout(80);
  await expect(resend).toHaveText('发送中');
  await expect(resend).toBeDisabled();
  await resend.click({ force: true }).catch(() => {});
  await shot('pending');
  await request;
  await expect(resend).toHaveText('重新发送');
  await shot('settled');
});

scenario(86, 'recovery', '重置提交等待：按钮锁定，重复点击不重复改密', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await startRecovery(p);
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill('reset-submit-pending');
  await confirmation(p).fill('reset-submit-pending');
  const primary = p.locator('.ae-primary');
  const request = primary.click();
  await p.waitForTimeout(80);
  await expect(primary).toHaveText('提交中');
  await expect(primary).toBeDisabled();
  await primary.click({ force: true }).catch(() => {});
  await shot('pending');
  await request;
  await heading(p, '登录');
  await shot('settled');
});

scenario(87, 'register', '注册发码途中改地址：旧响应丢弃，只有新地址能继续', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(p, { address: 'register-race-old@example.com', name: '改地址竞态' });
  const send = p.getByRole('button', { name: '发送验证码', exact: true });
  const request = send.click();
  await p.waitForTimeout(80);
  await email(p).fill('register-race-new@example.com');
  await request;
  await p.waitForTimeout(120);
  await expect(email(p)).toHaveValue('register-race-new@example.com');
  await expect(code(p)).toHaveCount(0);
  await expect(p.locator('.ae-field-note')).toHaveCount(0);
  await shot('old-response-dropped');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await expect(p.locator('.ae-field-note')).toContainText('register-race-new@example.com');
  await shot('new-address-sent');
});

scenario(88, 'recovery', '找回发码途中切换用途：旧响应不进入确认卡', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await p.getByRole('button', { name: '忘记密码？' }).click();
  await email(p).fill(EMAIL);
  const request = p.locator('.ae-primary').click();
  await p.waitForTimeout(80);
  await p.getByRole('button', { name: '返回登录', exact: true }).click();
  await request;
  await heading(p, '登录');
  await expect(code(p)).toHaveCount(0);
  await expect(p.locator('.ae-notice')).toHaveCount(0);
  await shot('purpose-switch-drops-response');
});

scenario(89, 'recovery', '重置提交途中切卡：迟到成功不自动跳转或污染登录卡', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await startRecovery(p);
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill('reset-switch-card');
  await confirmation(p).fill('reset-switch-card');
  const request = p.locator('.ae-primary').click();
  await p.waitForTimeout(80);
  await p.getByRole('button', { name: '返回登录', exact: true }).click();
  await request;
  await heading(p, '登录');
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await expect(p.locator('.ae-notice')).toHaveCount(0);
  await shot('switched-during-reset');
});

scenario(90, 'recovery', '重置提交途中改密码：迟到结果不清空新输入，业务按提交快照完成', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await startRecovery(p);
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill('reset-before-edit');
  await confirmation(p).fill('reset-before-edit');
  const request = p.locator('.ae-primary').click();
  await p.waitForTimeout(80);
  await password(p).fill('reset-after-edit');
  await confirmation(p).fill('reset-after-edit');
  await request;
  await heading(p, '设置新密码');
  await expect(password(p)).toHaveValue('reset-after-edit');
  await expect(p.locator('.ae-notice')).toHaveCount(0);
  await shot('edited-during-reset');
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: '返回登录', exact: true }).click();
  await email(p).fill(EMAIL);
  await password(p).fill('reset-before-edit');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('snapshot-password-recovers');
});

scenario(91, 'register', '注册提交途中切卡：迟到创建不自动跳转，完成账户可由登录恢复', async (p, shot, { url }) => {
  const address = 'register-submit-switch@example.com';
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(p, { address, name: '注册切卡' });
  await pressSend(p);
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  const request = p.locator('.ae-primary').click();
  await p.waitForTimeout(80);
  await p.getByRole('button', { name: '登录', exact: true }).click();
  await request;
  await heading(p, '登录');
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await expect(p.locator('.ae-notice')).toHaveCount(0);
  await shot('switched-during-register');
  await email(p).fill(address);
  await password(p).fill(PASSWORD);
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('created-account-recovers');
});

scenario(92, 'recovery', '响应丢失后重试已消费验证码：明确提示已使用，再用新密码恢复', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '', 'dev-result': 'reset' }));
  await startRecovery(p);
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill('consumed-recovery-password');
  await confirmation(p).fill('consumed-recovery-password');
  await submit(p);
  await alert(p, '结果暂未确认');
  await shot('response-unknown-after-consume');
  await submit(p);
  await fieldAlert(p, '已经用过了');
  await shot('consumed-code-rejected');
  await p.getByRole('button', { name: '返回登录', exact: true }).click();
  await email(p).fill(EMAIL);
  await password(p).fill('consumed-recovery-password');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('new-password-recovers');
});

scenario(93, 'recovery', '验证码挑战消费状态：同一 challengeId 的第二次验证返回已消费', async (p, shot, { url }) => {
  await openEntry(p, url);
  const verdict = await p.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { PrototypeAuth } = await import(loaded.name);
    const auth = new PrototypeAuth();
    const sent = await auth.sendCode({ email: 'example@example.com', purpose: 'recovery', code: '654321', force: true });
    const first = auth.verifyCode({ email: sent.email, purpose: 'recovery', code: '654321', challengeId: sent.challengeId, consume: true });
    const second = auth.verifyCode({ email: sent.email, purpose: 'recovery', code: '654321', challengeId: sent.challengeId, consume: true });
    return { first: first.kind || 'ok', second: second.kind || 'ok' };
  });
  expect(verdict).toEqual({ first: 'ok', second: 'used' });
  await shot('consumed-challenge-reuse-rejected');
});

scenario(94, 'register', '重发失败：旧码保留且不启动新冷却，恢复后旧码仍可成功', async (p, shot, { url }) => {
  const address = 'resend-failure-keeps-code@example.com';
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(p, { address, name: '旧码重试' });
  await pressSend(p);
  await code(p).fill(REGISTER_CODE);
  await setFailureMode(p, 'offline');
  await p.getByRole('button', { name: '重新发送', exact: true }).click();
  await alert(p, '网络连接不可用');
  await expect(code(p)).toHaveValue(REGISTER_CODE);
  const resend = p.getByRole('button', { name: '重新发送', exact: true });
  await expect(resend).toBeEnabled();
  await shot('resend-failed-old-code-kept');
  await setFailureMode(p, 'normal');
  await resend.click();
  await expect(resend).toHaveText('重新发送');
  await p.locator('.is-terms input').check();
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('old-code-retried');
});

scenario(95, 'session', '真实浏览器重开：记住我会话从新浏览器上下文恢复', async (p, shot, { url }) => {
  const viewport = p.viewportSize() || { width: 1440, height: 900 };
  const profileRoot = process.env.PROTOTYPE_TEMP_DIR
    ? path.resolve(process.env.PROTOTYPE_TEMP_DIR)
    : tmpdir();
  const profileDir = await fs.mkdtemp(path.join(profileRoot, 'ca95-profile-'));
  let firstRun;
  let reopened;
  try {
    firstRun = await chromium.launchPersistentContext(profileDir, {
      headless: true,
      viewport
    });
    const firstPage = await firstRun.newPage();
    await openEntry(firstPage, url);
    await signIn(firstPage);
    await expect(firstPage.locator('.tb-shell')).toBeVisible();
    await dismissCoach(firstPage);
    await firstRun.close();
    firstRun = undefined;

    reopened = await chromium.launchPersistentContext(profileDir, {
      headless: true,
      viewport
    });
    const page = reopened.pages()[0] || await reopened.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await expect.poll(async () => page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
      .toEqual(viewport);
    await expect(page.locator('.tb-shell')).toBeVisible();
    await expect(page.locator('.tb-account-name')).toHaveText('林老师');
    await shot('reopened-browser', page);
  } finally {
    await reopened?.close().catch(() => {});
    await firstRun?.close().catch(() => {});
    await fs.rm(profileDir, { recursive: true, force: true });
  }
});

scenario(96, 'session', '账户存储损坏：恢复失败可返回登录，不回退到种子密码', async (p, shot, { url }) => {
  await openEntry(p, url);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await corruptStorage(p, 'teachbuddy-prototype-accounts', '{"version":1,"accounts":[{"email":"bad"}]}');
  await p.reload({ waitUntil: 'networkidle' });
  await expect(p.locator('.ae-restore-card h1')).toHaveText('恢复失败');
  await expect(p.locator('.ae-form')).toHaveCount(0);
  await shot('corrupt-store-restore-failed');
  await p.getByRole('button', { name: '返回登录' }).click();
  await heading(p, '登录');
  await email(p).fill(EMAIL);
  await password(p).fill(PASSWORD);
  await submit(p);
  await alert(p, '暂时无法完成，请重试');
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await shot('corrupt-store-login-retry');
});

scenario(97, 'session', '恢复等待中会话被移除：不迟到进入工作台，回登录提示过期', async (p, shot, { url }) => {
  await openEntry(p, url);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  const slowUrl = withParams(url, { 'dev-restore': 'slow' });
  await p.goto(slowUrl, { waitUntil: 'domcontentloaded' });
  await expect(p.locator('.ae-restore-card')).toContainText('正在恢复');
  const other = await p.context().newPage();
  await other.goto(url, { waitUntil: 'networkidle' });
  await other.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { SESSION_KEY } = await import(loaded.name);
    localStorage.removeItem(SESSION_KEY);
  });
  await other.close();
  await expect(p.locator('.ae-form')).toBeVisible({ timeout: 5000 });
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await alert(p, '登录状态已过期');
  await p.waitForTimeout(1300);
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await shot('restore-revoked');
});

scenario(98, 'session', '恢复等待中会话到期：恢复结束回登录并提示过期', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await p.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { SESSION_KEY } = await import(loaded.name);
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...saved, expiresAt: Date.now() + 100 }));
  });
  await p.goto(withParams(url, { 'dev-restore': 'slow', 'dev-no-cooldown': '' }), { waitUntil: 'domcontentloaded' });
  await expect(p.locator('.ae-restore-card')).toContainText('正在恢复');
  await expect(p.locator('.ae-form')).toHaveCount(0);
  await p.waitForTimeout(1500);
  await heading(p, '登录');
  await alert(p, '登录状态已过期');
  await shot('restore-expired');
});

scenario(99, 'session', '多账户隔离：重置一个账户时另一账户工作台保持可见', async (p, shot, { url }) => {
  const scenarioUrl = withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' });
  await openEntry(p, scenarioUrl);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await p.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { SESSION_KEY } = await import(loaded.name);
    localStorage.removeItem(SESSION_KEY);
  });
  const other = await p.context().newPage();
  await other.goto(scenarioUrl, { waitUntil: 'networkidle' });
  await other.getByRole('button', { name: '创建账户' }).click();
  await other.locator('input[autocomplete="nickname"]').fill('另一账户老师');
  await other.locator('input[autocomplete="email"]').fill('other-isolated@example.com');
  await other.locator('.ae-password input').fill(PASSWORD);
  await other.locator('input[autocomplete="new-password"]').last().fill(PASSWORD);
  await other.getByRole('button', { name: '发送验证码', exact: true }).click();
  await other.locator('input[inputmode="numeric"]').fill(REGISTER_CODE);
  await other.locator('.is-terms input').check();
  await blockStorageKey(other, 'teachbuddy-prototype-session');
  await other.getByRole('button', { name: '注册', exact: true }).click();
  await expect(other.locator('.ae-session-recovery')).toBeVisible();
  await restoreStorage(other);
  await other.getByRole('button', { name: '继续进入工作台' }).click();
  await expect(other.locator('.tb-shell')).toBeVisible();
  await expect(other.locator('.tb-account-name')).toHaveText('另一账户老师');
  const external = await p.context().newPage();
  await external.goto(scenarioUrl, { waitUntil: 'networkidle' });
  await external.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { ACCOUNT_KEY, RESET_KEY } = await import(loaded.name);
    const accounts = JSON.parse(localStorage.getItem(ACCOUNT_KEY));
    const next = accounts.accounts.map((account) => account.email === 'example@example.com'
      ? { ...account, password: 'isolated-reset-password' }
      : account);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ ...accounts, accounts: next }));
    const resets = JSON.parse(localStorage.getItem(RESET_KEY) || '{}');
    localStorage.setItem(RESET_KEY, JSON.stringify({ ...resets, 'example@example.com': Date.now() }));
  });
  await external.close();
  await expect(p.locator('.ae-form')).toBeVisible();
  await alert(p, '登录状态已过期');
  await expect(other.locator('.tb-shell')).toBeVisible();
  await expect(other.locator('.tb-account-name')).toHaveText('另一账户老师');
  await shot('reset-account-expired', p);
  await shot('other-account-kept', other);
  await other.close();
});

scenario(100, 'login', '登录缺失结果：统一失败文案，保留输入且不进入工作台', async (p, shot, { url }) => {
  await openEntry(p, url);
  await patchAuthMethod(p, 'signIn', async function signIn() { return undefined; });
  await email(p).fill(EMAIL);
  await password(p).fill(PASSWORD);
  await submit(p);
  await alert(p, '暂时无法完成，请重试');
  await expect(password(p)).toHaveValue(PASSWORD);
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await shot('undefined-sign-in');
});

scenario(101, 'register', '发码缺失结果：留在第一步，不进入验证码确认', async (p, shot, { url }) => {
  await openEntry(p, url);
  await startRegistration(p, { address: 'undefined-send-code@example.com', name: '发码缺失' });
  await patchAuthMethod(p, 'sendCode', async function sendCode() { return undefined; });
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await alert(p, '暂时无法完成，请重试');
  await expect(code(p)).toHaveCount(0);
  await heading(p, '注册');
  await shot('undefined-send-code');
});

scenario(102, 'register', '注册缺失结果：保留表单并显示通用失败，不进入工作台', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }));
  await startRegistration(p, { address: 'undefined-register@example.com', name: '注册缺失' });
  await pressSend(p);
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  await patchAuthMethod(p, 'register', async function register() { return undefined; });
  await submit(p);
  await alert(p, '暂时无法完成，请重试');
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await expect(email(p)).toHaveValue('undefined-register@example.com');
  await shot('undefined-register');
});

scenario(103, 'recovery', '重置缺失结果：停留在确认卡，不显示成功', async (p, shot, { url }) => {
  await openEntry(p, withParams(url, { 'dev-no-cooldown': '' }));
  await startRecovery(p);
  await patchAuthMethod(p, 'resetPassword', async function resetPassword() { return undefined; });
  await code(p).fill(RECOVERY_CODE);
  await password(p).fill('undefined-reset-password');
  await confirmation(p).fill('undefined-reset-password');
  await submit(p);
  await alert(p, '暂时无法完成，请重试');
  await heading(p, '设置新密码');
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await shot('undefined-reset');
});

scenario(104, 'register', '注册关闭提交副作用：账户不创建，重新开放后可以重新走注册', async (p, shot, { url }) => {
  const address = 'closed-side-effect@example.com';
  await openEntry(p, withParams(url, {
    'dev-code': REGISTER_CODE,
    'dev-no-cooldown': '',
    'dev-register-closes-after': '1800'
  }));
  await startRegistration(p, { address, name: '关闭副作用' });
  await pressSend(p);
  await p.waitForTimeout(1000);
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  await submit(p);
  await p.waitForTimeout(650);
  await expect(p.locator('.ae-closed-state')).toBeVisible();
  await p.getByRole('button', { name: '返回登录' }).first().click();
  await email(p).fill(address);
  await password(p).fill(PASSWORD);
  await submit(p);
  await alert(p, '邮箱或密码不正确');
  await shot('closed-no-account');
  await p.goto(withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' }), { waitUntil: 'networkidle' });
  await startRegistration(p, { address, name: '关闭后重试' });
  await pressSend(p);
  await code(p).fill(REGISTER_CODE);
  await p.locator('.is-terms input').check();
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('reopened-register-success');
});

scenario(105, 'recovery', '验证码用途和地址绑定：错误用途或地址的 challengeId 不可验证', async (p, shot, { url }) => {
  await openEntry(p, url);
  const verdict = await p.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { PrototypeAuth } = await import(loaded.name);
    const auth = new PrototypeAuth();
    const sent = await auth.sendCode({ email: 'example@example.com', purpose: 'recovery', code: '654321', force: true });
    return {
      wrongPurpose: auth.verifyCode({ email: sent.email, purpose: 'register', code: '654321', challengeId: sent.challengeId }).kind,
      wrongAddress: auth.verifyCode({ email: 'other@example.com', purpose: 'recovery', code: '654321', challengeId: sent.challengeId }).kind
    };
  });
  expect(verdict).toEqual({ wrongPurpose: 'missing', wrongAddress: 'missing' });
  await shot('purpose-address-bound');
});

scenario(106, 'session', '会话存储畸形：恢复失败可返回登录，不静默进入工作台', async (p, shot, { url }) => {
  await openEntry(p, url);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await corruptStorage(p, 'teachbuddy-prototype-session', '{"email":"example@example.com","remember":true}');
  await p.reload({ waitUntil: 'networkidle' });
  await expect(p.locator('.ae-restore-card h1')).toHaveText('恢复失败');
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await shot('malformed-session-failed');
  await p.getByRole('button', { name: '返回登录' }).click();
  await heading(p, '登录');
  await shot('malformed-session-return-login');
});

scenario(107, 'login', '账户服务读取不可用：登录显示可重试失败，不回退示例账户', async (p, shot, { url }) => {
  await openEntry(p, url);
  await blockStorageRead(p, 'teachbuddy-prototype-accounts');
  await signIn(p);
  await alert(p, '暂时无法完成，请重试');
  await expect(p.locator('.tb-shell')).toHaveCount(0);
  await expect(password(p)).toHaveValue(PASSWORD);
  await shot('account-store-unavailable');
});

scenario(108, 'session', '外部账户重置：当前设备回登录，其他设备的不同账户保持工作台', async (p, shot, { url }) => {
  const scenarioUrl = withParams(url, { 'dev-code': REGISTER_CODE, 'dev-no-cooldown': '' });
  await openEntry(p, scenarioUrl);
  await signIn(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await p.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource')
      .findLast(entry => new URL(entry.name).pathname === '/src/auth/demo-data.js');
    const { SESSION_KEY } = await import(loaded.name);
    localStorage.removeItem(SESSION_KEY);
  });
  const other = await p.context().newPage();
  await other.goto(scenarioUrl, { waitUntil: 'networkidle' });
  await other.getByRole('button', { name: '创建账户' }).click();
  await other.locator('input[autocomplete="nickname"]').fill('独立设备老师');
  await other.locator('input[autocomplete="email"]').fill('independent-device@example.com');
  await other.locator('.ae-password input').fill(PASSWORD);
  await other.locator('input[autocomplete="new-password"]').last().fill(PASSWORD);
  await other.getByRole('button', { name: '发送验证码', exact: true }).click();
  await other.locator('input[inputmode="numeric"]').fill(REGISTER_CODE);
  await other.locator('.is-terms input').check();
  await blockStorageKey(other, 'teachbuddy-prototype-session');
  await other.getByRole('button', { name: '注册', exact: true }).click();
  await expect(other.locator('.ae-session-recovery')).toBeVisible();
  await restoreStorage(other);
  await other.getByRole('button', { name: '继续进入工作台' }).click();
  await expect(other.locator('.tb-shell')).toBeVisible();
  await markReset(other, EMAIL);
  await expect(p.locator('.ae-form')).toBeVisible();
  await alert(p, '登录状态已过期');
  await expect(other.locator('.tb-shell')).toBeVisible();
  await expect(other.locator('.tb-account-name')).toHaveText('独立设备老师');
  await shot('reset-current-device', p);
  await shot('other-device-kept', other);
  await other.close();
});

scenario(109, 'session', '继续当前会话是临时会话：无关持久会话变化不将其踢出', async (p, shot, { url }) => {
  await openEntry(p, url);
  await blockStorageKey(p, 'teachbuddy-prototype-session', { once: true });
  await signIn(p);
  await expect(p.locator('.ae-session-recovery')).toBeVisible();
  await restoreStorage(p);
  await p.getByRole('button', { name: '继续进入工作台' }).click();
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('temporary-session');
  const other = await p.context().newPage();
  await other.goto(url, { waitUntil: 'networkidle' });
  await email(other).fill(EMAIL);
  await password(other).fill(PASSWORD);
  await other.locator('.ae-primary').click();
  await expect(other.locator('.tb-shell')).toBeVisible();
  await p.waitForTimeout(300);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('persistent-change-ignored');
  await other.close();
});

scenario(120, 'register', '离开保存失败卡后旧 pending 结束：另一页重置不清空新注册表单', async (p, shot, { url }) => {
  const scenarioUrl = withParams(url, { 'dev-no-cooldown': '' });
  await openEntry(p, scenarioUrl);
  await blockStorageKey(p, 'teachbuddy-prototype-session');
  await signIn(p);
  await expect(p.locator('.ae-session-recovery')).toBeVisible();
  await p.getByRole('button', { name: '创建账户', exact: true }).click();
  await heading(p, '注册');
  await nickname(p).fill('正在填写的老师');
  await email(p).fill('another@example.com');
  await password(p).fill(PASSWORD);
  await confirmation(p).fill(PASSWORD);
  const other = await p.context().newPage();
  await other.goto(scenarioUrl, { waitUntil: 'networkidle' });
  await other.getByRole('button', { name: '忘记密码？' }).click();
  await other.locator('input[autocomplete="email"]').fill(EMAIL);
  await other.locator('.ae-primary').click();
  await other.locator('input[inputmode="numeric"]').fill(RECOVERY_CODE);
  await other.locator('.ae-password input').fill('pending-exit-reset');
  await other.locator('input[autocomplete="new-password"]').last().fill('pending-exit-reset');
  await other.locator('.ae-primary').click();
  await heading(other, '登录');
  await expect(p.locator('.ae-card h1')).toHaveText('注册');
  await expect(nickname(p)).toHaveValue('正在填写的老师');
  await expect(email(p)).toHaveValue('another@example.com');
  await expect(password(p)).toHaveValue(PASSWORD);
  await expect(p.locator('.ae-notice')).toHaveCount(0);
  await shot('new-form-survives-old-reset');
  await other.close();
});
