import { expect } from '@playwright/test';

export const viewports = [
  { name: 'PC', width: 1440, height: 900 },
  { name: '平板', width: 768, height: 1024 },
  { name: '手机', width: 390, height: 844 }
];

const email = (p) => p.locator('.ae-form input[type="email"]');
const password = (p) => p.locator('.ae-password input');
const confirmation = (p) => p.locator('.ae-field input[autocomplete="new-password"]').last();
const code = (p) => p.locator('input[inputmode="numeric"]');
const submit = (p) => p.locator('.ae-primary').click();
const switchCard = (p) => p.locator('.ae-switch button').click();
const alert = (p, text) => expect(p.locator('.ae-field-error')).toContainText(text);
const fieldAlert = alert;
const heading = (p, text) => expect(p.locator('.ae-card h1')).toHaveText(text);
const name = (p) => p.locator('input[autocomplete="nickname"]');

async function login(p) {
  await email(p).fill('example@example.com');
  await password(p).fill('teachbuddy');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
}

async function dismissCoach(p) {
  await p.locator('.tb-coach-dismiss').click();
  await expect(p.locator('.tb-coach')).toHaveCount(0);
}

/* Waits out the resend cooldown the way a user would. */
async function registration(p, { sent = true } = {}) {
  await switchCard(p);
  await heading(p, '注册');
  await name(p).fill('林');
  await email(p).fill('new@example.com');
  await password(p).fill('teachbuddy');
  await confirmation(p).fill('teachbuddy');
  if (sent) {
    await p.getByRole('button', { name: '发送验证码', exact: true }).click();
    await expect(code(p)).toBeVisible();
    await code(p).fill('309614');
  }
  await p.locator('.is-terms input').check();
}

async function recovery(p, { confirm = true } = {}) {
  await p.getByRole('button', { name: '忘记密码？' }).click();
  await heading(p, '找回密码');
  if (confirm) {
    await email(p).fill('example@example.com');
    await submit(p);
    await heading(p, '设置新密码');
    /* The code is requested from the second step, where it is bound to the
     * address the first step collected. */
    const send = p.getByRole('button', { name: '发送验证码', exact: true });
    if (await send.count()) await send.click();
    await expect(code(p)).toBeVisible();
    await code(p).fill('841207');
    await password(p).fill('new-teachbuddy');
    await confirmation(p).fill('new-teachbuddy');
  }
}

export const scenarios = [];
function scenario(id, journey, description, run) {
  scenarios.push({ id: `CA${String(id).padStart(2, '0')}`, journey, description, run });
}

