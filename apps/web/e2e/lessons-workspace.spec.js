import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
import { registerMath } from "./fixtures/math-static/real.mjs";
import {
  http,
  Q,
  question,
} from "../../api/test/teaching-time-classes-materials-fixture.js";

let world;
const screenshots = process.env.MANUAL_LESSONS_EVIDENCE;
test.afterEach(async ({ context }, info) => {
  await context.close();
  if (world) {
    await world.close();
    if (info.status === info.expectedStatus)
      fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
async function setup(page) {
  world = await createIntegration();
  const { client } = await registerMath(world, "lesson-ux@example.test");
  await page.goto(`${world.origin}/lessons`);
  await page.getByLabel("邮箱", { exact: true }).fill("lesson-ux@example.test");
  await page.getByLabel("密码", { exact: true }).fill("math-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "备课", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "知道了", exact: true }).click();
  return http(client);
}
async function screenshot(page, name) {
  if (!screenshots) return;
  fs.mkdirSync(screenshots, { recursive: true });
  await page.screenshot({
    path: path.join(screenshots, `${name}.png`),
    animations: "disabled",
  });
}
async function newLesson(page) {
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await expect(
    page.getByLabel("开头文稿段落 1", { exact: true }),
  ).toBeVisible();
}
async function save(page) {
  await page.getByRole("button", { name: "保存备课", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toHaveAttribute(
    "data-save-status",
    /clean|saved/,
  );
}
async function addSection(page, name) {
  await page.getByRole("button", { name: "添加教学环节", exact: true }).click();
  await page
    .getByLabel(/环节名称/)
    .last()
    .fill(name);
}
async function pick(page, name = "加入题目") {
  await page
    .locator("[data-section-id]")
    .first()
    .getByRole("button", { name: "加入材料", exact: true })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

test("第一次备课可直接写作，空白返回不留下草稿，保存后可阅读和重开", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await screenshot(page, "lessons-empty");
  await page.getByRole("button", { name: "看看一份备课示例" }).click();
  await expect(page.getByRole("dialog", { name: "备课示例" })).toContainText(
    "例题讲解",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "看看一份备课示例" }),
  ).toBeFocused();
  await newLesson(page);
  await page.getByRole("button", { name: "我的备课", exact: true }).click();
  await expect(page.locator('[data-region="lesson-draft"]')).toHaveCount(0);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("函数的单调性");
  const intro = page.getByLabel("开头文稿段落 1", { exact: true });
  await intro.pressSequentially("观察 $x^2$ 的图像");
  await expect(intro).toHaveValue("观察 $x^2$ 的图像");
  await intro.press("End");
  await intro.press("Enter");
  await intro.pressSequentially("讨论增减变化");
  await expect(intro).toHaveValue("观察 $x^2$ 的图像\n讨论增减变化");
  await addSection(page, "例题讲解");
  await page
    .getByLabel("环节文稿 1段落 1", { exact: true })
    .fill("先观察，再证明。");
  await screenshot(page, "lessons-writing");
  await save(page);
  await expect(page).toHaveURL(/\/lessons\/[a-f0-9-]+$/);
  await page.getByRole("button", { name: "查看课稿", exact: true }).click();
  await expect(page.locator(".wb-lesson textarea")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "函数的单调性" }),
  ).toBeVisible();
  await expect(page.locator(".wb-lesson .katex")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "编辑备课", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".wb-lesson")).toContainText("先观察，再证明。");
  await screenshot(page, "lessons-reading");
  await page.getByRole("button", { name: "编辑备课", exact: true }).click();
  await expect(intro).toHaveValue("观察 $x^2$ 的图像\n讨论增减变化");
  expect(errors).toEqual([]);
});

test("未保存草稿与已保存课稿明确区分，退出和刷新后仍能继续", async ({
  page,
}) => {
  const call = await setup(page);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("草稿保留");
  await page.getByLabel("开头文稿段落 1").fill("已保存的思路");
  await save(page);
  const id = page.url().split("/").at(-1);
  await page.getByLabel("开头文稿段落 1").fill("尚未保存的修改");
  await page.getByRole("button", { name: "查看课稿", exact: true }).click();
  await expect(page.locator(".lesson-draft-banner")).toContainText(
    "这里显示已保存的课稿",
  );
  await expect(page.locator(".lesson-intro-section")).toContainText(
    "已保存的思路",
  );
  await expect(
    page.getByRole("button", { name: "生成教学资料", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page
    .getByRole("button", { name: "继续编辑草稿", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue("尚未保存的修改");
  expect(
    (await call("GET", `/api/modules/lessons/v3/${id}`)).intro.blocks[0].runs[0]
      .text,
  ).toBe("已保存的思路");
  await save(page);
  expect(
    (await call("GET", `/api/modules/lessons/v3/${id}`)).intro.blocks[0].runs[0]
      .text,
  ).toBe("尚未保存的修改");
});

test("按环节取材、备注清空后继续输入、材料移动和备用材料恢复", async ({
  page,
}) => {
  const call = await setup(page);
  await call("POST", Q, question("单调性例题"), 201);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("例题组织");
  await addSection(page, "例题讲解");
  await pick(page);
  await expect(
    page.getByText("加入到：例题组织 / 例题讲解", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "选择 单调性例题", exact: true })
    .check();
  await page.getByRole("button", { name: "加入 1 道题", exact: true }).click();
  const ref = page.locator("[data-reference-id]");
  await expect(ref).toHaveCount(1);
  await expect(ref.getByRole("textbox")).toHaveCount(0);
  await ref.getByRole("button", { name: "添加本课备注", exact: true }).click();
  const note = ref.getByLabel("本课备注 单调性例题");
  await note.click();
  await note.fill("先让学生讨论");
  await note.fill("");
  await note.pressSequentially("再补充一个提示");
  await expect(note).toHaveValue("再补充一个提示");
  await ref
    .getByRole("button", { name: "材料操作 单调性例题", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "移到备用材料", exact: true })
    .click();
  await page.getByRole("button", { name: "备用材料 · 1", exact: true }).click();
  await expect(page.locator('[data-region="materials"]')).toContainText(
    "再补充一个提示",
  );
  await save(page);
  await page.reload();
  await expect(
    page.locator('[data-region="materials"] [data-reference-id]'),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "材料操作 单调性例题", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "移到例题讲解", exact: true })
    .click();
  await expect(
    page.locator('[data-region="section-references"] [data-reference-id]'),
  ).toHaveCount(1);
  await save(page);
  await screenshot(page, "lessons-material");
});

test("用途选择与独立的答案注记开关清楚可见，返回保留课稿", async ({ page }) => {
  await setup(page);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("输出选项");
  await page.getByLabel("开头文稿段落 1").fill("课堂导入");
  await addSection(page, "例题");
  await save(page);
  await page.getByRole("button", { name: "生成教学资料", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: /教案 \/ 提纲/ }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("checkbox", { name: /附上答案与解析/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /附上教师注记/ }),
  ).not.toBeChecked();
  await screenshot(page, "lessons-exports-start");
  await page.getByRole("radio", { name: /^练习/ }).click();
  await page.getByRole("radio", { name: /^练习/ }).press("ArrowLeft");
  await expect(
    page.getByRole("radio", { name: /导学案 \/ 讲义/ }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /导学案 \/ 讲义/ }).press("ArrowRight");
  await expect(page.getByRole("radio", { name: /^练习/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByLabel("作答空白行")).toBeVisible();
  await page.getByRole("checkbox", { name: /附上答案与解析/ }).check();
  await expect(
    page.getByRole("checkbox", { name: /附上教师注记/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "例题", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "选择环节与备用材料", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "例题", exact: true }),
  ).toBeChecked();
  await screenshot(page, "lessons-exports");
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(
    page.getByRole("button", { name: "保存并生成", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await screenshot(page, "lessons-exports-narrow");
  await page.getByRole("button", { name: "返回课稿", exact: true }).click();
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue("课堂导入");
});

test("备课辅助栏对齐，窄屏无裁切，深浅主题通过真实设置切换", async ({
  page,
}) => {
  await setup(page);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("布局检查");
  await addSection(page, "例题讲解");
  await save(page);
  await page.getByRole("button", { name: "备课操作", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "查看本课大纲", exact: true })
    .click();
  const main = await page.locator(".wb-lesson").boundingBox(),
    aside = await page
      .getByRole("complementary", { name: "辅助栏" })
      .boundingBox();
  expect(Math.abs(main.y - aside.y)).toBeLessThan(2);
  expect(Math.abs(main.height - aside.height)).toBeLessThan(2);
  await screenshot(page, "lessons-outline");
  await page.getByRole("button", { name: "关闭辅助栏", exact: true }).click();
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("button", { name: "保存备课", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await screenshot(page, `lessons-width-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // Appearance is exercised through the actual setting, not emulated media.
  await page.getByRole("link", { name: /账户：/ }).click();
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await expect(page.locator(".wb-shell")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("complementary", { name: "工作台导航" })
    .getByRole("link", { name: /^备课/ })
    .click();
  await expect(page.locator(".wb-lesson")).toBeVisible();
  await screenshot(page, "lessons-dark");
  await page.getByRole("link", { name: /账户：/ }).click();
  await page.getByRole("button", { name: "浅色", exact: true }).click();
  await expect(page.locator(".wb-shell")).toHaveAttribute(
    "data-theme",
    "light",
  );
});

test("按需插入公式、教师注记和图片，排序后保存重开", async ({ page }) => {
  const call = await setup(page);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("内容插入");
  const editor = page.locator(
    '.lesson-document-editor[data-document-editor="开头文稿"]',
  );
  await editor.getByRole("textbox").fill("正文说明");
  async function insert(name) {
    await editor.getByRole("button", { name: "插入内容", exact: true }).click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  }
  await insert("公式");
  await editor
    .getByRole("group", { name: "开头文稿公式 1内容块", exact: true })
    .getByRole("textbox")
    .pressSequentially("x^2+1");
  await insert("公式");
  await editor
    .getByRole("group", { name: "开头文稿公式 2内容块", exact: true })
    .getByRole("textbox")
    .pressSequentially("y=2x");
  await insert("教师注记");
  await editor
    .getByRole("group", { name: "开头文稿教师注记 1内容块", exact: true })
    .getByRole("textbox")
    .fill("只给老师看的提示");
  await editor.getByRole("button", { name: "插入内容", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "图片", exact: true }).click();
  await (
    await chooser
  ).setFiles(
    new URL("./fixtures/office/source/assets/q2-parabola.png", import.meta.url)
      .pathname,
  );
  const picture = editor.getByRole("group", {
    name: "开头文稿图片 1内容块",
    exact: true,
  });
  await picture.getByRole("textbox").fill("抛物线示意");
  await expect(picture.locator("img")).toBeVisible();
  await picture
    .getByRole("button", { name: "图片操作 1", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "上移图片", exact: true }).click();
  await save(page);
  const id = page.url().split("/").at(-1);
  const saved = await call("GET", `/api/modules/lessons/v3/${id}`);
  expect(saved.intro.blocks.map((block) => block.type)).toEqual([
    "paragraph",
    "math",
    "math",
    "image",
    "teacher-note",
  ]);
  expect(saved.intro.blocks[1].latex).toBe("x^2+1");
  expect(saved.intro.blocks[2].latex).toBe("y=2x");
  expect(saved.intro.blocks[3].alt).toBe("抛物线示意");
  await page.reload();
  await expect(editor.locator('[data-lesson-block="math"]')).toHaveCount(2);
  await page.getByRole("button", { name: "查看课稿", exact: true }).click();
  await expect(page.locator(".lesson-intro-section .katex")).toHaveCount(2);
  await expect(page.locator(".lesson-intro-section img")).toBeVisible();
  await expect(page.locator(".lesson-intro-section")).toContainText(
    "只给老师看的提示",
  );
});

test("归档备课后返回主页，恢复草稿和彻底删除均可从归档中完成", async ({
  page,
}) => {
  const call = await setup(page);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("准备归档的课稿");
  await save(page);
  const id = page.url().split("/").at(-1);
  await page.getByLabel("开头文稿段落 1").fill("归档后仍需保留的草稿");
  await page.getByRole("button", { name: "备课操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "归档备课", exact: true }).click();
  await page
    .getByRole("dialog", { name: "归档备课" })
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue(
    "归档后仍需保留的草稿",
  );
  await page.getByRole("button", { name: "备课操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "归档备课", exact: true }).click();
  await page
    .getByRole("dialog", { name: "归档备课", exact: true })
    .getByRole("button", { name: "归档备课", exact: true })
    .click();
  await expect(page).toHaveURL(/\/lessons$/);
  await expect(page.locator(".wb-card-title")).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/\/lessons$/);
  await expect(
    page.getByRole("button", { name: "新建备课", exact: true }),
  ).toBeVisible();

  await openArchived(page, "准备归档的课稿");
  await expect(page.locator(".wb-lesson textarea")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "生成教学资料", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "恢复备课", exact: true }).click();
  await expect(page).toHaveURL(/\/lessons$/);
  await page.getByRole("button", { name: /^准备归档的课稿/ }).click();
  await page
    .getByRole("button", { name: "继续编辑草稿", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue(
    "归档后仍需保留的草稿",
  );
  await save(page);
  await archiveLesson(page);
  await openArchived(page, "准备归档的课稿");
  await page.getByRole("button", { name: "彻底删除", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "彻底删除备课" });
  await expect(dialog).toContainText("无法恢复");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator('[data-region="lesson-archived"]')).toBeVisible();
  await page.getByRole("button", { name: "彻底删除", exact: true }).click();
  await dialog.getByRole("button", { name: "彻底删除", exact: true }).click();
  await expect(page).toHaveURL(/\/lessons$/);
  await page.reload();
  await expect(page).toHaveURL(/\/lessons$/);
  await call("GET", `/api/modules/lessons/v3/${id}`, undefined, 404);
  await page.getByRole("button", { name: "备课列表选项", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "查看已归档备课", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "没有已归档的备课" }),
  ).toBeVisible();
});

async function archiveLesson(page) {
  await page.getByRole("button", { name: "备课操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "归档备课", exact: true }).click();
  await page
    .getByRole("dialog", { name: "归档备课", exact: true })
    .getByRole("button", { name: "归档备课", exact: true })
    .click();
  await expect(page).toHaveURL(/\/lessons$/);
}
async function openArchived(page, title) {
  await page.getByRole("button", { name: "备课列表选项", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "查看已归档备课", exact: true })
    .click();
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await expect(page.locator('[data-region="lesson-archived"]')).toBeVisible();
}

for (const action of ["archive", "restore", "purge"]) {
  test(`备课 ${action} 写入后断线，刷新仍可确认并返回主页`, async ({
    page,
  }) => {
    await setup(page);
    await newLesson(page);
    await page.getByLabel("课题", { exact: true }).fill("断线后确认");
    await save(page);
    if (action !== "archive") {
      await archiveLesson(page);
      await openArchived(page, "断线后确认");
    }
    const route = `**/api/modules/lessons/v3/*/${action === "purge" ? "purge" : "deletion"}`;
    const attempts = [];
    await page.route(route, async (intercepted) => {
      const request = intercepted.request();
      attempts.push({
        key: request.headers()["idempotency-key"],
        body: request.postData(),
      });
      const response = await intercepted.fetch();
      expect(response.status()).toBe(200);
      if (attempts.length === 1) await intercepted.abort("connectionfailed");
      else await intercepted.fulfill({ response });
    });
    if (action === "archive") {
      await page.getByRole("button", { name: "备课操作", exact: true }).click();
      await page
        .getByRole("menuitem", { name: "归档备课", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "归档备课" })
        .getByRole("button", { name: "归档备课", exact: true })
        .click();
    } else if (action === "restore") {
      await page.getByRole("button", { name: "恢复备课", exact: true }).click();
    } else {
      await page.getByRole("button", { name: "彻底删除", exact: true }).click();
      await page
        .getByRole("dialog", { name: "彻底删除备课" })
        .getByRole("button", { name: "彻底删除", exact: true })
        .click();
    }
    await expect(
      page.getByRole("button", { name: "重试确认", exact: true }),
    ).toBeEnabled();
    await page.reload();
    await page.getByRole("button", { name: "重试确认", exact: true }).click();
    await expect(page).toHaveURL(/\/lessons$/);
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    await page.reload();
    await expect(page).toHaveURL(/\/lessons$/);
    await expect(page.locator(".wb-card-title")).toHaveCount(
      action === "restore" ? 1 : 0,
    );
  });
}

test("备课输入焦点完整贴合，深浅色与窄屏仍能阅读长课题和归档操作", async ({
  page,
}) => {
  await setup(page);
  await newLesson(page);
  const title = "函数的单调性：从图像观察到定义证明，再到课堂练习和课后复习";
  await page.getByLabel("课题", { exact: true }).fill(title);
  await page.getByLabel("开头文稿段落 1").fill("先观察，再证明。");
  await addSection(page, "例题讲解");
  await save(page);
  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("link", { name: /账户：/ }).click();
    await page
      .getByRole("button", {
        name: theme === "dark" ? "深色" : "浅色",
        exact: true,
      })
      .click();
    await expect(page.locator(".wb-shell")).toHaveAttribute(
      "data-theme",
      theme,
    );
    await page
      .getByRole("complementary", { name: "工作台导航" })
      .getByRole("link", { name: /^备课/ })
      .click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const label of ["课题", "开头文稿段落 1", "环节名称 1"]) {
        const input = page.getByLabel(label, { exact: true });
        await input.click();
        const focus = await input.evaluate((node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return {
            outline: style.outlineStyle,
            shadow: style.boxShadow,
            corners: [
              [rect.left + 3, rect.top + 3],
              [rect.right - 3, rect.bottom - 3],
            ].every(([x, y]) => document.elementFromPoint(x, y) === node),
          };
        });
        expect(focus.outline).toBe("none");
        expect(focus.shadow).toContain("inset");
        expect(focus.corners).toBe(true);
        await screenshot(page, `focus-${theme}-${width}-${label}`);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.getByRole("button", { name: "查看课稿", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await screenshot(page, "long-title-dark-390");
  await page.getByRole("button", { name: "我的备课", exact: true }).click();
  const search = page.getByLabel("搜索备课", { exact: true });
  await search.click();
  const focus = await search.evaluate((node) => ({
    outline: getComputedStyle(node).outlineStyle,
    shadow: getComputedStyle(node).boxShadow,
    group: getComputedStyle(node.parentElement).boxShadow,
  }));
  expect(focus.outline).toBe("none");
  expect(focus.shadow).toBe("none");
  expect(focus.group).toContain("inset");
  await screenshot(page, "search-dark-390");
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await archiveLesson(page);
  await openArchived(page, title);
  await expect(
    page.getByRole("button", { name: "恢复备课", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "彻底删除", exact: true }),
  ).toBeInViewport();
  await screenshot(page, "archive-dark-390");
});
