import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
const evidence = path.resolve(process.env.R34_BROWSER_EVIDENCE ?? "test-results/r34-integration/evidence");
const root = path.resolve("test-results/r34-integration");
fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(evidence, { recursive: true });
let world;
test.afterEach(async ({ context }) => {
  await context.close();
  await world?.close();
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
}
const nav = (page, name) =>
  page.locator(".wb-sidebar").getByRole("link", { name, exact: true }).click();
test("真实身份外壳：原件预览替换、校对入库与重启恢复", async ({
  page,
  browser,
}) => {
  const directory = fs.mkdtempSync(path.join(root, "chain-"));
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
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await page.getByLabel("资源名称").fill("集成课堂课件");
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已保存");
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "resource-original.png"),
  });
  await nav(page, "题库");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  await page
    .getByLabel("原始文字")
    .fill("1. 求 $x^2=4$ 的解。\n答案：$x=\\pm2$");
  await page.getByRole("button", { name: "保存原稿并整理" }).click();
  await expect(page.getByLabel("草稿标题")).toBeVisible();
  await page.getByLabel("草稿标题").fill("集成校对题");
  await page
    .locator(".q-review-result textarea")
    .first()
    .fill("求 $x^2=9$ 的解。");
  await page.locator(".q-review-result textarea").nth(1).fill("$x=\\pm3$");
  await page.locator(".q-issue select").selectOption("corrected");
  await page.getByRole("button", { name: "保存校对", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("校对已保存");
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "question-review.png"),
  });
  await page.getByRole("button", { name: "确认收录", exact: true }).click();
  await page.getByRole("button", { name: "查看已入库题目" }).click();
  await expect(page.getByLabel("题目标题")).toHaveValue("集成校对题");
  const questionPath = new URL(page.url()).pathname;
  await nav(page, "资源库");
  await expect(page.getByLabel("资源名称")).toHaveValue("集成课堂课件");
  await page
    .getByLabel("更新文件", { exact: true })
    .setInputFiles("test/fixtures/materials/c22.pdf");
  await page.getByRole("button", { name: "确认更新", exact: true }).click();
  await expect(page.locator(".res-file-info strong")).toHaveText("c22.pdf");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page
    .getByLabel("上传资料", { exact: true })
    .setInputFiles("test/fixtures/questions/figure.png");
  await expect(page.getByLabel("资源名称")).toHaveValue("figure.png");
  await page.reload();
  await expect(page.getByLabel("资源名称")).toHaveValue("figure.png");
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "resource-deeplink-restored.png"),
  });

  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    if (width === 1024)
      await expect
        .poll(() =>
          page
            .locator(".wb-sidebar")
            .evaluate((el) => el.getBoundingClientRect().width),
        )
        .toBe(72);
    if (width === 1280)
      await page
        .getByRole("button", { name: "AI 助理", exact: true })
        .first()
        .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      animations: "disabled",
      path: path.join(evidence, `shell-${width}.png`),
    });
    if (width === 1024) {
      await page
        .getByRole("button", { name: "关闭辅助栏", exact: true })
        .first().click();
      await page.screenshot({
        animations: "disabled",
        path: path.join(evidence, "shell-1024-content.png"),
      });
    }
  }
  const storageState = await page.context().storageState();
  await world.close();
  world = await createIntegration({ directory });
  const fresh = await browser.newContext({
    storageState,
    ignoreHTTPSErrors: true,
  });
  const reopened = await fresh.newPage();
  await reopened.goto(world.origin + questionPath);
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
