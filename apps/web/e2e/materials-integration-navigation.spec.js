import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
const evidence = path.resolve("docs/acceptance/evidence/R34/v1/attempt3");
const root = path.resolve("test-results/r34-attempt3");
fs.mkdirSync(root, { recursive: true });
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
async function prepare(page) {
  const directory = fs.mkdtempSync(path.join(root, "navigation-"));
  world = await createIntegration({ directory });
  await register(page);
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

  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await nav(page, "题库");
  await expect(page.getByLabel("题目标题")).toHaveValue("集成校对题");
}

test("题库使用位置可前往实际环节并返回题库现场", async ({ page }) => {
  await prepare(page);
  await page.getByLabel("搜索题目").fill("集成");
  await page.getByLabel("题目标题").fill("题库未保存修改");
  await page.evaluate(() => { window.navigationDocument = "same-document"; });
  await page.getByText("使用位置", { exact: true }).click();
  await page.screenshot({ path: path.join(evidence, "usage-current.png"), animations: "disabled" });
  const usageLink = page.getByRole("link", { name: "真实材料整合课 自主探究", exact: true });
  await usageLink.focus();
  await usageLink.press("Enter");
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue("真实材料整合课");
  await expect(page.locator("[data-reference-id]")).toHaveCount(1);
  await expect(page.locator("[data-reference-id]")).toBeInViewport();
  expect(await page.evaluate(() => window.navigationDocument)).toBe("same-document");
  await page.reload();
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue("真实材料整合课");
  await page.getByRole("button", { name: "返回题库现场" }).click();
  await expect(page.getByLabel("题目标题")).toHaveValue("题库未保存修改");
  await expect(page.getByLabel("搜索题目")).toHaveValue("集成");
  await expect(page.getByRole("link", { name: "真实材料整合课 自主探究", exact: true })).toBeVisible();
  await expect(usageLink).toBeFocused();
  await usageLink.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, "usage-return.png"), animations: "disabled" });
});

test("题库主动加入后保留成功反馈及前往备课入口", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "加入备课", exact: true }).click();
  await page.getByRole("button", { name: "真实材料整合课", exact: true }).click();
  await page.getByRole("button", { name: "加入", exact: true }).click();
  await page.screenshot({ path: path.join(evidence, "add-current.png"), animations: "disabled" });
  await expect(page.getByRole("link", { name: "前往备课" })).toBeVisible({ timeout: 3000 });
  for (const width of [1440, 1280, 1024]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : width === 1280 ? 800 : 768 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(evidence, `add-success-${width}.png`), animations: "disabled" });
  }
  await page.getByRole("link", { name: "前往备课" }).click();
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue("真实材料整合课");
  await page.getByRole("button", { name: "返回题库现场" }).click();
  await expect(page.getByLabel("题目标题")).toHaveValue("集成校对题");
  await expect(page.getByRole("button", { name: "加入备课", exact: true })).toBeFocused();
});

test("加入备课响应丢失后确认原请求仍提供前往入口且不重复", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "加入备课", exact: true }).click();
  await page.getByRole("button", { name: "真实材料整合课", exact: true }).click();
  let originalKey;
  await page.route("**/api/modules/lessons/v3/*", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    originalKey = route.request().headers()["idempotency-key"];
    await route.fetch();
    await route.abort();
  });
  await page.getByRole("button", { name: "加入", exact: true }).click();
  await expect(page.getByRole("button", { name: "重试确认", exact: true })).toBeVisible();
  await page.unroute("**/api/modules/lessons/v3/*");
  const replay = page.waitForRequest(r => r.method() === "PUT" && r.url().includes("/lessons/v3/"));
  await page.getByRole("button", { name: "重试确认", exact: true }).click();
  expect((await replay).headers()["idempotency-key"]).toBe(originalKey);
  await expect(page.getByRole("link", { name: "前往备课" })).toBeVisible({ timeout: 3000 });
  await page.getByRole("link", { name: "前往备课" }).click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(2);
});

test("最新原生Word校对在真实外壳保存恢复并引用输出", async ({ page }) => {
  const directory = fs.mkdtempSync(path.join(root, "native-word-"));
  world = await createIntegration({ directory });
  await register(page);
  await nav(page, "题库");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  await page.getByRole("button", { name: "Word", exact: true }).click();
  await page.getByLabel("选择原稿").setInputFiles("apps/web/e2e/fixtures/materials-questions/W.docx");
  await page.getByRole("button", { name: "保存原稿并整理" }).click();
  await expect(page.getByLabel("草稿标题")).toBeVisible({ timeout: 60000 });
  const source = page.locator(".q-review-result textarea").first();
  await expect(source).toHaveValue(/x-2/);
  await source.fill((await source.inputValue()).replace("x-2", "x+2"));
  await page.getByLabel("草稿标题").fill("原生Word集成题");
  for (const select of await page.locator(".q-issue select").all()) await select.selectOption("corrected");
  await page.getByRole("button", { name: "保存校对", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("校对已保存");
  await page.reload();
  await expect(source).toHaveValue(/x\+2/);
  await expect(page.locator(".q-review-result [data-formula-failed]")).toHaveCount(0);
  await page.getByRole("button", { name: "确认收录", exact: true }).click();
  await page.getByRole("button", { name: "查看已入库题目" }).click();
  await nav(page, "备课");
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page.getByLabel("课题", { exact: true }).fill("原生Word接续课");
  await page.getByRole("button", { name: "添加环节", exact: true }).click();
  await page.getByLabel("环节名称 1", { exact: true }).fill("练习");
  await page.locator("[data-section-id]").getByRole("button", { name: "从题库取题", exact: true }).click();
  await page.getByLabel("选择 原生Word集成题", { exact: true }).check();
  await page.getByRole("button", { name: "采用所选 1 项", exact: true }).click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "输出", exact: true }).click();
  await page.getByRole("combobox", { name: "成果", exact: true }).selectOption("practice");
  await page.getByRole("combobox", { name: "格式", exact: true }).selectOption("docx");
  await page.getByRole("button", { name: "保存并生成", exact: true }).click();
  await expect(page.getByRole("button", { name: "下载", exact: true })).toBeVisible({ timeout: 60000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  await (await download).saveAs(path.join(evidence, "native-word-practice.docx"));
  fs.writeFileSync(path.join(evidence, "native-word-environment.json"), JSON.stringify({ directory, origin: world.origin, identity: "real-auth/fake-mail", provider: "unavailable" }, null, 2));
});
