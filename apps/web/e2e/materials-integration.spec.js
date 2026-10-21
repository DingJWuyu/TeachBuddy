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
async function infoPanel(page) {
  await expect(page.getByLabel("资源名称")).toBeVisible();
}
async function openUploaded(page, title) {
  await expect(page.locator('.tbx-res-main')).toHaveAttribute('aria-busy', 'false');
  await page.locator('.tbx-res-open').filter({ hasText: title }).click();
  await expect(page.locator('.res-detail')).toBeVisible();
}
const nav = (page, name) =>
  page.getByRole("navigation", { name: "功能模块" }).getByRole("link", { name: new RegExp("^" + name) }).click();
test("真实身份外壳：原件预览替换、校对入库与重启恢复", async ({
  page,
  browser,
}) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "materials-chain-"));
  world = await createIntegration({ directory });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/"))
      requests.push({
        path: new URL(r.url()).pathname,
        method: r.method(),
        pageBound: Boolean(r.headers()["x-teachbuddy-page"]),
      });
  });
  await register(page);
  await nav(page, "资源库");
  await page
    .getByLabel("上传资料", { exact: true })
    .setInputFiles("test/fixtures/materials/c22.pptx");
  await openUploaded(page, "c22.pptx");
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await infoPanel(page);
  await page.getByLabel("资源名称").fill("集成课堂课件");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已保存");
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "resource-original.png"),
  });
  await nav(page, "题库");
  await page.locator(".q-finder").getByRole("button", { name: "从资料收录", exact: true }).click();
  await page.getByRole("button", { name: /^粘贴文字/ }).click();
  await page
    .getByLabel("原始文字")
    .fill("1. 求 $x^2=4$ 的解。\n答案：$x=\\pm2$");
  await page.getByRole("button", { name: "开始整理" }).click();
  await page.getByRole("button", { name: "修改题目", exact: true }).click();
  await expect(page.getByLabel("草稿标题")).toBeVisible();
  await page.getByLabel("草稿标题").fill("集成校对题");
  await page
    .locator(".q-review-result textarea")
    .first()
    .fill("求 $x^2=9$ 的解。");
  await page.locator(".q-review-result textarea").nth(1).fill("$x=\\pm3$");
  await page.locator(".q-issue select").selectOption("corrected");
  await page.getByRole("button", { name: "保存检查进度", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("校对已保存");
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "question-review.png"),
  });
  const committed = page.waitForResponse(response => response.request().method() === "POST" && /\/imports\/[^/]+\/commit$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: "确认这道题", exact: true }).click();
  const committedResponse = await committed;
  expect(committedResponse.status()).toBe(200);
  const questionPath = "/questions/" + (await committedResponse.json()).questions[0].id;
  await page.getByRole("button", { name: "查看题目", exact: true }).click();
  await page.getByRole("button", { name: "编辑题目", exact: true }).click();
  await expect(page.getByLabel("题目标题")).toHaveValue("集成校对题");
  await nav(page, "资源库");
  await infoPanel(page);
  await expect(page.getByLabel("资源名称")).toHaveValue("集成课堂课件");
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "更新文件", exact: true }).click();
  await (await chooser).setFiles("test/fixtures/materials/c22.pdf");
  await page.getByRole("button", { name: "更新", exact: true }).click();
  await expect(page.locator(".res-file-info strong")).toHaveText("c22.pdf");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page
    .getByLabel("上传资料", { exact: true })
    .setInputFiles("test/fixtures/questions/figure.png");
  await openUploaded(page, "figure.png");
  await infoPanel(page);
  await expect(page.getByLabel("资源名称")).toHaveValue("figure.png");
  await page.reload();
  await infoPanel(page);
  await expect(page.getByLabel("资源名称")).toHaveValue("figure.png");
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "resource-deeplink-restored.png"),
  });

  const storageState = await page.context().storageState();
  await world.close();
  world = await createIntegration({ directory });
  const fresh = await browser.newContext({
    storageState,
    ignoreHTTPSErrors: true,
  });
  const reopened = await fresh.newPage();
  await reopened.goto(world.origin + questionPath);
  await expect(reopened.getByRole("heading", { name: "集成校对题", exact: true })).toBeVisible();
  const reopenedCoach = reopened.getByRole("button", { name: "知道了", exact: true });
  if (await reopenedCoach.count()) await reopenedCoach.click();
  await reopened.getByRole("button", { name: "编辑题目", exact: true }).click();
  await expect(reopened.getByLabel("题目标题")).toHaveValue("集成校对题");
  await reopened.screenshot({
    path: path.join(evidence, "restart-new-browser.png"),
  });
  await fresh.close();
  fs.writeFileSync(
    path.join(evidence, "browser-requests.json"),
    JSON.stringify(requests, null, 2),
  );
  fs.writeFileSync(
    path.join(evidence, "browser-environment.json"),
    JSON.stringify(
      {
        directory,
        identity: "real-auth / fake-mail / self-signed HTTPS",
        questionPath,
        errors,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
  expect(requests.every((r) => r.pageBound)).toBe(true);
});
