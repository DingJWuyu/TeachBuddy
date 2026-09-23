import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { startQuestionsFixture } from "./fixtures/materials-questions/server.mjs";
const out = "test-results/evidence/R33/v1/attempt4";
fs.mkdirSync(out, { recursive: true });
test("synthetic page fragments use real upload, review, independent answer navigation and reload", async ({
  page,
}) => {
  const dir = fs.mkdtempSync("test-results/r33-attempt4/browser-");
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
  try {
    await page.goto(runtime.origin + "/fixture/session");
    await page.getByRole("button", { name: "收录", exact: true }).click();
    await page.getByRole("button", { name: "图片", exact: true }).click();
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
    await page.getByRole("button", { name: "保存原稿并整理" }).click();
    const id = (await (await created).json()).id;
    await expect(page.getByLabel("草稿标题")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "答案 · 原稿 2 · 第 1 页",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "答案 · 原稿 2 · 第 1 页", exact: true })
      .click();
    const material = await (
      await page.request.get(
        runtime.origin + "/api/modules/questions/v2/imports/" + id,
      )
    ).json();
    await expect(page.getByLabel("原稿文件")).toHaveValue(
      material.input.fileIds[1],
    );
    await page.getByLabel("草稿标题").fill("人工校对标题");
    await page.getByRole("button", { name: "保存校对", exact: true }).click();
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
      await page.screenshot({ path: `${out}/fragments-${width}.png` });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    fs.writeFileSync(
      `${out}/browser-synthetic.json`,
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
  } finally {
    await page.goto("about:blank");
    runtime.server.closeAllConnections();
    await runtime.close();
  }
});