scenario(1, 'login', '初始登录卡、密码隐藏、记住我默认勾选', async (p, shot) => {
  await heading(p, '登录');
  await expect(email(p)).toHaveValue('');
  await expect(password(p)).toHaveAttribute('type', 'password');
  await expect(p.getByRole('checkbox', { name: '记住我' })).toBeChecked();
  await shot('initial');
});
scenario(2, 'login', '邮箱为空，修正后进入工作台', async (p, shot) => {
  await submit(p);
  await alert(p, '请填写邮箱。');
  await shot('error');
  await login(p);
  await dismissCoach(p);
  await shot('recovered');
});
scenario(3, 'login', '非法邮箱拒绝，修改邮箱清除错误', async (p, shot) => {
  await email(p).fill('invalid');
  await password(p).fill('teachbuddy');
  await submit(p);
  await alert(p, '邮箱格式不正确。');
  await shot('error');
  await email(p).fill('example@example.com');
  await expect(p.getByRole('alert')).toHaveCount(0);
  await shot('corrected');
});
scenario(4, 'login', '短密码拒绝，修正重试成功', async (p, shot) => {
  await email(p).fill('example@example.com');
  await password(p).fill('short');
  await submit(p);
  await alert(p, '密码至少 8 位。');
  await shot('error');
  await login(p);
  await dismissCoach(p);
  await shot('recovered');
});
scenario(5, 'login', '填写、显示密码、再次隐藏', async (p, shot) => {
  await email(p).fill('example@example.com');
  await password(p).fill('teachbuddy');
  await shot('filled');
  await p.locator('.ae-password-toggle').click();
  await expect(password(p)).toHaveAttribute('type', 'text');
  await expect(p.locator('.ae-password-toggle')).toHaveAttribute('aria-pressed', 'true');
  await shot('revealed');
  await p.locator('.ae-password-toggle').click();
  await expect(password(p)).toHaveAttribute('type', 'password');
  await shot('hidden');
});
scenario(6, 'login', '取消记住我，不改变本次登录结果', async (p, shot) => {
  await p.getByRole('checkbox', { name: '记住我' }).uncheck();
  await expect(p.getByRole('checkbox', { name: '记住我' })).not.toBeChecked();
  await shot('unchecked');
  await login(p);
  await dismissCoach(p);
  await shot('signed-in');
});
scenario(7, 'login', '登录、首次引导、关闭引导', async (p, shot) => {
  await login(p);
  await expect(p.locator('.tb-coach')).toBeVisible();
  await shot('coach');
  await dismissCoach(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await shot('workbench');
});
scenario(8, 'login', '键盘聚焦、输入、Enter 登录', async (p, shot) => {
  await p.keyboard.press('Tab');
  await expect(email(p)).toBeFocused();
  await p.keyboard.type('example@example.com');
  await p.keyboard.press('Tab');
  await expect(p.getByRole('button', { name: '忘记密码？' })).toBeFocused();
  await p.keyboard.press('Tab');
  await expect(password(p)).toBeFocused();
  await p.keyboard.type('teachbuddy');
  await shot('focus');
  await p.keyboard.press('Enter');
  await expect(p.locator('.tb-shell')).toBeVisible();
  await dismissCoach(p);
  await shot('signed-in');
});
scenario(9, 'login', '不勾选记住我时刷新清除会话，回到空登录卡', async (p, shot) => {
  await p.getByRole('checkbox', { name: '记住我' }).uncheck();
  await login(p);
  await p.reload();
  await heading(p, '登录');
  await expect(email(p)).toHaveValue('');
  await expect(password(p)).toHaveValue('');
  await shot('reset');
});
scenario(10, 'register', '注册初始态，条款未勾选且验证码字段隐藏', async (p, shot) => {
  await switchCard(p);
  await heading(p, '注册');
  await expect(code(p)).toHaveCount(0);
  await expect(p.locator('.is-terms input')).not.toBeChecked();
  await shot('initial');
});
for (const [id, value, message] of [[11, '', '请填写邮箱。'], [12, 'invalid', '邮箱格式不正确。']]) {
  scenario(id, 'register', `发码邮箱校验：${message}`, async (p, shot) => {
    await switchCard(p);
    await email(p).fill(value);
    await p.getByRole('button', { name: '发送验证码', exact: true }).click();
    await alert(p, message);
    await expect(code(p)).toHaveCount(0);
    await shot('error');
  });
}
scenario(13, 'register', '已占用邮箱不发码，换地址后正常发码', async (p, shot) => {
  await switchCard(p);
  await email(p).fill('EXAMPLE@example.com');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await alert(p, '这个邮箱已经注册过了，直接登录，或换一个邮箱。');
  await expect(code(p)).toHaveCount(0);
  await shot('taken');
  await email(p).fill('available@example.com');
  await expect(p.getByRole('alert')).toHaveCount(0);
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(p.locator('.ae-field-note')).toContainText('available@example.com');
  await shot('sent');
});
scenario(14, 'register', '发码和重新发送', async (p, shot) => {
  await registration(p);
  await code(p).fill('');
  await expect(p.locator('.ae-field-note')).toContainText('new@example.com');
  await shot('sent');
  await expect(p.locator('.ae-combo button')).toHaveText('重新发送');
  await p.locator('.ae-combo button').click();
  await expect(code(p)).toBeVisible();
  await expect(p.locator('.ae-field-error')).toHaveCount(0);
  await shot('resent');
});
for (const [id, value, message] of [[15, '', '请填写邮箱。'], [16, 'invalid', '邮箱格式不正确。']]) {
  scenario(id, 'register', `注册提交邮箱校验：${message}`, async (p, shot) => {
    await switchCard(p);
    await email(p).fill(value);
    await submit(p);
    await alert(p, message);
    await shot('error');
  });
}
for (const [id, field, value, message] of [
  [17, 'name', '   ', '请填写昵称。'],
  [18, 'password', 'short', '密码至少 8 位。'],
  [19, 'confirmation', 'different', '两次输入的密码不一致。'],
  [20, 'code', '12', '请输入 6 位数字验证码。'],
  [21, 'code', 'abcdef', '请输入 6 位数字验证码。'],
  [22, 'code', '111111', '验证码不正确，还可以再试 4 次。']
]) {
  scenario(id, 'register', `注册字段校验与修正：${message}`, async (p, shot) => {
    await registration(p);
    const fields = { name: name(p), password: password(p), confirmation: confirmation(p), code: code(p) };
    await fields[field].fill(value);
    await submit(p);
    await fieldAlert(p, message);
    await shot('error');
    await fields[field].fill({ name: '林', password: 'teachbuddy', confirmation: 'teachbuddy', code: '309614' }[field]);
    await submit(p);
    await expect(p.locator('.tb-shell')).toBeVisible();
    await dismissCoach(p);
    await shot('recovered');
  });
}
scenario(23, 'register', '未发码就提交，提示可见，发码后可继续', async (p, shot) => {
  await registration(p, { sent: false });
  await submit(p);
  await alert(p, '请先发送邮箱验证码。');
  await shot('error');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await expect(p.getByRole('alert')).toHaveCount(0);
  await shot('sent');
});
scenario(24, 'register', '未同意条款，显示错误文字，勾选后重试', async (p, shot) => {
  await registration(p);
  await p.locator('.is-terms input').uncheck();
  await submit(p);
  await alert(p, '需要同意服务条款才能创建账户。');
  await shot('error');
  await p.locator('.is-terms input').check();
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await dismissCoach(p);
  await shot('recovered');
});
scenario(25, 'register', '注册成功', async (p, shot) => {
  await registration(p);
  await shot('filled');
  await submit(p);
  await expect(p.locator('.tb-shell')).toBeVisible();
  await dismissCoach(p);
  await shot('registered');
});
scenario(26, 'register', '切换登录再返回，只保留邮箱', async (p, shot) => {
  await registration(p);
  await p.locator('.ae-password-toggle').click();
  await switchCard(p);
  await heading(p, '登录');
  await expect(password(p)).toHaveValue('');
  await expect(password(p)).toHaveAttribute('type', 'password');
  await shot('login');
  await switchCard(p);
  await expect(name(p)).toHaveValue('');
  await expect(password(p)).toHaveValue('');
  await expect(confirmation(p)).toHaveValue('');
  await expect(email(p)).toHaveValue('new@example.com');
  await expect(code(p)).toHaveCount(0);
  await expect(p.locator('.is-terms input')).not.toBeChecked();
  await shot('reset');
});
scenario(27, 'register', '发码后更换邮箱，旧验证码状态失效', async (p, shot) => {
  await registration(p);
  await email(p).fill('another@example.com');
  await expect(code(p)).toHaveCount(0);
  await expect(p.locator('.ae-field-note')).toHaveCount(0);
  await shot('changed');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toHaveValue('');
  await expect(p.locator('.ae-field-note')).toContainText('another@example.com');
  await shot('resent');
});
scenario(28, 'register', '条款链接保留在当前卡片，不跳转', async (p, shot) => {
  await switchCard(p);
  const before = p.url();
  await p.getByRole('link', { name: '服务条款' }).click();
  await expect(p).toHaveURL(before);
  await heading(p, '注册');
  await shot('terms');
});
scenario(29, 'recovery', '找回入口沿用登录邮箱，返回登录清空密码', async (p, shot) => {
  await email(p).fill('example@example.com');
  await password(p).fill('teachbuddy');
  await recovery(p, { confirm: false });
  await expect(email(p)).toHaveValue('example@example.com');
  await shot('request');
  await switchCard(p);
  await heading(p, '登录');
  await expect(password(p)).toHaveValue('');
  await shot('returned');
});
for (const [id, value, message] of [[30, '', '请填写邮箱。'], [31, 'invalid', '邮箱格式不正确。']]) {
  scenario(id, 'recovery', `找回第一步：${message}`, async (p, shot) => {
    await recovery(p, { confirm: false });
    await email(p).fill(value);
    await expect(email(p)).toHaveValue(value);
    await submit(p);
    await alert(p, message);
    await heading(p, '找回密码');
    await shot('error');
  });
}
scenario(32, 'recovery', '两步找回的空表单', async (p, shot) => {
  await recovery(p, { confirm: false });
  await shot('request');
  await email(p).fill('example@example.com');
  await submit(p);
  await heading(p, '设置新密码');
  /* Step two starts without a code: the address is bound, and the code is
   * asked for from here. */
  await expect(code(p)).toHaveCount(0);
  await expect(password(p)).toHaveValue('');
  await shot('confirm');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await expect(code(p)).toHaveValue('');
  await shot('code-sent');
});
for (const [id, field, value, message] of [
  [33, 'code', '84', '请输入 6 位数字验证码。'],
  [34, 'code', 'abcdef', '请输入 6 位数字验证码。'],
  [35, 'code', '000000', '验证码不正确，还可以再试 4 次。'],
  [36, 'password', 'short', '新密码至少 8 位。'],
  [37, 'confirmation', 'different', '两次输入的新密码不一致。']
]) {
  scenario(id, 'recovery', `找回校验与修正：${message}`, async (p, shot) => {
    await recovery(p);
    const fields = { password: password(p), confirmation: confirmation(p), code: code(p) };
    await fields[field].fill(value);
    await submit(p);
    await fieldAlert(p, message);
    await shot('error');
    await fields[field].fill({ password: 'new-teachbuddy', confirmation: 'new-teachbuddy', code: '841207' }[field]);
    await submit(p);
    await heading(p, '登录');
    await expect(password(p)).toHaveValue('');
    await shot('recovered');
  });
}
scenario(38, 'recovery', '重置成功回到登录，字段上没有残留错误', async (p, shot) => {
  await recovery(p);
  await p.getByRole('button', { name: '显示密码', exact: true }).click();
  await shot('filled');
  await submit(p);
  await heading(p, '登录');
  await expect(p.getByRole('alert')).toHaveCount(0);
  await expect(password(p)).toHaveValue('');
  await expect(password(p)).toHaveAttribute('type', 'password');
  await shot('returned');
});
scenario(39, 'recovery', '第二步取消后重进，清空验证码和密码', async (p, shot) => {
  await recovery(p, { confirm: false });
  await email(p).fill('example@example.com');
  await submit(p);
  await heading(p, '设置新密码');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await switchCard(p);
  await heading(p, '登录');
  await shot('cancelled');
  await recovery(p, { confirm: false });
  await submit(p);
  await heading(p, '设置新密码');
  await expect(code(p)).toHaveCount(0);
  await expect(password(p)).toHaveValue('');
  await expect(confirmation(p)).toHaveValue('');
  await shot('reset');
  await p.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(code(p)).toBeVisible();
  await expect(code(p)).toHaveValue('');
  await expect(password(p)).toHaveValue('');
  await shot('code-sent');
});
scenario(40, 'recovery', '第二步邮箱锁定到已发码的地址；显示与隐藏新密码', async (p, shot) => {
  await recovery(p);
  /* The code was issued for the address collected in step one, so that address
   * is shown as fixed rather than as a second editable field. */
  await expect(email(p)).toHaveAttribute('readonly', '');
  await expect(email(p)).toHaveValue('example@example.com');
  await expect(p.locator('.ae-field-hint')).toContainText('只对这个地址有效');
  await shot('bound');
  await p.locator('.ae-password-toggle').click();
  await expect(password(p)).toHaveAttribute('type', 'text');
  await shot('revealed');
  await p.locator('.ae-password-toggle').click();
  await expect(password(p)).toHaveAttribute('type', 'password');
  await shot('hidden');
});
