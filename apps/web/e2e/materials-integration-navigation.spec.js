import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
const evidence = path.resolve(process.env.MATERIALS_INTEGRATION_EVIDENCE_DIR ?? "test-results/materials-integration/evidence");
fs.mkdirSync(evidence, { recursive: true });
let world;
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world?.close();
  if (world && info.status === info.expectedStatus) fs.rmSync(world.directory, { recursive: true, force: true });
  else if (world) console.error(`材料集成失败现场保留：${world.directory}`);
});
async function register(page) {
  await page.goto(world.origin);
  await page.getByRole("button", { name: "创建账户" }).click();
  await page.getByLabel("昵称", { exact: true }).fill("材料集成老师");
  await page.getByLabel("邮箱", { exact: true }).fill("materials@example.test");
  await page.getByLabel("密码", { exact: true }).fill("materials-password");
  await page.getByLabel("确认密码", { exact: true }).fill("materials-password");
  await page.getByRole("button", { name: "发送验证码" }).click();
  await expect
    .poll(() => world.mailer.lastCode("registration", "materials@example.test"))
    .toBeTruthy();
  await page
    .getByLabel("邮箱验证码")
    .fill(world.mailer.lastCode("registration", "materials@example.test"));
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.locator(".wb-shell")).toBeVisible();
  const coach = page.getByRole("button", { name: "知道了", exact: true });
  if (await coach.count()) await coach.click();
}
const nav = (page, name) =>
  page.getByRole("navigation", { name: "功能模块" }).getByRole("link", { name: new RegExp("^" + name) }).click();

test("最新原生Word校对在真实外壳保存恢复并入库", async ({ page }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "materials-native-word-"));
  world = await createIntegration({ directory });
  await register(page);
  await nav(page, "题库");
  await page.locator(".q-finder").getByRole("button", { name: "从资料收录", exact: true }).click();
  await page.getByRole("button", { name: /^上传 Word/ }).click();
  await page.getByLabel("选择原稿").setInputFiles("test/fixtures/questions/W.docx");
  await page.getByRole("button", { name: "开始整理" }).click();
  await page.getByRole("button", { name: "修改题目", exact: true }).click();
  await expect(page.getByLabel("草稿标题")).toBeVisible({ timeout: 60000 });
  const source = page.locator(".q-review-result textarea").first();
  await expect(source).toHaveValue(/x-2/);
  await source.fill((await source.inputValue()).replace("x-2", "x+2"));
  await page.getByLabel("草稿标题").fill("原生Word集成题");
  for (const select of await page.locator(".q-issue select").all()) await select.selectOption("corrected");
  await page.getByRole("button", { name: "保存检查进度", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("校对已保存");
  await page.reload();
  await expect(source).toHaveValue(/x\+2/);
  await expect(page.locator(".q-review-result [data-formula-failed]")).toHaveCount(0);
  await page.getByRole("button", { name: "确认这道题", exact: true }).click();
  await page.getByRole("button", { name: "查看题目", exact: true }).click();
  await page.getByRole("button", { name: "编辑题目", exact: true }).click();
  await expect(page.getByLabel("题目标题")).toHaveValue("原生Word集成题");
  await page.reload();
  await expect(page.getByLabel("题目标题")).toHaveValue("原生Word集成题");
  fs.writeFileSync(path.join(evidence, "native-word-environment.json"), JSON.stringify({ directory, origin: world.origin, identity: "real-auth/fake-mail", provider: "unavailable" }, null, 2));
});
