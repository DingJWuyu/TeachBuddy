// 走查账户入口原型的全部状态：量几何、收控制台错误、读回输入值。
//
// 用法（仓库根目录，先跑 npm run prototype:sidebar）：
//   node prototype/verification/auth-walk.mjs
//
// PROTOTYPE_URL 覆盖目标地址。
import { chromium } from 'playwright';

/*
 * 只做断言，不产截图。视觉证据统一由 capture-all.mjs 生成，两个脚本如果都往
 * evidence/ 写图，目录里会混进两套命名，看的人分不清哪张是哪套。
 */
const BASE = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4174/?no-dev-chrome';

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 }
];

const problems = [];
const browser = await chromium.launch();

async function open(viewport) {
  const page = await browser.newPage({ viewport });
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ae-card');
  return page;
}

/*
 * Typing is verified by reading the value back, not by trusting the fill call.
 * A control whose change handler is broken swallows every keystroke and still
 * looks like a successful fill.
 */
async function enter(locator, text, label) {
  await locator.fill(text);
  const actual = await locator.inputValue();
  if (actual !== text) problems.push(`${label} 输入未生效: 期望 "${text}"，实际 "${actual}"`);
  return actual;
}

async function measure(page, label, expectNoScroll) {
  const metrics = await page.evaluate(() => {
    const box = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      docHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      scrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
      card: box('.ae-card'),
      mark: box('.tb-brand-mark'),
      wordmark: box('.tb-brand-wordmark'),
      /*
       * 入口的圆标与工作台的方形标同名不同形（见 authEntry.css 的说明）。这里读回
       * 圆角，避免两张样式表再次因为导入顺序把对方压掉。
       */
      markRadius: getComputedStyle(document.querySelector('.tb-brand-mark')).borderRadius,
      control: box('.ae-form input'),
      primary: box('.ae-primary')
    };
  });
  const sameRow = metrics.mark && metrics.wordmark && Math.abs(metrics.mark.y - metrics.wordmark.y) < 10;
  console.log(`${label}: ${metrics.scrolls ? '滚动' : '不滚动'} doc=${metrics.docHeight} vp=${metrics.viewportHeight} card=${metrics.card.w}x${metrics.card.h}@${metrics.card.y} 品牌同行=${sameRow} 圆标=${metrics.markRadius}`);
  if (expectNoScroll && metrics.scrolls) {
    problems.push(`${label} 出现滚动条: doc=${metrics.docHeight} > vp=${metrics.viewportHeight}`);
  }
  if (!sameRow) problems.push(`${label} 品牌图标与产品名不在同一行`);
  if (metrics.markRadius !== '50%') problems.push(`${label} 入口圆标不是圆的: ${metrics.markRadius}`);
  const centred = Math.abs((metrics.viewportHeight - metrics.card.h) / 2 - metrics.card.y) < 60;
  if (!centred) problems.push(`${label} 卡片未垂直居中: y=${metrics.card.y}`);
  return metrics;
}

async function heading(page) {
  return (await page.locator('.ae-card-head h1').textContent()).trim();
}

async function gotoLogin(page) {
  if ((await heading(page)) === '登录') return;
  await page.locator('.ae-switch button').scrollIntoViewIfNeeded();
  await page.locator('.ae-switch button').click();
  await page.locator('.ae-card-head h1:text-is("登录")').waitFor({ timeout: 5000 });
}

/*
 * 读某个字段下的行内错误。标签要么直接是字段的第一个 span，要么在一个
 * .ae-field-head 里（密码字段会把"忘记密码？"放在同一行），两种都要认。
 */
async function fieldError(page, label) {
  return page.evaluate((text) => {
    const fields = [...document.querySelectorAll('.ae-field, .ae-check')];
    const field = fields.find((el) => {
      const head = el.querySelector(':scope > .ae-field-head');
      if (head) {
        return [...head.querySelectorAll(':scope > span')].some((s) => s.textContent.trim() === text);
      }
      return el.querySelector(':scope > span')?.textContent.trim() === text;
    });
    return field?.querySelector('.ae-field-error')?.textContent.trim() || '';
  }, label);
}

