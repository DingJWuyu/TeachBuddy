// 打开工作台：账户入口把工作台挡在会话之后，所以每次导航（含刷新）都要先登录一次。
//
// 这里走的是界面本身，不给原型加一条跳过后门：填邮箱与密码，点登录，等外壳出现。
// 两个值与 src/auth/demo-data.js 里的示例账户一致；故意写成字面量，脚本用 Node 直接
// 运行，不去解析带 JSX 依赖的源码模块。
export const DEMO_EMAIL = 'example@example.com';
export const DEMO_PASSWORD = 'teachbuddy';

export async function openWorkbench(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.ae-card');
  await page.fill('.ae-form input[type="email"]', DEMO_EMAIL);
  await page.fill('.ae-form input[type="password"]', DEMO_PASSWORD);
  await page.click('.ae-primary');
  await page.waitForSelector('.tb-shell', { timeout: 15000 });
}
