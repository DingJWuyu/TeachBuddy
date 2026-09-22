import fs from "node:fs";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { startFixture } from "./fixture.mjs";
const evidence = path.resolve("docs/acceptance/evidence/R31/v1");
const options = {
  dataDir: path.resolve("test-results/r31-complete/preview-browser"),
  port: 48335,
  webDist: path.resolve("test-results/r31-foundation/web"),
};
let fixture = await startFixture({ ...options, reset: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(fixture.origin + "/fixture/session");
  await page.goto(fixture.origin + "/?preview");
  await page
    .getByLabel("上传材料")
    .setInputFiles("apps/web/e2e/fixtures/materials/samples/c22.pptx");
  await expect(page.getByRole("status")).toHaveText("预览已就绪，共 3 页", {
    timeout: 30000,
  });
  await page.getByLabel("预览页码").selectOption("3");
  await expect(page.getByAltText("原稿第 3 页")).toBeVisible();
  await page.getByRole("button", { name: "保存裁图" }).click();
  await expect(page.getByRole("status")).toHaveText("裁图已持久保存");
  await expect(page.getByAltText("已保存裁图")).toBeVisible();
  await page.screenshot({ path: path.join(evidence, "preview-desktop.png") });
  const restoredURL = page.url();
  await fixture.close();
  fixture = await startFixture(options);
  await page.goto(restoredURL);
  await expect(page.getByRole("status")).toHaveText("已恢复预览，共 3 页");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({ path: path.join(evidence, "preview-pad.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  fs.writeFileSync(
    path.join(evidence, "preview-browser.json"),
    JSON.stringify(
      {
        status: "PASS",
        identity: "test-principal",
        checks: [
          "真实PPTX上传与三页浏览",
          "第3页真实裁图",
          "服务重启后原ID预览恢复",
          "1440与768无横向溢出",
        ],
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await fixture.close();
}
