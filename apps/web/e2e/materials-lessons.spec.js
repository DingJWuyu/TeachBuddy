import { test, expect } from "@playwright/test";
const evidence = "test-results/evidence/R34/v1";
test("WB-M018/M019/M020: edit manuscript, select references, reopen and generate actual output", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page
    .getByRole("textbox", { name: "课题", exact: true })
    .fill("函数探究 - 浏览器备课");
  await page.getByRole("button", { name: "段落", exact: true }).click();
  await page
    .getByRole("textbox", { name: "开头文稿段落 1", exact: true })
    .fill("讨论函数的定义域与分段条件。");
  await page.getByRole("button", { name: "公式", exact: true }).click();
  await page
    .getByRole("textbox", { name: /开头文稿公式 1源/ })
    .fill("\\sqrt{x_1^2+1}+\\log_2 x");
  await page.getByRole("button", { name: "添加环节", exact: true }).click();
  await page
    .getByRole("textbox", { name: "环节名称 1", exact: true })
    .fill("自主探究");
  const section = page.locator("[data-section-id]");
  await section
    .getByRole("button", { name: "从题库取题", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "选择 函数的定义域", exact: true })
    .check();
  await page
    .getByRole("button", { name: "采用所选 1 项", exact: true })
    .click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(1);
  await section
    .getByRole("button", { name: "从资源库取材", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "选择 课堂阅读资料", exact: true })
    .check();
  await page
    .getByRole("button", { name: "采用所选 1 项", exact: true })
    .click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "本课备注 函数的定义域", exact: true })
    .fill("本课教师追问");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await expect(page.locator("[data-reference-id]")).toHaveCount(2);
  await page.screenshot({
    path: `${evidence}/lesson-desktop.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "输出", exact: true }).click();
  await page.getByRole("button", { name: "保存并生成", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "下载", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "预览成品", exact: true }).click();
  await expect(page.getByAltText("成品第 1 页")).toBeVisible({
    timeout: 30000,
  });
  await page.screenshot({
    path: `${evidence}/output-preview.png`,
    fullPage: true,
  });
  await page.getByLabel("预览缩放").selectOption("150");
  await page.locator(".r34-preview-scroll").evaluate((el) => {
    el.scrollTop = 100;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.getByRole("button", { name: "关闭预览", exact: true }).click();
  await page.getByRole("button", { name: "预览成品", exact: true }).click();
  await expect(page.getByLabel("预览缩放")).toHaveValue("150");
  await expect(page.getByAltText("成品第 1 页")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".r34-preview-scroll").evaluate((el) => el.scrollTop),
    )
    .toBe(100);
  await page.getByRole("button", { name: "关闭预览", exact: true }).click();
  await page.getByRole("button", { name: "返回文稿", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "我的备课", exact: true }).click();
  await page.screenshot({
    path: `${evidence}/lesson-1280-panel.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({
    path: `${evidence}/lesson-tablet.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("WB-M019/M023: lost response and conflicting edit retain the teacher draft", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page
    .getByRole("textbox", { name: "课题", exact: true })
    .fill("恢复演练");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page).toHaveURL(/\/lessons\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").at(-1),
    endpoint = `/api/modules/lessons/v2/items/${id}`;
  await page.route(`**${endpoint}`, async (route) => {
    if (route.request().method() === "PUT") {
      await route.fetch();
      await route.abort("failed");
      await page.unroute(`**${endpoint}`);
    } else await route.continue();
  });
  await page
    .getByRole("textbox", { name: "课题", exact: true })
    .fill("响应丢失但内容已保存");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重试确认", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/save-unconfirmed.png`,
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "课题", exact: true })
    .fill("原请求确认期间的新草稿");
  await page.getByRole("button", { name: "重试确认", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "课题", exact: true }),
  ).toHaveValue("原请求确认期间的新草稿");
  const stored = await (await page.request.get(endpoint)).json();
  expect(stored.version).toBe(2);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("已保存");
  const current = await (await page.request.get(endpoint)).json();
  await page.request.put(endpoint, {
    headers: {
      Origin: "http://localhost:48434",
      "X-TeachBuddy-Request": "1",
      "Idempotency-Key": crypto.randomUUID(),
    },
    data: {
      baseVersion: current.version,
      title: "另一处已保存的课题",
      intro: current.intro,
      sections: [],
      materials: [],
    },
  });
  await page
    .getByRole("textbox", { name: "课题", exact: true })
    .fill("本地冲突稿保留");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator('[data-region="conflict"]')).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "课题", exact: true }),
  ).toHaveValue("本地冲突稿保留");
  await page
    .getByRole("button", { name: "查看服务器版本", exact: true })
    .click();
  await page.screenshot({
    path: `${evidence}/save-conflict.png`,
    fullPage: true,
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "采用服务器版本", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "课题", exact: true }),
  ).toHaveValue("另一处已保存的课题");
});
test("WB-M018/M019: cancelled selections survive and deleted target requires explicit relocation", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page
    .getByRole("textbox", { name: "课题", exact: true })
    .fill("目标环节恢复");
  await page.getByRole("button", { name: "添加环节", exact: true }).click();
  await page
    .getByRole("textbox", { name: "环节名称 1", exact: true })
    .fill("被修改的环节");
  await page
    .locator("[data-section-id]")
    .getByRole("button", { name: "从题库取题", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "选择 函数的定义域", exact: true })
    .check();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page
    .locator("[data-section-id]")
    .getByRole("button", { name: "从题库取题", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "选择 函数的定义域", exact: true }),
  ).toBeChecked();
  const id = page.url().split("/").at(-1),
    endpoint = `/api/modules/lessons/v2/items/${id}`,
    current = await (await page.request.get(endpoint)).json();
  const changed = await page.request.put(endpoint, {
    headers: {
      Origin: "http://localhost:48434",
      "X-TeachBuddy-Request": "1",
      "Idempotency-Key": crypto.randomUUID(),
    },
    data: {
      baseVersion: current.version,
      title: current.title,
      intro: current.intro,
      sections: [],
      materials: [],
    },
  });
  expect(changed.status()).toBe(200);
  await page
    .getByRole("button", { name: "采用所选 1 项", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("备课已在别处修改");
  await page
    .getByRole("button", { name: "取回服务器版本", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("目标环境已变化");
  await page.screenshot({
    path: `${evidence}/picker-target-conflict.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "改选本课材料", exact: true }).click();
  await page
    .getByRole("button", { name: "采用所选 1 项", exact: true })
    .click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(1);
  const originalId = await page
    .locator("[data-reference-id]")
    .getAttribute("data-reference-id");
  await page.getByRole("button", { name: "再放一次", exact: true }).click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(2);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toHaveText("已保存");
  await page.reload();
  await expect(page.locator("[data-reference-id]")).toHaveCount(2);
  expect(
    await page
      .locator("[data-reference-id]")
      .first()
      .getAttribute("data-reference-id"),
  ).toBe(originalId);
});

test("WB-M020: deleted output selections do not block a fresh output", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page
    .getByRole("textbox", { name: "课题", exact: true })
    .fill("输出选项恢复");
  await page.getByRole("button", { name: "添加环节", exact: true }).click();
  await page
    .getByRole("textbox", { name: "环节名称 1", exact: true })
    .fill("将删除的环节");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.getByRole("button", { name: "输出", exact: true }).click();
  await page.locator(".r34-export-options select").nth(1).selectOption("pdf");
  await page.getByRole("button", { name: "返回文稿", exact: true }).click();
  await page
    .getByRole("button", { name: "删除环节 将删除的环节", exact: true })
    .click();
  await page
    .getByRole("button", { name: "移入本课材料并删除", exact: true })
    .click();
  await page.getByRole("button", { name: "输出", exact: true }).click();
  await page.getByRole("button", { name: "保存并生成", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "下载", exact: true }),
  ).toBeVisible({ timeout: 30000 });
});
test("WB-M018: output round trip restores manuscript scroll", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page
    .getByRole("textbox", { name: "课题", exact: true })
    .fill("长课现场");
  for (let n = 0; n < 7; n++)
    await page.getByRole("button", { name: "添加环节", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  const region = page.locator('[data-region="lesson-scroll"]');
  await region.evaluate((el) => {
    el.scrollTop = 150;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBe(150);
  await page.waitForTimeout(200); // Let the existing 120ms scene commit settle.
  await page.getByRole("button", { name: "输出", exact: true }).click();
  await page.getByRole("button", { name: "返回文稿", exact: true }).click();
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBe(150);
});
test("WB-M019: resource comparison previews both adopted and current files", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page
    .getByRole("textbox", { name: "课题", exact: true })
    .fill("资源对照");
  await page.getByRole("button", { name: "从资源库取材", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "选择 课堂阅读资料", exact: true })
    .check();
  await page
    .getByRole("button", { name: "采用所选 1 项", exact: true })
    .click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  // Frozen HTTP Adapter simulates a source replacement; no R32 business is implied.
  await page.route("**/api/modules/lessons/v2/items/*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const r of [
      ...(body.materials || []),
      ...(body.sections || []).flatMap((s) => s.references),
    ])
      if (r.kind === "resource") r.latestVersion = r.resourceVersion + 1;
    await route.fulfill({ response, json: body });
  });
  await page.route(
    "**/api/modules/resources/items/*/for-reference",
    async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.version++;
      await route.fulfill({ response, json: body });
    },
  );
  await page.reload();
  await page
    .getByRole("button", { name: "有更新 · 查看", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "对照更新", exact: true });
  await expect(dialog).not.toContainText("暂不支持");
  await dialog
    .getByRole("button", { name: "预览来源当前文件", exact: true })
    .click();
  await expect(page.getByAltText("成品第 1 页")).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole("button", { name: "关闭预览", exact: true }).click();
  await dialog
    .getByRole("button", { name: "预览本课采用文件", exact: true })
    .click();
  await expect(page.getByAltText("成品第 1 页")).toBeVisible({
    timeout: 30000,
  });
});
