import fs from 'node:fs';
import { test, expect } from "@playwright/test";
import path from "node:path";
const evidence = path.resolve(
  process.env.R32_EVIDENCE_DIR ?? "test-results/evidence/R32/v1",
);
const samples = path.resolve("apps/web/e2e/fixtures/materials/samples");
fs.mkdirSync(evidence, { recursive: true });
test("WB-M013-017 真实上传、逐页、笔记、分类、更新和恢复", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/fixture/session");
  await page
    .getByLabel("上传资料", { exact: true })
    .setInputFiles(path.join(samples, "c22.pptx"));
  await expect(page.getByLabel("资源名称")).toHaveValue("c22.pptx");
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByAltText("第 2 页", { exact: true })).toBeVisible();
  await page.getByLabel("资源名称").fill("函数课堂课件");
  await page.getByLabel("资源笔记").fill("板书：先观察，再归纳");
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已保存");
  await page.screenshot({ path: path.join(evidence, "desktop-preview.png") });
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.getByLabel("搜索资料").fill("板书");
  await expect(
    page.getByRole("button", { name: /函数课堂课件/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新建文件夹", exact: true }).click();
  await page
    .getByRole("dialog", { name: "管理分类" })
    .getByLabel("名称", { exact: true })
    .fill("高一资料");
  await page.getByRole("button", { name: "保存分类", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "管理分类" })).toHaveCount(0);
  await page.getByRole("button", { name: "新建标签", exact: true }).click();
  await page
    .getByRole("dialog", { name: "管理分类" })
    .getByLabel("名称", { exact: true })
    .fill("课堂");
  await page.getByRole("button", { name: "保存分类", exact: true }).click();
  await page.getByRole("button", { name: /函数课堂课件/ }).click();
  await page.getByLabel("资源文件夹").selectOption({ label: "高一资料" });
  await page
    .locator(".res-metadata")
    .getByLabel("课堂", { exact: true })
    .check();
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已保存");
  await page
    .getByLabel("更新文件", { exact: true })
    .setInputFiles(path.join(samples, "c22.pdf"));
  await page.getByRole("button", { name: "确认更新", exact: true }).click();
  await expect(page.locator(".res-file-info strong")).toHaveText("c22.pdf");
  await expect(page.getByLabel("资源笔记")).toHaveValue("板书：先观察，再归纳");
  await page.getByRole("button", { name: "删除资料", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "恢复资料", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "恢复资料", exact: true }).click();
  await page.getByRole("button", { name: "确认恢复", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "删除资料", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("资源笔记")).toHaveValue("板书：先观察，再归纳");
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    for (const panel of [true, false]) {
      const toggle = page.getByRole("button", {
        name: "文件夹与标签",
        exact: true,
      });
      if ((await toggle.getAttribute("aria-expanded")) !== String(panel))
        await toggle.click();
      await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: path.join(
          evidence,
          `preview-${width}-${panel ? "open" : "closed"}.png`,
        ),
      });
    }
  }
});
test("WB-M015 旧DOC风险和逐页核对补充PDF", async ({ page }) => {
  await page.goto("/fixture/session");
  if (
    await page
      .getByRole("button", { name: "返回资源库", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page
    .getByLabel("上传资料", { exact: true })
    .setInputFiles(path.join(samples, "w.doc"));
  await expect(page.getByLabel("资源名称")).toHaveValue("w.doc");
  await expect(page.getByText(/旧 DOC 公式或对象可能缺失/)).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(evidence, "legacy-limited.png") });
  await page
    .getByLabel("补充 PDF 预览", { exact: true })
    .setInputFiles(path.join(samples, "c22.pdf"));
  const adopt = page.getByRole("button", { name: "采用补充 PDF", exact: true });
  await expect(adopt).toBeDisabled();
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByAltText("第 2 页", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByAltText("第 3 页", { exact: true })).toBeVisible();
  await expect(adopt).toBeEnabled();
  await adopt.click();
  await expect(
    page.getByText("正在查看本版本补充 PDF，原件保持不变。"),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(evidence, "supplement-adopted.png"),
  });
});

