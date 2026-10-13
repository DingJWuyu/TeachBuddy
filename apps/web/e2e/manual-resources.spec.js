import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
import { registerMath } from "./fixtures/math-static/real.mjs";
import { Document, Packer, Paragraph, ExternalHyperlink, TextRun } from "docx";
let world;
async function openInfo(page) {
  await expect(page.locator(".res-detail")).toBeVisible();
  const toggle = page.getByRole("button", { name: "资料信息", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true")
    await toggle.click();
}
const evidence = path.resolve(
  "test-results/evidence/MANUAL-RESOURCES/v1/browser",
);
test.beforeEach(async ({ page }) => {
  world = await createIntegration({
    directory: fs.mkdtempSync(path.join(os.tmpdir(), "resources-")),
  });
  await registerMath(world, "resources@example.test");
  await page.goto(world.origin);
  await expect(
    page.locator(".wb-shell").or(page.getByLabel("邮箱", { exact: true })),
  ).toBeVisible();
  if (await page.getByLabel("邮箱", { exact: true }).isVisible()) {
    await page
      .getByLabel("邮箱", { exact: true })
      .fill("resources@example.test");
    await page.getByLabel("密码", { exact: true }).fill("math-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
  }
  await expect(page.locator(".wb-shell")).toBeVisible();
  await page
    .locator(".wb-sidebar")
    .getByRole("link", { name: "资源库", exact: true })
    .click();
});
test.afterEach(async ({ context }) => {
  await context.close();
  await world?.close();
});

test("带网页超链接的 Word 可预览、下载并重开", async ({ page }) => {
  const bytes = await Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            new Paragraph("课堂参考资料"),
            new Paragraph({
              children: [
                new ExternalHyperlink({
                  link: "https://example.com/lesson",
                  children: [new TextRun("参考阅读")],
                }),
              ],
            }),
          ],
        },
      ],
    }),
  );

  if (
    await page
      .getByRole("button", { name: "返回资源库", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page
    .getByLabel(/^上传(第一份)?资料$/)
    .setInputFiles({
      name: "课堂链接.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: bytes,
    });
  await openInfo(page);
  await expect(page.getByLabel("资源名称")).toHaveValue("课堂链接.docx");
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  expect(
    await page
      .getByAltText("第 1 页", { exact: true })
      .evaluate((img) => img.naturalWidth),
  ).toBeGreaterThan(500);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载原件", exact: true }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).equals(bytes)).toBeTruthy();
  await page.screenshot({ path: path.join(evidence, "hyperlink-preview.png") });
  await page.reload();
  await openInfo(page);
  await expect(page.getByLabel("资源名称")).toHaveValue("课堂链接.docx");
  await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible();
});

test("全部常用格式内容预览，分类搜索及更新后保库重开", async ({
  page,
}) => {
  const nav = (name) =>
    page
      .locator(".wb-sidebar")
      .getByRole("link", { name, exact: true })
      .click();
  await nav("资源库");
  const files = [
    "materials/samples/c22.pptx",
    "materials/samples/c22.ppt",
    "materials/samples/w.doc",
    "materials-resources/samples/w.docx",
    "materials/samples/c22.pdf",
    "materials-resources/samples/page.png",
    "materials-resources/samples/page.jpg",
    "materials-resources/samples/page.webp",
  ];
  for (const source of files) {
    await page
      .getByLabel(/^上传(第一份)?资料$/)
      .setInputFiles(path.resolve("apps/web/e2e/fixtures", source));
    await openInfo(page);
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
      (await page
        .getByRole("button", { name: "下一页", exact: true })
        .isVisible()) &&
      (await page
        .getByRole("button", { name: "下一页", exact: true })
        .isEnabled())
    ) {
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      await expect(page.locator(".res-page-paper img")).toBeVisible();
    }
    await page.screenshot({
      path: path.join(evidence, `preview-${path.extname(source).slice(1)}.png`),
    });
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  }
  await page.getByRole("button", { name: "文件夹与标签", exact: true }).click();
  await page.getByRole("button", { name: "新建文件夹", exact: true }).click();
  await page
    .getByRole("dialog", { name: "新建文件夹" })
    .getByLabel("名称", { exact: true })
    .fill("课堂资料");
  await page.getByRole("button", { name: "创建文件夹", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "新建文件夹" })).toHaveCount(0);
  await page.getByRole("button", { name: "新建标签", exact: true }).click();
  await page
    .getByRole("dialog", { name: "新建标签" })
    .getByLabel("名称", { exact: true })
    .fill("复习");
  await page.getByRole("button", { name: "创建标签", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "新建标签" })).toHaveCount(0);
  await page.getByLabel("搜索资料").fill("c22.pptx");
  await expect(page.locator(".res-card-open")).toHaveCount(1);
  await page.locator(".res-card-open").click();
  await openInfo(page);
  await page.getByLabel("资源名称").fill("函数课堂课件");
  await page.getByLabel("资源笔记").fill("先观察图像，再归纳单调性");
  await page.getByLabel("资源文件夹").selectOption({ label: "课堂资料" });
  await page
    .locator(".res-metadata")
    .getByLabel("复习", { exact: true })
    .check();
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator(".res-status")).toContainText("已保存");
  await page
    .getByLabel("更新文件", { exact: true })
    .setInputFiles("apps/web/e2e/fixtures/materials/samples/c22.pdf");
  await page.getByRole("button", { name: "确认更新", exact: true }).click();
  await expect(page.locator(".res-info-file strong")).toHaveText("c22.pdf");
  await openInfo(page);
  await expect(page.getByLabel("资源名称")).toHaveValue("函数课堂课件");
  await expect(page.getByLabel("资源笔记")).toHaveValue(
    "先观察图像，再归纳单调性",
  );
  await expect(page.getByLabel("资源文件夹")).toHaveValue(/.+/);
  await expect(
    page.locator(".res-metadata").getByLabel("复习", { exact: true }),
  ).toBeChecked();
  await page.reload();
  await openInfo(page);
  await expect(page.getByLabel("资源名称")).toHaveValue("函数课堂课件");
  await expect(page.locator(".res-page-paper img")).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: path.join(evidence, "metadata-reopened.png") });
  const directory = world.directory;
  await world.close();
  world = await createIntegration({ directory });
  await page.goto(world.origin);
  await expect(
    page.locator(".wb-shell").or(page.getByLabel("邮箱", { exact: true })),
  ).toBeVisible();
  if (await page.getByLabel("邮箱", { exact: true }).isVisible()) {
    await page
      .getByLabel("邮箱", { exact: true })
      .fill("resources@example.test");
    await page.getByLabel("密码", { exact: true }).fill("math-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
  }
  await expect(page.locator(".wb-shell")).toBeVisible();
  await nav("资源库");
  if (
    await page
      .getByRole("button", { name: "返回资源库", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "返回资源库", exact: true }).click();
  await page.getByLabel("搜索资料").fill("归纳单调性");
  await expect(page.locator(".res-card-open")).toHaveCount(1);
  await page.locator(".res-card-open").click();
  await openInfo(page);
  await expect(page.getByLabel("资源名称")).toHaveValue("函数课堂课件");
  await expect(page.locator(".res-page-paper img")).toBeVisible();
});

test("转换恢复后重试自动显示页图，不需要刷新", async ({ page }) => {
  const original = process.env.MATERIALS_OFFICE_ROOT;
  expect(original, "运行此场景需提供本机 Office 目录").toBeTruthy();
  const office = path.join(world.directory, "office-after-recovery");
  process.env.MATERIALS_OFFICE_ROOT = office;
  try {
    await page
      .getByLabel(/^上传(第一份)?资料$/)
      .setInputFiles(
        "apps/web/e2e/fixtures/materials-resources/samples/w.docx",
      );
    await expect(
      page.getByRole("button", { name: "重试预览", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    fs.symlinkSync(original, office);
    await page.getByRole("button", { name: "重试预览", exact: true }).click();
    await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await page.screenshot({ path: path.join(evidence, "retry-recovered.png") });
  } finally {
    process.env.MATERIALS_OFFICE_ROOT = original;
  }
});
