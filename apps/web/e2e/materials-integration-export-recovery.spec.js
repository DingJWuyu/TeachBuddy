import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";

const evidence = process.env.EXPORT_RECOVERY_EVIDENCE;
test.use({ actionTimeout: 15000 });
async function register(page, world) {
    await page.goto(world.origin);
    await page.getByRole("button", { name: "创建账户" }).click();
    await page.getByLabel("昵称", { exact: true }).fill("输出恢复老师");
    await page.getByLabel("邮箱", { exact: true }).fill("recovery@example.test");
    await page.getByLabel("密码", { exact: true }).fill("recovery-password");
    await page.getByLabel("确认密码", { exact: true }).fill("recovery-password");
    await page.getByRole("button", { name: "发送验证码" }).click();
    await expect.poll(() => world.mailer.lastCode("registration", "recovery@example.test")).toBeTruthy();
    await page.getByLabel("邮箱验证码").fill(world.mailer.lastCode("registration", "recovery@example.test"));
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "注册", exact: true }).click();
    await expect(page.locator(".wb-shell")).toBeVisible();
}
const nav = (page, name) => page.locator(".wb-sidebar").getByRole("link", { name, exact: true }).click();

test("输出现场刷新恢复", async ({ page, context }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "export-recovery-"));
  const world = await createIntegration({ directory });
  const errors = [];
  page.on("pageerror", (error) => errors.push({ message: error.message, stack: error.stack }));
  try {
    await register(page, world);
    await page.locator(".wb-sidebar").getByRole("link", { name: "备课", exact: true }).click();
    await page.getByRole("button", { name: "新建备课", exact: true }).click();
    await page.getByLabel("课题", { exact: true }).fill("输出恢复回归课");
    await page.getByRole("button", { name: "添加环节", exact: true }).click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("status").first()).toContainText("已保存");
    await page.getByRole("button", { name: "输出", exact: true }).click();
    await expect(page.getByRole("button", { name: "保存并生成", exact: true })).toBeVisible();
    if (evidence) {
      fs.mkdirSync(evidence, { recursive: true });
      await page.screenshot({ path: path.join(evidence, "before.png") });
    }
    await page.reload();
    await expect(page.getByRole("button", { name: "保存并生成", exact: true })).toBeVisible({ timeout: 5000 });
    expect(errors).toEqual([]);
  } finally {
    if (evidence) {
      await page.screenshot({ path: path.join(evidence, "after.png") });
      fs.writeFileSync(path.join(evidence, "result.json"), JSON.stringify({ errors }, null, 2));
    }
    await context.close();
    await world.close();
  }
});

