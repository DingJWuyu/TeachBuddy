import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
import { registerMath } from "./fixtures/math-static/real.mjs";

let world, api;
const image = path.resolve(
  "apps/web/e2e/fixtures/materials-resources/samples/page.png",
);
const pdf = path.resolve("apps/web/e2e/fixtures/materials/samples/c22.pdf");
async function screenshot(page, info, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(280, 80);
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    animations: "disabled",
  });
}
async function infoPanel(page) {
  const button = page.getByRole("button", { name: "资料信息", exact: true });
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
  await expect(page.getByLabel("资源名称")).toBeVisible();
}
async function upload(page, file = image, first = true) {
  await page
    .getByLabel(first ? "上传第一份资料" : "上传资料", { exact: true })
    .setInputFiles(file);
  await expect(page.locator(".res-status")).toContainText("文件已保存");
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("第 1 页", { exact: true })
        .evaluate((img) => img.naturalWidth),
    )
    .toBeGreaterThan(100);
}

test.beforeEach(async ({ page }) => {
  if (!process.env.WORKBENCH_WEB_DIST)
    throw new Error("先构建到隔离目录，再用 WORKBENCH_WEB_DIST 指向该目录");
  world = await createIntegration({
    directory: fs.mkdtempSync(path.join(os.tmpdir(), "resources-ui-test-")),
  });
  ({ client: api } = await registerMath(world, "resources-ui@example.test"));
  await page.goto(world.origin + "/resources");
  await page
    .getByLabel("邮箱", { exact: true })
    .fill("resources-ui@example.test");
  await page.getByLabel("密码", { exact: true }).fill("math-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator(".res-browser")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  if (
    await page.getByRole("button", { name: "知道了", exact: true }).isVisible()
  )
    await page.getByRole("button", { name: "知道了", exact: true }).click();
});
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world?.close();
  if (world && info.status === info.expectedStatus)
    fs.rmSync(world.directory, { recursive: true });
});

