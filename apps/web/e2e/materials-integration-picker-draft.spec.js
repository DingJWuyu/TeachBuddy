import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";

const evidence = process.env.PICKER_DRAFT_EVIDENCE;
test.use({ actionTimeout: 15000 });
async function register(page, world, email = "picker@example.test") {
    await page.goto(world.origin);
    await page.getByRole("button", { name: "创建账户" }).click();
    await page.getByLabel("昵称", { exact: true }).fill("取题回归老师");
    await page.getByLabel("邮箱", { exact: true }).fill(email);
    await page.getByLabel("密码", { exact: true }).fill("recovery-password");
    await page.getByLabel("确认密码", { exact: true }).fill("recovery-password");
    await page.getByRole("button", { name: "发送验证码" }).click();
    await expect.poll(() => world.mailer.lastCode("registration", email)).toBeTruthy();
    await page.getByLabel("邮箱验证码").fill(world.mailer.lastCode("registration", email));
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "注册", exact: true }).click();
    await expect(page.locator(".wb-shell")).toBeVisible();
}
const nav = (page, name) => page.locator(".wb-sidebar").getByRole("link", { name, exact: true }).click();


async function createQuestion(page) {
    await nav(page, "题库");
    await page.getByRole("button", { name: "自建", exact: true }).click();
    await page.getByLabel("题目标题").fill("取题回归题");
    await page.getByRole("button", { name: "段落", exact: true }).first().click();
    await page.locator(".q-question textarea").first().fill("求 1+1 的值。");
    await page.getByRole("button", { name: "保存题目", exact: true }).click();
    await expect(page.locator(".q-message")).toContainText("已保存");
}

async function newLesson(page, title) {
    await nav(page, "备课");
    await page.getByRole("button", { name: "新建备课", exact: true }).click();
    await page.getByLabel("课题", { exact: true }).fill(title);
    await page.getByRole("button", { name: "添加环节", exact: true }).click();
}
const pick = page => page.locator("[data-section-id]").getByRole("button", { name: "从题库取题", exact: true }).click();
async function adopt(page) {
    await page.getByLabel("选择 取题回归题", { exact: true }).check();
    await page.getByRole("button", { name: "采用所选 1 项", exact: true }).click();
}

test("未手动保存直接取题后再次新建为空白草稿", async ({ page, context }) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "picker-"));
  const world = await createIntegration({ directory });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await register(page, world);
    await createQuestion(page);
    await nav(page, "备课");
    await page.getByRole("button", { name: "新建备课", exact: true }).click();
    await page.getByLabel("课题", { exact: true }).fill("首次直接取题课");
    await page.getByRole("button", { name: "添加环节", exact: true }).click();
    await page.getByLabel("环节名称 1", { exact: true }).fill("首次环节");
    await page.locator("[data-section-id]").getByRole("button", { name: "从题库取题", exact: true }).click();
    await page.getByLabel("选择 取题回归题", { exact: true }).check();
    await page.getByRole("button", { name: "采用所选 1 项", exact: true }).click();
    await expect(page.locator("[data-reference-id]")).toHaveCount(1);
    const firstPath = new URL(page.url()).pathname;
    await page.reload();
    await expect(page.getByLabel("课题", { exact: true })).toHaveValue("首次直接取题课");
    await expect(page.locator("[data-reference-id]")).toHaveCount(1);
    await nav(page, "备课");
    await page.getByRole("button", { name: "新建备课", exact: true }).click();
    await expect(page.locator("[data-section-id]")).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible();
    await capture(page, "new-draft");
    await page.getByLabel("课题", { exact: true }).fill("第二次直接取题课");
    await page.getByRole("button", { name: "添加环节", exact: true }).click();
    await pick(page);
    await adopt(page);
    await expect(page.locator("[data-reference-id]")).toHaveCount(1);
    await page.reload();
    await expect(page.getByLabel("课题", { exact: true })).toHaveValue("第二次直接取题课");
    await expect(page.locator("[data-reference-id]")).toHaveCount(1);
    await page.goto(world.origin + firstPath);
    await expect(page.getByLabel("环节名称 1", { exact: true })).toHaveValue("首次环节");
    await expect(page.locator("[data-reference-id]")).toHaveCount(1);
    await page.getByRole("button", { name: "输出", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "保存并生成", exact: true })).toBeVisible();
    expect(world.workbench.db.prepare("SELECT COUNT(*) AS n FROM lesson_items").get().n).toBe(2);
    expect(errors).toEqual([]);
  } finally {
    if (evidence) {
      fs.mkdirSync(evidence, { recursive: true });
      await page.screenshot({ path: path.join(evidence, "flow-final.png") });
      fs.writeFileSync(path.join(evidence, "result.json"), JSON.stringify({ errors, url: page.url(), lessonCount: world.workbench.db.prepare("SELECT COUNT(*) AS n FROM lesson_items").get().n, text: await page.locator("body").innerText() }, null, 2));
    }
    await context.close();
    await world.close();
  }
});

async function capture(page, name, details = {}) {
  if (!evidence) return;
  fs.mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, name + ".png") });
  fs.writeFileSync(path.join(evidence, name + ".json"), JSON.stringify({ ...details, text: await page.locator("body").innerText() }, null, 2));
}