test("输出恢复保留选项、六种成品与失败现场，新建备课仍可保存", async ({ page, context }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "export-recovery-flow-"));
  const world = await createIntegration({ directory });
  const errors = [], accepted = [], downloads = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", async (response) => {
    if (response.request().method() === "POST" && response.url().endsWith("/exports") && response.ok()) {
      accepted.push(await response.json());
    }
  });
  const output = page.getByRole("button", { name: "保存并生成", exact: true });
  const downloadButtons = page.getByRole("button", { name: "下载", exact: true });
  async function downloadFirst(name) {
    const waiting = page.waitForEvent("download");
    await downloadButtons.first().click();
    const download = await waiting;
    const target = path.join(evidence ?? directory, name);
    await download.saveAs(target);
    const bytes = fs.readFileSync(target);
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    downloads.push({ name, bytes: bytes.length, sha256 });
    expect(bytes.length).toBeGreaterThan(1000);
    return sha256;
  }
  async function restored() {
    await expect(output).toBeVisible();
    await expect(page.getByRole("combobox", { name: "成果", exact: true })).toHaveValue("handout");
    await expect(page.getByRole("combobox", { name: "格式", exact: true })).toHaveValue("pdf");
    await expect(page.getByLabel("答案与解析", { exact: true })).toBeChecked();
    await expect(page.getByLabel("教师注记", { exact: true })).toBeChecked();
    await expect(page.getByLabel("作答空白行", { exact: true })).toHaveValue("7");
    await expect(page.getByLabel("保留环节", { exact: true })).toBeChecked();
    await expect(page.getByLabel("排除环节", { exact: true })).not.toBeChecked();
    await expect(downloadButtons).toHaveCount(6);
  }
  try {
    if (evidence) fs.mkdirSync(evidence, { recursive: true });
    await register(page, world);
    await nav(page, "题库");
    await page.getByRole("button", { name: "自建", exact: true }).click();
    await page.getByLabel("题目标题").fill("恢复导出题");
    await page.getByRole("button", { name: "段落", exact: true }).first().click();
    await page.locator(".q-question textarea").first().fill("求 $x^2=9$ 的解。");
    await page.getByRole("button", { name: "保存题目", exact: true }).click();
    await expect(page.locator(".q-message")).toContainText("已保存");
    await nav(page, "备课");
    await page.getByRole("button", { name: "新建备课", exact: true }).click();
    await page.getByLabel("课题", { exact: true }).fill("完整输出恢复课");
    await page.getByRole("button", { name: "添加环节", exact: true }).click();
    await page.getByLabel("环节名称 1", { exact: true }).fill("保留环节");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page).toHaveURL(/\/lessons\/[a-f0-9-]{36}$/);
    await expect(page.getByRole("status").first()).toContainText("已保存");
    await page.locator("[data-section-id]").getByRole("button", { name: "从题库取题", exact: true }).click();
    await page.getByLabel("选择 恢复导出题", { exact: true }).check();
    await page.getByRole("button", { name: "采用所选 1 项", exact: true }).click();
    await expect(page.locator("[data-reference-id]")).toHaveCount(1);
    await page.getByRole("button", { name: "添加环节", exact: true }).click();
    await page.getByLabel("环节名称 2", { exact: true }).fill("排除环节");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("status").first()).toContainText("已保存");
    const lessonPath = new URL(page.url()).pathname;
    const endpoint = `/api/modules/lessons/v3/${lessonPath.split("/").at(-1)}`;
    await page.getByRole("button", { name: "输出", exact: true }).click();
    let count = 0;
    for (const kind of ["lesson-plan", "practice", "handout"]) {
      for (const format of ["docx", "pdf"]) {
        await page.getByRole("combobox", { name: "成果", exact: true }).selectOption(kind);
        await page.getByRole("combobox", { name: "格式", exact: true }).selectOption(format);
        await output.click();
        await expect(downloadButtons).toHaveCount(++count, { timeout: 60000 });
        await downloadFirst(`${kind}.${format}`);
      }
    }
    await page.getByLabel("答案与解析", { exact: true }).check();
    await page.getByLabel("教师注记", { exact: true }).check();
    await page.getByLabel("作答空白行", { exact: true }).fill("7");
    await page.getByLabel("排除环节", { exact: true }).uncheck();
    const oldHash = await downloadFirst("old-before.pdf");

    // Hold the real read response to observe the loading boundary, without changing storage.
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route("**" + endpoint, async (route) => { await gate; await route.continue(); });
    try {
      await page.reload();
      await expect(page.locator('[data-region="lesson-loading"]')).toBeVisible();
      await expect(output).toHaveCount(0);
      if (evidence) await page.screenshot({ path: path.join(evidence, "loading.png") });
    } finally {
      release();
    }
    await restored();
    await page.unroute("**" + endpoint);
    await page.reload();
    await restored();
    expect(await downloadFirst("old-after-reload.pdf")).toBe(oldHash);
    await nav(page, "资源库");
    await nav(page, "备课");
    await page.getByRole("button", { name: /完整输出恢复课/ }).click();
    await restored();
    expect(await downloadFirst("old-after-reopen.pdf")).toBe(oldHash);

    // A failed document read must show a retry, then recover the same output scene.
    await page.route("**" + endpoint, (route) => route.abort());
    await page.reload();
    await expect(page.locator('[data-region="lesson-load-error"]')).toBeVisible();
    await expect(output).toHaveCount(0);
    if (evidence) await page.screenshot({ path: path.join(evidence, "load-error.png") });
    await page.unroute("**" + endpoint);
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await restored();

    // Real preflight rejection after recovery retains all previous successful files.
    await page.getByRole("button", { name: "返回文稿", exact: true }).click();
    await page.getByRole("button", { name: "公式", exact: true }).first().click();
    const formula = page.locator('[data-document-editor="开头文稿"] textarea').first();
    await formula.fill("\\unknownrecovery{x}");
    await page.getByRole("button", { name: "输出", exact: true }).click();
    await output.click();
    await expect(page.getByRole("button", { name: "返回错误位置", exact: true })).toBeVisible();
    await expect(downloadButtons).toHaveCount(6);
    expect(await downloadFirst("old-after-rejection.pdf")).toBe(oldHash);
    if (evidence) await page.screenshot({ path: path.join(evidence, "export-error.png") });
    await page.getByRole("button", { name: "返回错误位置", exact: true }).click();
    await expect(formula).toHaveValue("\\unknownrecovery{x}");
    await formula.fill("\\frac{1}{2}");
    await page.getByRole("button", { name: "输出", exact: true }).click();
    await output.click();
    await expect(downloadButtons).toHaveCount(7, { timeout: 60000 });
    await downloadFirst("corrected.pdf");
    await page.getByRole("button", { name: "预览成品", exact: true }).first().click();
    await expect(page.getByAltText("成品第 1 页")).toBeVisible({ timeout: 60000 });
    if (evidence) await page.screenshot({ path: path.join(evidence, "preview.png") });
    await page.getByRole("button", { name: "关闭预览", exact: true }).click();

    // Lose only the real acceptance response, then refresh with the original request pending.
    let originalKey;
    await page.route("**" + endpoint + "/exports", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      originalKey = route.request().headers()["idempotency-key"];
      await route.fetch();
      await route.abort();
    });
    await output.click();
    await expect(page.getByRole("button", { name: "重试确认生成请求", exact: true })).toBeVisible();
    await page.unroute("**" + endpoint + "/exports");
    await page.reload();
    await expect(page.getByRole("button", { name: "重试确认生成请求", exact: true })).toBeVisible();
    const retried = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith(endpoint + "/exports"));
    await page.getByRole("button", { name: "重试确认生成请求", exact: true }).click();
    expect((await retried).headers()["idempotency-key"]).toBe(originalKey);
    await expect(output).toBeVisible();
    await expect(downloadButtons).toHaveCount(8, { timeout: 60000 });
    await downloadFirst("confirmed.pdf");
    if (evidence) await page.screenshot({ path: path.join(evidence, "confirmed.png") });

    // The saved output scene remains in storage while a new draft is prepared.
    await nav(page, "备课");
    await page.getByRole("button", { name: "新建备课", exact: true }).click();
    await expect(output).toBeVisible();
    await expect(downloadButtons).toHaveCount(0);
    await page.getByRole("button", { name: "返回文稿", exact: true }).click();
    await page.getByLabel("课题", { exact: true }).fill("恢复后新建备课");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("status").first()).toContainText("已保存");
    await page.reload();
    await expect(page.getByLabel("课题", { exact: true })).toHaveValue("恢复后新建备课");
    if (evidence) await page.screenshot({ path: path.join(evidence, "new-lesson.png") });
    expect(errors).toEqual([]);
  } finally {
    if (evidence) {
      await page.screenshot({ path: path.join(evidence, "flow-final.png") });
      fs.writeFileSync(path.join(evidence, "flow-result.json"), JSON.stringify({ errors, accepted, downloads }, null, 2));
    }
    await context.close();
    await world.close();
  }
});
