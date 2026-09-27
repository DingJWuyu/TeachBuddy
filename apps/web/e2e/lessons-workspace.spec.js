import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    fileURLToPath(new URL("./fixtures/office/source/assets/q2-parabola.png", import.meta.url)),
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


test("备课搜索覆盖环节名称、题面和本课备注", async ({ page }) => {
  const call = await setup(page);
  await call("POST", Q, question("隐含条件题面"), 201);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("搜索完整性");
  await addSection(page, "数形结合探究");
  await pick(page);
  await page.getByRole("checkbox", { name: "选择 隐含条件题面", exact: true }).check();
  await page.getByRole("button", { name: "加入 1 道题", exact: true }).click();
  const ref = page.locator("[data-reference-id]");
  await ref.getByRole("button", { name: "添加本课备注", exact: true }).click();
  await ref.getByRole("textbox").fill("先让学生独立猜想");
  await save(page);
  await page.getByRole("button", { name: "我的备课", exact: true }).click();
  for (const term of ["搜索完整性", "数形结合探究", "隐含条件题面", "独立猜想"]) {
    const result = page.waitForResponse(response => new URL(response.url()).pathname === '/api/modules/lessons/v3' && new URL(response.url()).searchParams.get('q') === term);
    await page.getByRole("searchbox", { name: "搜索备课" }).fill(term);
    await result;
    await expect(page.locator(".wb-card-title")).toHaveText(["搜索完整性"]);
  }
  await page.getByRole("searchbox", { name: "搜索备课" }).fill("不存在的内容");
  await expect(page.getByRole("heading", { name: "没有找到这份备课" })).toBeVisible();
});

test("未保存编辑可撤销重做，误删段落与环节可恢复，保存后清空本次历史", async ({ page }) => {
  await setup(page);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("撤销备课");
  await page.getByLabel("开头文稿段落 1").fill("原始思路");
  await addSection(page, "保留环节");
  await save(page);
  const undo = page.getByRole("button", { name: "撤销", exact: true });
  const redo = page.getByRole("button", { name: "重做", exact: true });
  await expect(undo).toBeDisabled();
  const paragraph = page.getByLabel("开头文稿段落 1");
  await paragraph.click();
  await paragraph.press("End");
  await paragraph.pressSequentially("连续输入的补充");
  await paragraph.press("Control+z");
  await expect(paragraph).toHaveValue("原始思路");
  await paragraph.fill("保留这处修改");
  await page.locator('.lesson-intro-section').getByRole("button", { name: "段落操作 1" }).click();
  await page.getByRole("menuitem", { name: "删除段落", exact: true }).click();
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue("");
  await undo.click();
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue("保留这处修改");
  await redo.click();
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue("");
  await undo.click();
  await page.getByRole("button", { name: "环节操作 保留环节" }).click();
  await page.getByRole("menuitem", { name: "删除环节", exact: true }).click();
  await page.getByRole("button", { name: "连同材料一起移除", exact: true }).click();
  await expect(page.locator('[data-section-id]')).toHaveCount(0);
  await undo.click();
  await expect(page.getByLabel("环节名称 1")).toHaveValue("保留环节");
  await page.getByLabel("环节名称 1").fill("临时改名");
  await page.getByLabel("环节名称 1").press("Control+z");
  await expect(page.getByLabel("环节名称 1")).toHaveValue("保留环节");
  await page.getByLabel("环节名称 1").press("Control+Shift+z");
  await expect(page.getByLabel("环节名称 1")).toHaveValue("临时改名");
  await save(page);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue("保留这处修改");
  await expect(page.getByLabel("环节名称 1")).toHaveValue("临时改名");
});

