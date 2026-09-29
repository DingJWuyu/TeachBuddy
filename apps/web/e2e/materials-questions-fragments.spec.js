import os from 'node:os';
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startQuestionsFixture } from "./fixtures/materials-questions/server.mjs";
test("synthetic page fragments use real upload, review, independent answer navigation and reload", async ({
  page,
}, testInfo) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'questions-fragments-'));
  const runtime = await startQuestionsFixture({
    dataDir: dir,
    port: 48459,
    webDist: path.resolve("test-results/r33/web"),
    provider: {
      extract: async ({ file }) => ({
        content: JSON.stringify({
          fragments: [
            {
              role: file.name === "body.png" ? "question" : "answer",
              label: "7.",
              section: "集合",
              group: "练习",
              text:
                file.name === "body.png" ? "求集合的交集。" : "交集为空集。",
              content: [
                {
                  text:
                    file.name === "body.png"
                      ? "求集合的交集。"
                      : "交集为空集。",
                },
              ],
              continues: "",
              doubts: [],
            },
          ],
        }),
      }),
    },
  });
  let passed = false;
  try {
    await page.goto(runtime.origin + "/fixture/session");
    await page.locator(".q-finder").getByRole("button", { name: "从资料收录", exact: true }).click();
    await page.getByRole("button", { name: /上传图片/ }).click();
    const buffer = fs.readFileSync(
      "apps/web/e2e/fixtures/materials-questions/attempt4/old-page-2.png",
    );
    await page.getByLabel("选择原稿").setInputFiles([
      { name: "body.png", mimeType: "image/png", buffer },
      { name: "answer.png", mimeType: "image/png", buffer },
    ]);
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith("/questions/v2/imports") &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "开始整理", exact: true }).click();
    const id = (await (await created).json()).id;
    await expect(page.getByRole("article", { name: "待检查题干" })).toContainText("求集合的交集。");
    await expect(page.locator(".q-review-answer")).toContainText("交集为空集。");
    await expect(
      page.getByRole("button", {
        name: "定位答案 · 第 1 页",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "定位答案 · 第 1 页", exact: true })
      .click();
    const material = await (
      await page.request.get(
        runtime.origin + "/api/modules/questions/v2/imports/" + id,
      )
    ).json();
    await expect(page.getByLabel("原稿文件")).toHaveValue(
      material.input.fileIds[1],
    );
    await page.getByRole("button", { name: "定位题面 · 第 1 页", exact: true }).click();
    await expect(page.getByLabel("原稿文件")).toHaveValue(material.input.fileIds[0]);
    await page.getByRole("button", { name: "定位答案 · 第 1 页", exact: true }).click();
    await expect(page.getByLabel("原稿文件")).toHaveValue(material.input.fileIds[1]);
    await page.getByRole("button", { name: "修改题目", exact: true }).click();
    await page.getByLabel("草稿标题").fill("人工校对标题");
    await page.getByRole("button", { name: "保存检查进度", exact: true }).click();
    await expect(page.getByText("校对已保存", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("草稿标题")).toHaveValue("人工校对标题");
    await expect(page.getByLabel("原稿文件")).toHaveValue(
      material.input.fileIds[1],
    );
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [1024, 768],
    ]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: testInfo.outputPath(`fragments-${width}.png`) });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    fs.writeFileSync(
      testInfo.outputPath("browser-synthetic.json"),
      JSON.stringify(
        {
          identity: "test-principal",
          source:
            "synthetic fragments; fixed O image bytes used only as upload/preview carrier, no recognition score",
          material,
          dataDir: path.resolve(dir),
        },
        null,
        2,
      ),
    );
    passed = true;
  } finally {
    if (!page.isClosed()) await page.goto("about:blank").catch(() => {});
    runtime.server.closeAllConnections();
    await runtime.close();
    if (passed) fs.rmSync(dir, { recursive: true, force: true });
    else console.error("Retained fragments fixture:", dir);
  }
});
