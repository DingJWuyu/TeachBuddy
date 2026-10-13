import { test as baseTest, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
import { registerMath } from "./fixtures/math-static/real.mjs";
import net from "node:net";
import https from "node:https";
import { startServer } from "../../api/src/server.js";
import {
  createClient,
  createMailer,
  generateSelfSignedCertificate,
} from "../../api/test/fixtures/auth-contract/harness.js";

const test = baseTest.extend({
  recognizer: [null, { option: true }],
  recognitionHome: [null, { option: true }],
});
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

test.beforeEach(async ({ page, recognizer, recognitionHome }) => {
  if (!process.env.WORKBENCH_WEB_DIST && !process.env.RESOURCE_UI_DEV)
    throw new Error("先构建到隔离目录，再用 WORKBENCH_WEB_DIST 指向该目录");
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "resources-ui-test-"),
  );
  if (process.env.RESOURCE_UI_DEV) {
    generateSelfSignedCertificate(directory);
    const reservation = net.createServer();
    await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    const mailer = createMailer();
    world = await startServer({
      dev: true,
      env: {
        nodeEnv: "development",
        port,
        sqlitePath: path.join(directory, "workspace.sqlite"),
        authCodeSecret: "isolated-resources-development",
        workbench: {
          recognition: { recognizer, home: recognitionHome },
          publicOrigin: `https://localhost:${port}`,
          filesDir: path.join(directory, "files"),
          tls: {
            cert: path.join(directory, "tls-cert.pem"),
            key: path.join(directory, "tls-key.pem"),
          },
        },
      },
      sendCode: mailer.sendCode,
    });
    Object.assign(world, {
      directory,
      mailer,
      client: () => createClient(world.origin, { transport: https }),
    });
  } else
    world = await createIntegration({
      directory,
      workbench: { recognition: { recognizer, home: recognitionHome } },
    });
  ({ client: api } = await registerMath(world, "resources-ui@example.test"));
  await page.goto(world.origin + "/resources");
  if (process.env.RESOURCE_UI_DEV)
    await expect(page.locator('script[src="/@vite/client"]')).toHaveCount(1);
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

test("真实 PDF 翻页、更新文件、归档恢复与彻底删除", async ({
  page,
}, info) => {
  await upload(page, pdf);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.getByAltText("第 2 页", { exact: true })).toBeVisible();
  await page.getByLabel("缩放", { exact: true }).selectOption("125");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.locator(".res-card-open").click();
  await expect(page.getByAltText("第 2 页", { exact: true })).toBeVisible();
  await expect(page.getByLabel("缩放", { exact: true })).toHaveValue("125");
  await infoPanel(page);
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
  await page.getByRole("button", { name: "确认 更新", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("文件已更新");
  await expect(page.getByLabel("资源名称")).toHaveValue("函数复习资料");
  await expect(page.getByLabel("资源笔记")).toHaveValue(
    "更新文件也保留这条备注",
  );
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "归档资料", exact: true }).click();
  await page.getByRole("button", { name: "确认 归档", exact: true }).click();
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
  await page.getByRole("button", { name: "确认 恢复", exact: true }).click();
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
  await page.getByRole("button", { name: "确认 归档", exact: true }).click();
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
  await page.getByRole("button", { name: "确认 彻底删除", exact: true }).click();
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
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await expect(page.locator(".res-thumb img")).toBeVisible();
  await expect(page.locator(".res-preview-state")).toHaveCount(0);
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
  await page.getByRole("button", { name: "确认 归档", exact: true }).click();
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
  await page.getByRole("button", { name: "确认 彻底删除", exact: true }).click();
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

test("单份文件读取失败不阻断正常资料下载", async ({ page }) => {
  await upload(page, image);
  const broken = (await api.request("GET", "/api/modules/resources/items")).json
    .items[0];
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await upload(page, pdf, false);
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.route(`**/api/workbench/files/${broken.fileId}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ detail: "文件暂时不可读取或保存" }),
    }),
  );
  await page.reload();
  await expect(page.locator(".res-browser")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("button", { name: /c22.pdf/ }).click();
  await expect(
    page.getByRole("button", { name: "下载原件", exact: true }),
  ).toBeEnabled();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载原件", exact: true }).click();
  expect(
    fs.readFileSync(await (await event).path()).equals(fs.readFileSync(pdf)),
  ).toBe(true);
});

test("不支持的预览格式给出明确原因而不是无效重试", async ({ page }) => {
  await page.getByLabel("上传第一份资料", { exact: true }).setInputFiles({
    name: "课堂记录.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("仅存档的文字资料"),
  });
  await expect(page.getByText("此格式暂不支持在线预览")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重试预览", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "下载原件", exact: true }),
  ).toBeEnabled();
});

test("历史文件可下载核对并恢复，备注保持", async ({ page }, info) => {
  await upload(page, pdf);
  await infoPanel(page);
  // Hold the list refresh so consecutive edits use the confirmed save response.
  const lists = /\/api\/modules\/resources\/items(?:\?.*)?$/;
  let releaseLists;
  const listGate = new Promise(resolve => { releaseLists = resolve; });
  await page.route(lists, async route => { await listGate; await route.continue(); });
  let original;
  try {
    await page.getByLabel("资源笔记").fill("保留的教学备注");
    const firstSave = page.waitForResponse(response => response.request().method() === 'PUT' && /\/resources\/items\//.test(response.url()));
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    expect((await firstSave).status()).toBe(200);
    await expect(page.getByRole("button", { name: "保存修改", exact: true })).toBeDisabled();
    original = (await api.request("GET", "/api/modules/resources/items")).json.items[0];
    await page.getByLabel("资源笔记").fill("只更新备注，不更新文件");
    const secondSave = page.waitForResponse(response => response.request().method() === 'PUT' && /\/resources\/items\//.test(response.url()));
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    expect((await secondSave).status()).toBe(200);
    await expect(page.getByRole('dialog', { name: '版本冲突', exact: true })).toHaveCount(0);
  } finally {
    releaseLists();
    await page.unrouteAll({ behavior: 'wait' });
  }
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "更新文件", exact: true }).click();
  await (await chooser).setFiles(image);
  await page.getByRole("button", { name: "确认 更新", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("文件已更新");
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "文件历史版本", exact: true })
    .click();
  const old = page.locator(".res-history-entry").filter({ hasText: "c22.pdf" });
  await expect(old).toBeVisible();
  await expect(old.getByRole("button", { name: "预览此版本", exact: true })).toBeVisible();
  const beforeViewing = (await api.request("GET", `/api/modules/resources/items/${original.id}`)).json;
  await old.getByRole("button", { name: "预览此版本", exact: true }).click();
  const historyDialog = page.getByRole("dialog", { name: "文件历史版本" });
  await expect(historyDialog.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await historyDialog.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(historyDialog.getByAltText("第 2 页", { exact: true })).toBeVisible();
  await expect(historyDialog.getByRole("button", { name: "识别文字", exact: true })).toHaveCount(0);
  await expect(historyDialog.getByRole("button", { name: "生成预览", exact: true })).toHaveCount(0);
  await screenshot(page, info, "history-readonly-preview");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(historyDialog.getByLabel("跳转页码")).toBeVisible();
  await screenshot(page, info, "history-readonly-phone");
  expect((await api.request("GET", `/api/modules/resources/items/${original.id}`)).json).toEqual(beforeViewing);
  await historyDialog.getByRole("button", { name: "返回历史列表", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await screenshot(page, info, "history-desktop");
  await page.setViewportSize({ width: 768, height: 900 });
  await screenshot(page, info, "history-narrow");
  const historyBox = await page
    .getByRole("dialog", { name: "文件历史版本" })
    .boundingBox();
  expect(historyBox.x).toBeGreaterThanOrEqual(0);
  expect(historyBox.x + historyBox.width).toBeLessThanOrEqual(768);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const download = page.waitForEvent("download");
  await old.getByRole("button", { name: "下载此版本" }).click();
  expect(
    fs.readFileSync(await (await download).path()).equals(fs.readFileSync(pdf)),
  ).toBe(true);
  await old.getByRole("button", { name: "恢复为当前文件" }).click();
  await page.getByRole("button", { name: "取消恢复" }).click();
  expect(
    (await api.request("GET", `/api/modules/resources/items/${original.id}`))
      .json.fileId,
  ).not.toBe(original.fileId);
  await old.getByRole("button", { name: "恢复为当前文件" }).click();
  await page.getByRole("button", { name: "确认恢复文件" }).click();
  await expect(page.locator(".res-status")).toContainText("已恢复历史文件");
  await page.getByRole("button", { name: "关闭辅助栏", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("跳转页码").fill("3");
  await page.getByRole("button", { name: "跳转", exact: true }).click();
  await expect(page.getByAltText("第 3 页", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.getByLabel("缩放", { exact: true }).evaluate((element) => {
        const control = element.getBoundingClientRect();
        const toolbar = element
          .closest(".res-preview-toolbar")
          .getBoundingClientRect();
        return (
          control.right <= toolbar.right && control.bottom <= toolbar.bottom
        );
      }),
    )
    .toBe(true);
  await screenshot(page, info, "page-jump-phone");
  const menuBounds = await page
    .getByRole("button", { name: "资料更多操作", exact: true })
    .boundingBox();
  expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await expect(page.getByAltText("第 3 页", { exact: true })).toBeVisible();
  await infoPanel(page);
  await expect(page.getByLabel("资源笔记")).toHaveValue(
    "只更新备注，不更新文件",
  );
  const current = (
    await api.request("GET", `/api/modules/resources/items/${original.id}`)
  ).json;
  expect(current.fileId).toBe(original.fileId);
  const history = await api.request(
    "GET",
    `/api/modules/resources/items/${original.id}/history`,
  );
  expect(history.json.items).toHaveLength(3);
  const exported = await api.request("POST", "/api/reliability/v1/exports", {
    headers: { "Idempotency-Key": randomUUID() },
    body: {},
  });
  expect(exported.status).toBe(202);
  await expect
    .poll(
      async () =>
        (
          await api.request(
            "GET",
            `/api/reliability/v1/exports/${exported.json.id}`,
          )
        ).json.state,
    )
    .toBe("ready");
  const archive = await JSZip.loadAsync(
    fs.readFileSync(
      path.join(world.directory, "personal-exports", `${exported.json.id}.zip`),
    ),
  );
  const manifest = JSON.parse(
    await archive.file("manifest.json").async("string"),
  );
  expect(
    manifest.objects.filter(
      (object) =>
        object.key.kind === "resource-file-revision" &&
        object.key.id === original.id,
    ),
  ).toHaveLength(3);
  const foreign = await registerMath(world, "history-other@example.test");
  expect(
    (
      await foreign.client.request(
        "GET",
        `/api/modules/resources/items/${original.id}/history`,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await api.request(
        "POST",
        `/api/modules/resources/items/${original.id}/restore-file`,
        {
          headers: { "Idempotency-Key": randomUUID() },
          body: { baseVersion: original.version, fileVersion: 1 },
        },
      )
    ).status,
  ).toBe(409);
});

test("批量收录遇到重复资料可刷新后继续，不重复创建已保存条目", async ({
  page,
}) => {
  await page
    .getByLabel("上传第一份资料", { exact: true })
    .setInputFiles([image, image, pdf]);
  await expect(
    page.getByRole("dialog", { name: "发现重复资料" }),
  ).toBeVisible();
  expect(
    (await api.request("GET", "/api/modules/resources/items")).json.items,
  ).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "发现重复资料" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "跳过这份资料" }).click();
  await expect(page.locator(".res-card")).toHaveCount(2);
  await expect(page.locator(".res-status")).toContainText(
    "已处理 3 / 3 份资料",
  );
  await page.getByLabel("上传资料", { exact: true }).setInputFiles(image);
  await page.getByRole("button", { name: "仍然另存一份" }).click();
  await expect(page.locator(".res-status")).toContainText("文件已保存");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await expect(page.locator(".res-card")).toHaveCount(3);
});

test("批量整理取消、冲突和响应丢失保持原子结果", async ({ page }, info) => {
  const folderId = randomUUID(),
    tagId = randomUUID();
  expect(
    (
      await api.request("PUT", "/api/modules/resources/taxonomy", {
        headers: { "Idempotency-Key": randomUUID() },
        body: {
          baseVersion: 1,
          folders: [{ id: folderId, name: "期末复习", parentId: null }],
          tags: [{ id: tagId, name: "重点" }],
        },
      })
    ).status,
  ).toBe(200);
  await page
    .getByLabel("上传第一份资料", { exact: true })
    .setInputFiles([image, pdf]);
  await expect(page.locator(".res-status")).toContainText(
    "已处理 2 / 2 份资料",
  );
  await expect(page.locator(".res-card")).toHaveCount(2);
  async function selectAll() {
    await page.getByRole("button", { name: "选择资料", exact: true }).click();
    await page
      .getByRole("button", { name: "选择当前结果", exact: true })
      .click();
  }
  await selectAll();
  await page.getByRole("button", { name: "移动", exact: true }).click();
  await page.getByLabel("目标文件夹").selectOption(folderId);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect(
    (await api.request("GET", "/api/modules/resources/items")).json.items.every(
      (item) => item.folderId === null,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "移动", exact: true }).click();
  await page.getByLabel("目标文件夹").selectOption(folderId);
  await page.getByRole("button", { name: "确认 移动", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已移动 2 份资料");
  await selectAll();
  await page.getByRole("button", { name: "添加标签", exact: true }).click();
  await page.getByRole("dialog").getByLabel("重点", { exact: true }).check();
  await page.getByRole("button", { name: "确认 添加标签", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("2 份资料");
  await expect
    .poll(async () =>
      (
        await api.request("GET", "/api/modules/resources/items")
      ).json.items.every((item) => item.tagIds.includes(tagId)),
    )
    .toBe(true);
  const items = (await api.request("GET", "/api/modules/resources/items")).json
    .items;
  const invalid = {
    action: "archive",
    items: items.map((item, i) => ({
      id: item.id,
      baseVersion: item.version - (i === 1 ? 1 : 0),
    })),
    folderId: null,
    tagIds: [],
  };
  expect(
    (
      await api.request("POST", "/api/modules/resources/items/organize", {
        headers: { "Idempotency-Key": randomUUID() },
        body: invalid,
      })
    ).status,
  ).toBe(409);
  expect(
    (await api.request("GET", "/api/modules/resources/items")).json.items,
  ).toHaveLength(2);
  let key;
  await page.route("**/items/organize", async (route) => {
    key = route.request().headers()["idempotency-key"];
    await route.fetch();
    await route.abort("failed");
  });
  await selectAll();
  await page.getByRole("button", { name: "归档", exact: true }).click();
  await page.getByRole("button", { name: "确认 归档", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeVisible();
  await page.unroute("**/items/organize");
  await page.reload();
  const replay = page.waitForRequest((req) =>
    req.url().endsWith("/items/organize"),
  );
  await page.getByRole("button", { name: "重试确认原请求" }).click();
  expect((await replay).headers()["idempotency-key"]).toBe(key);
  await expect(page.locator(".res-status")).toContainText("已归档 2 份资料");
  await page
    .getByRole("button", { name: "资源库更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "已归档资料", exact: true }).click();
  await selectAll();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await page.getByRole("button", { name: "确认 恢复", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已恢复 2 份资料");
  const restored = (await api.request("GET", "/api/modules/resources/items"))
    .json.items;
  expect(
    restored.every(
      (item) => item.folderId === folderId && item.tagIds.includes(tagId),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "全部资料", exact: true })
    .first()
    .click();
  await selectAll();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.locator(".res-status")).toBeVisible();
  await expect
    .poll(async () => {
      const toast = await page.locator(".res-status").boundingBox();
      const toolbar = await page.locator(".res-selection").boundingBox();
      return toast.y + toast.height <= toolbar.y;
    })
    .toBe(true);
  await screenshot(page, info, "batch-narrow");
  const preferences = (
    await api.request("GET", "/api/reliability/v1/preferences")
  ).json;
  expect(
    (
      await api.request("PUT", "/api/reliability/v1/preferences", {
        headers: { "Idempotency-Key": randomUUID() },
        body: {
          baseVersion: preferences.version,
          values: { ...preferences.values, theme: "dark", motion: "reduce" },
        },
      })
    ).status,
  ).toBe(200);
  await page.reload();
  await expect(page.locator(".wb-shell")).toHaveAttribute("data-theme", "dark");
  await screenshot(page, info, "batch-dark");
  const bounds = await page.locator(".res-selection").boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(768);
});

test("批量收录拒绝后重试遇到响应丢失，刷新接续剩余文件", async ({ page }) => {
  let attempt = 0,
    key;
  await page.route("**/api/modules/resources/items", async (route) => {
    if (route.request().method() !== "POST" || attempt >= 2)
      return route.continue();
    attempt++;
    if (attempt === 1)
      return route.fulfill({
        status: 422,
        contentType: "application/problem+json",
        body: JSON.stringify({ detail: "本次请求已明确拒绝" }),
      });
    key = route.request().headers()["idempotency-key"];
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByLabel("上传第一份资料", { exact: true })
    .setInputFiles([image, pdf]);
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "跳过未保存的资料" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重试确认原请求" }).click();
  await expect(
    page.getByRole("button", { name: "重试确认原请求" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "跳过未保存的资料" }),
  ).toHaveCount(0);
  await page.reload();
  const replay = page.waitForRequest(
    (req) => req.url().endsWith("/resources/items") && req.method() === "POST",
  );
  await page.getByRole("button", { name: "重试确认原请求" }).click();
  expect((await replay).headers()["idempotency-key"]).toBe(key);
  await expect(page.locator(".res-card")).toHaveCount(2);
  await expect(page.locator(".res-status")).toContainText(
    "已处理 2 / 2 份资料",
  );
  expect(
    (await api.request("GET", "/api/modules/resources/items")).json.items,
  ).toHaveLength(2);
});

async function findSample(context) {
  const source = await context.newPage();
  try {
    await source.setContent(`<style>
      @page { size: A4; margin: 20mm; }
      body { margin: 0; font: 22px "Noto Sans CJK SC", sans-serif; }
      section { height: 900px; position: relative; break-after: page; }
      section:last-child { break-after: auto; }
      .last { position: absolute; top: 780px; }
      </style><section><h1>本页查找样本</h1>
      <p>函数 Function function FUNCTION</p><p>函数与图像</p>
      <p><span>跨项</span><strong>匹配</strong></p><p>a+b [x]</p>
      <p class="last">函数的第三处，在本页底部</p></section>
      <section><h1>专属词</h1><p>函数只有一处</p></section>`);
    await source.evaluate(() => document.fonts.ready);
    return {
      name: "页内查找样本.pdf",
      mimeType: "application/pdf",
      buffer: await source.pdf({ preferCSSPageSize: true }),
    };
  } finally {
    await source.close();
  }
}
async function findHighlights(page) {
  return page.evaluate(() =>
    [...CSS.highlights.entries()]
      .filter(([name]) => name.startsWith("res-find-"))
      .map(([name, value]) => ({
        name,
        texts: [...value].map((range) => range.toString()),
        rects: [...value].map((range) => {
          const rect = range.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        }),
      })),
  );
}

test("查找本页：真实中英文、跨文字项高亮、键盘导航与复制", async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await upload(page, await findSample(context));
  await page.getByRole("button", { name: "查找本页", exact: true }).click();
  const input = page.getByRole("textbox", { name: "查找本页文字" });
  const status = page.locator(".res-find-status");
  await expect(input).toBeFocused();
  await input.pressSequentially("函数");
  await expect(input).toHaveValue("函数");
  await expect(status).toHaveText("1 / 3 处");
  await expect
    .poll(
      async () =>
        (await findHighlights(page)).find(
          (entry) => !entry.name.endsWith("-current"),
        )?.texts,
    )
    .toEqual(["函数", "函数", "函数"]);
  await input.press("Enter");
  await expect(status).toHaveText("2 / 3 处");
  await input.press("Enter");
  await expect(status).toHaveText("3 / 3 处");
  await expect
    .poll(() =>
      page.locator(".res-page-scroll").evaluate((node) => node.scrollTop),
    )
    .toBeGreaterThan(100);
  await screenshot(page, info, "find-third-match");
  await input.press("Shift+Enter");
  await expect(status).toHaveText("2 / 3 处");
  await input.fill("跨项匹配");
  await expect(status).toHaveText("1 / 1 处");
  await expect(
    page.locator(".res-pdf-text span").filter({ hasText: /^跨项$/ }),
  ).toHaveCount(1);
  await expect(
    page.locator(".res-pdf-text span").filter({ hasText: /^匹配$/ }),
  ).toHaveCount(1);
  await expect
    .poll(
      async () =>
        (await findHighlights(page)).find((entry) =>
          entry.name.endsWith("-current"),
        )?.texts,
    )
    .toEqual(["跨项匹配"]);
  await screenshot(page, info, "find-cross-items");
  await input.fill("a+b [x]");
  await expect(status).toHaveText("1 / 1 处");
  await input.fill("Function");
  await expect(status).toHaveText("1 / 3 处");
  const line = page
    .locator(".res-pdf-text span")
    .filter({ hasText: "Function" })
    .first();
  const box = await line.boundingBox();
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => getSelection().toString()))
    .toContain("Function");
  const selection = await page.evaluate(() => getSelection().toString());
  await page.getByRole("button", { name: "下一处匹配", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => getSelection().toString()))
    .toBe(selection);
  await page.keyboard.press("Control+c");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("Function");
  await page.getByRole("button", { name: "复制本页文字", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("函数的第三处");
  await input.fill("函数");
  await page.getByRole("button", { name: "下一处匹配", exact: true }).click();
  await expect(status).toHaveText("2 / 3 处");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(status).toHaveText("1 / 1 处");
  await page.getByRole("button", { name: "上一页", exact: true }).click();
  await expect(status).toHaveText("1 / 3 处");
  await input.fill("专属词");
  await expect(status).toHaveText("本页无匹配");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(input).toHaveValue("专属词");
  await expect(status).toHaveText("1 / 1 处");
  await input.fill("");
  await expect(status).toHaveText("仅查找当前页");
  await expect.poll(() => findHighlights(page)).toEqual([]);
  await input.press("Escape");
  await expect(
    page.getByRole("button", { name: "查找本页", exact: true }),
  ).toBeFocused();
  await expect(input).not.toBeVisible();
});

test("查找本页：缩放、深浅主题与窄屏保持高亮和操作可达", async ({
  page,
  context,
}, info) => {
  await upload(page, await findSample(context));
  const open = async () => {
    await page.getByRole("button", { name: "查找本页", exact: true }).click();
    await page.getByRole("textbox", { name: "查找本页文字" }).fill("函数");
    await expect(page.locator(".res-find-status")).toHaveText("1 / 3 处");
  };
  await open();
  const width = async () =>
    (await findHighlights(page)).find((entry) =>
      entry.name.endsWith("-current"),
    )?.rects[0].width ?? 0;
  const original = await width();
  expect(original).toBeGreaterThan(10);
  await page.getByLabel("缩放", { exact: true }).selectOption("75");
  await expect.poll(width).toBeGreaterThan(original * 0.65);
  await expect.poll(width).toBeLessThan(original * 0.9);
  await screenshot(page, info, "find-light-75");
  await page.getByLabel("缩放", { exact: true }).selectOption("200");
  await expect.poll(width).toBeGreaterThan(original * 1.8);
  await page.getByRole("button", { name: "下一处匹配", exact: true }).click();
  await expect(page.locator(".res-find-status")).toHaveText("2 / 3 处");
  await screenshot(page, info, "find-light-200");
  await page.getByLabel("缩放", { exact: true }).selectOption("100");
  await expect(page.locator(".res-find-status")).toHaveText("2 / 3 处");
  await page.getByRole("link", { name: /^账户：/ }).click();
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await expect(page.locator(".wb-shell")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("navigation", { name: "功能模块" })
    .getByRole("link", { name: /^资源库/ })
    .click();
  await expect(
    page.getByRole("button", { name: "复制本页文字", exact: true }),
  ).toBeVisible();
  await open();
  await screenshot(page, info, "find-dark-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  const input = page.getByRole("textbox", { name: "查找本页文字" });
  await input.click();
  await input.pressSequentially("不存在");
  await expect(page.locator(".res-find-status")).toHaveText("本页无匹配");
  await input.fill("跨项匹配");
  await expect(page.locator(".res-find-status")).toHaveText("1 / 1 处");
  await page.getByRole("button", { name: "下一处匹配", exact: true }).click();
  for (const control of [
    input,
    page.getByRole("button", { name: "关闭页内查找" }),
  ]) {
    const rect = await control.boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(390);
  }
  await screenshot(page, info, "find-dark-phone");
  await page.getByRole("button", { name: "关闭页内查找", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查找本页", exact: true }),
  ).toBeFocused();
  await expect.poll(() => findHighlights(page)).toEqual([]);
});

test("查找本页：迟到读取、换文件、快速翻页与重新进入不串结果", async ({
  page,
  context,
}, info) => {
  await upload(page, await findSample(context));
  const first = (await api.request("GET", "/api/modules/resources/items")).json
    .items[0];
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route(
    `**/api/workbench/files/${first.fileId}/content`,
    async (route) => {
      const response = await route.fetch();
      intercepted = true;
      await held;
      await route.fulfill({ response }).catch(() => {});
    },
  );
  try {
    await page.locator(".res-card-open").click();
    await expect.poll(() => intercepted).toBe(true);
    await page.getByRole("button", { name: "查找本页", exact: true }).click();
    await page.getByRole("textbox", { name: "查找本页文字" }).fill("函数");
    await expect(page.locator(".res-find-status")).toHaveText(
      "正在读取本页文字…",
    );
    await screenshot(page, info, "find-loading");
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
    await upload(page, pdf, false);
    await page.getByRole("button", { name: "查找本页", exact: true }).click();
    const input = page.getByRole("textbox", { name: "查找本页文字" });
    await expect(input).toHaveValue("");
    await input.fill("三角形");
    await expect(page.locator(".res-find-status")).toHaveText("本页无匹配");
    release();
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(page.locator(".res-find-status")).toHaveText(/\d+ \/ \d+ 处/);
    await expect
      .poll(
        async () =>
          (await findHighlights(page)).find((entry) =>
            entry.name.endsWith("-current"),
          )?.texts,
      )
      .toEqual(["三角形"]);
    await page.getByRole("button", { name: "上一页", exact: true }).click();
    await page.getByRole("button", { name: "上一页", exact: true }).click();
    await expect(page.locator(".res-find-status")).toHaveText("本页无匹配");
    await expect.poll(() => findHighlights(page)).toEqual([]);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "复制本页文字", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "查找本页", exact: true }).click();
    await expect(input).toHaveValue("");
    await input.fill("二次函数");
    await expect(page.locator(".res-find-status")).toHaveText(/\d+ \/ \d+ 处/);
    await screenshot(page, info, "find-reopened");
    await registerMath(world, "find-other@example.test");
    await page.getByRole("link", { name: /^账户：/ }).click();
    await page.getByRole("button", { name: "退出登录", exact: true }).click();
    await page
      .getByLabel("邮箱", { exact: true })
      .fill("find-other@example.test");
    await page.getByLabel("密码", { exact: true }).fill("math-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.getByRole("button", { name: "知道了", exact: true }).click();
    await page
      .getByRole("navigation", { name: "功能模块" })
      .getByRole("link", { name: /^资源库/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "把教学资料收在一起" }),
    ).toBeVisible();
    await expect(page.locator(".res-page-find")).toHaveCount(0);
    await expect.poll(() => findHighlights(page)).toEqual([]);
  } finally {
    release();
    await page.unroute(`**/api/workbench/files/${first.fileId}/content`);
  }
});

test("查找本页：浏览器无高亮能力时保留原预览与复制", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() =>
    Object.defineProperty(globalThis, "Highlight", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.reload();
  await upload(page, pdf);
  await page.getByRole("button", { name: "查找本页", exact: true }).click();
  await expect(page.locator(".res-find-status")).toHaveText(
    "当前浏览器暂不支持页内查找，仍可预览与复制。",
  );
  await expect(
    page.getByRole("textbox", { name: "查找本页文字" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "复制本页文字", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("二次函数");
  await page.getByRole("button", { name: "关闭页内查找", exact: true }).click();
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
});

test("正文检索定位、中文选择复制、刷新与缩放保留文字层", async ({
  page,
  context,
}, info) => {
  for (const asset of [
    "cmaps/UniGB-UTF16-H.bcmap",
    "standard_fonts/LiberationSans-Regular.ttf",
  ]) {
    const response = await page.request.get(
      world.origin + "/resources-pdf/" + asset,
    );
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).not.toContain("text/html");
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await upload(page, pdf);
  const copy = page.getByRole("button", { name: "复制本页文字", exact: true });
  await expect(copy).toBeVisible();
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("二次函数");
  const title = page
    .locator(".res-pdf-text span")
    .filter({ hasText: "二次函数" })
    .first();
  const box = await title.boundingBox();
  expect(box.width).toBeGreaterThan(100);
  await page.mouse.move(box.x + 1, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, {
    steps: 15,
  });
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.getSelection().toString()))
    .toContain("函数");
  await page.keyboard.press("Control+c");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("函数");
  await screenshot(page, info, "selected-chinese-text");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.getByLabel("搜索资料").pressSequentially("三角形");
  await expect(page.locator(".res-search-excerpt")).toContainText("第 3 页");
  await expect(page.locator(".res-search-excerpt")).toContainText("三角形");
  await screenshot(page, info, "body-search");
  await page.locator(".res-card-open").click();
  await expect(page.getByAltText("第 3 页", { exact: true })).toBeVisible();
  await expect(page.getByLabel("查找本页文字", { exact: true })).toHaveValue("三角形");
  await expect(page.locator(".res-find-status")).toHaveText(/1 \/ \d+ 处/);
  await screenshot(page, info, "search-native-highlight");
  await expect(copy).toBeVisible();
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("三角形");
  await page.getByLabel("缩放", { exact: true }).selectOption("150");
  await expect(page.locator(".res-pdf-text")).toContainText("三角形");
  await page.reload();
  await expect(page.getByAltText("第 3 页", { exact: true })).toBeVisible();
  await expect(copy).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, info, "copy-phone");
  const copyBox = await copy.boundingBox();
  expect(copyBox.x).toBeGreaterThanOrEqual(0);
  expect(copyBox.x + copyBox.width).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("全文检索只跟随当前文件，历史恢复与归档刷新保持正确", async ({ page }) => {
  await upload(page, pdf);
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.getByLabel("搜索资料").fill("三角形");
  await expect(page.locator(".res-card-open")).toHaveCount(1);
  await page.locator(".res-card-open").click();
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "更新文件", exact: true }).click();
  await (await chooser).setFiles(image);
  await page.getByRole("button", { name: "确认 更新", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("文件已更新");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await expect(page.locator(".res-card-open")).toHaveCount(0);
  await expect(page.locator(".res-search-status")).toContainText(
    "暂无可直接提取的文字",
  );
  await page.getByRole("button", { name: "清除搜索", exact: true }).click();
  await page.locator(".res-card-open").click();
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "文件历史版本", exact: true })
    .click();
  await page
    .getByRole("button", { name: "恢复为当前文件", exact: true })
    .click();
  await page.getByRole("button", { name: "确认恢复文件", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已恢复历史文件");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.getByLabel("搜索资料").fill("三角形");
  await expect(page.locator(".res-search-excerpt")).toContainText("第 3 页");
  await page.locator(".res-card-open").click();
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "归档资料", exact: true }).click();
  await page.getByRole("button", { name: "确认 归档", exact: true }).click();
  await expect(page.locator(".res-card-open")).toHaveCount(0);
  await page
    .getByRole("button", { name: "资源库更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "已归档资料", exact: true }).click();
  await page.getByLabel("搜索资料").fill("三角形");
  await expect(page.locator(".res-search-excerpt")).toContainText("第 3 页");
  await page.reload();
  await expect(page.locator(".res-search-excerpt")).toContainText("第 3 页");
  const { client: other } = await registerMath(
    world,
    "body-search-other@example.test",
  );
  const otherResult = await other.request(
    "GET",
    "/api/modules/resources/items?q=三角形",
  );
  expect(otherResult.json.items).toEqual([]);
  expect(otherResult.json.search.matches).toEqual({});
});

test("扫描 PDF 提示无文字，文字读取失败可重试且不影响页图", async ({
  page,
  context,
}, info) => {
  const printPage = await context.newPage();
  await printPage.setContent(
    `<img src="data:image/png;base64,${fs.readFileSync(image).toString("base64")}">`,
  );
  await printPage.locator("img").evaluate((img) => img.decode());
  const scanned = await printPage.pdf();
  await printPage.close();
  await upload(page, {
    name: "扫描讲义.pdf",
    mimeType: "application/pdf",
    buffer: scanned,
  });
  await expect(
    page.getByText("本页没有可提取文字，可能是扫描页或图片。"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "复制本页文字" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "查找本页", exact: true }).click();
  await page.getByRole("textbox", { name: "查找本页文字" }).fill("函数");
  await expect(page.locator(".res-find-status")).toHaveText(
    "本页没有可查找文字。",
  );
  await expect(
    page.getByRole("button", { name: "下一处匹配", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.getByLabel("搜索资料").fill("扫描讲义");
  await expect(page.locator(".res-card-open")).toHaveCount(1);
  await expect(page.locator(".res-search-status")).toContainText(
    "暂无可直接提取的文字",
  );
  await page.getByRole("button", { name: "清除搜索", exact: true }).click();
  await page.route("**/api/workbench/files/*/content", async (route) => {
    const response = await route.fetch();
    if (response.headers()["content-type"]?.includes("application/pdf"))
      await route.abort("failed");
    else await route.fulfill({ response });
  });
  await upload(page, pdf, false);
  await expect(
    page.getByRole("button", { name: "重新读取文字", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查找本页", exact: true }).click();
  await page.getByRole("textbox", { name: "查找本页文字" }).fill("函数");
  await expect(page.locator(".res-find-status")).toHaveText(
    "本页文字读取失败，可重新读取。",
  );
  await expect
    .poll(() =>
      page
        .getByAltText("第 1 页", { exact: true })
        .evaluate((img) => img.naturalWidth),
    )
    .toBeGreaterThan(100);
  await page.unroute("**/api/workbench/files/*/content");
  await page.getByRole("button", { name: "重新读取文字", exact: true }).click();
  await expect(page.locator(".res-find-status")).toHaveText(/\d+ \/ \d+ 处/);
  await expect(
    page.getByRole("button", { name: "复制本页文字" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 768, height: 900 });
  const preferences = (
    await api.request("GET", "/api/reliability/v1/preferences")
  ).json;
  await api.request("PUT", "/api/reliability/v1/preferences", {
    headers: { "Idempotency-Key": randomUUID() },
    body: {
      baseVersion: preferences.version,
      values: { ...preferences.values, theme: "dark", motion: "reduce" },
    },
  });
  await page.reload();
  await expect(page.locator(".wb-shell")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "复制本页文字" }),
  ).toBeVisible();
  await screenshot(page, info, "copy-dark-narrow");
});

test("坏 PDF 的正文失败独立显示，继续检索其他资料并支持重试", async ({
  page,
}) => {
  await page.getByLabel("上传第一份资料", { exact: true }).setInputFiles([
    {
      name: "损坏课件.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\ntruncated"),
    },
    {
      name: "正常课件.pdf",
      mimeType: "application/pdf",
      buffer: fs.readFileSync(pdf),
    },
    {
      name: "课堂摘录.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("分层教学案例：<script>安全显示</script>"),
    },
  ]);
  await expect(page.locator(".res-card-open")).toHaveCount(3);
  await page.getByLabel("搜索资料").fill("三角形");
  await expect(page.locator(".res-search-status")).toContainText(
    "1 份资料正文读取失败",
  );
  await expect(page.locator(".res-search-excerpt")).toContainText("三角形");
  await expect(page.locator(".res-search-status")).not.toContainText(
    "正在读取",
  );
  await page.getByRole("button", { name: "重新读取正文", exact: true }).click();
  await expect(page.locator(".res-search-excerpt")).toContainText("三角形");
  await page.getByLabel("搜索资料").fill("分层教学");
  await expect(page.locator(".res-search-excerpt")).toContainText(
    "<script>安全显示</script>",
  );
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await page.getByLabel("格式筛选").selectOption("application/pdf");
  await expect(page.locator(".res-card-open")).toHaveCount(0);
});

test("正文逐步检索断网时停止等待，重试后接续结果", async ({ page }) => {
  await page.getByLabel("上传第一份资料", { exact: true }).setInputFiles([
    {
      name: "甲.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("共同正文甲"),
    },
    {
      name: "乙.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("共同正文乙"),
    },
  ]);
  await expect(page.locator(".res-card-open")).toHaveCount(2);
  let searches = 0;
  await page.route("**/api/modules/resources/items?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("q") && ++searches > 1)
      await route.abort("failed");
    else await route.continue();
  });
  await page.getByLabel("搜索资料").fill("共同正文");
  await expect(page.locator(".res-search-status")).toContainText(
    "正文检索已中断",
  );
  await expect(page.locator(".res-search-status")).not.toContainText(
    "正在读取",
  );
  await page.unroute("**/api/modules/resources/items?*");
  await page.getByRole("button", { name: "继续检索", exact: true }).click();
  await expect(page.locator(".res-search-excerpt")).toHaveCount(2);
});

for (const source of [
  "materials/samples/c22.pptx",
  "materials/samples/c22.ppt",
  "materials/samples/w.doc",
  "materials-resources/samples/w.docx",
]) {
  test(`Office 原件真实逐页预览与下载：${path.extname(source)}`, async ({
    page,
    context,
  }, info) => {
    test.skip(
      !process.env.MATERIALS_OFFICE_ROOT,
      "需配置真实 LibreOffice 环境",
    );
    const original = path.resolve("apps/web/e2e/fixtures", source);
    await page
      .getByLabel("上传第一份资料", { exact: true })
      .setInputFiles(original);
    await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
      timeout: 60000,
    });
    const item = (await api.request("GET", "/api/modules/resources/items")).json
      .items[0];
    const preview = (
      await api.request("GET", `/api/workbench/files/${item.fileId}/preview`)
    ).json;
    expect(preview.pageCount).toBeGreaterThan(0);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page
      .getByRole("button", { name: "复制本页文字", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain(source.includes("c22") ? "教学目标" : "固定样本");
    await page.getByRole("button", { name: "查找本页", exact: true }).click();
    await page
      .getByRole("textbox", { name: "查找本页文字" })
      .fill(source.includes("c22") ? "教学目标" : "固定样本");
    await expect(page.locator(".res-find-status")).toHaveText(/\d+ \/ \d+ 处/);
    await screenshot(page, info, "office-page-find");
    await page
      .getByRole("button", { name: "关闭页内查找", exact: true })
      .click();
    if (source.endsWith(".doc"))
      await expect(page.getByText(/旧 DOC 公式或对象可能缺失/)).toBeVisible();
    for (let number = 1; number <= preview.pageCount; number++) {
      if (number > 1)
        await page.getByRole("button", { name: "下一页", exact: true }).click();
      await expect
        .poll(() =>
          page
            .getByAltText(`第 ${number} 页`, { exact: true })
            .evaluate((img) => img.naturalWidth),
        )
        .toBeGreaterThan(100);
    }
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载原件", exact: true }).click();
    expect(
      fs
        .readFileSync(await (await download).path())
        .equals(fs.readFileSync(original)),
    ).toBe(true);
    await screenshot(page, info, "office-last-page");
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
    await page
      .getByLabel("搜索资料")
      .fill(source.includes("c22") ? "三角形" : "定义域");
    await expect(page.locator(".res-search-excerpt")).toContainText(
      source.includes("c22") ? "三角形" : "定义域",
    );
  });
}

// Replay actual model artifacts through the real HTTP/SQLite/Files pipeline.
// These tests verify resource behavior, not OCR model fidelity.
test.describe("OCR 资源消费", () => {
  const fixtureRoot = path.resolve(
    "apps/web/e2e/fixtures/resources-recognition",
  );
  const recognizer = {
    revision: "resources-recorded-paddle-v1",
    calls: 0,
    mode: "ready",
    sample: "I-2",
    release: null,
    async run({ bytes, signal }) {
      expect(bytes.length).toBeGreaterThan(100);
      this.calls++;
      const sample = this.sample;
      if (this.mode === "fail")
        throw new Error("Recognition temporarily unavailable");
      if (["hold", "cleanup-failure"].includes(this.mode)) {
        const mode = this.mode;
        await new Promise((resolve, reject) => {
          const stop = () =>
            reject(
              mode === "cleanup-failure"
                ? Object.assign(new Error("Scope stop failed"), {
                    code: "recognition-cleanup",
                  })
                : signal.reason,
            );
          this.release = () => {
            signal.removeEventListener("abort", stop);
            resolve();
          };
          signal.addEventListener("abort", stop, { once: true });
          if (signal.aborted) stop();
        });
      }
      signal.throwIfAborted();
      const directory = path.join(fixtureRoot, sample);
      const raw = JSON.parse(
        fs.readFileSync(path.join(directory, "raw.json"), "utf8"),
      );
      const images = path.join(directory, "imgs");
      return {
        raw,
        markdown: fs.readFileSync(path.join(directory, "page.md"), "utf8"),
        width: raw.width,
        height: raw.height,
        assets: fs.existsSync(images)
          ? fs.readdirSync(images).map((name) => ({
              name: `imgs/${name}`,
              bytes: fs.readFileSync(path.join(images, name)),
            }))
          : [],
      };
    },
  };
  test.use({ recognizer });
  test.beforeEach(() =>
    Object.assign(recognizer, {
      revision: "resources-recorded-paddle-v1",
      calls: 0,
      mode: "ready",
      sample: "I-2",
      release: null,
    }),
  );
  async function showRecognition(page) {
    const button = page.getByRole("button", { name: "识别文字", exact: true });
    if ((await button.getAttribute("aria-expanded")) !== "true")
      await button.click();
    await expect(page.locator(".res-recognition-status")).toBeVisible();
  }
  async function scanPdf(context) {
    const printPage = await context.newPage();
    try {
      await printPage.setContent(
        `<style>@page{size:A4;margin:0}body{margin:0}img{display:block;width:210mm;height:297mm;object-fit:contain;break-after:page}img:last-child{break-after:auto}</style>${["I-1", "I-2"].map((name) => `<img src="data:image/png;base64,${fs.readFileSync(path.join(fixtureRoot, name, "page.png")).toString("base64")}">`).join("")}`,
      );
      await printPage
        .locator("img")
        .evaluateAll((images) =>
          Promise.all(images.map((image) => image.decode())),
        );
      return {
        name: "扫描课堂讲义.pdf",
        mimeType: "application/pdf",
        buffer: await printPage.pdf({ preferCSSPageSize: true }),
      };
    } finally {
      await printPage.close();
    }
  }

  test("按需识别指定页，复制、搜索定位和刷新保持真实来源", async ({
    page,
    context,
  }, info) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await upload(page, await scanPdf(context));
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
    await page.getByLabel("搜索资料").fill("不等式");
    await expect(page.locator(".res-card-open")).toHaveCount(0);
    await expect(page.locator(".res-search-status")).toContainText(
      "2 页尚无可检索文字",
    );
    expect(recognizer.calls).toBe(0);
    await page.getByRole("button", { name: "清除搜索", exact: true }).click();
    await page.locator(".res-card-open").click();
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await showRecognition(page);
    expect(recognizer.calls).toBe(0);
    await page
      .getByRole("button", { name: "识别本页文字", exact: true })
      .click();
    const text = page.getByRole("region", { name: "第 2 页识别正文" });
    await expect(text).toContainText(/解不等式/);
    await expect(text.locator(".katex")).toHaveCount(5);
    await expect(text.locator("[data-formula-failed]")).toHaveCount(0);
    await expect(text).not.toContainText("\\begin{cases}");
    await expect(
      page.getByRole("textbox", { name: "第 2 页识别原文" }),
    ).toHaveCount(0);
    const resource = (await api.request("GET", "/api/modules/resources/items"))
      .json.items[0];
    const preview = (
      await api.request(
        "GET",
        `/api/workbench/files/${resource.fileId}/preview`,
      )
    ).json;
    const expectedText = (
      await api.request(
        "GET",
        `/api/workbench/files/${resource.fileId}/recognition/pages/2?renditionFileId=${preview.renditionFileId}`,
      )
    ).json.text;
    expect(recognizer.calls).toBe(1);
    await page
      .getByRole("button", { name: "复制本页识别文字", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(expectedText);
    expect(expectedText).toContain("\\\\");
    await page
      .getByRole("button", { name: "查看可复制原文", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "第 2 页识别原文" }),
    ).toHaveValue(expectedText);
    await page
      .getByRole("button", { name: "查看可复制原文", exact: true })
      .click();
    await page.reload();
    await expect(text).toContainText(/解不等式/);
    await screenshot(page, info, "ocr-light-desktop");
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
    await page.getByLabel("搜索资料").fill("不等式");
    await expect(page.locator(".res-search-excerpt")).toContainText("第 2 页");
    const search = (
      await api.request("GET", "/api/modules/resources/items?q=不等式")
    ).json;
    const match = search.search.matches[search.items[0].id];
    expect(match.recognition.location.fileId).toBe(search.items[0].fileId);
    expect(match.recognition.location.page).toBe(2);
    expect(search.search.ocr.unprocessedPages).toBe(1);
    await page.locator(".res-card-open").click();
    await expect(text).toContainText(/解不等式/);
    await expect(text.locator(".res-recognition-hit mark").first()).toHaveText("不等式");
    await screenshot(page, info, "ocr-search-highlight");
    await expect(page.locator(".res-issue-box")).toHaveCount(0);
    await expect(page.getByAltText("第 2 页", { exact: true })).toBeVisible();
    expect(recognizer.calls).toBe(1);
    await expect(
      page.getByRole("button", { name: "关闭识别文字", exact: true }),
    ).toHaveAttribute("title", "关闭识别文字（Esc）");
    await text.click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".res-recognition")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "识别文字", exact: true }),
    ).toBeFocused();
    await showRecognition(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await text.click();
    await screenshot(page, info, "ocr-light-phone");
    for (const element of [
      text,
      page.getByRole("button", { name: "复制本页识别文字", exact: true }),
    ]) {
      const box = await element.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("link", { name: /^账户：/ }).click();
    await page.getByRole("button", { name: "深色", exact: true }).click();
    await expect(page.locator(".wb-shell")).toHaveAttribute(
      "data-theme",
      "dark",
    );
    await page
      .getByRole("navigation", { name: "功能模块" })
      .getByRole("link", { name: /^资源库/ })
      .click();
    await showRecognition(page);
    await expect(text).toContainText(/解不等式/);
    await screenshot(page, info, "ocr-dark-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, info, "ocr-dark-phone");
    expect(errors).toEqual([]);
  });

  test("失败和停止后明确重试，响应丢失刷新后使用原键确认", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    recognizer.mode = "fail";
    await upload(page, path.join(fixtureRoot, "I-2/page.png"));
    await showRecognition(page);
    await page
      .getByRole("button", { name: "识别本页文字", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "重新识别本页", exact: true }),
    ).toBeVisible();
    expect(recognizer.calls).toBe(1);
    recognizer.mode = "hold";
    await page
      .getByRole("button", { name: "重新识别本页", exact: true })
      .click();
    await expect.poll(() => recognizer.calls).toBe(2);
    await page.getByRole("button", { name: "停止识别", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "重新识别本页", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "重新识别本页", exact: true }),
    ).toBeVisible();
    expect(recognizer.calls).toBe(2);
    recognizer.mode = "cleanup-failure";
    await page
      .getByRole("button", { name: "重新识别本页", exact: true })
      .click();
    await expect.poll(() => recognizer.calls).toBe(3);
    await page.getByRole("button", { name: "停止识别", exact: true }).click();
    await expect(page.locator(".res-recognition-status")).toContainText(
      "尚未确认识别进程停止",
    );
    await page.reload();
    await expect(page.locator(".res-recognition-status")).toContainText(
      "尚未确认识别进程停止",
    );
    expect(recognizer.calls).toBe(3);
    recognizer.mode = "ready";
    let lost = true,
      originalKey;
    await page.route("**/api/workbench/files/*/recognition", async (route) => {
      if (lost && route.request().method() === "POST") {
        lost = false;
        originalKey = route.request().headers()["idempotency-key"];
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await page
      .getByRole("button", { name: "重新识别本页", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "重试确认原请求" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "重试确认原请求" }),
    ).toBeVisible();
    const sameKey = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.headers()["idempotency-key"] === originalKey,
    );
    await page.getByRole("button", { name: "重试确认原请求" }).click();
    await sameKey;
    await expect(
      page.getByRole("button", { name: "重试确认原请求" }),
    ).toBeHidden();
    await expect(
      page.getByRole("region", { name: "第 1 页识别正文" }),
    ).toContainText(/解不等式/);
    expect(recognizer.calls).toBe(4);
  });

  test("引擎修订更新后重新识别本页，不困在旧任务重试", async ({ page }) => {
    test.skip(Boolean(process.env.RESOURCE_UI_DEV), "服务重启使用固定构建验证");
    recognizer.mode = "fail";
    await upload(page, path.join(fixtureRoot, "I-2/page.png"));
    await showRecognition(page);
    await page
      .getByRole("button", { name: "识别本页文字", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "重新识别本页", exact: true }),
    ).toBeVisible();
    const { directory, origin } = world;
    await world.close();
    recognizer.revision = "resources-recorded-paddle-v2";
    recognizer.mode = "ready";
    world = await createIntegration({
      directory,
      port: Number(new URL(origin).port),
      workbench: { recognition: { recognizer } },
    });
    // Keep the page open across the actual server restart, as a user would.
    expect(recognizer.calls).toBe(1);
    await page
      .getByRole("button", { name: "重新识别本页", exact: true })
      .click();
    await expect(page.locator(".res-recognition")).toContainText(/解不等式/);
    expect(recognizer.calls).toBe(2);
  });

  test("另一客户端更新文件后，轮询命中打开最新文件和识别正文", async ({
    page,
  }, info) => {
    await upload(page, {
      name: "另一客户端新文件.png",
      mimeType: "image/png",
      buffer: fs.readFileSync(path.join(fixtureRoot, "I-2/page.png")),
    });
    await showRecognition(page);
    await page
      .getByRole("button", { name: "识别本页文字", exact: true })
      .click();
    await expect(page.locator(".res-recognition")).toContainText("解不等式");
    const newer = (await api.request("GET", "/api/modules/resources/items"))
      .json.items[0];
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
    // The other HTTP client keeps an owned file ready before replacing the
    // resource. Its temporary resource entry is removed, not the managed file.
    const archived = await api.request(
      "POST",
      `/api/modules/resources/items/${newer.id}/deletion`,
      {
        headers: { "Idempotency-Key": randomUUID() },
        body: { baseVersion: newer.version, deleted: true },
      },
    );
    expect(archived.status).toBe(200);
    expect(
      (
        await api.request(
          "POST",
          `/api/modules/resources/items/${newer.id}/purge`,
          {
            headers: { "Idempotency-Key": randomUUID() },
            body: { baseVersion: archived.json.version },
          },
        )
      ).status,
    ).toBe(200);
    await upload(
      page,
      {
        name: "待更新的资料.png",
        mimeType: "image/png",
        buffer: fs.readFileSync(path.join(fixtureRoot, "I-1/page.png")),
      },
      false,
    );
    const original = (await api.request("GET", "/api/modules/resources/items"))
      .json.items[0];
    recognizer.sample = "I-1";
    recognizer.mode = "hold";
    await showRecognition(page);
    await page
      .getByRole("button", { name: "识别本页文字", exact: true })
      .click();
    await expect.poll(() => recognizer.calls).toBe(2);
    try {
      await page
        .getByRole("button", { name: "返回资源库", exact: true })
        .click();
      await page.getByLabel("搜索资料").fill("不等式");
      await expect(page.locator(".res-search-status")).toContainText(
        "正在识别 1 页",
      );
      await expect(page.locator(".res-card-open")).toHaveCount(0);
      const replaced = await api.request(
        "PUT",
        `/api/modules/resources/items/${original.id}/file`,
        {
          headers: { "Idempotency-Key": randomUUID() },
          body: { baseVersion: original.version, fileId: newer.fileId },
        },
      );
      expect(replaced.status).toBe(200);
      await expect(page.locator(".res-search-excerpt")).toContainText("不等式");
      await page.locator(".res-card-open").click();
      await expect(page.locator(".res-detail-title .res-muted")).toHaveText(
        "另一客户端新文件.png",
      );
      await expect(page.locator(".res-recognition")).toContainText("解不等式");
      await expect(
        page.getByRole("button", { name: "下载原件", exact: true }),
      ).toBeEnabled();
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "下载原件", exact: true }).click();
      expect(
        fs
          .readFileSync(await (await downloadEvent).path())
          .equals(fs.readFileSync(path.join(fixtureRoot, "I-2/page.png"))),
      ).toBe(true);
      await screenshot(page, info, "ocr-updated-source");
    } finally {
      recognizer.release?.();
    }
  });

  test("搜索补充已完成识别，断网可继续且不会重复发起识别", async ({
    page,
    context,
  }) => {
    await upload(page, await scanPdf(context));
    recognizer.sample = "I-1";
    await showRecognition(page);
    await page
      .getByRole("button", { name: "识别本页文字", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "第 1 页识别正文" }),
    ).toContainText(/函数/);
    await expect
      .poll(() =>
        page
          .locator(".res-recognition-document img")
          .evaluate((image) => image.naturalWidth),
      )
      .toBeGreaterThan(100);
    recognizer.sample = "I-2";
    recognizer.mode = "hold";
    await page
      .getByRole("button", { name: "识别剩余 1 页", exact: true })
      .click();
    await expect.poll(() => recognizer.calls).toBe(2);
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
    await page.getByLabel("搜索资料").fill("不等式");
    await expect(page.locator(".res-search-status")).toContainText(
      "正在识别 1 页",
    );
    await expect(
      page.getByRole("heading", { name: "正在读取资料" }),
    ).toBeVisible();
    await page.route("**/api/modules/resources/items?*", (route) =>
      route.abort("failed"),
    );
    await expect(
      page.getByRole("button", { name: "继续检索", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".res-search-status")).not.toContainText(
      "正在识别",
    );
    await page.unroute("**/api/modules/resources/items?*");
    recognizer.release();
    await page.getByRole("button", { name: "继续检索", exact: true }).click();
    await expect(page.locator(".res-search-excerpt")).toContainText("第 2 页");
    expect(recognizer.calls).toBe(2);
    const { client: other } = await registerMath(
      world,
      "ocr-other@example.test",
    );
    const otherSearch = await other.request(
      "GET",
      "/api/modules/resources/items?q=不等式",
    );
    expect(otherSearch.json.items).toEqual([]);
    expect(otherSearch.json.search.matches).toEqual({});
    await page.locator(".res-card-open").click();
    await expect(
      page.getByRole("region", { name: "第 2 页识别正文" }),
    ).toContainText(/不等式/);
    await page
      .getByRole("button", { name: "资料更多操作", exact: true })
      .click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("menuitem", { name: "更新文件", exact: true }).click();
    await (await chooser).setFiles(image);
    await page.getByRole("button", { name: "确认 更新", exact: true }).click();
    await expect(page.locator(".res-status")).toContainText("文件已更新");
    await expect(page.getByRole("region", { name: /识别正文/ })).toHaveCount(0);
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
    await expect(page.locator(".res-card-open")).toHaveCount(0);
    expect(recognizer.calls).toBe(2);
  });
});

test.describe("真实 OCR 运行链", () => {
  test.use({ recognitionHome: process.env.RESOURCE_OCR_REAL_HOME || null });
  test.skip(
    !process.env.RESOURCE_OCR_REAL_HOME,
    "实际模型运行需明确指定隔离工具目录和运行窗口",
  );
  test("从上传发起实际识别，阅读公式和题图、精确复制、搜索定位并刷新", async ({
    page,
    context,
  }, info) => {
    test.setTimeout(420000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = [],
      writes = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith("/recognition")
      )
        writes.push(request.url());
    });
    await upload(
      page,
      path.resolve("apps/web/e2e/fixtures/resources-recognition/I-1/page.png"),
    );
    await page.getByRole("button", { name: "识别文字", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "识别本页文字", exact: true }),
    ).toBeEnabled();
    expect(writes).toHaveLength(0);
    await page
      .getByRole("button", { name: "识别本页文字", exact: true })
      .click();
    const document = page.getByRole("region", { name: "第 1 页识别正文" });
    await expect(document).toContainText("定义域", { timeout: 360000 });
    await expect(document).toContainText("抛物线");
    await expect(document.locator("[data-formula-failed]")).toHaveCount(0);
    expect(await document.locator(".katex").count()).toBeGreaterThan(0);
    const formulae = await document
      .locator("[data-formula-source]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.dataset.formulaSource.replace(/\s/g, "")),
      );
    expect(formulae.some((source) => /x\^(?:2|\{2\})-2x-3/.test(source))).toBe(
      true,
    );
    await expect(document.locator("img")).toHaveCount(1);
    await expect
      .poll(() =>
        document.locator("img").evaluate((image) => image.naturalWidth),
      )
      .toBeGreaterThan(100);
    await screenshot(page, info, "real-ocr-document");
    await page.locator(".res-recognition-body").hover();
    await page.mouse.wheel(0, 600);
    await expect(document.locator("img")).toBeInViewport({ ratio: 0.8 });
    await screenshot(page, info, "real-ocr-figure");
    const resource = (await api.request("GET", "/api/modules/resources/items"))
      .json.items[0];
    const preview = (
      await api.request(
        "GET",
        `/api/workbench/files/${resource.fileId}/preview`,
      )
    ).json;
    const endpoint = `/api/workbench/files/${resource.fileId}/recognition/pages/1?renditionFileId=${preview.renditionFileId}`;
    const result = (await api.request("GET", endpoint)).json;
    expect(result.state).toBe("ready");
    expect(result.location).toMatchObject({
      fileId: resource.fileId,
      renditionFileId: preview.renditionFileId,
      page: 1,
    });
    for (const id of [result.rawFileId, ...result.assetFileIds]) {
      const response = await page.request.get(
        `${world.origin}/api/workbench/files/${id}/content`,
        {
          headers: {
            "X-TeachBuddy-Page": api.pageId,
            Cookie: api.jar.header(),
          },
        },
      );
      expect(response.ok()).toBe(true);
      await info.attach(`recognition-file-${id}`, {
        body: await response.body(),
        contentType: response.headers()["content-type"],
      });
    }
    await page
      .getByRole("button", { name: "复制本页识别文字", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(result.text);
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
    await page.getByLabel("搜索资料").fill("定义域");
    await expect(page.locator(".res-search-excerpt")).toContainText("第 1 页");
    const search = (
      await api.request("GET", "/api/modules/resources/items?q=定义域")
    ).json;
    expect(search.search.matches[resource.id].recognition).toEqual({
      resultId: result.resultId,
      location: result.location,
    });
    await page.locator(".res-card-open").click();
    await expect(document).toContainText("定义域");
    await page.reload();
    await expect(document).toContainText("定义域");
    await expect
      .poll(() =>
        document.locator("img").evaluate((image) => image.naturalWidth),
      )
      .toBeGreaterThan(100);
    expect((await api.request("GET", endpoint)).json.resultId).toBe(
      result.resultId,
    );
    expect(writes).toHaveLength(1);
    expect(errors).toEqual([]);
    await screenshot(page, info, "real-ocr-refreshed");
    await info.attach("recognition-result", {
      body: Buffer.from(JSON.stringify(result, null, 2)),
      contentType: "application/json",
    });
  });
});

test("多级同名文件夹在资料归属、批量移动与父目录中显示完整路径", async ({ page }, info) => {
  const a = randomUUID(), b = randomUUID(), aa = randomUUID(), bb = randomUUID(), aaa = randomUUID();
  const folders = [
    { id: a, name: "数学", parentId: null },
    { id: b, name: "英语", parentId: null },
    { id: aa, name: "复习", parentId: a },
    { id: bb, name: "复习", parentId: b },
    { id: aaa, name: "复习", parentId: aa },
  ];
  expect((await api.request("PUT", "/api/modules/resources/taxonomy", {
    headers: { "Idempotency-Key": randomUUID() }, body: { baseVersion: 1, folders, tags: [] },
  })).status).toBe(200);
  await upload(page);
  await infoPanel(page);
  await expect(page.getByLabel("资源文件夹").locator(`option[value="${aaa}"]`)).toHaveText("数学 / 复习 / 复习");
  await page.getByLabel("资源文件夹").selectOption(aaa);
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("资料信息已保存");
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await expect(page.locator(".res-card-text")).toContainText("数学 / 复习 / 复习");
  await page.getByRole("button", { name: "选择资料", exact: true }).click();
  await page.locator(".res-pick input").check();
  await page.getByRole("button", { name: "移动", exact: true }).click();
  await expect(page.getByLabel("目标文件夹").locator(`option[value="${bb}"]`)).toHaveText("英语 / 复习");
  await screenshot(page, info, "folder-paths-move");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "文件夹与标签", exact: true }).click();
  await page.getByRole("button", { name: "管理文件夹 数学", exact: true }).click();
  await expect(page.getByLabel("上级文件夹").locator(`option[value="${bb}"]`)).toHaveText("英语 / 复习");
  await expect(page.getByLabel("上级文件夹").locator(`option[value="${a}"], option[value="${aa}"], option[value="${aaa}"]`)).toHaveCount(0);
});

test("全文命中带词定位时中文换行和连续空白与检索一致", async ({ page, context }, info) => {
  const source = await context.newPage();
  let bytes;
  try {
    await source.setContent('<style>@page {size:A4} body{font:24px "Noto Sans CJK SC",sans-serif}</style><p>中文<br>换行</p><p>Alpha　 Beta</p>');
    await source.evaluate(() => document.fonts.ready);
    bytes = await source.pdf();
  } finally { await source.close(); }
  await upload(page, { name: "搜索空白样本.pdf", mimeType: "application/pdf", buffer: bytes });
  for (const query of ["中文换行", "alpha beta"]) {
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
    await page.getByLabel("搜索资料").fill(query);
    await expect(page.locator(".res-search-excerpt")).toBeVisible();
    await page.locator(".res-card-open").click();
    await expect(page.getByLabel("查找本页文字", { exact: true })).toHaveValue(query);
    await expect(page.locator(".res-find-status")).toHaveText("1 / 1 处");
    const highlights = await findHighlights(page);
    expect(highlights.some(entry => entry.name.endsWith("-current") && entry.texts.length === 1)).toBe(true);
    await screenshot(page, info, query === "中文换行" ? "search-chinese-line-break" : "search-english-space");
  }
});

test("多选原件 ZIP 下载保留真实字节和同名文件，取消不触发下载", async ({ page }, info) => {
  await page.getByLabel("上传第一份资料", { exact: true }).setInputFiles([
    { name: "课堂资料.pdf", mimeType: "application/pdf", buffer: fs.readFileSync(pdf) },
    { name: "课堂资料.pdf", mimeType: "image/png", buffer: fs.readFileSync(image) },
  ]);
  await expect(page.locator(".res-status")).toContainText("已处理 2 / 2 份资料");
  await expect(page.locator(".res-card")).toHaveCount(2);
  await page.getByRole("button", { name: "选择资料", exact: true }).click();
  await page.getByRole("button", { name: "选择当前结果", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载所选原件 ZIP", exact: true }).click();
  const archive = await download;
  expect(archive.suggestedFilename()).toBe("resources.zip");
  const zip = await JSZip.loadAsync(fs.readFileSync(await archive.path()));
  const entries = Object.values(zip.files).filter(file => !file.dir);
  expect(entries).toHaveLength(2);
  expect(entries.map(file => file.name).sort()).toEqual(["课堂资料 (2).pdf", "课堂资料.pdf"].sort());
  const content = await Promise.all(entries.map(file => file.async("nodebuffer")));
  expect(content.some(value => value.equals(fs.readFileSync(pdf)))).toBe(true);
  expect(content.some(value => value.equals(fs.readFileSync(image)))).toBe(true);
  await screenshot(page, info, "selection-zip");
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/api/modules/resources/items/download", async route => { await gate; await route.continue().catch(() => {}); });
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.getByRole("button", { name: "下载所选原件 ZIP", exact: true }).click();
  await page.getByRole("button", { name: "取消下载", exact: true }).click();
  await expect(page.getByRole("button", { name: "取消下载", exact: true })).toHaveCount(0);
  release();
  await page.unrouteAll({ behavior: "wait" });
  expect(downloads).toBe(0);
  await expect(page.locator(".res-download-error")).toHaveCount(0);
});

test("历史只读预览在英文深色桌面与窄屏保持可用", async ({ page }, info) => {
  await upload(page, pdf);
  await page.getByRole("button", { name: "资料更多操作", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "更新文件", exact: true }).click();
  await (await chooser).setFiles(image);
  await page.getByRole("button", { name: "确认 更新", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("文件已更新");
  await page.getByRole("link", { name: /^账户：/ }).click();
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await page.getByRole("button", { name: "语言", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "English", exact: true }).click();
  await page.getByRole("navigation", { name: "Modules" }).getByRole("link", { name: /^Resource library/ }).click();
  await expect(page.locator(".wb-shell")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "More material actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "File history", exact: true }).click();
  const historical = page.locator(".res-history-entry").filter({ hasText: "c22.pdf" });
  await historical.getByRole("button", { name: "Preview this version", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "File history", exact: true });
  await expect(dialog.getByText("Read-only preview. The current file and resource information stay unchanged.")).toBeVisible();
  await expect(dialog.locator(".res-page-paper img")).toBeVisible();
  await screenshot(page, info, "history-english-dark-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, info, "history-english-dark-phone");
  await dialog.getByRole("button", { name: "Back to version list", exact: true }).click();
  await expect(historical.getByRole("button", { name: "Preview this version", exact: true })).toBeFocused();
});

test("改变搜索和筛选不会重读已加载文件与分类", async ({ page }, info) => {
  await page.getByLabel("上传第一份资料", { exact: true }).setInputFiles([image, pdf]);
  await expect(page.locator(".res-status")).toContainText("已处理 2 / 2 份资料");
  await expect(page.locator(".res-browser")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".res-thumb img")).toHaveCount(2);
  await screenshot(page, info, "batch-thumbnails-completed");
  const reads = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (request.method() === "GET" && (
      /\/api\/workbench\/files\/[0-9a-f-]+(?:\/preview)?$/.test(url.pathname) ||
      url.pathname === "/api/modules/resources/taxonomy" ||
      (url.pathname === "/api/modules/resources/items" && (!url.search || url.search === "?state=deleted"))
    )) reads.push(url.pathname + url.search);
  });
  await page.getByLabel("搜索资料").fill("c22");
  await expect(page.locator(".res-card")).toHaveCount(1);
  await expect(page.locator(".res-browser")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await page.getByLabel("格式筛选").selectOption("application/pdf");
  await expect(page.locator(".res-card")).toHaveCount(1);
  await expect(page.locator(".res-browser")).toHaveAttribute("aria-busy", "false");
  await info.attach("unchanged-source-requests", { body: JSON.stringify(reads), contentType: "application/json" });
  expect(reads).toEqual([]);
});

test("搜索发现新资料、外部替换和补充来源后读取当前文件", async ({ page, context }) => {
  await upload(page, pdf);
  const original = (await api.request("GET", "/api/modules/resources/items")).json.items[0];
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  const sample = await findSample(context);
  const form = new FormData();
  form.append("file", new Blob([sample.buffer], { type: "application/pdf" }), "新来源.pdf");
  const uploadRequest = new Request("https://fixture.test", { method: "POST", body: form });
  const uploaded = await api.request("POST", "/api/workbench/files", {
    headers: { "Idempotency-Key": randomUUID() },
    rawBody: Buffer.from(await uploadRequest.arrayBuffer()),
    contentType: uploadRequest.headers.get("content-type"),
  });
  expect(uploaded.status).toBe(201);
  const newFile = uploaded.json;
  expect((await api.request("POST", `/api/workbench/files/${newFile.id}/preview`, {
    headers: { "Idempotency-Key": randomUUID() }, body: {},
  })).status).toBe(202);
  await expect.poll(async () => (await api.request("GET", `/api/workbench/files/${newFile.id}/preview`)).json.pages.length).toBe(2);
  expect((await api.request("POST", "/api/modules/resources/items", {
    headers: { "Idempotency-Key": randomUUID() },
    body: { title: "外部新增", fileId: newFile.id, folderId: null, tagIds: [], note: "" },
  })).status).toBe(201);
  await page.getByLabel("搜索资料").fill("外部新增");
  await expect(page.locator(".res-card-text strong")).toHaveText("外部新增");
  await expect(page.locator(".res-browser")).toHaveAttribute("aria-busy", "false");
  await page.locator(".res-card-open").click();
  await expect(page.locator(".res-detail-title .res-muted")).toHaveText("新来源.pdf");
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  const replaced = await api.request("PUT", `/api/modules/resources/items/${original.id}/file`, {
    headers: { "Idempotency-Key": randomUUID() },
    body: { baseVersion: original.version, fileId: newFile.id },
  });
  expect(replaced.status).toBe(200);
  await page.getByLabel("搜索资料").fill("c22");
  await expect(page.locator(".res-card-text strong")).toHaveText("c22.pdf");
  await expect(page.locator(".res-browser")).toHaveAttribute("aria-busy", "false");
  await page.locator(".res-card-open").click();
  await expect(page.locator(".res-detail-title .res-muted")).toHaveText("新来源.pdf");
  await infoPanel(page);
  await expect(page.getByRole("button", { name: "保存修改", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  expect((await api.request("PUT", `/api/modules/resources/items/${original.id}/supplement-preview`, {
    headers: { "Idempotency-Key": randomUUID() },
    body: { baseVersion: replaced.json.version, fileId: newFile.id, supplementPreviewFileId: original.fileId },
  })).status).toBe(200);
  await page.getByLabel("搜索资料").fill("三角形");
  await expect(page.locator(".res-search-excerpt")).toContainText("第 3 页");
  await page.locator(".res-card-open").click();
  await expect(page.getByAltText("第 3 页", { exact: true })).toBeVisible();
  await expect(page.getByLabel("查找本页文字", { exact: true })).toHaveValue("三角形");
  await expect(page.locator(".res-detail-title .res-muted")).toHaveText("新来源.pdf");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载原件", exact: true }).click();
  expect(fs.readFileSync(await (await download).path()).equals(sample.buffer)).toBe(true);
});