test("WB-M014 全格式真实页图、返回现场及备课取用 Adapter", async ({ page }) => {
  await page.goto("/fixture/session");
  const own = path.resolve("apps/web/e2e/fixtures/materials-resources/samples");
  for (const source of [
    path.join(samples, "c22.ppt"),
    path.join(own, "w.docx"),
    path.join(own, "page.png"),
    path.join(own, "page.jpg"),
    path.join(own, "page.webp"),
  ]) {
    await page.getByLabel("上传资料", { exact: true }).setInputFiles(source);
    await expect(page.getByLabel("资源名称")).toHaveValue(
      path.basename(source),
    );
    await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
      timeout: 60000,
    });
    expect(
      await page
        .getByAltText("第 1 页", { exact: true })
        .evaluate((img) => img.naturalWidth),
    ).toBeGreaterThan(100);
    while (
      await page
        .getByRole("button", { name: "下一页", exact: true })
        .isEnabled()
    ) {
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      await expect(page.locator(".res-page-paper img")).toBeVisible();
    }
    await page.screenshot({
      path: path.join(evidence, `format-${path.extname(source).slice(1)}.png`),
    });
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  }
  await page.getByLabel("搜索资料").fill("page.webp");
  await page
    .getByRole("button", { name: /page.webp/ })
    .first()
    .click();
  await page.getByRole("button", { name: "加入备课", exact: true }).click();
  await page.getByLabel("选择备课").selectOption({ label: "函数复习课" });
  await page.getByRole("button", { name: "确认加入", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "前往备课：函数复习课" }),
  ).toBeVisible();
  await expect(page.locator(".res-usage")).toContainText("采用版本 1");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await expect(page.getByLabel("搜索资料")).toHaveValue("page.webp");
  await page.screenshot({ path: path.join(evidence, "filtered-library.png") });
});

test("WB-M023/028 未知结果刷新后原键确认，新草稿及冲突对照保留", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page
    .getByLabel("上传资料", { exact: true })
    .setInputFiles(path.join(samples, "c22.pdf"));
  await expect(page.getByLabel("资源名称")).toHaveValue("c22.pdf");
  await page.getByLabel("资源笔记").fill("确认前的笔记");
  let lost = true,
    originalKey,
    pathName;
  await page.route("**/api/modules/resources/items/*", async (route) => {
    if (route.request().method() === "PUT" && lost) {
      lost = false;
      originalKey = route.request().headers()["idempotency-key"];
      pathName = new URL(route.request().url()).pathname;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeVisible();
  await page.getByLabel("资源笔记").fill("后续草稿不能被确认覆盖");
  await page.screenshot({ path: path.join(evidence, "unknown-result.png") });
  await page.reload();
  await expect(page.getByLabel("资源笔记")).toHaveValue(
    "后续草稿不能被确认覆盖",
  );
  const confirmed = page.waitForRequest(
    (r) =>
      r.method() === "PUT" && r.headers()["idempotency-key"] === originalKey,
  );
  await page.getByRole("button", { name: "重试确认原请求" }).click();
  await confirmed;
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("资源笔记")).toHaveValue(
    "后续草稿不能被确认覆盖",
  );
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已保存");
  await page.evaluate(async (pathName) => {
    const value = await fetch(pathName).then((r) => r.json());
    await fetch(pathName, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-TeachBuddy-Request": "1",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        baseVersion: value.version,
        title: value.title,
        folderId: value.folderId,
        tagIds: value.tagIds,
        note: "另一个窗口的笔记",
      }),
    });
  }, pathName);
  await page.getByLabel("资源笔记").fill("我保留的草稿");
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "版本冲突" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "版本冲突" })).toContainText(
    "另一个窗口的笔记",
  );
  await page.screenshot({ path: path.join(evidence, "version-conflict.png") });
  await page.getByRole("button", { name: "保留草稿并对照当前版本" }).click();
  await expect(page.getByLabel("资源笔记")).toHaveValue("我保留的草稿");
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已保存");
});