for (const viewport of VIEWPORTS) {
  const page = await open(viewport);
  const tag = viewport.name;
  await measure(page, `login ${tag}`, true);

  // 登录：密码不足 8 位 -> 字段级错误
  await enter(page.locator('.ae-form input[type="email"]'), 'example@example.com', `login ${tag} 邮箱`);
  await enter(page.locator('.ae-form input[type="password"]'), 'short', `login ${tag} 密码`);
  await page.locator('.ae-primary').click();
  await page.waitForTimeout(250);
  const shortPassword = await fieldError(page, '密码');
  if (shortPassword !== '密码至少 8 位。') problems.push(`login ${tag} 密码过短未报字段错误: "${shortPassword}"`);

  // 密码显示切换：默认隐藏，点眼睛变明文，图标随之换
  const passwordInput = page.locator('.ae-form input[autocomplete="current-password"], .ae-form input[autocomplete="new-password"]').first();
  const toggle = page.locator('.ae-password-toggle');
  if ((await toggle.getAttribute('aria-pressed')) !== 'false') problems.push(`login ${tag} 密码默认不是隐藏`);
  if ((await passwordInput.getAttribute('type')) !== 'password') problems.push(`login ${tag} 默认未隐藏密码`);
  await toggle.click();
  await page.waitForTimeout(150);
  if ((await passwordInput.getAttribute('type')) !== 'text') problems.push(`login ${tag} 点击后未显示密码`);
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') problems.push(`login ${tag} 图标未切到“睁眼”态`);
  await toggle.click();
  await page.waitForTimeout(150);
  if ((await passwordInput.getAttribute('type')) !== 'password') problems.push(`login ${tag} 再次点击未隐藏密码`);

  // 注册：先填邮箱发码，码出现后再填
  await gotoLogin(page);
  await page.locator('.ae-switch button').scrollIntoViewIfNeeded();
  await page.locator('.ae-switch button').click();
  await page.locator('.ae-card-head h1:text-is("注册")').waitFor({ timeout: 5000 });
  await measure(page, `register ${tag}`, true);

  if (await page.locator('.ae-form .ae-field-note').count()) {
    problems.push('register 未点击发送前就出现了验证码提示');
  }

  await enter(page.locator('.ae-field:has-text("昵称") input'), '林', `register ${tag} 昵称`);
  await enter(page.locator('.ae-form input[type="email"]'), 'new@example.com', `register ${tag} 邮箱`);
  await page.locator('.ae-send.is-block').click();
  await page.waitForTimeout(250);
  const codeNote = await page.locator('.ae-field-note').textContent();
  if (!codeNote.includes('new@example.com')) problems.push(`register ${tag} 未说明验证码发往何处: "${codeNote}"`);

  await enter(page.locator('.ae-form input[inputmode="numeric"]'), '111111', `register ${tag} 验证码`);
  await enter(page.locator('.ae-field', { has: page.locator('span:text-is("密码")') }).locator('input'), 'teachbuddy', `register ${tag} 密码`);
  await enter(page.locator('.ae-field:has-text("确认密码") input'), 'teachbuddy', `register ${tag} 确认密码`);
  const terms = page.locator('.ae-check.is-terms input');
  if (await terms.isChecked()) problems.push(`register ${tag} 条款默认被勾选了`);
  await terms.check();
  await page.locator('.ae-primary').click();
  await page.waitForTimeout(250);
  const codeError = await fieldError(page, '邮箱验证码');
  if (!codeError.includes('验证码不正确')) problems.push(`register ${tag} 错误验证码未报字段错误: "${codeError}"`);

  // 找回密码：两步
  await gotoLogin(page);
  await page.locator('.ae-form .ae-text-action').click();
  await page.locator('.ae-card-head h1:text-is("找回密码")').waitFor({ timeout: 5000 });
  await measure(page, `recovery-request ${tag}`, true);

  await enter(page.locator('.ae-form input[type="email"]'), 'example@example.com', `recovery ${tag} 邮箱`);
  await page.locator('.ae-primary').click();
  await page.locator('.ae-card-head h1:text-is("设置新密码")').waitFor({ timeout: 5000 });
  await measure(page, `recovery-confirm ${tag}`, true);

  if (tag === 'desktop-1440') {
    // 验证码错：字段级错误，且不残留"已发送"这类横幅
    await enter(page.locator('.ae-form input[inputmode="numeric"]'), '000000', 'recovery 验证码');
    await enter(page.locator('.ae-field', { has: page.locator('span:text-is("新密码")') }).locator('input'), 'new-teachbuddy', 'recovery 新密码');
    await enter(page.locator('.ae-field:has-text("确认新密码") input'), 'new-teachbuddy', 'recovery 确认新密码');
    await page.locator('.ae-primary').click();
    await page.waitForTimeout(300);
    const recoveryError = await fieldError(page, '验证码');
    if (!recoveryError) problems.push('recovery 错误验证码未报字段错误');
    if (await page.locator('.ae-notice').count()) problems.push('页面上仍有成功提示条残留');

    // 正确验证码 -> 回到登录
    await enter(page.locator('.ae-form input[inputmode="numeric"]'), '841207', 'recovery 验证码');
    await page.locator('.ae-primary').click();
    await page.locator('.ae-card-head h1:text-is("登录")').waitFor({ timeout: 5000 });

    // 登录成功：进入工作台
    await enter(page.locator('.ae-form input[type="email"]'), 'example@example.com', '登录邮箱');
    await enter(page.locator('.ae-form input[type="password"]'), 'teachbuddy', '登录密码');
    await page.locator('.ae-primary').click();
    await page.waitForSelector('.tb-topbar', { timeout: 8000 });
    await page.waitForTimeout(700);
    const signedIn = await page.evaluate(() => {
      const strip = document.querySelector('.ae-session');
      const box = strip?.getBoundingClientRect();
      return {
        workbench: Boolean(document.querySelector('.tb-topbar')),
        session: strip?.innerText.replace(/\n/g, ' | ') || '',
        /*
         * 会话语条是浮在外壳之上的固定控件，一旦没有样式就会掉到工作台下面，
         * 只出现在整页截图里。这里断言它在视口内，且不越出左下角。
         */
        strip: box ? {
          visible: box.width > 0 && box.height > 0 && box.bottom <= window.innerHeight + 1 && box.top >= 0,
          box: [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)]
        } : null
      };
    });
    console.log('登录后:', JSON.stringify(signedIn));
    if (!signedIn.workbench) problems.push('登录后未进入工作台');
    if (!signedIn.session) problems.push('登录后未显示会话语条');
    if (!signedIn.strip?.visible) problems.push(`会话语条不在视口内: ${JSON.stringify(signedIn.strip)}`);
    /*
     * 会话闸门给 body 加的类名不能和外壳根元素同名，否则脚本里按 `.tb-prototype`
     * 取根元素会取到 body，侧栏收起状态就读错了。
     */
    if (await page.locator('body.tb-prototype').count()) problems.push('body 与外壳根元素共用了 tb-prototype 类名');

    /*
     * The workbench shows its first-run spotlight over everything on the first
     * visit, including the session strip. Dismiss it the way a user would before
     * reaching for sign-out.
     */
    if (await page.locator('.tb-coach-scrim').count()) {
      await page.getByRole('button', { name: '知道了' }).click();
      await page.waitForTimeout(300);
    }

    await page.locator('.ae-session-out').click();
    await page.locator('.ae-card-head h1:text-is("登录")').waitFor({ timeout: 5000 });
  }

  await page.close();
}

await browser.close();

if (problems.length) {
  console.log('\n问题:');
  for (const problem of problems) console.log(' - ' + problem);
  process.exitCode = 1;
} else {
  console.log('\n无控制台错误，全程不滚动，卡片居中，品牌同行，错误落在字段上，登录可进入工作台。');
}
