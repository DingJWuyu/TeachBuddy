# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: materials-integration-picker-draft.spec.js >> 未手动保存直接取题后再次新建为空白草稿
- Location: apps/web/e2e/materials-integration-picker-draft.spec.js:25:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-section-id]')
Expected: 0
Received: 1
Timeout:  3000ms

Call log:
  - Expect "toHaveCount" locator('[data-section-id]') with timeout 3000ms
  - waiting for locator('[data-section-id]')
    10 × locator resolved to 1 element
       - unexpected value "1"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import fs from "node:fs";
  3  | import path from "node:path";
  4  | import os from "node:os";
  5  | import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
  6  |
  7  | const evidence = process.env.PICKER_DRAFT_EVIDENCE;
  8  | test.use({ actionTimeout: 15000 });
  9  | async function register(page, world) {
  10 |     await page.goto(world.origin);
  11 |     await page.getByRole("button", { name: "创建账户" }).click();
  12 |     await page.getByLabel("昵称", { exact: true }).fill("输出恢复老师");
  13 |     await page.getByLabel("邮箱", { exact: true }).fill("recovery@example.test");
  14 |     await page.getByLabel("密码", { exact: true }).fill("recovery-password");
  15 |     await page.getByLabel("确认密码", { exact: true }).fill("recovery-password");
  16 |     await page.getByRole("button", { name: "发送验证码" }).click();
  17 |     await expect.poll(() => world.mailer.lastCode("registration", "recovery@example.test")).toBeTruthy();
  18 |     await page.getByLabel("邮箱验证码").fill(world.mailer.lastCode("registration", "recovery@example.test"));
  19 |     await page.getByRole("checkbox").check();
  20 |     await page.getByRole("button", { name: "注册", exact: true }).click();
  21 |     await expect(page.locator(".wb-shell")).toBeVisible();
  22 | }
  23 | const nav = (page, name) => page.locator(".wb-sidebar").getByRole("link", { name, exact: true }).click();
  24 |
  25 | test("未手动保存直接取题后再次新建为空白草稿", async ({ page, context }) => {
  26 |   const directory = fs.mkdtempSync(path.join(os.tmpdir(), "picker-"));
  27 |   const world = await createIntegration({ directory });
  28 |   const errors = [];
  29 |   page.on("pageerror", error => errors.push(error.message));
  30 |   try {
  31 |     await register(page, world);
  32 |     await nav(page, "题库");
  33 |     await page.getByRole("button", { name: "自建", exact: true }).click();
  34 |     await page.getByLabel("题目标题").fill("取题回归题");
  35 |     await page.getByRole("button", { name: "段落", exact: true }).first().click();
  36 |     await page.locator(".q-question textarea").first().fill("求 1+1 的值。");
  37 |     await page.getByRole("button", { name: "保存题目", exact: true }).click();
  38 |     await expect(page.locator(".q-message")).toContainText("已保存");
  39 |     await nav(page, "备课");
  40 |     await page.getByRole("button", { name: "新建备课", exact: true }).click();
  41 |     await page.getByLabel("课题", { exact: true }).fill("首次直接取题课");
  42 |     await page.getByRole("button", { name: "添加环节", exact: true }).click();
  43 |     await page.getByLabel("环节名称 1", { exact: true }).fill("首次环节");
  44 |     await page.locator("[data-section-id]").getByRole("button", { name: "从题库取题", exact: true }).click();
  45 |     await page.getByLabel("选择 取题回归题", { exact: true }).check();
  46 |     await page.getByRole("button", { name: "采用所选 1 项", exact: true }).click();
  47 |     await expect(page.locator("[data-reference-id]")).toHaveCount(1);
  48 |     await nav(page, "备课");
  49 |     await page.getByRole("button", { name: "新建备课", exact: true }).click();
> 50 |     await expect(page.locator("[data-section-id]")).toHaveCount(0, { timeout: 3000 });
     |                                                     ^ Error: expect(locator).toHaveCount(expected) failed
  51 |     await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible();
  52 |     expect(errors).toEqual([]);
  53 |   } finally {
  54 |     if (evidence) {
  55 |       fs.mkdirSync(evidence, { recursive: true });
  56 |       await page.screenshot({ path: path.join(evidence, "new-draft.png") });
  57 |       fs.writeFileSync(path.join(evidence, "result.json"), JSON.stringify({ errors, url: page.url(), directory, storage: await page.evaluate(() => ({...localStorage})), text: await page.locator("body").innerText() }, null, 2));
  58 |     }
  59 |     await context.close();
  60 |     await world.close();
  61 |   }
  62 | });
  63 |
```