test("损坏预览可重试，替换失败保持旧文件，HTML不执行", async ({ page }) => {
  await page.goto("/fixture/session");
  await page.getByLabel("上传资料", { exact: true }).setInputFiles({
    name: "损坏.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\ntruncated"),
  });
  await expect(page.getByLabel("资源名称")).toHaveValue("损坏.pdf");
  await expect(page.getByRole("button", { name: "重试预览" })).toBeVisible({
    timeout: 60000,
  });
  await page.screenshot({ path: path.join(evidence, "preview-failure.png") });
  await page.getByRole("button", { name: "重试预览" }).click();
  await expect(page.getByRole("button", { name: "重试预览" })).toBeVisible();
  await page.route("**/api/modules/resources/items/*/file", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "/problems/materials/storage-unavailable",
        field: "",
        detail: "存储暂不可用",
      }),
    }),
  );
  await page
    .getByLabel("更新文件", { exact: true })
    .setInputFiles(path.join(samples, "c22.pdf"));
  await page.getByRole("button", { name: "确认更新", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeVisible();
  await expect(page.locator(".res-file-info strong")).toHaveText("损坏.pdf");
  await expect(page.getByRole("alert")).toContainText("存储暂不可用");
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeEnabled();
  await page.unroute("**/api/modules/resources/items/*/file");
  await page.getByRole("button", { name: "重试确认原请求" }).click();
  await expect(page.locator(".res-file-info strong")).toHaveText("c22.pdf");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.getByLabel("上传资料", { exact: true }).setInputFiles({
    name: "安全文本.html",
    mimeType: "text/html",
    buffer: Buffer.from(
      "<!doctype html><html><h1>文字</h1><script>window.UNSAFE_EXECUTED=1</script></html>",
    ),
  });
  await expect(page.getByLabel("资源名称")).toHaveValue("安全文本.html");
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  expect(await page.evaluate(() => window.UNSAFE_EXECUTED)).toBeUndefined();
});

test("重启后新浏览器上下文读取笔记、原件和账户隔离", async ({ browser }) => {
  const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    }),
    page = await context.newPage();
  await page.goto("/fixture/session");
  await page.getByLabel("搜索资料").fill("我保留的草稿");
  await expect(page.locator(".res-card-open")).toHaveCount(1);
  await page.locator(".res-card-open").click();
  await expect(page.getByLabel("资源笔记")).toHaveValue("我保留的草稿");
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await page.screenshot({
    path: path.join(evidence, "restart-new-context.png"),
  });
  await page.goto("/fixture/session?account=b");
  await expect(page.getByText("上传第一份课件或文档")).toBeVisible();
  await expect(page.locator(".res-card-open")).toHaveCount(0);
  await context.close();
});

test("列表与预览独立滚动，关闭后恢复筛选位置和键盘焦点", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/fixture/session");
  const prefix = "滚动资料 " + Date.now();
  await page.evaluate(async (prefix) => {
    const items = await fetch("/api/modules/resources/items").then((r) =>
      r.json(),
    );
    const source = items.items.find((i) => i.title === "函数课堂课件");
    for (let i = 0; i < 24; i++) {
      const r = await fetch("/api/modules/resources/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TeachBuddy-Request": "1",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          title: `${prefix} ${i + 1}`,
          fileId: source.fileId,
          folderId: null,
          tagIds: [],
          note: "",
        }),
      });
      if (!r.ok) throw Error("seed failed");
    }
  }, prefix);
  await page.getByLabel("搜索资料").fill(prefix);
  await expect(page.locator(".res-card-open")).toHaveCount(24);
  await expect(page.locator(".res-thumb img").first()).toBeVisible();
  await page.locator(".res-card-open").last().scrollIntoViewIfNeeded();
  const scroll = await page
    .locator(".res-items")
    .evaluate((el) => el.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  await page.locator(".res-card-open").last().click();
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await page.locator(".res-page-scroll").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByAltText("第 2 页", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await expect(page.getByLabel("搜索资料")).toHaveValue(prefix);
  await expect
    .poll(() => page.locator(".res-items").evaluate((el) => el.scrollTop))
    .toBe(scroll);
  await expect(page.locator(".res-card-open").last()).toBeFocused();
  await page.screenshot({
    path: path.join(evidence, "grid-scroll-restored.png"),
  });
  await page.getByRole("button", { name: "列表视图", exact: true }).click();
  await page.screenshot({ path: path.join(evidence, "list-view.png") });
});

