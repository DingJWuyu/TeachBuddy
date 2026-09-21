import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { evidencePaths } from './evidence-paths.mjs';

/*
 * G06 input-boundary delivery.
 *
 * This is intentionally a small, package-local runner rather than a generic
 * harness. Every case uses the real auth entry, a fresh browser context, and
 * the same three viewports as the accepted auth evidence. The forced code is
 * injected through the existing query seam; the page never renders a test UI.
 */

const { screenshots: screenshotRoot, results: resultRoot } = evidencePaths('input-boundary');
const baseUrl = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/';
const scenarioFilter = (process.env.SCENARIO_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const viewportFilter = (process.env.VIEWPORT_NAMES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const viewports = [
  { name: 'PC', width: 1440, height: 900 },
  { name: '平板', width: 768, height: 1024 },
  { name: '手机', width: 390, height: 844 }
];

const rules = {
  G06N: '昵称 trim 后 1-40 Unicode code points，保存 trim 值，计数与规则解释一致，不静默截断。',
  G06P: '密码 8-128 Unicode code points，原样保留，不 trim、大小写转换或 Unicode normalization；确认密码只做本地相等。',
  G06E: '邮箱输入期间原样保留；发送和提交目标 trim+lowercase；ASCII、总长不超过 254、形状规则按已确定约束校验。',
  G06C: '验证码为 6 位 ASCII 数字，允许前导 0；全角数字、少于或超过 6 位拒绝且不静默改写。',
  G06V: '每个新增独特视觉状态在 PC 1440x900、平板 768x1024、手机 390x844 采集，并检查无遮挡、无横向溢出、无开发浮层。'
};

const scenarioMeta = [
  {
    id: 'CA110',
    rules: ['G06N', 'G06V'],
    description: 'trim 后 40 Unicode code points 可注册，计数、保存值和账号行一致',
    assertions: [
      '昵称输入原样保留，trim 后计数为 40/40',
      '提交后进入真实工作台，账号行保存且显示 trim 后昵称'
    ]
  },
  {
    id: 'CA111',
    rules: ['G06N', 'G06V'],
    description: '41 Unicode code points 拒绝，完整输入保留',
    assertions: [
      '提交出现昵称 40 字符边界错误',
      '输入值仍为完整 41 code points，页面没有静默截断或进入工作台',
      'trim 后为空白的昵称拒绝，空白输入值仍保留'
    ]
  },
  {
    id: 'CA112',
    rules: ['G06P', 'G06V'],
    description: '8 code points 的首尾空格、emoji、组合字符和大小写密码按原样注册',
    assertions: [
      '密码 DOM 值和 8/128 计数保留原始语义',
      '确认值逐 code point 相等时真实注册成功',
      '注册后用原密码登录成功，改变大小写的密码登录被拒绝',
      '128 个 emoji 密码达到上限并真实注册成功'
    ]
  },
  {
    id: 'CA113',
    rules: ['G06P', 'G06V'],
    description: '7 Unicode code points 拒绝，129 Unicode code points 拒绝并完整保留',
    assertions: [
      '7 code points 提交出现至少 8 位错误且完整保留',
      '129 code points 提交出现密码上限错误且完整保留，未静默截断'
    ]
  },
  {
    id: 'CA114',
    rules: ['G06E', 'G06V'],
    description: 'trim+lower 后恰好 254 ASCII 邮箱可发码并完成注册',
    assertions: [
      '输入框保留首尾空格和大写原文',
      '验证码发送目标和后续账户保存使用 lower-case 规范值',
      '长目标的完整规范值保留在 aria-label/title，可见前缀和有效期保留并使用省略号',
      '真实注册成功进入工作台'
    ]
  },
  {
    id: 'CA115',
    rules: ['G06E', 'G06V'],
    description: '255 边界与代表性邮箱形状表驱动拒绝',
    assertions: [
      '255 字符完整保留并因长度拒绝',
      'local/domain 非法形状均拒绝，代表性子用例复用同一错误视觉状态'
    ]
  },
  {
    id: 'CA116',
    rules: ['G06C', 'G06V'],
    description: '前导 0 的六位验证码实际完成注册',
    assertions: [
      '输入值保持 001234',
      '验证码经过真实提交并进入工作台'
    ]
  },
  {
    id: 'CA117',
    rules: ['G06C', 'G06V'],
    description: '全角、少位、超长验证码拒绝且不改写，修正后可用',
    assertions: [
      '六种格式错误的输入值均原样保留',
      '错误提示位于验证码字段，累计六次形状错误后修正为 001234 仍真实注册成功，证明格式错误未耗用挑战'
    ]
  },
  {
    id: 'CA118',
    rules: ['G06C', 'G06V'],
    description: '验证码格式错与未勾条款同时存在时优先格式错误',
    assertions: [
      '错误验证码提交时显示验证码字段错误',
      '同一提交不把错误优先显示为条款错误'
    ]
  },
  {
    id: 'CA119',
    rules: ['G06P', 'G06V'],
    description: '确认密码不做 trim、大小写或 normalization，修正为原值后成功',
    assertions: [
      '去掉首尾空格、改变大小写或把组合字符改为预组字符的确认值均被拒绝，原始密码值不变',
      '确认值恢复逐 code point 相等后真实注册成功',
      '注册后原密码登录成功，trim 和组合字符 normalization 后的密码均被拒绝'
    ]
  }
];

const selectedViewports = viewportFilter.length
  ? viewports.filter((viewport) => viewportFilter.includes(viewport.name))
  : viewports;
if (viewportFilter.some((name) => !viewports.some((viewport) => viewport.name === name))) {
  throw new Error(`Unknown viewport name: ${viewportFilter.join(', ')}`);
}
if (scenarioFilter.some((id) => !scenarioMeta.some((scenario) => scenario.id === id))) {
  throw new Error(`Unknown scenario ID: ${scenarioFilter.join(', ')}`);
}
const selectedScenarios = scenarioFilter.length
  ? scenarioMeta.filter((scenario) => scenarioFilter.includes(scenario.id))
  : scenarioMeta;
const partialRun = scenarioFilter.length > 0 || viewportFilter.length > 0;
const reportStem = partialRun ? 'input-boundary-report.partial' : 'input-boundary-report';

function testUrl() {
  const url = new URL(baseUrl);
  url.searchParams.set('dev-code', '001234');
  url.searchParams.set('dev-no-cooldown', '');
  return url.href;
}

function assertText(actual, expected, label) {
  assert.equal(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertIncludes(actual, expected, label) {
  assert.ok(String(actual).includes(expected), `${label}: expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`);
}

function codePointLength(value) {
  return Array.from(value).length;
}

async function valueOf(locator, label) {
  const value = await locator.inputValue();
  assert.equal(typeof value, 'string', `${label}: input value must be a string`);
  return value;
}

async function textOf(locator, label) {
  const value = await locator.textContent();
  assert.equal(typeof value, 'string', `${label}: expected text`);
  return value;
}

async function heading(page, value) {
  await page.locator('.ae-card h1').waitFor({ state: 'visible' });
  assertText(await textOf(page.locator('.ae-card h1'), 'card heading'), value, 'card heading');
}

function email(page) {
  return page.locator('.ae-form input[autocomplete="email"]');
}

function password(page) {
  return page.locator('.ae-password input');
}

function confirmation(page) {
  return page.locator('.ae-field input[autocomplete="new-password"]').last();
}

function nameInput(page) {
  return page.locator('input[autocomplete="nickname"]');
}

function codeInput(page) {
  return page.locator('input[autocomplete="one-time-code"]');
}

function fieldError(page) {
  return page.locator('.ae-field-error').first();
}

async function openEntry(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await heading(page, '登录');
  assert.equal(await page.locator('[aria-label="开发环境故障注入"], [aria-label="开发环境界面切换"]').count(), 0, 'development overlay must be absent');
}

async function openRegistration(page, { address, nickname = '林' } = {}) {
  await page.locator('.ae-switch button').click();
  await heading(page, '注册');
  await nameInput(page).fill(nickname);
  if (address !== undefined) await email(page).fill(address);
}

async function fillRegistrationCredentials(page, { address, nickname = '林', secret = 'teachbuddy', confirm = secret } = {}) {
  await openRegistration(page, { address, nickname });
  await password(page).fill(secret);
  await confirmation(page).fill(confirm);
}

async function sendRegistrationCode(page) {
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await codeInput(page).waitFor({ state: 'visible' });
}

async function submit(page) {
  await page.locator('.ae-primary').click();
}

async function signIn(page, { address, secret }) {
  await email(page).fill(address);
  await password(page).fill(secret);
  await submit(page);
}

async function clearRememberedSession(page) {
  await page.evaluate(() => localStorage.removeItem('teachbuddy-prototype-session'));
}

async function waitForError(page) {
  await fieldError(page).waitFor({ state: 'visible' });
  return textOf(fieldError(page), 'field error');
}

async function agreeTerms(page) {
  await page.locator('.is-terms input').check();
}

async function assertWorkbench(page, expectedName) {
  await page.locator('.tb-shell').waitFor({ state: 'visible', timeout: 10000 });
  if (expectedName !== undefined) {
    const row = page.locator('.tb-account-row');
    await row.waitFor({ state: 'attached' });
    assertText(await row.getAttribute('aria-label'), `账户：${expectedName}`, 'saved account aria-label');
    assertText(await row.getAttribute('title'), expectedName, 'saved account title');
  }
}

async function assertAccountRowInViewport(page, viewport, expectedName) {
  const row = page.locator('.tb-account-row');
  if (viewport.name === '手机') {
    await page.getByRole('button', { name: '打开工作台导航', exact: true }).click();
    await page.locator('.tb-sidebar.is-mobile-open').waitFor({ state: 'visible' });
    /* The mobile drawer is visible in the DOM during its entrance motion. */
    await page.waitForTimeout(400);
  }
  await row.waitFor({ state: 'visible' });
  assertText(await row.getAttribute('aria-label'), `账户：${expectedName}`, 'visible account aria-label');
  const box = await row.boundingBox();
  assert.ok(box, `${viewport.name} account row must have a rendered box`);
  assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
    `${viewport.name} account row must be inside the viewport`);
}

async function dismissCoach(page) {
  const button = page.locator('.tb-coach-dismiss');
  if (await button.count()) await button.click();
}

async function shot(page, viewport, id, state, row) {
  await page.waitForTimeout(220);
  const metrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    card: Boolean(document.querySelector('.ae-card')),
    verticalOverflow: document.documentElement.scrollHeight > window.innerHeight + 1,
    developmentOverlay: Boolean(document.querySelector('[aria-label="开发环境故障注入"], [aria-label="开发环境界面切换"]')),
    cardRect: (() => {
      const element = document.querySelector('.ae-card');
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
    })()
  }));
  assert.equal(metrics.horizontalOverflow, false, `${id} ${viewport.name} ${state}: horizontal overflow`);
  assert.equal(metrics.developmentOverlay, false, `${id} ${viewport.name} ${state}: development overlay visible`);
  if (metrics.card) assert.equal(metrics.verticalOverflow, false, `${id} ${viewport.name} ${state}: auth card does not fit viewport`);
  if (metrics.cardRect) {
    assert.ok(metrics.cardRect.top >= -1 && metrics.cardRect.left >= -1, `${id} ${viewport.name} ${state}: auth card is clipped at top or left`);
    assert.ok(metrics.cardRect.right <= viewport.width + 1 && metrics.cardRect.bottom <= viewport.height + 1, `${id} ${viewport.name} ${state}: auth card is clipped at right or bottom`);
  }
  const relative = `${id}/${viewport.name}-${id}-${state}.png`;
  const target = path.join(screenshotRoot, id, `${viewport.name}-${id}-${state}.png`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, animations: 'disabled' });
  row.screenshots.push(relative);
}

