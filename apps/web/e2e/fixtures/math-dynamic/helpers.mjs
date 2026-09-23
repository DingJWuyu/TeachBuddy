import fs from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";
export const evidence = path.resolve(
  process.env.M42_EVIDENCE_DIR || "test-results/evidence/M42/v1/artifacts",
);
fs.mkdirSync(evidence, { recursive: true });
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
  await expect(page.getByText("数学工坊", { exact: true })).toBeVisible();
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
export async function download(page, format, name) {
  await page.getByLabel("导出格式").selectOption(format);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  const file = await event;
  const target = path.join(evidence, name);
  await file.saveAs(target);
  return target;
}
