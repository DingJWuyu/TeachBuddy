import { chromium } from "@playwright/test";
import fs from "node:fs";
const out = "test-results/evidence/R33/v1/attempt2";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const kind of ["T", "W"]) {
  await page.goto("http://localhost:48349/fixture/session");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  if (kind === "T")
    await page
      .getByLabel("原始文字")
      .fill(
        fs.readFileSync(
          "apps/web/e2e/fixtures/materials-questions/T.txt",
          "utf8",
        ),
      );
  else {
    await page.getByRole("button", { name: "Word", exact: true }).click();
    await page
      .getByLabel("选择原稿")
      .setInputFiles("apps/web/e2e/fixtures/materials-questions/W.docx");
  }
  await page.getByRole("button", { name: "保存原稿并整理" }).click();
  await page.getByLabel("草稿标题").waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${out}/red-${kind}.png` });
  fs.writeFileSync(
    `${out}/red-${kind}-dom.txt`,
    await page.locator("body").innerText(),
  );
  console.log(
    kind,
    await page.locator(".q-review-result textarea").allTextContents(),
  );
  await page.evaluate(() => localStorage.clear());
}
await browser.close();