test("先收录后整理：图片、就地建文件夹和标签、保存重开与检索", async ({
  page,
}, info) => {
  await expect(
    page.getByRole("heading", { name: "把教学资料收在一起" }),
  ).toBeVisible();
  await expect(page.getByLabel("格式筛选")).toHaveCount(0);
  await screenshot(page, info, "empty");
  await upload(page);
  await expect(page.locator(".res-metadata")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "上一页", exact: true }),
  ).toHaveCount(0);
  await screenshot(page, info, "image-preview");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载原件", exact: true }).click();
  const download = await downloadEvent;
  expect(
    fs.readFileSync(await download.path()).equals(fs.readFileSync(image)),
  ).toBe(true);
  await infoPanel(page);
  await expect(
    page.getByRole("button", { name: "保存修改", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("资源名称").fill("函数图像课堂素材");
  await page.getByLabel("资源笔记").fill("先观察图像，再归纳单调性");
  await page
    .locator(".res-field-heading")
    .getByRole("button", { name: "新建", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "新建文件夹" })
    .getByLabel("名称", { exact: true })
    .fill("函数课件");
  await page.getByRole("button", { name: "创建文件夹", exact: true }).click();
  await expect(page.getByLabel("资源文件夹")).toHaveValue(/.+/);
  await page
    .getByRole("button", { name: "添加第一个标签", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "新建标签" })
    .getByLabel("名称", { exact: true })
    .fill("复习");
  await page.getByRole("button", { name: "创建标签", exact: true }).click();
  await expect(
    page.locator(".res-metadata").getByLabel("复习", { exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("资料信息已保存");
  await expect(
    page.getByRole("button", { name: "保存修改", exact: true }),
  ).toBeDisabled();
  await screenshot(page, info, "metadata");
  await page.reload();
  await expect(page.getByLabel("资源名称")).toHaveValue("函数图像课堂素材");
  await expect(page.getByLabel("资源笔记")).toHaveValue(
    "先观察图像，再归纳单调性",
  );
  await expect(
    page.locator(".res-metadata").getByLabel("复习", { exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.getByLabel("搜索资料").fill("归纳单调性");
  await expect(page.locator(".res-card-open")).toHaveCount(1);
  await page.getByRole("button", { name: "列表视图", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "列表视图", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await page.getByLabel("格式筛选").selectOption("image/png");
  await page.getByRole("checkbox", { name: "复习", exact: true }).check();
  await expect(page.locator(".res-card-open")).toHaveCount(1);
  await screenshot(page, info, "filtered-list");
  await page.locator(".res-card-open").click();
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await expect(page.getByLabel("搜索资料")).toHaveValue("归纳单调性");
  await expect(page.getByLabel("格式筛选")).toHaveValue("image/png");
  await page.getByLabel("搜索资料").fill("不存在的资料");
  await expect(
    page.getByRole("heading", { name: "没有找到匹配的资料" }),
  ).toBeVisible();
  await expect(
    page.getByText("试试其他关键词，或清除筛选条件。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await expect(page.locator(".res-card-open")).toHaveCount(1);
});

test("真实 PDF 翻页、加入备课、更新文件、归档恢复保留资料和旧引用", async ({
  page,
}, info) => {
  // Only the destination lesson is a fixture. All resource actions use visible UI.
  const created = await api.request("POST", "/api/modules/lessons/v3", {
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      title: "函数复习课",
      intro: { version: 2, blocks: [] },
      sections: [],
      materials: [],
    },
  });
  expect(created.status).toBe(201);
  await upload(page, pdf);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByAltText("第 2 页", { exact: true })).toBeVisible();
  await page.getByLabel("缩放", { exact: true }).selectOption("125");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.locator(".res-card-open").click();
  await expect(page.getByAltText("第 2 页", { exact: true })).toBeVisible();
  await expect(page.getByLabel("缩放", { exact: true })).toHaveValue("125");
  await page.getByRole("button", { name: "加入备课", exact: true }).click();
  await page.getByLabel("选择备课").selectOption(created.json.id);
  await page.getByRole("button", { name: "确认加入", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已加入备课");
  await infoPanel(page);
  await expect(page.locator(".res-usage")).toContainText("函数复习课");
  const before = await api.request(
    "GET",
    "/api/modules/lessons/v3/" + created.json.id,
  );
  const snapshot = before.json.materials[0].snapshot;
  await page.getByLabel("资源名称").fill("函数复习资料");
  await page.getByLabel("资源笔记").fill("更新文件也保留这条备注");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存修改", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "更新文件", exact: true }).click();
  await (await chooserEvent).setFiles(image);
  await expect(
    page.getByRole("dialog", { name: "更新文件确认" }),
  ).toContainText("page.png");
  await page.getByRole("button", { name: "确认更新", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("文件已更新");
  await expect(page.getByLabel("资源名称")).toHaveValue("函数复习资料");
  await expect(page.getByLabel("资源笔记")).toHaveValue(
    "更新文件也保留这条备注",
  );
  await expect(page.locator(".res-usage")).toContainText("来源有更新");
  const after = await api.request(
    "GET",
    "/api/modules/lessons/v3/" + created.json.id,
  );
  expect(after.json.materials[0].snapshot).toEqual(snapshot);
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "归档资料", exact: true }).click();
  await page.getByRole("button", { name: "确认归档", exact: true }).click();
  await expect(page.locator(".res-library")).toBeVisible();
  await expect(page.locator(".res-detail")).toHaveCount(0);
  await expect(page.locator(".res-status")).toBeHidden({ timeout: 3500 });
  await page
    .getByRole("button", { name: "资源库更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "已归档资料", exact: true }).click();
  await expect(page.locator(".res-card-open")).toHaveCount(1);
  await screenshot(page, info, "deleted");
  await page.locator(".res-card-open").click();
  await page.getByRole("button", { name: "恢复资料", exact: true }).click();
  await page.getByRole("button", { name: "确认恢复", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("资料已恢复");
  await page.reload();
  await infoPanel(page);
  await expect(page.getByLabel("资源名称")).toHaveValue("函数复习资料");
  await expect(page.getByLabel("资源笔记")).toHaveValue(
    "更新文件也保留这条备注",
  );
  const resource = (await api.request("GET", "/api/modules/resources/items"))
    .json.items[0];
  const rejected = await api.request(
    "POST",
    `/api/modules/resources/items/${resource.id}/purge`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      body: { baseVersion: resource.version },
    },
  );
  expect(rejected.status).toBe(422);
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "归档资料", exact: true }).click();
  await page.getByRole("button", { name: "确认归档", exact: true }).click();
  await expect(page.locator(".res-library")).toBeVisible();
  await page
    .getByRole("button", { name: "资源库更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "已归档资料", exact: true }).click();
  await page.locator(".res-card-open").click();
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "彻底删除", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "彻底删除确认" }),
  ).toContainText("无法恢复");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".res-detail")).toBeVisible();
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "彻底删除", exact: true }).click();
  await page.getByRole("button", { name: "确认彻底删除", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "没有已归档的资料" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "没有已归档的资料" }),
  ).toBeVisible();
  expect(
    (await api.request("GET", `/api/modules/resources/items/${resource.id}`))
      .status,
  ).toBe(404);
  const lesson = (
    await api.request("GET", "/api/modules/lessons/v3/" + created.json.id)
  ).json;
  expect(lesson.materials[0].snapshot).toEqual(snapshot);
  expect(lesson.materials[0].sourceState).toBe("deleted");
  const original = await api.request(
    "GET",
    `/api/workbench/files/${snapshot.fileId}/content`,
  );
  expect(original.status).toBe(200);
  expect(original.text).toBe(fs.readFileSync(pdf, "utf8"));
});

test("文件夹浏览与菜单键盘操作，桌面和平板布局保持可用", async ({
  page,
}, info) => {
  await upload(page);
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.getByRole("button", { name: "文件夹与标签", exact: true }).click();
  await expect
    .poll(async () => {
      const main = await page.locator(".res-workspace").boundingBox();
      const aside = await page.locator(".wb-aux").boundingBox();
      return Math.max(
        Math.abs(main.y - aside.y),
        Math.abs(main.y + main.height - aside.y - aside.height),
      );
    })
    .toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "新建文件夹", exact: true }).click();
  await page
    .getByRole("dialog", { name: "新建文件夹" })
    .getByLabel("名称", { exact: true })
    .fill("课堂材料");
  await page.getByRole("button", { name: "创建文件夹", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "课堂材料", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "当前资料文件夹" }),
  ).toContainText("课堂材料");
  await upload(page, pdf, false);
  await expect(page.locator(".res-metadata")).toHaveCount(0);
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await expect(page.locator(".res-tools")).toBeVisible();
  await page.locator(".res-card-open").click();
  const menuButton = page.getByRole("button", {
    name: "资料更多操作",
    exact: true,
  });
  await menuButton.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(menuButton).toBeFocused();
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const zoomFits = await page
      .getByLabel("缩放", { exact: true })
      .evaluate(
        (select) =>
          select.getBoundingClientRect().right <=
          select.closest(".res-preview-toolbar").getBoundingClientRect().right -
            8,
      );
    expect(zoomFits).toBe(true);
    await screenshot(page, info, `preview-${width}`);
    await infoPanel(page);
    await expect
      .poll(async () => {
        const main = await page.locator(".res-workspace").boundingBox();
        const aside = await page.locator(".wb-aux").boundingBox();
        return Math.max(
          Math.abs(main.y - aside.y),
          Math.abs(main.y + main.height - aside.y - aside.height),
        );
      })
      .toBeLessThanOrEqual(1);
    await screenshot(page, info, `info-${width}`);
    await page.getByRole("button", { name: "关闭辅助栏", exact: true }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preferences = (
    await api.request("GET", "/api/reliability/v1/preferences")
  ).json;
  const saved = await api.request("PUT", "/api/reliability/v1/preferences", {
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      baseVersion: preferences.version,
      values: { ...preferences.values, theme: "dark", motion: "reduce" },
    },
  });
  expect(saved.status).toBe(200);
  await page.reload();
  await expect(page.locator(".wb-shell")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await screenshot(page, info, "preview-dark");
});

test("预览失败后可以重试，并逐页核对补充 PDF，原文件仍可下载", async ({
  page,
}, info) => {
  const bytes = Buffer.from("%PDF-1.4\ntruncated");
  await page.getByLabel("上传第一份资料", { exact: true }).setInputFiles({
    name: "待核对的课件.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await expect(
    page.getByRole("heading", { name: "暂时无法预览" }),
  ).toBeVisible();
  await expect(page.getByText(/原文件已保存，可以随时下载/)).toBeVisible();
  const response = page.waitForResponse(
    (res) => res.url().includes("/retry") && res.request().method() === "POST",
    { timeout: 8000 },
  );
  await page.getByRole("button", { name: "重试预览", exact: true }).click();
  expect((await response).status()).toBe(202);
  await expect(
    page.getByRole("heading", { name: "暂时无法预览" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重试预览", exact: true }),
  ).toBeVisible();
  await screenshot(page, info, "preview-failed");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "补充 PDF 预览", exact: true })
    .click();
  await (await chooser).setFiles(pdf);
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  const adopt = page.getByRole("button", { name: "采用补充 PDF", exact: true });
  await expect(adopt).toBeDisabled();
  for (const number of [2, 3]) {
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(
      page.getByAltText(`第 ${number} 页`, { exact: true }),
    ).toBeVisible();
  }
  await expect(adopt).toBeEnabled();
  await adopt.click();
  await expect(
    page.getByText("正在查看本版本补充 PDF，原件保持不变。"),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载原件", exact: true }).click();
  const download = await downloadEvent;
  expect(fs.readFileSync(await download.path()).equals(bytes)).toBe(true);
});

test("保存响应丢失后保留原请求及后续草稿，关闭信息栏和刷新可恢复", async ({
  page,
}) => {
  await upload(page);
  await infoPanel(page);
  await page.getByLabel("资源笔记").fill("第一次保存的备注");
  let lost = true,
    originalKey;
  await page.route("**/api/modules/resources/items/*", async (route) => {
    if (lost && route.request().method() === "PUT") {
      lost = false;
      originalKey = route.request().headers()["idempotency-key"];
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeVisible();
  await page.getByLabel("资源笔记").fill("继续写下的草稿");
  await page.getByRole("button", { name: "资料信息", exact: true }).click();
  await expect(page.locator(".res-metadata")).toHaveCount(0);
  await infoPanel(page);
  await expect(page.getByLabel("资源笔记")).toHaveValue("继续写下的草稿");
  await page.reload();
  await expect(page.getByLabel("资源笔记")).toHaveValue("继续写下的草稿");
  const retried = page.waitForRequest(
    (req) =>
      req.method() === "PUT" &&
      req.headers()["idempotency-key"] === originalKey,
  );
  await page.getByRole("button", { name: "重试确认原请求" }).click();
  await retried;
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeHidden();
  await expect(page.getByLabel("资源笔记")).toHaveValue("继续写下的草稿");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存修改", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("资源笔记")).toHaveValue("继续写下的草稿");
});

test("筛选和对话框连续展开收起，快速反向与键盘焦点可用", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await upload(page);
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  async function sample(selector, action) {
    await page.evaluate((selector) => {
      const frames = [];
      const start = performance.now();
      window.resourceMotion = { frames, done: false };
      function record(now) {
        const node = document.querySelector(selector);
        frames.push(node ? Number(getComputedStyle(node).opacity) : 0);
        if (now - start < 500) requestAnimationFrame(record);
        else window.resourceMotion.done = true;
      }
      requestAnimationFrame(record);
    }, selector);
    await action();
    await page.waitForFunction(() => window.resourceMotion.done, null, {
      polling: "raf",
    });
    return page.evaluate(() => window.resourceMotion.frames);
  }
  const filter = page.getByRole("button", { name: "筛选", exact: true });
  const selector = ".res-browser .wb-module-presence.is-collapse";
  for (const action of [() => filter.click(), () => filter.click()]) {
    const frames = await sample(selector, action);
    expect(frames.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
  }
  await expect(page.getByLabel("格式筛选")).toHaveCount(0);
  const reversal = await sample(selector, async () => {
    await filter.click();
    await filter.click();
    await filter.click();
  });
  expect(reversal.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
  await expect(filter).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("格式筛选")).toBeVisible();

  await page.getByRole("button", { name: "文件夹与标签", exact: true }).click();
  const create = page.getByRole("button", { name: "新建文件夹", exact: true });
  const opening = await sample(".res-overlay", () => create.click());
  expect(opening.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
  await expect(
    page.getByRole("dialog").getByLabel("名称", { exact: true }),
  ).toBeFocused();
  const closing = await sample(".res-overlay", () =>
    page.keyboard.press("Escape"),
  );
  expect(closing.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(create).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await filter.click();
  await expect(page.getByLabel("格式筛选")).toHaveCount(0);
});

test("PDF 预览不依赖 Office 安装目录", async ({ page }) => {
  const previous = process.env.MATERIALS_OFFICE_ROOT;
  process.env.MATERIALS_OFFICE_ROOT = path.join(
    world.directory,
    "office-not-installed",
  );
  try {
    await page.getByLabel("上传第一份资料", { exact: true }).setInputFiles(pdf);
    await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
      timeout: 8000,
    });
    await expect
      .poll(() =>
        page
          .getByAltText("第 1 页", { exact: true })
          .evaluate((img) => img.naturalWidth),
      )
      .toBeGreaterThan(100);
  } finally {
    if (previous === undefined) delete process.env.MATERIALS_OFFICE_ROOT;
    else process.env.MATERIALS_OFFICE_ROOT = previous;
  }
});

test("彻底删除的权限、版本与响应丢失恢复", async ({ page }) => {
  await upload(page);
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "归档资料", exact: true }).click();
  await page.getByRole("button", { name: "确认归档", exact: true }).click();
  await expect(page.locator(".res-library")).toBeVisible();
  const archived = (
    await api.request("GET", "/api/modules/resources/items?state=deleted")
  ).json.items[0];
  const endpoint = `/api/modules/resources/items/${archived.id}/purge`;
  const mutation = {
    headers: { "Idempotency-Key": randomUUID() },
    body: { baseVersion: archived.version },
  };
  const other = (
    await registerMath(world, "another-resource-owner@example.test")
  ).client;
  expect((await other.request("POST", endpoint, mutation)).status).toBe(404);
  expect(
    (
      await api.request("POST", endpoint, {
        ...mutation,
        body: { baseVersion: archived.version - 1 },
      })
    ).status,
  ).toBe(409);
  await page
    .getByRole("button", { name: "资源库更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "已归档资料", exact: true }).click();
  await page.locator(".res-card-open").click();
  let key,
    lost = true;
  await page.route("**/purge", async (route) => {
    if (lost) {
      lost = false;
      key = route.request().headers()["idempotency-key"];
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "彻底删除", exact: true }).click();
  await page.getByRole("button", { name: "确认彻底删除", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeVisible();
  await page.reload();
  const retried = page.waitForRequest(
    (req) =>
      req.url().endsWith("/purge") && req.headers()["idempotency-key"] === key,
  );
  await page.getByRole("button", { name: "重试确认原请求" }).click();
  await retried;
  await expect(
    page.getByRole("heading", { name: "没有已归档的资料" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeHidden();
  expect(
    (
      await api.request(
        "POST",
        `/api/modules/resources/items/${archived.id}/deletion`,
        {
          headers: { "Idempotency-Key": randomUUID() },
          body: { baseVersion: archived.version, deleted: false },
        },
      )
    ).status,
  ).toBe(404);
});