test("复制备课保留原稿及采用快照，断线刷新后确认同一份副本", async ({ page }) => {
  const call = await setup(page);
  const source = await call("POST", Q, question("旧版例题"), 201);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("可复用的课稿");
  await addSection(page, "讲解环节");
  await pick(page);
  await page.getByRole("checkbox", { name: "选择 旧版例题", exact: true }).check();
  await page.getByRole("button", { name: "加入 1 道题", exact: true }).click();
  await expect(page.locator('[data-reference-id]')).toHaveCount(1);
  const originalId = page.url().split('/').at(-1);
  await call("POST", `${Q}/${source.id}/deletion`, { baseVersion: 1, deleted: true });
  await page.getByLabel("开头文稿段落 1").fill("复制之前的修改也要保留");
  await page.getByRole("button", { name: "备课操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "复制备课", exact: true }).click();
  await expect(page.getByRole('dialog', { name: '创建备课副本？' })).toBeVisible();
  await expect(page.locator('.wb-module-presence').filter({ has: page.getByRole('dialog', { name: '创建备课副本？' }) })).toHaveAttribute('data-state', 'open');
  await screenshot(page, "lesson-copy-confirmation");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect((await call("GET", '/api/modules/lessons/v3')).items).toHaveLength(1);
  const attempts = [];
  await page.route(`**/api/modules/lessons/v3/${originalId}/copy`, async route => {
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    if (attempts.length === 1) { await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "备课操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "复制备课", exact: true }).click();
  await page.getByRole("button", { name: "创建副本", exact: true }).click();
  await expect(page.getByRole("button", { name: "确认备课副本", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "确认备课副本", exact: true }).click();
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue("可复用的课稿（副本）");
  const copiedId = page.url().split('/').at(-1);
  expect(copiedId).not.toBe(originalId);
  expect(attempts[1]).toEqual(attempts[0]);
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue("复制之前的修改也要保留");
  await expect(page.locator('[data-reference-id]')).toContainText('旧版例题');
  const original = await call("GET", `/api/modules/lessons/v3/${originalId}`);
  const copied = await call("GET", `/api/modules/lessons/v3/${copiedId}`);
  expect(copied.sections[0].id).not.toBe(original.sections[0].id);
  expect(copied.sections[0].references[0].id).not.toBe(original.sections[0].references[0].id);
  expect(copied.sections[0].references[0].snapshot).toEqual(original.sections[0].references[0].snapshot);
  await page.getByLabel("课题", { exact: true }).fill("另一个班的课稿");
  await save(page);
  expect((await call("GET", `/api/modules/lessons/v3/${originalId}`)).title).toBe("可复用的课稿");
  expect((await call("GET", '/api/modules/lessons/v3')).items).toHaveLength(2);
  await page.reload();
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue("另一个班的课稿");
});


test("撤销材料移除保留引用身份和本课备注", async ({ page }) => {
  const call = await setup(page);
  await call("POST", Q, question("撤销材料示例"), 201);
  await newLesson(page);
  await page.getByLabel("课题", { exact: true }).fill("材料恢复");
  await addSection(page, "练习");
  await pick(page);
  await page.getByRole("checkbox", { name: "选择 撤销材料示例", exact: true }).check();
  await page.getByRole("button", { name: "加入 1 道题", exact: true }).click();
  const card = page.locator('[data-reference-id]');
  await expect(card).toHaveCount(1);
  const referenceId = await card.getAttribute('data-reference-id');
  await card.getByRole('button', { name: '添加本课备注', exact: true }).click();
  await card.getByRole('textbox').fill('这一条未保存备注也要保留');
  await card.getByRole('button', { name: '材料操作 撤销材料示例', exact: true }).click();
  await page.getByRole('menuitem', { name: '从本课移除', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(card).toHaveAttribute('data-reference-id', referenceId);
  await expect(card.getByRole('textbox')).toHaveValue('这一条未保存备注也要保留');
  await save(page);
  await page.reload();
  await expect(card).toHaveAttribute('data-reference-id', referenceId);
  await expect(card.getByRole('textbox')).toHaveValue('这一条未保存备注也要保留');
});

test("材料可穿插正文，删除和移动正文保留材料，撤销后保存重开保持位置", async ({ page }) => {
  const call = await setup(page);
  await call("POST", Q, question("穿插例题"), 201);
  await newLesson(page); await page.getByLabel("课题", { exact: true }).fill("正文混排");
  await addSection(page, "先讲后练");
  const section = page.locator("[data-section-id]").first();
  await page.getByLabel("环节文稿 1段落 1", { exact: true }).fill("前置讲解");
  await section.getByRole("button", { name: "插入内容", exact: true }).click();
  await page.getByRole("menuitem", { name: "段落", exact: true }).click();
  await page.getByLabel("环节文稿 1段落 2", { exact: true }).fill("练习之后的总结");
  await pick(page);
  await page.getByRole("checkbox", { name: "选择 穿插例题", exact: true }).check();
  await page.getByRole("button", { name: /^加入 1 道题$/ }).click();
  await expect(page.locator("[data-reference-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "材料操作 穿插例题", exact: true }).click();
  await page.getByRole("menuitem", { name: "放到正文之间", exact: true }).click();
  await page.getByRole("radio", { name: /第 1 块内容之后/ }).check();
  await screenshot(page, "placement-dialog");
  await page.getByRole("button", { name: "移动到这里", exact: true }).click();
  const order = () => section.locator("[data-lesson-block], [data-reference-id]").evaluateAll(nodes => nodes.map(n => n.dataset.referenceId ? "题目" : n.querySelector("textarea")?.value));
  await expect.poll(order).toEqual(["前置讲解", "题目", "练习之后的总结"]);
  await section.getByRole("button", { name: "段落操作 1", exact: true }).click();
  await page.getByRole("menuitem", { name: "删除段落", exact: true }).click();
  await expect.poll(order).toEqual(["题目", "练习之后的总结"]);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect.poll(order).toEqual(["前置讲解", "题目", "练习之后的总结"]);
  await section.getByRole("button", { name: "段落操作 1", exact: true }).click();
  await page.getByRole("menuitem", { name: "下移段落", exact: true }).click();
  await expect.poll(order).toEqual(["练习之后的总结", "前置讲解", "题目"]);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await save(page); await page.reload();
  await expect.poll(order).toEqual(["前置讲解", "题目", "练习之后的总结"]);
  const saved = await call("GET", new URL(page.url()).pathname.replace("/lessons/", "/api/modules/lessons/v3/"));
  expect(saved.sections[0].references[0].afterBlock).toBe(1);
  await page.getByRole("button", { name: "查看课稿", exact: true }).click();
  const text = await section.innerText();
  expect(text.indexOf("前置讲解")).toBeLessThan(text.indexOf("穿插例题"));
  expect(text.indexOf("穿插例题")).toBeLessThan(text.indexOf("练习之后的总结"));
});

test("历史恢复先保留草稿，断线后刷新原键确认，并可找回恢复前的内容", async ({ page }) => {
  const call = await setup(page);
  await newLesson(page); await page.getByLabel("课题", { exact: true }).fill("第一稿标题");
  await page.getByLabel("开头文稿段落 1", { exact: true }).fill("第一稿的教学目标");
  await save(page);
  const id = new URL(page.url()).pathname.split("/").at(-1), url = `/api/modules/lessons/v3/${id}`;
  await page.getByLabel("课题", { exact: true }).fill("第二稿标题"); await save(page);
  await page.getByLabel("课题", { exact: true }).fill("还未保存的标题");
  async function openHistory() {
    await page.getByRole("button", { name: "备课操作", exact: true }).click();
    await page.getByRole("menuitem", { name: "查看已保存版本", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "已保存版本", exact: true })).toBeVisible();
  }
  await openHistory();
  const dialog = page.getByRole("dialog", { name: "已保存版本", exact: true });
  await expect(dialog).toContainText("确认时会先保存当前草稿");
  await dialog.getByRole("button", { name: /版本 1/ }).click();
  await expect(dialog.getByLabel("所选课稿预览")).toContainText("第一稿的教学目标");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue("还未保存的标题");
  await openHistory(); await dialog.getByRole("button", { name: /版本 1/ }).click();
  const attempts = [];
  await page.route(`**${url}/history/restore`, async route => {
    attempts.push({ key: route.request().headers()["idempotency-key"], body: route.request().postData() });
    if (attempts.length === 1) { await route.fetch(); await route.abort("failed"); } else await route.continue();
  });
  await dialog.getByRole("button", { name: "恢复此版本", exact: true }).click();
  await expect(page.getByRole("button", { name: "确认课稿更新", exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "确认课稿更新", exact: true }).click();
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue("第一稿标题");
  expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
  expect((await call("GET", url)).version).toBe(4);
  await openHistory(); await dialog.getByRole("button", { name: /版本 3/ }).click();
  await expect(dialog.getByLabel("所选课稿预览")).toContainText("还未保存的标题");
  await dialog.getByRole("button", { name: "恢复此版本", exact: true }).click();
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue("还未保存的标题");
  await page.reload(); await expect(page.getByLabel("课题", { exact: true })).toHaveValue("还未保存的标题");
});

test("从归档备课挑选环节复用，保留原课快照和位置，深浅色窄屏对话框可用", async ({ page }) => {
  const call = await setup(page);
  const q = await call("POST", Q, question("复用的例题"), 201);
  const doc = text => ({ version: 1, blocks: [{ type: "paragraph", runs: [{ type: "text", text }] }] });
  const source = await call("POST", "/api/modules/lessons/v3", { title: "上学期备课", intro: doc("来源思路"), materials: [], sections: [
    { id: crypto.randomUUID(), title: "选择这个环节", content: doc("旧的讲解"), references: [{ id: crypto.randomUUID(), kind: "question", questionId: q.id, questionVersion: 1, note: "原课的讲法", afterBlock: 0 }] },
    { id: crypto.randomUUID(), title: "不选的环节", content: doc("不复制的内容"), references: [] },
  ] }, 201);
  await call("POST", `/api/modules/lessons/v3/${source.id}/deletion`, { baseVersion: 1, deleted: true });
  await call("POST", `${Q}/${q.id}/deletion`, { baseVersion: 1, deleted: true });
  await newLesson(page); await page.getByLabel("课题", { exact: true }).fill("新学期备课"); await save(page);
  const targetPath = new URL(page.url()).pathname;
  await page.getByLabel("开头文稿段落 1").fill("保留本课草稿");
  async function openReuse() {
    await page.getByRole("button", { name: "从其他备课复用环节", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "从其他备课复用环节", exact: true });
    await dialog.getByRole("checkbox", { name: "查看已归档备课" }).check();
    await dialog.getByRole("button", { name: /上学期备课/ }).click();
    await dialog.getByRole("checkbox", { name: "选择这个环节", exact: true }).check();
    return dialog;
  }
  let dialog = await openReuse();
  await expect(dialog).toContainText("原课的讲法");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByLabel("开头文稿段落 1")).toHaveValue("保留本课草稿");
  dialog = await openReuse(); await dialog.getByRole("button", { name: "加入本课（1 个环节）", exact: true }).click();
  await expect(page.locator("[data-section-id]")).toHaveCount(1);
  await expect(page.getByLabel("环节名称 1")).toHaveValue("选择这个环节");
  await expect(page.getByLabel("本课备注 复用的例题")).toHaveValue("原课的讲法");
  const copy = await call("GET", targetPath.replace("/lessons/", "/api/modules/lessons/v3/"));
  expect(copy.sections[0].id).not.toBe(source.sections[0].id);
  expect(copy.sections[0].references[0].snapshot).toEqual(source.sections[0].references[0].snapshot);
  expect(copy.sections[0].references[0].afterBlock).toBe(0);
  await page.getByLabel("环节名称 1").fill("本课改名"); await save(page);
  expect((await call("GET", `/api/modules/lessons/v3/${source.id}`)).sections[0].title).toBe("选择这个环节");
  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("link", { name: /账户：/ }).click();
    await page.getByRole("button", { name: theme === "dark" ? "深色" : "浅色", exact: true }).click();
    await expect(page.locator(".wb-shell")).toHaveAttribute("data-theme", theme);
    await page.getByRole("complementary", { name: "工作台导航" }).getByRole("link", { name: /^备课/ }).click();
    dialog = await openReuse();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(dialog.getByRole("button", { name: "加入本课（1 个环节）" })).toBeInViewport();
      await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      for (const checkbox of await dialog.getByRole("checkbox").all()) {
        expect((await checkbox.boundingBox()).width).toBeLessThanOrEqual(20);
      }
      await screenshot(page, `reuse-${theme}-${width}`);
    }
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
  }
});
