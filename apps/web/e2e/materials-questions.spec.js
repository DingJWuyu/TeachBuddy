import { test, expect } from "@playwright/test";
test("teacher imports text, edits formula, confirms and reopens persistent question", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  await page
    .getByLabel("原始文字")
    .fill("1. 求 $x^2=4$ 的解。\n答案：$x=\\pm2$\n2. 计算 $2+3$。");
  await page.getByRole("button", { name: "保存原稿并整理" }).click();
  await expect(page.getByLabel("草稿标题")).toBeVisible();
  await page.getByLabel("草稿标题").fill("公式校对题");
  await page
    .locator(".q-review-result textarea")
    .first()
    .fill("求 $x^2=9$ 的解。");
  await page.locator(".q-review-result textarea").nth(1).fill("$x=\\pm3$");
  await page.locator(".q-issue select").selectOption("corrected");
  await page.getByRole("button", { name: "保存校对", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("校对已保存");
  await page.screenshot({
    path: "test-results/evidence/R33/v1/attempt2/text-review-desktop.png",
  });
  await page.getByRole("button", { name: "确认收录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看已入库题目" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看已入库题目" }).click();
  await expect(page.getByLabel("题目标题")).toHaveValue("公式校对题");
  await page.reload();
  await expect(page.getByLabel("题目标题")).toHaveValue("公式校对题");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({
    path: "test-results/evidence/R33/v1/attempt2/question-pad.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("unsaved collection form survives refresh", async ({ page }) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  await page.getByLabel("原始文字").fill("草稿尚未上传，刷新后仍保留");
  await page.reload();
  await expect(page.getByLabel("原始文字")).toHaveValue(
    "草稿尚未上传，刷新后仍保留",
  );
});

test("Word original and formulas are available for review", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  await page.getByRole("button", { name: "Word", exact: true }).click();
  await page
    .getByLabel("选择原稿")
    .setInputFiles("test/fixtures/questions/W.docx");
  await page.getByRole("button", { name: "保存原稿并整理" }).click();
  await expect(page.getByLabel("草稿标题")).toBeVisible({ timeout: 25000 });
  await expect(page.locator(".q-original")).toContainText("段落");
  await expect(page.locator(".q-original img")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/R33/v1/attempt2/word-review.png",
  });
});

test("asset job is restored after refresh", async ({ page }) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "自建", exact: true }).click();
  await page.getByLabel("题目标题").fill("PPT恢复验证");
  await page.getByRole("button", { name: "段落", exact: true }).first().click();
  await page
    .locator(".q-question textarea")
    .first()
    .fill("透明题面与公式 $a^2+b^2=c^2$");
  await page.getByRole("button", { name: "保存题目", exact: true }).click();
  await expect(page.getByLabel("题目标题")).toHaveValue("PPT恢复验证");
  await page.getByText("用于 PPT", { exact: true }).click();
  await page.getByRole("button", { name: "生成透明题面 PNG" }).click();
  await expect(
    page.getByRole("button", { name: "查看生成结果" }),
  ).toBeEnabled();
  await page.reload();
  await page.getByText("用于 PPT", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看生成结果" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "查看生成结果" }).click();
  await expect(page.getByRole("button", { name: "下载分片 1" })).toBeVisible();
});

test("image failure retains original and supports explicit local crop correction", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  await page.getByRole("button", { name: "图片", exact: true }).click();
  await page
    .getByLabel("选择原稿")
    .setInputFiles("test/fixtures/questions/figure.png");
  await page.getByRole("button", { name: "保存原稿并整理" }).click();
  await expect(
    page.getByText("整理失败，原稿已保存", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "补充题目草稿" }).click();
  await expect(page.getByLabel("草稿标题")).toBeVisible();
  await page.getByRole("button", { name: "段落", exact: true }).first().click();
  await page
    .locator(".q-review-result textarea")
    .first()
    .fill("根据原稿图进行局部校对。");
  const box = await page.locator(".q-page").boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, {
    steps: 5,
  });
  await page.mouse.up();
  await page.getByRole("button", { name: "裁图加入题面" }).click();
  await expect(page.locator(".q-review-result img")).toBeVisible();
  await page.getByRole("button", { name: "保存校对", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("校对已保存");
  await page.screenshot({
    path: "test-results/evidence/R33/v1/attempt2/image-recovery-crop.png",
  });
  await page.reload();
  await expect(page.locator(".q-review-result img")).toBeVisible();
});

test("concurrent edit keeps local work and offers explicit version comparison", async ({
  page,
  context,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "自建", exact: true }).click();
  await page.getByLabel("题目标题").fill("冲突原题");
  await page.getByRole("button", { name: "段落", exact: true }).first().click();
  await page.locator(".q-question textarea").first().fill("保留这道题的内容");
  await page.getByRole("button", { name: "保存题目", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("已保存");
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByLabel("题目标题")).toHaveValue("冲突原题");
  await page.getByLabel("题目标题").fill("本地修改");
  await other.getByLabel("题目标题").fill("另一窗口修改");
  await other.getByRole("button", { name: "保存题目", exact: true }).click();
  await expect(other.locator(".q-message")).toContainText("题目已保存");
  await page.getByRole("button", { name: "保存题目", exact: true }).click();
  await expect(page.getByLabel("版本冲突对照")).toContainText("另一窗口修改");
  await expect(page.getByLabel("题目标题")).toHaveValue("本地修改");
  await page.getByRole("button", { name: "保留本地修改并继续校对" }).click();
  await page.getByRole("button", { name: "保存题目", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("题目已保存");
  await page.reload();
  await expect(page.getByLabel("题目标题")).toHaveValue("本地修改");
});
