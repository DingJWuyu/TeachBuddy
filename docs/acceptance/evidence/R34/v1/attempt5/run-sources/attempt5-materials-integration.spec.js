import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
const evidence = path.resolve("docs/acceptance/evidence/R34/v1/attempt5/e2e");
const root = path.resolve("test-results/r34-attempt5/integration");
fs.mkdirSync(root, { recursive: true });
let world;
test.afterEach(async () => world?.close());
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
test("真实身份外壳：原件预览替换、校对入库、混合取材、六输出与重启恢复", async ({
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
    .setInputFiles("apps/web/e2e/fixtures/materials/samples/c22.pptx");
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
  await nav(page, "备课");
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page.getByLabel("课题", { exact: true }).fill("真实材料整合课");
  await page.getByRole("button", { name: "段落", exact: true }).click();
  await page
    .getByLabel("开头文稿段落 1", { exact: true })
    .fill("真实题目与课件组合。");
  await page.getByRole("button", { name: "添加环节", exact: true }).click();
  await page.getByLabel("环节名称 1", { exact: true }).fill("自主探究");
  const section = page.locator("[data-section-id]");
  await section
    .getByRole("button", { name: "从题库取题", exact: true })
    .click();
  await page.getByLabel("选择 集成校对题", { exact: true }).check();
  await page
    .getByRole("button", { name: "采用所选 1 项", exact: true })
    .click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(1);
  await section
    .getByRole("button", { name: "从资源库取材", exact: true })
    .click();
  await page.getByLabel("选择 集成课堂课件", { exact: true }).check();
  await page
    .getByRole("button", { name: "采用所选 1 项", exact: true })
    .click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(2);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  const lessonPath = new URL(page.url()).pathname;
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "lesson-real.png"),
  });
  await page
    .locator("[data-reference-id]")
    .first()
    .getByRole("button", { name: "查看来源", exact: true })
    .click();
  await expect(page.getByLabel("题目标题")).toHaveValue("集成校对题");
  await page.getByText("使用位置", { exact: true }).click();
  await expect(
    page.getByText("真实材料整合课 自主探究", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "返回备课现场" }).click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(2);
  await page.evaluate(() => {
    window.r34OriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.endsWith(":scene:resources"))
        throw new DOMException("test quota", "QuotaExceededError");
      return window.r34OriginalSetItem.call(this, key, value);
    };
  });
  // The real source link must select the resource and preserve the lesson scene.
  await page
    .locator("[data-reference-id]")
    .nth(1)
    .getByRole("button", { name: /来源|原题/ })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "无法打开指定资料" }),
  ).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = window.r34OriginalSetItem;
    delete window.r34OriginalSetItem;
  });
  await page.getByRole("button", { name: "重试打开资料" }).click();
  await expect(page.getByLabel("资源名称")).toHaveValue("集成课堂课件");
  await expect(
    page.getByRole("button", { name: /真实材料整合课/ }),
  ).toBeVisible();
  await page
    .getByLabel("更新文件", { exact: true })
    .setInputFiles("apps/web/e2e/fixtures/materials/samples/c22.pdf");
  await page.getByRole("button", { name: "确认更新", exact: true }).click();
  await expect(page.locator(".res-file-info strong")).toHaveText("c22.pdf");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page
    .getByLabel("上传资料", { exact: true })
    .setInputFiles("apps/web/e2e/fixtures/materials-questions/figure.png");
  await expect(page.getByLabel("资源名称")).toHaveValue("figure.png");
  await page.reload();
  await expect(page.getByLabel("资源名称")).toHaveValue("figure.png");
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "resource-deeplink-restored.png"),
  });

  await page.getByRole("button", { name: "返回备课现场" }).click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(2);
  await expect(page.getByText(/有更新|来源已更新/).first()).toBeVisible();
  await page.getByRole("button", { name: "输出", exact: true }).click();
  let outputCount = 0;
  for (const kind of ["lesson-plan", "handout", "practice"])
    for (const format of ["docx", "pdf"]) {
      await page
        .getByRole("combobox", { name: "成果", exact: true })
        .selectOption(kind);
      await page
        .getByRole("combobox", { name: "格式", exact: true })
        .selectOption(format);
      await page
        .getByRole("button", { name: "保存并生成", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "下载", exact: true }),
      ).toHaveCount(++outputCount, { timeout: 60000 });
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "下载", exact: true })
        .first()
        .click();
      await (
        await download
      ).saveAs(path.join(evidence, `real-${kind}.${format}`));
    }
  await page
    .getByRole("button", { name: "预览成品", exact: true })
    .first()
    .click();
  await expect(page.getByAltText("成品第 1 页")).toBeVisible({
    timeout: 60000,
  });
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "output-real.png"),
  });
  await page.getByRole("button", { name: "关闭预览", exact: true }).click();
  await page.getByRole("button", { name: "返回文稿", exact: true }).click();
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
  await reopened.goto(world.origin + lessonPath);
  await expect(reopened.locator("[data-reference-id]")).toHaveCount(2);
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
        lessonPath,
        errors,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
  expect(requests.every((r) => r.pageBound)).toBe(true);
});

test("真实身份边界及保存丢响应：同键恢复、草稿保留、退出后拒绝旧页面", async ({
  page,
}) => {
  const directory = fs.mkdtempSync(path.join(root, "recovery-"));
  world = await createIntegration({ directory });
  await register(page);
  await nav(page, "备课");
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page.getByLabel("课题", { exact: true }).fill("保存恢复基线");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page).toHaveURL(/\/lessons\/[a-f0-9-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1),
    endpoint = "/api/modules/lessons/v2/items/" + id;
  let originalKey;
  await page.route("**" + endpoint, async (route) => {
    if (route.request().method() === "PUT") {
      originalKey = route.request().headers()["idempotency-key"];
      await route.fetch();
      await route.abort();
      await page.unroute("**" + endpoint);
    } else await route.continue();
  });
  await page.getByLabel("课题", { exact: true }).fill("服务端已保存但响应丢失");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重试确认", exact: true }),
  ).toBeVisible();
  await page.getByLabel("课题", { exact: true }).fill("继续编辑的新草稿");
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "save-unknown.png"),
  });
  const retried = page.waitForRequest(
    (r) => r.url().endsWith(endpoint) && r.method() === "PUT",
  );
  await page.getByRole("button", { name: "重试确认", exact: true }).click();
  expect((await retried).headers()["idempotency-key"]).toBe(originalKey);
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue(
    "继续编辑的新草稿",
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  let pageId;
  page.on("request", (r) => {
    if (r.url().includes("/api/workbench/"))
      pageId = r.headers()["x-teachbuddy-page"];
  });
  await page.reload();
  await expect(page.locator(".wb-shell")).toBeVisible();
  await nav(page, "设置");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "登录", exact: true }),
  ).toBeVisible();
  const denied = await page.request.get(world.origin + endpoint, {
    headers: { "X-TeachBuddy-Page": pageId },
  });
  expect(denied.status()).toBe(401);
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, "logout-boundary.png"),
  });
});
