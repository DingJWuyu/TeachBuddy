import { expect } from "@playwright/test";

export async function register(page, world, email) {
  await page.goto(world.origin);
  await page.getByRole("button", { name: /^创建账户/ }).click();
  await page.getByLabel("昵称", { exact: true }).fill("数学教师");
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill("math-password");
  await page.getByLabel("确认密码", { exact: true }).fill("math-password");
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  await expect
    .poll(() => world.mailer.lastCode("registration", email))
    .toBeTruthy();
  await page
    .getByLabel("邮箱验证码")
    .fill(world.mailer.lastCode("registration", email));
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "功能模块", exact: true }).getByRole("link", { name: /^数学工坊/ }).or(page.getByRole("button", { name: "新建作品", exact: true })).first()).toBeVisible();
}