function valid254Email() {
  const local = 'A'.repeat(64);
  const domain = `${'B'.repeat(63)}.${'C'.repeat(63)}.${'D'.repeat(61)}`;
  const normalized = `${local}@${domain}`;
  assert.equal(normalized.length, 254, 'fixture email must be exactly 254 ASCII characters');
  return { raw: `  ${normalized}  `, normalized: normalized.toLowerCase() };
}

function valid255Email() {
  const local = 'a'.repeat(64);
  const domain = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`;
  const normalized = `${local}@${domain}`;
  assert.equal(normalized.length, 255, 'fixture email must be exactly 255 ASCII characters');
  return `  ${normalized}  `;
}

async function registerSuccess(page, { emailAddress, nickname = '林', secret = 'teachbuddy', confirm = secret, code = '001234' } = {}) {
  await fillRegistrationCredentials(page, { address: emailAddress, nickname, secret, confirm });
  await sendRegistrationCode(page);
  await codeInput(page).fill(code);
  await agreeTerms(page);
  await submit(page);
  await assertWorkbench(page, nickname.trim());
}

async function runCA110(page, row, url, viewport) {
  const trimmedName = '😀'.repeat(40);
  const rawName = `  ${trimmedName}  `;
  await fillRegistrationCredentials(page, { address: 'boundary110@example.com', nickname: rawName });
  assertText(await valueOf(nameInput(page), 'CA110 nickname input'), rawName, 'CA110 nickname input');
  assertText(await textOf(page.locator('.ae-field-count').first(), 'CA110 nickname count'), '40/40', 'CA110 nickname count');
  await shot(page, viewport, 'CA110', 'trimmed-40-filled', row);
  await sendRegistrationCode(page);
  await codeInput(page).fill('001234');
  await agreeTerms(page);
  await submit(page);
  await assertWorkbench(page, trimmedName);
  await dismissCoach(page);
  await assertAccountRowInViewport(page, viewport, trimmedName);
  await shot(page, viewport, 'CA110', 'saved-trimmed-name', row);
}

async function runCA111(page, row, url, viewport) {
  const rawName = '😀'.repeat(41);
  await fillRegistrationCredentials(page, { address: 'boundary111@example.com', nickname: rawName });
  await submit(page);
  const error = await waitForError(page);
  assertIncludes(error, '40', 'CA111 nickname error');
  assertText(await valueOf(nameInput(page), 'CA111 nickname input'), rawName, 'CA111 nickname input');
  assertText(await textOf(page.locator('.ae-field-count').first(), 'CA111 nickname count'), '41/40', 'CA111 nickname count');
  assert.equal(await page.locator('.tb-shell').count(), 0, 'CA111 must remain on registration card');
  await shot(page, viewport, 'CA111', 'over-40-retained', row);
  const blankName = '   ';
  await nameInput(page).fill(blankName);
  await submit(page);
  const blankError = await waitForError(page);
  assertIncludes(blankError, '请填写昵称', 'CA111 blank nickname error');
  assertText(await valueOf(nameInput(page), 'CA111 blank nickname input'), blankName, 'CA111 blank nickname input');
  assertText(await textOf(page.locator('.ae-field-count').first(), 'CA111 blank nickname count'), '0/40', 'CA111 blank nickname count');
  await shot(page, viewport, 'CA111', 'blank-after-trim', row);
}

async function runCA112(page, row, url, viewport) {
  const secret = ' A😀e\u0301Bc ';
  assert.equal(codePointLength(secret), 8, 'CA112 password fixture must be 8 code points');
  const rawLogin = await page.context().newPage();
  const changedCaseLogin = await page.context().newPage();
  const peerErrors = [];
  for (const peer of [rawLogin, changedCaseLogin]) {
    peer.on('pageerror', (error) => peerErrors.push(error.message));
    peer.on('console', (message) => { if (message.type() === 'error') peerErrors.push(message.text()); });
    await openEntry(peer, url);
  }
  await fillRegistrationCredentials(page, { address: 'boundary112@example.com', secret, confirm: secret });
  assertText(await valueOf(password(page), 'CA112 password input'), secret, 'CA112 password input');
  assertText(await textOf(page.locator('.ae-field-count').nth(1), 'CA112 password count'), '8/128', 'CA112 password count');
  await page.getByRole('button', { name: '显示密码', exact: true }).click();
  assertText(await password(page).getAttribute('type'), 'text', 'CA112 password visibility');
  assertText(await valueOf(password(page), 'CA112 visible password'), secret, 'CA112 visible password');
  await shot(page, viewport, 'CA112', 'raw-password-visible', row);
  await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
  await sendRegistrationCode(page);
  await codeInput(page).fill('001234');
  await agreeTerms(page);
  await submit(page);
  await assertWorkbench(page, '林');
  await dismissCoach(page);
  await shot(page, viewport, 'CA112', 'raw-password-accepted', row);

  /* The account must retain the exact credential semantics after registration.
   * Peers were opened before registration; reload makes their real login path
   * observe the newly persisted account without adding a logout control. */
  await clearRememberedSession(page);
  await rawLogin.reload({ waitUntil: 'networkidle' });
  await heading(rawLogin, '登录');
  await signIn(rawLogin, { address: 'boundary112@example.com', secret });
  await assertWorkbench(rawLogin, '林');
  await clearRememberedSession(rawLogin);
  await changedCaseLogin.reload({ waitUntil: 'networkidle' });
  await heading(changedCaseLogin, '登录');
  const changedCase = secret.replace('A', 'a');
  await signIn(changedCaseLogin, { address: 'boundary112@example.com', secret: changedCase });
  const rejectedNotice = changedCaseLogin.locator('.ae-notice');
  await rejectedNotice.waitFor({ state: 'visible' });
  assertIncludes(await textOf(rejectedNotice, 'CA112 changed-case login notice'), '邮箱或密码不正确', 'CA112 changed-case login notice');
  assert.equal(await changedCaseLogin.locator('.tb-shell').count(), 0, 'CA112 changed-case password must not sign in');
  assert.deepEqual(peerErrors, [], 'CA112 peer browser errors');
  await rawLogin.close();
  await changedCaseLogin.close();

  /* Exercise the maximum accepted password in a fresh page state. */
  await page.goto(url, { waitUntil: 'networkidle' });
  await heading(page, '登录');
  const maxSecret = '😀'.repeat(128);
  await fillRegistrationCredentials(page, { address: 'boundary112-max@example.com', secret: maxSecret, confirm: maxSecret });
  assertText(await valueOf(password(page), 'CA112 max password input'), maxSecret, 'CA112 max password input');
  assertText(await textOf(page.locator('.ae-field-count').nth(1), 'CA112 max password count'), '128/128', 'CA112 max password count');
  await page.getByRole('button', { name: '显示密码', exact: true }).click();
  await shot(page, viewport, 'CA112', 'max-128-password-visible', row);
  await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
  await sendRegistrationCode(page);
  await codeInput(page).fill('001234');
  await agreeTerms(page);
  await submit(page);
  await assertWorkbench(page, '林');
  await dismissCoach(page);
  await shot(page, viewport, 'CA112', 'max-128-password-accepted', row);
}

async function runCA113(page, row, url, viewport) {
  const secret = '😀'.repeat(129);
  await fillRegistrationCredentials(page, { address: 'boundary113@example.com', secret, confirm: secret });
  await submit(page);
  const error = await waitForError(page);
  assertIncludes(error, '128', 'CA113 password error');
  assertText(await valueOf(password(page), 'CA113 password input'), secret, 'CA113 password input');
  assert.equal(codePointLength(await valueOf(password(page), 'CA113 password input')), 129, 'CA113 password code point length');
  assertText(await textOf(page.locator('.ae-field-count').nth(1), 'CA113 password count'), '129/128', 'CA113 password count');
  assert.equal(await page.locator('.tb-shell').count(), 0, 'CA113 must remain on registration card');
  await shot(page, viewport, 'CA113', 'over-128-retained', row);
  const shortSecret = '😀'.repeat(7);
  await password(page).fill(shortSecret);
  await confirmation(page).fill(shortSecret);
  await submit(page);
  const shortError = await waitForError(page);
  assertIncludes(shortError, '至少 8', 'CA113 short password error');
  assertText(await valueOf(password(page), 'CA113 short password input'), shortSecret, 'CA113 short password input');
  assert.equal(codePointLength(await valueOf(password(page), 'CA113 short password input')), 7, 'CA113 short password code point length');
  assertText(await textOf(page.locator('.ae-field-count').nth(1), 'CA113 short password count'), '7/128', 'CA113 short password count');
  await shot(page, viewport, 'CA113', 'under-8-retained', row);
}

async function runCA114(page, row, url, viewport) {
  const { raw, normalized } = valid254Email();
  await fillRegistrationCredentials(page, { address: raw, nickname: '边界254' });
  assertText(await valueOf(email(page), 'CA114 raw email'), raw, 'CA114 raw email');
  await sendRegistrationCode(page);
  assertText(await valueOf(email(page), 'CA114 raw email after send'), raw, 'CA114 raw email after send');
  const note = page.locator('.ae-field-note.is-long-address').first();
  await note.waitFor({ state: 'visible' });
  assertIncludes(await note.getAttribute('aria-label'), normalized, 'CA114 normalized target in note aria-label');
  assertText(await note.locator('.ae-code-note-address').getAttribute('aria-label'), normalized, 'CA114 normalized target in address aria-label');
  assertText(await note.locator('.ae-code-note-address').getAttribute('title'), normalized, 'CA114 normalized target in address title');
  assertText(await textOf(note.locator('.ae-code-note-label'), 'CA114 visible note label'), '验证码已发送至', 'CA114 visible note label');
  assertIncludes(await textOf(note.locator('.ae-code-note-expiry'), 'CA114 visible note expiry'), '分钟内有效', 'CA114 visible note expiry');
  const noteAddressMetrics = await note.locator('.ae-code-note-address').evaluate((element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
      left: rect.left,
      right: rect.right
    };
  });
  assert.ok(noteAddressMetrics.clientWidth > 0, 'CA114 visible target has width');
  assert.ok(noteAddressMetrics.scrollWidth > noteAddressMetrics.clientWidth, 'CA114 long target is visibly truncated');
  assertText(noteAddressMetrics.overflow, 'hidden', 'CA114 long target overflow mode');
  assertText(noteAddressMetrics.textOverflow, 'ellipsis', 'CA114 long target visible ellipsis');
  assertText(noteAddressMetrics.whiteSpace, 'nowrap', 'CA114 long target single line');
  await shot(page, viewport, 'CA114', 'valid-254-sent', row);
  await codeInput(page).fill('001234');
  await agreeTerms(page);
  await submit(page);
  await assertWorkbench(page, '边界254');
  await dismissCoach(page);
  await shot(page, viewport, 'CA114', 'valid-254-accepted', row);
}

async function runCA115(page, row, url, viewport) {
  const cases = [
    { label: 'length-255', value: valid255Email(), expected: '254' },
    { label: 'local-leading-dot', value: '  .bad@example.com  ', expected: '格式' },
    { label: 'local-consecutive-dot', value: 'bad..dots@example.com', expected: '格式' },
    { label: 'non-ascii', value: 'bad空@example.com', expected: '格式' },
    { label: 'local-too-long', value: `${'a'.repeat(65)}@example.com`, expected: '格式' },
    { label: 'domain-leading-hyphen', value: 'bad@-example.com', expected: '格式' },
    { label: 'domain-trailing-hyphen', value: 'bad@example-.com', expected: '格式' },
    { label: 'domain-single-label', value: 'bad@example', expected: '格式' },
    { label: 'empty-domain-label', value: 'bad@example..com', expected: '格式' },
    { label: 'multiple-at', value: 'bad@@example.com', expected: '格式' }
  ];
  await openRegistration(page, { address: cases[0].value });
  await password(page).fill('teachbuddy');
  await confirmation(page).fill('teachbuddy');
  for (const entry of cases) {
    await email(page).fill(entry.value);
    await page.getByRole('button', { name: '发送验证码', exact: true }).click();
    const error = await waitForError(page);
    assertIncludes(error, entry.expected, `CA115 ${entry.label} error`);
    assertText(await valueOf(email(page), `CA115 ${entry.label} email`), entry.value, `CA115 ${entry.label} email`);
    assert.equal(await codeInput(page).count(), 0, `CA115 ${entry.label} must not reveal code input`);
    if (entry.label === 'length-255') await shot(page, viewport, 'CA115', 'length-255-retained', row);
  }
  await shot(page, viewport, 'CA115', 'shape-table-rejected', row);
}

async function runCA116(page, row, url, viewport) {
  await fillRegistrationCredentials(page, { address: 'boundary116@example.com', nickname: '前导零' });
  await sendRegistrationCode(page);
  await codeInput(page).fill('001234');
  assertText(await valueOf(codeInput(page), 'CA116 code input'), '001234', 'CA116 code input');
  await shot(page, viewport, 'CA116', 'leading-zero-filled', row);
  await agreeTerms(page);
  await submit(page);
  await assertWorkbench(page, '前导零');
  await dismissCoach(page);
  await shot(page, viewport, 'CA116', 'leading-zero-accepted', row);
}

async function runCA117(page, row, url, viewport) {
  await fillRegistrationCredentials(page, { address: 'boundary117@example.com', nickname: '验证码形状' });
  await sendRegistrationCode(page);
  const malformed = ['１２３４５６', '12345', '1234567', '１２３４５', '１２３４５６７', '12345a'];
  for (const candidate of malformed) {
    await codeInput(page).fill(candidate);
    await submit(page);
    const error = await waitForError(page);
    assert.ok(/6\s*位/.test(error) && (error.includes('数字') || error.includes('验证码')), `CA117 format error text: ${error}`);
    assertText(await valueOf(codeInput(page), `CA117 code ${candidate}`), candidate, `CA117 code ${candidate}`);
  }
  await shot(page, viewport, 'CA117', 'malformed-code-retained', row);
  await codeInput(page).fill('001234');
  await agreeTerms(page);
  await submit(page);
  await assertWorkbench(page, '验证码形状');
  await dismissCoach(page);
  await shot(page, viewport, 'CA117', 'corrected-code-accepted', row);
}

async function runCA118(page, row, url, viewport) {
  await fillRegistrationCredentials(page, { address: 'boundary118@example.com', nickname: '错误优先级' });
  await sendRegistrationCode(page);
  await codeInput(page).fill('１２３４５６');
  /* Terms intentionally remain unchecked. Format validation must win. */
  await submit(page);
  const error = await waitForError(page);
  assert.ok(/6\s*位/.test(error) && (error.includes('数字') || error.includes('验证码')), `CA118 format error text: ${error}`);
  assert.equal(await page.locator('.is-terms.has-error').count(), 0, 'CA118 terms error must not win over format error');
  assertText(await valueOf(codeInput(page), 'CA118 code input'), '１２３４５６', 'CA118 code input');
  await shot(page, viewport, 'CA118', 'format-before-terms', row);
}

async function runCA119(page, row, url, viewport) {
  const secret = ' P😀e\u0301aSsXYZ ';
  const rawLogin = await page.context().newPage();
  const trimLogin = await page.context().newPage();
  const normalizedLogin = await page.context().newPage();
  const peerErrors = [];
  for (const peer of [rawLogin, trimLogin, normalizedLogin]) {
    peer.on('pageerror', (error) => peerErrors.push(error.message));
    peer.on('console', (message) => { if (message.type() === 'error') peerErrors.push(message.text()); });
    await openEntry(peer, url);
  }
  await fillRegistrationCredentials(page, {
    address: 'boundary119@example.com',
    nickname: '确认原样',
    secret,
    confirm: secret
  });
  const mismatches = [
    { label: 'trim', value: secret.trim() },
    { label: 'case', value: secret.replace('P', 'p') },
    { label: 'normalization', value: secret.replace('e\u0301', 'é') }
  ];
  for (const [index, mismatch] of mismatches.entries()) {
    await confirmation(page).fill(mismatch.value);
    await submit(page);
    const error = await waitForError(page);
    assertIncludes(error, '不一致', `CA119 ${mismatch.label} confirmation error`);
    assertText(await valueOf(password(page), 'CA119 password input'), secret, 'CA119 password input');
    assertText(await valueOf(confirmation(page), `CA119 ${mismatch.label} confirmation input`), mismatch.value, `CA119 ${mismatch.label} confirmation input`);
    if (index === 0) await shot(page, viewport, 'CA119', 'confirmation-transform-rejected', row);
  }
  await confirmation(page).fill(secret);
  await sendRegistrationCode(page);
  await codeInput(page).fill('001234');
  await agreeTerms(page);
  await submit(page);
  await assertWorkbench(page, '确认原样');
  await dismissCoach(page);
  await shot(page, viewport, 'CA119', 'confirmation-exact-accepted', row);

  await clearRememberedSession(page);
  await rawLogin.reload({ waitUntil: 'networkidle' });
  await heading(rawLogin, '登录');
  await signIn(rawLogin, { address: 'boundary119@example.com', secret });
  await assertWorkbench(rawLogin, '确认原样');
  await clearRememberedSession(rawLogin);

  const transformed = [
    { page: trimLogin, value: secret.trim(), label: 'trim' },
    { page: normalizedLogin, value: secret.replace('e\u0301', 'é'), label: 'normalization' }
  ];
  for (const entry of transformed) {
    await entry.page.reload({ waitUntil: 'networkidle' });
    await heading(entry.page, '登录');
    await signIn(entry.page, { address: 'boundary119@example.com', secret: entry.value });
    const notice = entry.page.locator('.ae-notice');
    await notice.waitFor({ state: 'visible' });
    assertIncludes(await textOf(notice, `CA119 ${entry.label} login notice`), '邮箱或密码不正确', `CA119 ${entry.label} login notice`);
    assert.equal(await entry.page.locator('.tb-shell').count(), 0, `CA119 ${entry.label} password must not sign in`);
  }
  assert.deepEqual(peerErrors, [], 'CA119 peer browser errors');
  await rawLogin.close();
  await trimLogin.close();
  await normalizedLogin.close();
}

const runners = {
  CA110: runCA110,
  CA111: runCA111,
  CA112: runCA112,
  CA113: runCA113,
  CA114: runCA114,
  CA115: runCA115,
  CA116: runCA116,
  CA117: runCA117,
  CA118: runCA118,
  CA119: runCA119
};

async function run() {
  await fs.mkdir(screenshotRoot, { recursive: true });
  await fs.mkdir(resultRoot, { recursive: true });
  const browser = await chromium.launch();
  const rows = [];
  const failures = [];
  const url = testUrl();

  for (const viewport of selectedViewports) {
    for (const scenario of selectedScenarios) {
      const row = {
        id: scenario.id,
        description: scenario.description,
        rules: scenario.rules,
        assertions: scenario.assertions,
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        screenshots: [],
        status: 'passed'
      };
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const browserErrors = [];
      page.on('pageerror', (error) => browserErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') browserErrors.push(message.text());
      });
      try {
        await openEntry(page, url);
        await runners[scenario.id](page, row, url, viewport);
        assert.deepEqual(browserErrors, [], `${scenario.id} ${viewport.name} browser errors`);
        assert.ok(row.screenshots.length > 0, `${scenario.id} ${viewport.name} must produce screenshots`);
        console.log(`PASS ${viewport.name} ${scenario.id} ${scenario.description}`);
      } catch (error) {
        row.status = 'failed';
        row.error = error instanceof Error ? error.message : String(error);
        row.browserErrors = browserErrors;
        failures.push(`${viewport.name} ${scenario.id}: ${row.error.split('\n')[0]}`);
        console.error(`FAIL ${viewport.name} ${scenario.id}: ${row.error.split('\n')[0]}`);
      } finally {
        rows.push(row);
        await context.close().catch(() => {});
      }
    }
  }
  await browser.close();

  const report = {
    suite: 'g06-input-boundary-delivery',
    generatedAt: new Date().toISOString(),
    url,
    reproduce: '在 prototype 根目录执行：PROTOTYPE_URL=http://127.0.0.1:4174/ node verification/verify-input-boundaries.mjs',
    rules,
    scenarios: scenarioMeta,
    selectedScenarios: selectedScenarios.map((scenario) => scenario.id),
    viewports: selectedViewports,
    rows,
    failures,
    status: failures.length ? 'failed' : 'passed'
  };
  await fs.writeFile(path.join(resultRoot, `${reportStem}.json`), `${JSON.stringify(report, null, 2)}\n`);

  const markdown = [
    '# G06 输入边界专项交付',
    '',
    `生成时间：${report.generatedAt}`,
    `运行地址：${url}`,
    `状态：${report.status}`,
    '',
    '复跑命令：',
    '',
    '```bash',
    report.reproduce,
    '```',
    '',
    '## 规则到场景',
    '',
    ...Object.entries(rules).map(([id, description]) => `- **${id}**：${description}`),
    '',
    '## 场景、断言与截图',
    '',
    ...rows.map((row) => [
      `### ${row.id} ${row.viewport} ${row.width}x${row.height}`,
      '',
      `${row.status.toUpperCase()}：${row.description}`,
      `规则：${row.rules.join('、')}`,
      ...row.assertions.map((assertion) => `- 断言：${assertion}`),
      ...(row.screenshots.length ? row.screenshots.map((file) => `- 截图：\`${file}\``) : ['- 截图：无（场景失败）']),
      row.error ? `- 失败：${row.error.split('\n')[0]}` : ''
    ].filter(Boolean).join('\n')),
    '',
    'CA115 的 `length-255-retained` 覆盖总长上限；同一 CA 的 `shape-table-rejected` 映射 local/domain 代表性形状表，未为每个同类错误重复截图。',
    'CA117 实际逐一断言 `１２３４５６`、`12345`、`1234567`、`１２３４５`、`１２３４５６７`、`12345a` 六种输入原样保留；`malformed-code-retained` 是同一错误视觉状态的代表截图。',
    'CA74 已覆盖“形状合法但值错 + 条款未勾选”的条款优先级；CA118 只验证本专项新增的格式错误优先级。',
    '',
    '截图路径均相对 `PROTOTYPE_EVIDENCE_DIR` 输出目录。',
    '每个截图由本脚本在实际页面断言通过后生成，并检查横向溢出、认证卡片纵向完整性和开发浮层缺失。'
  ].join('\n');
  await fs.writeFile(path.join(resultRoot, `${reportStem}.md`), `${markdown}\n`);

  /* A successful full run retires only this delivery directory's stale files.
   * Failed or filtered runs preserve their artifacts for diagnosis. */
  if (!failures.length && !scenarioFilter.length && !viewportFilter.length) {
    const expected = new Set(rows.flatMap((row) => row.screenshots));
    for (const scenario of scenarioMeta) {
      const directory = path.join(screenshotRoot, scenario.id);
      let files = [];
      try {
        files = await fs.readdir(directory);
      } catch {
        continue;
      }
      for (const file of files) {
        const relative = `${scenario.id}/${file}`;
        if (file.endsWith('.png') && !expected.has(relative)) await fs.unlink(path.join(directory, file));
      }
      await fs.rmdir(directory).catch(() => {});
    }
  }

  if (failures.length) {
    console.error(`\n${failures.length} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log(`\nPASS ${rows.length} viewport-case(s); screenshots: ${screenshotRoot}`);
    console.log(`report: ${path.join(resultRoot, `${reportStem}.md`)}`);
  }
}

await run();
