import { test, expect } from "@playwright/test";
import fs from "node:fs";
test("native text mathematical source is editable without retyping", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  await page
    .getByLabel("原始文字")
    .fill(
      fs.readFileSync(
        "test/fixtures/questions/T.txt",
        "utf8",
      ),
    );
  await page.getByRole("button", { name: "保存原稿并整理" }).click();
  await expect(page.getByLabel("草稿标题")).toBeVisible();
  await expect(page.locator(".q-review-result textarea").first()).toContainText(
    "\\sqrt",
  );
  await expect(page.locator(".q-review-result textarea").first()).toContainText(
    "\\frac",
  );
  await page.getByRole("button", { name: "3 待校对", exact: true }).click();
  await expect(page.locator(".q-review-result textarea").first()).toContainText(
    "\\begin{cases}",
  );
});
async function textImport(page, text) {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  await page.getByLabel("原始文字").fill(text);
  await page.getByRole("button", { name: "保存原稿并整理" }).click();
  await expect(page.getByLabel("草稿标题")).toBeVisible();
}
async function fileImport(page, kind, name) {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "收录", exact: true }).click();
  await page.getByRole("button", { name: kind, exact: true }).click();
  await page
    .getByLabel("选择原稿")
    .setInputFiles("test/fixtures/questions/" + name);
  await page.getByRole("button", { name: "保存原稿并整理" }).click();
  await expect(
    page.getByText("整理失败，原稿已保存", { exact: false }).first(),
  ).toBeVisible({ timeout: 25000 });
}
test("split merge ignore partial commit and refresh retain the review", async ({
  page,
}) => {
  await textImport(
    page,
    "1. 求 x+7=12 的解。\n继续核对条件。\n答案：x=5\n2. 如图求长。",
  );
  await page.getByRole("button", { name: "拆分", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "3 待校对", exact: true }),
  ).toBeVisible();
  await page.getByLabel("合并目标").selectOption({ label: "1.（续）" });
  await page.getByRole("button", { name: "合并", exact: true }).click();
  await expect(page.locator(".q-review-result nav button")).toHaveCount(2);
  for (const s of await page.locator(".q-issue select").all())
    await s.selectOption("corrected");
  await page.getByRole("button", { name: "确认收录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看已入库题目" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "2 待校对", exact: true }).click();
  await page.getByRole("button", { name: "确认收录", exact: true }).click();
  await expect(page.locator(".q-message")).not.toContainText("已收录 1 题");
  await page.getByRole("button", { name: "忽略", exact: true }).click();
  await page.getByRole("button", { name: "保存校对", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("校对已保存");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "1 已入库", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "2 已忽略", exact: true }),
  ).toBeVisible();
});
test("supplement preserves unsaved correction and both original files", async ({
  page,
}) => {
  await fileImport(page, "图片", "F-obscured.jpg");
  await page.getByRole("button", { name: "补充题目草稿" }).click();
  await page.getByLabel("草稿标题").fill("遮挡处暂不补数");
  await page.getByRole("button", { name: "段落", exact: true }).first().click();
  await page
    .locator(".q-review-result textarea")
    .first()
    .fill("已辨认内容保留，遮挡条件待核对。");
  await page
    .locator('input[type=file][accept="image/*"]')
    .setInputFiles("test/fixtures/questions/I-clear.jpg");
  await expect(page.getByLabel("原稿文件").locator("option")).toHaveCount(2);
  await expect(page.getByLabel("草稿标题")).toHaveValue("遮挡处暂不补数");
  await page.reload();
  await expect(page.getByLabel("草稿标题")).toHaveValue("遮挡处暂不补数");
  await page.getByLabel("原稿文件").selectOption({ label: "原稿 2" });
  await expect(page.locator(".q-original img")).toBeVisible();
});
for (const file of ["F-truncated.pdf", "PS.pdf"])
  test(`${file} failure remains downloadable and retryable`, async ({
    page,
  }) => {
    await fileImport(page, "PDF", file);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载原稿" }).click();
    const d = await download;
    expect(fs.readFileSync(await d.path())).toEqual(
      fs.readFileSync("test/fixtures/questions/" + file),
    );
    if (file === "PS.pdf") {
      await expect(page.getByLabel("原稿页码").locator("option")).toHaveCount(
        4,
      );
      await page.getByLabel("原稿页码").selectOption("2");
      await expect(page.getByAltText("原稿第 2 页")).toBeVisible();
    }
    await page.getByRole("button", { name: "重试未完成部分" }).click();
    await expect(
      page.getByText("整理失败，原稿已保存", { exact: false }).first(),
    ).toBeVisible({ timeout: 25000 });
    await page.reload();
    await expect(page.getByRole("button", { name: "下载原稿" })).toBeVisible();
  });

