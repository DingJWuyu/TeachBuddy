import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
import { registerMath } from "./fixtures/math-static/real.mjs";
import {
  Q,
  R,
  C,
  http,
  seedRich,
  seedLegacy,
  record,
  question,
} from "../../api/test/teaching-time-classes-materials-fixture.js";
const evidence = path.resolve(
  process.env.MTA_EVIDENCE ??
    "test-results/evidence/MATERIALS-TEACHING-ALIGNMENT/v1/implementation",
);
fs.mkdirSync(evidence, { recursive: true });
async function login(page, origin, email) {
  await page.goto(origin);
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill("math-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator(".wb-shell")).toBeVisible();
}
test("WB-MTA001/003: rich selection, two-class feedback and exact scene roundtrip", async ({
  page,
  context,
}) => {
  const world = await createIntegration(
    process.env.MTA_RED
      ? {
          webDist: path.resolve(
            process.env.MTA_BASELINE_WEB_DIST ??
              ".work/mta/fixed/apps/web/dist",
          ),
        }
      : {},
  );
  const responses = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", async (r) => {
    if (r.url().includes("/api/modules/") && r.request().method() === "GET") {
      try {
        responses.push({
          path: new URL(r.url()).pathname + new URL(r.url()).search,
          status: r.status(),
          body: await r.json(),
        });
      } catch {}
    }
  });
  try {
    const { client } = await registerMath(world, "mta-browser@example.test"),
      call = http(client);
    const seeded = await seedRich(client),
      legacy = await seedLegacy(client);
    const { client: foreign } = await registerMath(
      world,
      "mta-foreign@example.test",
    );
    await http(foreign)("POST", Q, question("其他账户的丰富题目"), 201);
    const second = await call("POST", C, { name: "高一二班" }, 201);
    const other = await call(
      "POST",
      R,
      record(
        second.id,
        [
          { kind: "question", id: seeded.rich.id },
          { kind: "lesson", id: legacy.lesson.id },
          { kind: "math", id: legacy.math.id },
        ],
        "二班：配方法需要补讲",
      ),
      201,
    );
    await login(page, world.origin, "mta-browser@example.test");
    await page
      .locator(".wb-sidebar")
      .getByRole("link", { name: "班级教学", exact: true })
      .click();
    await page.getByRole("button", { name: "新建班级", exact: true }).click();
    await page.getByLabel("班级名称", { exact: true }).fill("高一一班");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    await page.getByLabel("写一句", { exact: true }).fill("一班：零点还需再练");
    await page.getByRole("button", { name: "补充", exact: true }).click();
    const composer = page.locator('[data-region="record-composer"]');
    await composer
      .getByRole("button", { name: "关联资料", exact: true })
      .click();
    const picker = page.getByRole("dialog", { name: "关联资料", exact: true });
    await picker.getByRole("tab", { name: "题目", exact: true }).click();
    if (process.env.MTA_RED) {
      await expect
        .poll(() =>
          responses.some(
            (x) => x.path.includes("/questions/items") && x.status === 422,
          ),
        )
        .toBe(true);
      await page.screenshot({ path: path.join(evidence, "red-picker.png") });
      fs.writeFileSync(
        path.join(evidence, "red-picker.json"),
        JSON.stringify(
          {
            directory: world.directory,
            responses: responses.filter((x) => x.path.includes("/questions/")),
          },
          null,
          2,
        ),
      );
    }
    await expect(
      picker.locator(`[data-source-id="${seeded.rich.id}"]`),
    ).toBeVisible();
    for (const item of [seeded.v1, seeded.rich, seeded.copy, seeded.imported])
      await expect(
        picker.locator(`[data-source-id="${item.id}"]`),
      ).toBeVisible();
    await expect(picker).not.toContainText("其他账户的丰富题目");
    await picker.getByLabel("搜索资料").fill("丰富");
    await expect(picker.locator(".c-picker-row")).toHaveCount(2);
    await picker.locator(`[data-source-id="${seeded.rich.id}"]`).click();
    await picker.getByRole("button", { name: "取消", exact: true }).click();
    await expect(composer.locator(".c-source-chip")).toHaveCount(0);
    await composer
      .getByRole("button", { name: "关联资料", exact: true })
      .click();
    await picker.locator(`[data-source-id="${seeded.rich.id}"]`).click();
    let fail = true;
    await page.route("**/api/modules/questions/v2/items?*", async (route) => {
      if (fail)
        await route.fulfill({
          status: 503,
          contentType: "application/problem+json",
          body: JSON.stringify({
            type: "/problems/workbench/temporarily-unavailable",
          }),
        });
      else await route.continue();
    });
    await picker.getByLabel("搜索资料").fill("零点");
    await expect(
      picker.getByRole("button", { name: "重试", exact: true }),
    ).toBeVisible();
    fail = false;
    await picker.getByRole("button", { name: "重试", exact: true }).click();
    await expect(
      picker.locator(`[data-source-id="${seeded.rich.id}"]`),
    ).toHaveAttribute("aria-pressed", "true");
    await picker.getByRole("button", { name: "确定", exact: true }).click();
    const classId = new URL(page.url()).pathname.split("/")[2];
    expect((await call("GET", `${R}?classId=${classId}`)).items).toHaveLength(
      0,
    );
    const saving = page.waitForResponse(
      (r) =>
        r.url().endsWith("/classes/v2/records") &&
        r.request().method() === "POST",
    );
    await composer.getByRole("button", { name: "保存", exact: true }).click();
    const savedResponse = await saving;
    expect(savedResponse.status()).toBe(201);
    const saved = await savedResponse.json();
    const request = savedResponse.request().postDataJSON();
    expect(request.sources).toEqual([{ kind: "question", id: seeded.rich.id }]);
    await page.reload();
    const card = page.locator(`[data-record-id="${saved.id}"]`);
    await expect(card).toContainText("一班：零点还需再练");
    await card.getByRole("button", { name: "编辑", exact: true }).click();
    const editor = card.locator('[data-region="record-editor"]');
    await editor
      .getByLabel("编辑记录内容")
      .fill("一班未保存文字：不能被二班覆盖");
    await editor.getByLabel("编辑记录日期").fill("2026-09-20");
    await editor.getByLabel("下次备注").fill("未保存补充");
    await page
      .locator(".wb-topbar")
      .getByRole("button", { name: "AI 助理", exact: true })
      .click();
    await page.getByLabel("AI 输入").fill("保留这条教学 AI 草稿，不发送");
    const source = editor.getByRole("button", {
      name: seeded.rich.title,
      exact: true,
    });
    await source.scrollIntoViewIfNeeded();
    const scroll = await page
      .locator(".c-detail-scroll")
      .evaluate((n) => n.scrollTop);
    await source.click();
    await expect(page.getByLabel("题目标题")).toHaveValue(seeded.rich.title);
    await expect(page.getByAltText("零点三角形配图")).toBeVisible();
    await expect(page.locator(".q-question table")).toHaveCount(1);
    await expect(page.locator(".q-question")).toContainText("两个零点");
    expect((await call("GET", `${Q}/${seeded.rich.id}`)).version).toBe(1);
    await page.screenshot({ path: path.join(evidence, "rich-desktop.png") });
    await page.locator("summary").filter({ hasText: "教学反馈" }).click();
    const feedback = page.locator('[data-region="source-records-panel"]');
    await expect(feedback).toContainText("高一一班");
    await expect(feedback).toContainText("高一二班");
    await expect(feedback).toContainText("二班：配方法需要补讲");
    await feedback.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(evidence, "feedback-desktop.png"),
    });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page
      .getByRole("button", { name: "关闭辅助栏", exact: true })
      .first()
      .click();
    await feedback.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidence, "feedback-tablet.png") });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel(/长期笔记/).fill("丰富题保存后正文答案和文件保持");
    await page.getByRole("button", { name: "保存题目", exact: true }).click();
    await expect
      .poll(async () => (await call("GET", `${Q}/${seeded.rich.id}`)).version)
      .toBe(2);
    const editedRich = await call("GET", `${Q}/${seeded.rich.id}`);
    expect(editedRich.body).toEqual(seeded.rich.body);
    expect(editedRich.solution).toEqual(seeded.rich.solution);
    expect(editedRich.source).toEqual(seeded.rich.source);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("button", { name: "返回教学记录", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/classes/${classId}/records/${saved.id}$`),
    );
    await expect(editor.getByLabel("编辑记录内容")).toHaveValue(
      "一班未保存文字：不能被二班覆盖",
    );
    await expect(editor.getByLabel("编辑记录日期")).toHaveValue("2026-09-20");
    await expect(editor.getByLabel("下次备注")).toHaveValue("未保存补充");
    await page
      .locator(".wb-topbar")
      .getByRole("button", { name: "AI 助理", exact: true })
      .click();
    await expect(page.getByLabel("AI 输入")).toHaveValue(
      "保留这条教学 AI 草稿，不发送",
    );
    fs.writeFileSync(
      path.join(evidence, "scroll-verification.json"),
      JSON.stringify(
        {
          before: scroll,
          after: await page.locator(".c-detail-scroll").evaluate((n) => ({
            top: n.scrollTop,
            height: n.clientHeight,
            scrollHeight: n.scrollHeight,
          })),
        },
        null,
        2,
      ),
    );
    await expect
      .poll(() => page.locator(".c-detail-scroll").evaluate((n) => n.scrollTop))
      .toBe(scroll);
    await page.screenshot({ path: path.join(evidence, "record-return.png") });
    await source.click();
    await expect(feedback).toContainText("高一二班");
    await feedback.locator(`[data-source-record-id="${other.id}"]`).click();
    await expect(page).toHaveURL(
      new RegExp(`/classes/${second.id}/records/${other.id}$`),
    );
    const secondCard = page.locator(`[data-record-id="${other.id}"]`);
    await expect(secondCard.getByLabel("编辑记录内容")).toHaveValue(
      "二班：配方法需要补讲",
    );
    await secondCard
      .locator(".c-source-open")
      .filter({ hasText: legacy.math.title })
      .first()
      .click();
    await expect(page.getByLabel("作品名称")).toHaveValue(legacy.math.title);
    await page
      .locator("summary")
      .filter({ hasText: "使用位置与教学反馈" })
      .click();
    await expect(
      page.locator('[data-region="source-records-panel"]'),
    ).toContainText("二班：配方法需要补讲");
    await page
      .getByRole("button", { name: "返回教学记录", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(other.id + "$"));
    await secondCard
      .locator(".c-source-open")
      .filter({ hasText: seeded.rich.title })
      .first()
      .click();
    await expect(feedback).toHaveAttribute("data-source-id", seeded.rich.id);
    await page
      .locator(".q-list")
      .getByRole("button", { name: /手工旧题/ })
      .click();
    await expect(page.getByLabel("题目标题")).toHaveValue("手工旧题");
    await expect(feedback).toHaveAttribute("data-source-id", seeded.v1.id);
    await expect(feedback).toContainText("还没有班级记录");
    await expect(feedback).not.toContainText("二班：");
    expect(errors).toEqual([]);
    expect(
      responses.some((x) => x.path.startsWith("/api/modules/questions/items")),
    ).toBe(false);
    fs.writeFileSync(
      path.join(evidence, "browser-roundtrip.json"),
      JSON.stringify(
        {
          directory: world.directory,
          identity: "real-auth",
          seeded,
          record: saved,
          secondRecord: other,
          scroll,
          responses,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
    await world.close();
  }
});

test("WB-MTA004/005: failed feedback, lost response, conflict and identity keep the rich-linked draft", async ({
  page,
  context,
}) => {
  const world = await createIntegration();
  try {
    const { client } = await registerMath(world, "mta-recovery@example.test"),
      call = http(client);
    const q = await call("POST", Q, question("恢复验证题"), 201),
      c = await call("POST", C, { name: "恢复一班" }, 201);
    const input = record(c.id, [{ kind: "question", id: q.id }], "服务器原文"),
      saved = await call("POST", R, input, 201);
    await login(page, world.origin, "mta-recovery@example.test");
    await page
      .locator(".wb-sidebar")
      .getByRole("link", { name: "班级教学", exact: true })
      .click();
    await page.getByRole("button", { name: /恢复一班/ }).click();
    const card = page.locator(`[data-record-id="${saved.id}"]`);
    await card.getByRole("button", { name: "编辑", exact: true }).click();
    const editor = card.locator('[data-region="record-editor"]');
    await editor.getByLabel("编辑记录内容").fill("已提交但丢响应");
    const requests = [];
    await page.route(`**/classes/v2/records/${saved.id}`, async (route) => {
      if (route.request().method() !== "PUT") {
        await route.continue();
        return;
      }
      const r = route.request();
      requests.push({
        method: r.method(),
        url: new URL(r.url()).pathname,
        key: r.headers()["idempotency-key"],
        body: r.postDataJSON(),
      });
      if (requests.length === 1) {
        await route.fetch();
        await route.abort("failed");
      } else await route.continue();
    });
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      editor.getByRole("button", { name: "重试确认", exact: true }),
    ).toBeVisible();
    await editor.getByLabel("编辑记录内容").fill("确认期间新草稿");
    await editor.getByRole("button", { name: "重试确认", exact: true }).click();
    await expect(editor.getByLabel("编辑记录内容")).toHaveValue(
      "确认期间新草稿",
    );
    await expect(editor.locator("[data-save-status]")).toHaveAttribute(
      "data-save-status",
      "dirty",
    );
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect((await call("GET", `${R}/${saved.id}`)).version).toBe(2);
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    await expect(editor.locator("[data-save-status]")).toHaveAttribute(
      "data-save-status",
      "saved",
    );
    const concurrent = await call("PUT", `${R}/${saved.id}`, {
      ...input,
      expectedVersion: 3,
      note: "另处提交的对照文本",
    });
    await editor.getByLabel("编辑记录内容").fill("本地冲突草稿");
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    await expect(editor.locator('[data-region="conflict"]')).toBeVisible();
    await expect(editor.getByLabel("编辑记录内容")).toHaveValue("本地冲突草稿");
    await editor
      .getByRole("button", { name: "查看服务器版本", exact: true })
      .click();
    await expect(
      editor.locator('[data-region="server-version"]'),
    ).toContainText("另处提交的对照文本");
    await page.screenshot({ path: path.join(evidence, "conflict.png") });
    page.once("dialog", (d) => d.accept());
    await editor
      .getByRole("button", { name: "采用服务器版本", exact: true })
      .click();
    await expect(editor.getByLabel("编辑记录内容")).toHaveValue(
      "另处提交的对照文本",
    );
    await editor.getByLabel("编辑记录内容").fill("对照后新键保存");
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    await expect(editor.locator("[data-save-status]")).toHaveAttribute(
      "data-save-status",
      "saved",
    );
    expect((await call("GET", `${R}/${saved.id}`)).version).toBe(
      concurrent.version + 1,
    );
    await page.unroute(`**/classes/v2/records/${saved.id}`);
    await editor.getByRole("button", { name: q.title, exact: true }).click();
    await page.locator("summary").filter({ hasText: "教学反馈" }).click();
    const feedback = page.locator('[data-region="source-records-panel"]');
    await expect(feedback).toContainText("对照后新键保存");
    await page.route(`**/classes/v2/source-records/question/${q.id}`, (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/problem+json",
        body: JSON.stringify({
          type: "/problems/workbench/temporarily-unavailable",
        }),
      }),
    );
    await feedback
      .getByRole("button", { name: "刷新反馈", exact: true })
      .click();
    await expect(feedback).toContainText("未能更新反馈");
    await expect(feedback).toContainText("对照后新键保存");
    await page.unroute(`**/classes/v2/source-records/question/${q.id}`);
    await feedback.getByRole("button", { name: "重试", exact: true }).click();
    await expect(
      feedback.locator('[data-region="source-records-error"]'),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "删除题目", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "恢复题目", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("题目标题")).toBeDisabled();
    await feedback
      .getByRole("button", { name: "刷新反馈", exact: true })
      .click();
    await expect(feedback).toContainText("对照后新键保存");
    await page
      .getByRole("button", { name: "返回教学记录", exact: true })
      .click();
    await expect(editor.getByLabel("编辑记录内容")).toHaveValue(
      "对照后新键保存",
    );
    await editor.getByLabel("编辑记录内容").fill("401锁定草稿");
    await page.route(`**/classes/v2/records/${saved.id}`, async (route) => {
      if (route.request().method() === "PUT")
        await route.fulfill({
          status: 401,
          contentType: "application/problem+json",
          body: JSON.stringify({ type: "/problems/workbench/unauthenticated" }),
        });
      else await route.continue();
    });
    await editor.getByRole("button", { name: "保存", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.entries(localStorage).some(
            ([k, v]) => k.includes("class-record") && v.includes("401锁定草稿"),
          ),
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole("heading", { name: "正在核实登录状态", exact: true }),
    ).toBeVisible();
    await expect(editor).toHaveCount(0);
    await page.screenshot({ path: path.join(evidence, "identity-locked.png") });
    await page.unroute(`**/classes/v2/records/${saved.id}`);
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await expect(editor.getByLabel("编辑记录内容")).toHaveValue("401锁定草稿");
    fs.writeFileSync(
      path.join(evidence, "browser-recovery.json"),
      JSON.stringify(
        {
          directory: world.directory,
          requests,
          unknownResultCommittedOnce: true,
          conflictCompared: true,
          feedbackFailureRetained: true,
          deletedFeedback: true,
          identityDraftLocked: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
    await world.close();
  }
});
