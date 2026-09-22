import { expect } from "@playwright/test";
export async function register(page, world, email) {
  await page.goto(world.origin);
  await page.getByRole("button", { name: "创建账户", exact: true }).click();
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
  await expect(page.locator(".wb-shell")).toBeVisible();
  await page.locator(".wb-sidebar").getByRole("link",{name:"数学工坊",exact:true}).click();
  await page.getByRole("button",{name:"作品与工具",exact:true}).click();
}
export async function save(page) {
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/modules/math/v1/works") &&
      ["PUT", "POST"].includes(r.request().method()),
  );
  await page.getByRole("button", { name: /^(保存|确认保存结果)$/ }).click();
  const result = await response;
  expect(result.status(), await result.text()).toBeLessThan(300);
  await expect(
    page.getByRole("status").filter({ hasText: "已保存" }),
  ).toBeVisible();
  return result.json();
}