test("cancel ignores a late provider result and explicit retry retains teacher correction", async ({
  page,
}) => {
  const { startQuestionsFixture } = await import(
    "../../api/test/fixtures/questions/server.mjs"
  );
  let release,
    calls = 0;
  const runtime = await startQuestionsFixture({
    dataDir: fs.mkdtempSync("/tmp/r33-attempt2-cancel-"),
    port: 48350,
    webDist: process.cwd() + "/test-results/r33/web",
    provider: {
      async extract() {
        calls++;
        if (calls === 1) await new Promise((r) => (release = r));
        return {
          content: JSON.stringify({
            questions: [{ stem: "受控替身的迟到内容", answer: null }],
          }),
        };
      },
    },
  });
  try {
    await page.goto("http://localhost:48350/fixture/session");
    await page.getByRole("button", { name: "收录", exact: true }).click();
    await page.getByRole("button", { name: "图片", exact: true }).click();
    await page
      .getByLabel("选择原稿")
      .setInputFiles("test/fixtures/questions/figure.png");
    await page.getByRole("button", { name: "保存原稿并整理" }).click();
    await expect.poll(() => calls).toBe(1);
    await page.getByRole("button", { name: "停止整理", exact: true }).click();
    await expect(page.getByText("正在停止", { exact: false })).toBeVisible();
    release();
    await expect(page.getByText("已停止", { exact: false })).toBeVisible();
    expect(await page.locator(".q-review-result nav button").count()).toBe(0);
    await page.getByRole("button", { name: "补充题目草稿" }).click();
    await page.getByLabel("草稿标题").fill("停止后人工校对");
    await page
      .getByRole("button", { name: "段落", exact: true })
      .first()
      .click();
    await page
      .locator(".q-review-result textarea")
      .first()
      .fill("人工已辨认片段");
    await page.getByRole("button", { name: "保存校对", exact: true }).click();
    await expect(page.locator(".q-message")).toContainText("校对已保存");
    await page.reload();
    expect(calls).toBe(1);
    await expect(page.getByLabel("草稿标题")).toHaveValue("停止后人工校对");
    await page.getByRole("button", { name: "重试未完成部分" }).click();
    await expect.poll(() => calls).toBe(2);
    await expect(
      page.getByRole("button", { name: "2 待校对", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("草稿标题")).toHaveValue("停止后人工校对");
  } finally {
    release?.();
    await runtime.close();
  }
});

test("dispersed answer location can be selected independently of the question", async ({
  page,
}) => {
  await textImport(page, "1. 求 x+2=6 的解。\n参考答案\n1. 答案 x=4。");
  const positions = page.locator(".q-original .q-tools button");
  await expect(positions).toHaveCount(2);
  await positions.nth(1).click();
  await expect(page.locator(".q-original mark")).toContainText("答案 x=4");
});

test("classification search, direct edit, copy and deletion keep separate identities", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "分类管理", exact: true }).click();
  const term = "局部验收" + Date.now();
  await page.getByLabel("新分类名称").fill(term);
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await page.getByRole("button", { name: "保存分类", exact: true }).click();
  await expect(
    page.getByLabel("筛选题型").locator("option", { hasText: term }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "自建", exact: true }).click();
  await page.getByLabel("题目标题").fill(term);
  await page.getByRole("button", { name: "段落", exact: true }).first().click();
  await page
    .locator(".q-question textarea")
    .first()
    .fill("变化后的公式 $x^2+5$");
  await page
    .locator(".q-question")
    .getByRole("combobox", { name: "题型", exact: true })
    .selectOption({ label: term });
  await page.getByLabel("长期笔记").fill("教师自己的笔记");
  await page.getByLabel("标记题目", { exact: true }).check();
  await page.getByRole("button", { name: "保存题目", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("已保存");
  await page.getByLabel("搜索题目").fill("教师自己的笔记");
  await page.getByLabel("筛选题型").selectOption({ label: term });
  await page.locator(".q-finder").getByLabel("标记", { exact: true }).check();
  await expect(page.locator(".q-list > button")).toHaveCount(1);
  await page.getByRole("button", { name: "复制改编", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看原题", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("长期笔记")).toHaveValue("");
  await expect(page.getByLabel("标记题目", { exact: true })).not.toBeChecked();
  await page.getByLabel("题目标题").fill(term + "副本");
  await page.getByRole("button", { name: "保存题目", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("题目已保存");
  await page.getByRole("button", { name: "查看原题", exact: true }).click();
  await expect(page.getByLabel("题目标题")).toHaveValue(term);
  await page.getByRole("button", { name: "删除题目", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "恢复题目", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "改编题：" + term + "副本", exact: true })
    .click();
  await expect(page.getByLabel("题目标题")).toHaveValue(term + "副本");
  await page.getByText("采用时的原题", { exact: true }).click();
  await expect(page.locator(".q-question")).toContainText("变化后的公式");
});

test("math precedence, nested missing figure and answer after explanation remain faithful", async ({
  page,
}) => {
  await textImport(
    page,
    "1. 化简 x^2/3 与 x/2^3。\n2. 计算 2×3 与 x+2。\n3. 选择正确选项。\nA. 如图所示 B. 无图\n4. 解方程 x=2。\n说明：以下为格式说明\n答案：x=2",
  );
  await expect(page.locator(".q-review-result textarea").first()).toHaveValue(
    "化简 $x^2/3$ 与 $x/2^3$。",
  );
  await page.getByRole("button", { name: "2 待校对", exact: true }).click();
  await expect(page.locator(".q-review-result textarea").first()).toHaveValue(
    "计算 $2\\times 3$ 与 $x+2$。",
  );
  await page.getByRole("button", { name: "3 待校对", exact: true }).click();
  await expect(page.locator(".q-issue")).toContainText([
    "题目边界",
    "缺少配图",
  ]);
  await page.getByRole("button", { name: "4 待校对", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "答案状态", exact: true }),
  ).toHaveValue("present");
  await expect(page.locator(".q-review-result textarea").nth(1)).toHaveValue(
    "$x=2$",
  );
});

test("lost confirmation response replays the original request after reload without duplicating a question", async ({
  page,
}) => {
  await textImport(page, "1. 验证未知请求 $u=9$。");
  await page.locator(".q-issue select").selectOption("corrected");
  let committed;
  await page.route(
    "**/questions/v2/imports/*/commit",
    async (route) => {
      committed = await (await route.fetch()).json();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "确认收录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "确认上次请求", exact: true }),
  ).toBeVisible();
  await expect.poll(() => committed?.questions?.length).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "确认上次请求", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("原请求已确认");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "查看已入库题目" }),
  ).toBeVisible();
  const material = await (
    await page.request.get(
      `/api/modules/questions/v2/imports/${committed.import.id}`,
    )
  ).json();
  expect(material.drafts[0].questionId).toBe(committed.questions[0].id);
  const questions = await (
    await page.request.get("/api/modules/questions/v2/items")
  ).json();
  expect(
    questions.items.filter(
      (q) => q.source.kind === "import" && q.source.importId === material.id,
    ),
  ).toHaveLength(1);
});

test("renaming and deleting selected classification updates filters and keeps the question", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "分类管理", exact: true }).click();
  const name = "分类生命周期" + Date.now();
  await page.getByLabel("新分类名称").fill(name);
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await page.getByLabel("分类类别").selectOption("tags");
  await page.getByLabel("新分类名称").fill(name + "标签");
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await page.getByRole("button", { name: "保存分类", exact: true }).click();
  await expect(
    page.getByLabel("筛选题型").locator("option", { hasText: name }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "自建", exact: true }).click();
  await page.getByLabel("题目标题").fill(name);
  await page.getByRole("button", { name: "段落", exact: true }).first().click();
  await page.locator(".q-question textarea").first().fill("分类删除后仍在");
  await page
    .locator(".q-question")
    .getByRole("combobox", { name: "题型", exact: true })
    .selectOption({ label: name });
  await page
    .locator(".q-question")
    .getByLabel(name + "标签", { exact: true })
    .check();
  await page.getByRole("button", { name: "保存题目", exact: true }).click();
  await expect(page.locator(".q-message")).toContainText("已保存");
  const row = page
    .locator(".q-taxonomy > div")
    .filter({ has: page.locator(`input[value="${name}"]`) });
  await row.getByLabel("分类名称").fill(name + "改名");
  await page.getByRole("button", { name: "保存分类", exact: true }).click();
  await expect(
    page.getByLabel("筛选题型").locator("option", { hasText: name + "改名" }),
  ).toHaveCount(1);
  await page.getByLabel("筛选题型").selectOption({ label: name + "改名" });
  await page
    .locator(".q-finder")
    .getByLabel(name + "标签", { exact: true })
    .check();
  await expect(page.locator(".q-list > button")).toHaveCount(1);
  page.on("dialog", (dialog) => dialog.accept());
  for (const term of [name + "改名", name + "标签"]) {
    const r = page
      .locator(".q-taxonomy > div")
      .filter({ has: page.locator(`input[value="${term}"]`) });
    await r.getByRole("button", { name: "删除", exact: true }).click();
  }
  await page.getByRole("button", { name: "保存分类", exact: true }).click();
  await expect(page.getByLabel("筛选题型")).toHaveValue("");
  await expect(
    page.locator(".q-list > button").filter({ hasText: name }),
  ).toHaveCount(1);
  await page.locator(".q-list > button").filter({ hasText: name }).click();
  await expect(
    page
      .locator(".q-question")
      .getByRole("combobox", { name: "题型", exact: true }),
  ).toHaveValue("");
});