test("创建响应丢失保留原请求和后续输入，确认后不重复创建", async ({ page, context }) => {
  const world = await createIntegration();
  let original;
  try {
    await register(page, world);
    await newLesson(page, "待确认课");
    await page.route("**/api/modules/lessons/v3", async route => {
      if (route.request().method() !== "POST") return route.continue();
      original = { key: route.request().headers()["idempotency-key"], body: route.request().postData() };
      await route.fetch();
      await route.abort();
    });
    await pick(page);
    await expect(page.getByRole("button", { name: "重试确认", exact: true })).toBeVisible();
    await page.getByLabel("课题", { exact: true }).fill("确认期间继续编辑");
    await page.unroute("**/api/modules/lessons/v3");
    await page.reload();
    await expect(page.getByLabel("课题", { exact: true })).toHaveValue("确认期间继续编辑");
    const retry = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/api/modules/lessons/v3"));
    await page.getByRole("button", { name: "重试确认", exact: true }).click();
    const repeated = await retry;
    expect(repeated.headers()["idempotency-key"]).toBe(original.key);
    expect(repeated.postData()).toBe(original.body);
    await expect(page).toHaveURL(/\/lessons\/[a-f0-9-]{36}$/);
    await page.reload();
    await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible();
    await expect(page.getByLabel("课题", { exact: true })).toHaveValue("确认期间继续编辑");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page).toHaveURL(/\/lessons\/[a-f0-9-]{36}$/);
    await page.reload();
    await expect(page.getByLabel("课题", { exact: true })).toHaveValue("确认期间继续编辑");
    expect(world.workbench.db.prepare("SELECT COUNT(*) AS n FROM lesson_items").get().n).toBe(1);
  } finally {
    await capture(page, "create-recovery", { original });
    await context.close();
    await world.close();
  }
});

test("采用响应丢失后原键确认只保留一个引用", async ({ page, context }) => {
  const world = await createIntegration();
  let original;
  try {
    await register(page, world);
    await createQuestion(page);
    await newLesson(page, "采用恢复课");
    await pick(page);
    await page.route("**/api/modules/lessons/v3/*", async route => {
      if (route.request().method() !== "PUT") return route.continue();
      original = { key: route.request().headers()["idempotency-key"], body: route.request().postData() };
      await route.fetch();
      await route.abort();
    });
    await adopt(page);
    await expect(page.getByRole("alert")).toContainText("暂不能确认是否保存");
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await page.unroute("**/api/modules/lessons/v3/*");
    await page.reload();
    const retry = page.waitForRequest(request => request.method() === "PUT" && request.url().includes("/api/modules/lessons/v3/"));
    await page.getByRole("button", { name: "重试确认", exact: true }).click();
    const repeated = await retry;
    expect(repeated.headers()["idempotency-key"]).toBe(original.key);
    expect(repeated.postData()).toBe(original.body);
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
    await expect(page.locator("[data-reference-id]")).toHaveCount(1);
    await page.reload();
    await expect(page.locator("[data-reference-id]")).toHaveCount(1);
  } finally {
    await capture(page, "adopt-recovery", { original });
    await context.close();
    await world.close();
  }
});

test("账户切换保留各自新建草稿", async ({ page, context }) => {
  const world = await createIntegration();
  try {
    await register(page, world);
    await newLesson(page, "甲账户未保存内容");
    await nav(page, "设置");
    await page.getByRole("button", { name: "退出登录", exact: true }).click();
    await register(page, world, "second@example.test");
    await nav(page, "备课");
    await page.getByRole("button", { name: "新建备课", exact: true }).click();
    await expect(page.locator("[data-section-id]")).toHaveCount(0);
    await page.getByLabel("课题", { exact: true }).fill("乙账户保存内容");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page).toHaveURL(/\/lessons\/[a-f0-9-]{36}$/);
    await nav(page, "设置");
    await page.getByRole("button", { name: "退出登录", exact: true }).click();
    await page.getByLabel("邮箱", { exact: true }).fill("picker@example.test");
    await page.getByLabel("密码", { exact: true }).fill("recovery-password");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.locator(".wb-shell")).toBeVisible();
    await nav(page, "备课");
    await expect(page.getByRole("button", { name: /乙账户保存内容/ })).toHaveCount(0);
    await page.getByRole("button", { name: "新建备课", exact: true }).click();
    await expect(page.getByLabel("课题", { exact: true })).toHaveValue("甲账户未保存内容");
    await expect(page.locator("[data-section-id]")).toHaveCount(1);
  } finally {
    await capture(page, "account-drafts");
    await context.close();
    await world.close();
  }
});


test("离开后的迟到创建响应不覆盖重开的草稿", async ({ page, context }) => {
  const world = await createIntegration();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let received;
  const accepted = new Promise(resolve => { received = resolve; });
  try {
    await register(page, world);
    await newLesson(page, "迟到创建课");
    await page.route("**/api/modules/lessons/v3", async route => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      received();
      await gate;
      await route.fulfill({ response });
    });
    await pick(page);
    await accepted;
    await nav(page, "备课");
    await page.getByRole("button", { name: "新建备课", exact: true }).click();
    await page.getByLabel("课题", { exact: true }).fill("重开后继续编辑");
    const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/api/modules/lessons/v3"));
    release();
    await response;
    await page.unroute("**/api/modules/lessons/v3");
    await page.reload();
    await expect(page).toHaveURL(/\/lessons\/new$/);
    await expect(page.getByLabel("课题", { exact: true })).toHaveValue("重开后继续编辑");
    await expect(page.getByRole("button", { name: "重试确认", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "重试确认", exact: true }).click();
    await expect(page).toHaveURL(/\/lessons\/[a-f0-9-]{36}$/);
    await expect(page.getByLabel("课题", { exact: true })).toHaveValue("重开后继续编辑");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.locator('[data-save-status="saved"]')).toBeVisible();
    expect(world.workbench.db.prepare("SELECT COUNT(*) AS n FROM lesson_items").get().n).toBe(1);
  } finally {
    release();
    await capture(page, "late-response");
    await context.close();
    await world.close();
  }
});