test("分类草稿在辅助栏关闭和刷新后保留", async ({ page }) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建文件夹", exact: true }).click();
  await page
    .getByRole("dialog", { name: "管理分类" })
    .getByLabel("名称", { exact: true })
    .fill("仍保留的文件夹草稿");
  await page.getByRole("button", { name: "文件夹与标签", exact: true }).click();
  await page.getByRole("button", { name: "文件夹与标签", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "管理分类" })
      .getByLabel("名称", { exact: true }),
  ).toHaveValue("仍保留的文件夹草稿");
  await page.reload();
  await expect(
    page
      .getByRole("dialog", { name: "管理分类" })
      .getByLabel("名称", { exact: true }),
  ).toHaveValue("仍保留的文件夹草稿");
});
test("预览阅读位置随文件和页恢复", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/fixture/session");
  await page.getByLabel("搜索资料").fill("w.docx");
  await page.locator(".res-card-open").first().click();
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await page.getByLabel("缩放", { exact: true }).selectOption("200");
  await page.locator(".res-page-scroll").hover();
  await page.mouse.wheel(0, 420);
  await expect
    .poll(() => page.locator(".res-page-scroll").evaluate((e) => e.scrollTop))
    .toBeGreaterThan(200);
  const scroll = await page
    .locator(".res-page-scroll")
    .evaluate((e) => e.scrollTop);
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.locator(".res-card-open").first().click();
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator(".res-page-scroll").evaluate((e) => e.scrollTop))
    .toBe(scroll);
  await page.reload();
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator(".res-page-scroll").evaluate((e) => e.scrollTop))
    .toBe(scroll);
});
test("备课目标快速切换不被迟到响应覆盖", async ({ page }) => {
  await page.goto("/fixture/session");
  await page.getByLabel("搜索资料").fill("函数课堂课件");
  await expect(page.locator(".res-card-open")).toHaveCount(1);
  await page.locator(".res-card-open").click();
  const lesson = await page.request
    .get("/api/modules/lessons/v3")
    .then((r) => r.json())
    .then((v) => v.items[0]);
  const a = {
      ...lesson,
      id: "00000000-0000-4000-8000-000000000801",
      title: "备课 A",
    },
    b = {
      ...lesson,
      id: "00000000-0000-4000-8000-000000000802",
      title: "备课 B",
    };
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/modules/lessons/v3", (route) =>
    route.fulfill({ json: { items: [a, b] } }),
  );
  await page.route(`**/api/modules/lessons/v3/${a.id}`, async (route) => {
    await gate;
    await route.fulfill({ json: a });
  });
  await page.route(`**/api/modules/lessons/v3/${b.id}`, (route) =>
    route.fulfill({ json: b }),
  );
  await page.getByRole("button", { name: "加入备课", exact: true }).click();
  const requested = page.waitForRequest((r) => r.url().endsWith(a.id));
  await page.getByLabel("选择备课").selectOption(a.id);
  await requested;
  await page.getByLabel("选择备课").selectOption(b.id);
  await expect(page.getByLabel("选择备课")).toHaveValue(b.id);
  const late = page.waitForResponse((r) => r.url().endsWith(a.id));
  release();
  await late;
  await page.waitForFunction(() =>
    performance
      .getEntriesByType("resource")
      .some((r) => r.name.endsWith("00000000-0000-4000-8000-000000000801")),
  );
  await expect(page.getByLabel("选择备课")).toHaveValue(b.id);
});
