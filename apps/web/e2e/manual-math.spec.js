import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
import { register, save } from "./fixtures/math-dynamic/helpers.mjs";
let world;
test.afterEach(async ({ page }, info) => {
  if (world) {
    if (info.status !== info.expectedStatus)
      await page.screenshot({ path: info.outputPath("failure.png") });
    await world.close();
    if (info.status === info.expectedStatus)
      fs.rmSync(world.directory, { recursive: true, force: true });
    world = null;
  }
});
async function start(page, kind = "演示") {
  world = await createIntegration();
  await register(page, world, "manual-math@example.test");
  await page
    .locator(".wb-sidebar")
    .getByRole("link", { name: "数学工坊", exact: true })
    .click();
  await page
    .getByRole("button", { name: `新建${kind}`, exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "作品与工具", exact: true }).click();
  if (kind === "演示")
    await page
      .getByRole("button", { name: "二次函数起点", exact: true })
      .click();
}
test("手动添加参数后可以保存演示", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "添加参数", exact: true }).click();
  const saved = await save(page);
  expect(saved.source.parameters).toHaveLength(4);
});

async function tools(page) {
  if (!(await page.locator(".math-tools-panel").isVisible()))
    await page.getByRole("button", { name: "作品与工具", exact: true }).click();
}
async function section(page, name) {
  await tools(page);
  const details = page
    .locator(".math-tools-panel details")
    .filter({
      has: page.locator("summary", { hasText: new RegExp(`^${name}$`) }),
    })
    .first();
  if (!(await details.evaluate((e) => e.open)))
    await details.locator("summary").click();
  return details;
}
async function download(page, format, target) {
  await page.getByLabel("导出格式").selectOption(format);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  await (await event).saveAs(target);
  return target;
}
test("动态参数改名、范围、步骤说明、对象增删与离线展示", async ({
  page,
  browser,
}, info) => {
  await start(page);
  await page.getByLabel("作品名称").fill("手动正弦探究");
  await page.getByLabel("parameter-0-name", { exact: true }).fill("b");
  await page.getByLabel("parameter-0-min", { exact: true }).fill("-1");
  await page.getByLabel("parameter-0-max", { exact: true }).fill("1");
  await page.getByLabel("parameter-0-step", { exact: true }).fill("0.25");
  await page.reload();
  await tools(page);
  await expect(
    page.getByLabel("parameter-0-name", { exact: true }),
  ).toHaveValue("b");
  await page.getByRole("button", { name: "应用参数 1", exact: true }).click();
  await page.getByLabel("选择对象").selectOption("0");
  await page.getByLabel("expression", { exact: true }).fill("b*sin(x-h)+k");
  await page
    .getByLabel("label-text", { exact: true })
    .fill("y={b}sin(x-{h})+{k}");
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  await page.getByLabel("text", { exact: true }).fill("观察振幅随参数变化");
  await page.getByLabel("at-y", { exact: true }).fill("3");
  await section(page, "步骤");
  await page
    .getByLabel("步骤 1 说明")
    .fill("先观察振幅。\n再比较平移前后的图像。");
  await page.getByLabel("步骤 2 标题").fill("向右平移");
  const first = await save(page);
  expect(first.render.state).toBe("ready");
  expect(first.source.scene.elements[0].expression).toBe("b*sin(x-h)+k");
  expect(first.source.steps[2].values[0]).toEqual({ name: "b", value: -1 });
  expect(first.source.steps.every((s) => s.visibleIds.includes("T1"))).toBe(
    true,
  );
  await page.getByLabel("选择对象").selectOption("1");
  await page.getByLabel("id", { exact: true }).fill("Q");
  const renamed = await save(page);
  expect(renamed.source.drags[0].pointId).toBe("Q");
  await page.getByRole("button", { name: "移除对象", exact: true }).click();
  const removed = await save(page);
  expect(removed.source.drags).toEqual([]);
  expect(removed.source.steps.every((s) => !s.visibleIds.includes("Q"))).toBe(
    true,
  );
  await page.reload();
  await tools(page);
  await section(page, "步骤");
  await expect(page.getByLabel("步骤 1 说明")).toHaveValue(
    "先观察振幅。\n再比较平移前后的图像。",
  );
  await page.screenshot({ path: info.outputPath("dynamic.png") });
  const file = await download(page, "html", info.outputPath("dynamic.html"));
  const context = await browser.newContext({ offline: true });
  try {
    const offline = await context.newPage();
    await offline.goto(pathToFileURL(file).href);
    const frame = offline.frameLocator("iframe");
    await expect(frame.locator(".step-description")).toContainText(
      "先观察振幅",
    );
    await frame.getByRole("button", { name: "向右平移", exact: true }).click();
    await expect(frame.getByLabel("h 数值")).toHaveValue("1");
    await frame.getByLabel("b 数值").fill("0.5");
    await expect(frame.locator("svg")).toContainText("y=0.5sin");
  } finally {
    await context.close();
  }
});
test("平面任意函数、圆、线段、多边形与标注保存并导出透明图片", async ({
  page,
}, info) => {
  await start(page, "平面图形");
  await page.getByLabel("作品名称").fill("三角函数与单位圆");
  await page.getByRole("button", { name: "添加函数", exact: true }).click();
  await page.getByLabel("expression", { exact: true }).fill("2*sin(x)+1");
  await page.getByLabel("label-text", { exact: true }).fill("振幅为二");
  await page
    .getByRole("button", { name: "添加圆 / 椭圆", exact: true })
    .click();
  await page.getByLabel("rx", { exact: true }).fill("1");
  await page.getByLabel("ry", { exact: true }).fill("1");
  await page.getByRole("button", { name: "添加线段", exact: true }).click();
  await page.getByLabel("to-x", { exact: true }).fill("3");
  await page.getByLabel("arrow", { exact: true }).selectOption("end");
  await page.getByRole("button", { name: "添加多边形", exact: true }).click();
  await page.getByRole("button", { name: "添加顶点", exact: true }).click();
  await page.getByLabel("points-3-x", { exact: true }).fill("-2");
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  await page.getByLabel("text", { exact: true }).fill("单位圆与正弦函数");
  await page.getByLabel("at-y", { exact: true }).fill("4");
  const saved = await save(page);
  expect(saved.render.state).toBe("ready");
  await page.reload();
  await tools(page);
  const svg = await download(page, "svg", info.outputPath("plane.svg"));
  expect(fs.readFileSync(svg, "utf8")).toContain("单位圆与正弦函数");
  const png = await download(page, "png", info.outputPath("plane.png"));
  const { data, info: meta } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(meta.width).toBe(1600);
  expect(data.some((v, i) => i % 4 === 3 && v === 0)).toBe(true);
  await page.screenshot({ path: info.outputPath("plane-page.png") });
});
test("空间自定义顶点与棱、改名删点、投影保存重开", async ({ page }, info) => {
  await start(page, "空间图形");
  await page.getByRole("button", { name: "正方体起点", exact: true }).click();
  await page.getByLabel("选择对象").selectOption("0");
  await page.getByLabel("id", { exact: true }).fill("O");
  await page.getByLabel("label-text", { exact: true }).fill("原点 O");
  await page.getByLabel("选择对象").selectOption("7");
  await page.getByRole("button", { name: "移除对象", exact: true }).click();
  await page.getByRole("button", { name: "添加空间点", exact: true }).click();
  await page.getByLabel("z", { exact: true }).fill("4");
  await page.getByRole("button", { name: "添加棱", exact: true }).click();
  await section(page, "棱");
  const count = await page.getByLabel(/^edge-\d+-to$/).count();
  await page.getByLabel(`edge-${count - 1}-to`, { exact: true }).fill("P0");
  await page
    .getByLabel(`edge-${count - 1}-style-dash`, { exact: true })
    .selectOption("dashed");
  await page.getByLabel("azimuth", { exact: true }).fill("45");
  await page.getByLabel("elevation", { exact: true }).fill("30");
  const saved = await save(page);
  expect(saved.render.state).toBe("ready");
  expect(
    saved.source.edges.every(
      (e) => e.from !== "A" && e.to !== "A" && e.from !== "D1" && e.to !== "D1",
    ),
  ).toBe(true);
  await page.reload();
  await tools(page);
  await expect(page.getByLabel("azimuth", { exact: true })).toHaveValue("45");
  await download(page, "svg", info.outputPath("space.svg"));
  await download(page, "png", info.outputPath("space.png"));
  await page.screenshot({ path: info.outputPath("space-page.png") });
});
test("HTML 导入、源码修改、保存重开及离线交互", async ({
  page,
  browser,
}, info) => {
  await start(page, "公式");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByLabel("导入 HTML 文件").setInputFiles({
    name: "外部演示.html",
    mimeType: "text/html",
    buffer: Buffer.from(
      '<!doctype html><meta charset="utf-8"><h1>三角形面积</h1><button onclick="document.querySelector(\'output\').textContent=6">计算</button><output>0</output>',
    ),
  });
  await expect(page.getByLabel("作品名称")).toHaveValue("外部演示.html");
  await save(page);
  await page.getByRole("button", { name: "编辑源码", exact: true }).click();
  const editor = page.getByLabel("HTML 源码");
  await expect(editor).toContainText("三角形面积");
  await editor.fill(
    (await editor.inputValue())
      .replace("三角形面积", "底为四、高为三")
      .replace("textContent=6", "textContent=12"),
  );
  await save(page);
  await page.reload();
  await page.getByRole("button", { name: "运行预览", exact: true }).click();
  const preview = page
    .frameLocator('iframe[title="作品隔离预览"]')
    .frameLocator("iframe");
  await expect(preview.locator("h1")).toHaveText("底为四、高为三");
  await preview.getByRole("button", { name: "计算" }).click();
  await expect(preview.locator("output")).toHaveText("12");
  const file = await download(page, "html", info.outputPath("external.html"));
  const context = await browser.newContext({ offline: true });
  try {
    const offline = await context.newPage();
    await offline.goto(pathToFileURL(file).href);
    const frame = offline.frameLocator("iframe");
    await frame.getByRole("button", { name: "计算" }).click();
    await expect(frame.locator("output")).toHaveText("12");
  } finally {
    await context.close();
  }
});

test("备课原环节往返、公式中文说明、透明导出与服务重启", async ({
  page,
  browser,
}, info) => {
  world = await createIntegration();
  await register(page, world, "manual-math@example.test");
  await page
    .locator(".wb-sidebar")
    .getByRole("link", { name: "备课", exact: true })
    .click();
  await page.getByRole("button", { name: "新建备课", exact: true }).click();
  await page.getByLabel("课题", { exact: true }).fill("函数性质讨论");
  await page.getByRole("button", { name: "添加环节", exact: true }).click();
  await page.getByLabel("环节名称 1").fill("判别式探究");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.getByLabel("课题", { exact: true }).fill("保留的备课草稿");
  await page
    .locator("[data-section-id]")
    .getByRole("button", { name: "制作数学作品", exact: true })
    .click();
  await page
    .getByRole("button", { name: "新建公式", exact: true })
    .first()
    .click();
  await page.getByLabel("作品名称").fill("判别式与根");
  await page
    .getByLabel("LaTeX", { exact: true })
    .fill("x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}");
  await page
    .getByLabel("中文说明")
    .fill("判别式大于零时，方程有两个不同的实根。");
  const saved = await save(page);
  expect(saved.render.state).toBe("ready");
  const png = await download(page, "png", info.outputPath("formula.png"));
  const { data } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(data.some((v, i) => i % 4 === 3 && v === 0)).toBe(true);
  await download(page, "svg", info.outputPath("formula.svg"));
  await page.getByRole("button", { name: "带回备课", exact: true }).click();
  await expect(page.getByLabel("课题", { exact: true })).toHaveValue(
    "保留的备课草稿",
  );
  await expect(
    page.locator("[data-section-id] [data-reference-id]"),
  ).toHaveCount(1);
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await expect(
    page.locator("[data-section-id] [data-reference-id]"),
  ).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("lesson-return.png") });
  const directory = world.directory;
  const storageState = await page.context().storageState();
  await world.close();
  world = await createIntegration({ directory });
  const context = await browser.newContext({
    storageState,
    ignoreHTTPSErrors: true,
  });
  try {
    const reopened = await context.newPage();
    await reopened.goto(world.origin + `/math?workId=${saved.id}`);
    await expect(reopened.getByLabel("中文说明")).toHaveValue(
      "判别式大于零时，方程有两个不同的实根。",
    );
    await reopened.getByLabel("中文说明").fill("再次修改并保存的中文说明");
    const changed = await save(reopened);
    expect(changed.version).toBe(2);
  } finally {
    await context.close();
  }
});
test("从空白制作拖动点与分步演示，移除全部参数后仍可保存", async ({
  page,
}, info) => {
  world = await createIntegration();
  await register(page, world, "blank-math@example.test");
  await page
    .locator(".wb-sidebar")
    .getByRole("link", { name: "数学工坊", exact: true })
    .click();
  await page
    .getByRole("button", { name: "新建演示", exact: true })
    .first()
    .click();
  await tools(page);
  await expect(page.getByLabel("选择对象").locator("option")).toHaveCount(0);
  await page.getByLabel("作品名称").fill("自己制作的动点");
  await page.getByRole("button", { name: "添加点", exact: true }).click();
  await page.getByLabel("at-y", { exact: true }).fill("2");
  await page.getByLabel("label-text", { exact: true }).fill("横坐标 {t}");
  await section(page, "拖动绑定");
  await page.getByRole("button", { name: "添加拖动", exact: true }).click();
  await expect(page.getByLabel("at-x", { exact: true })).toHaveValue("t");
  await section(page, "步骤");
  await page.getByRole("button", { name: "添加步骤", exact: true }).click();
  await page.getByLabel("步骤 1 标题").fill("起点");
  await page.getByLabel("步骤 1 说明").fill("拖动蓝点观察横坐标");
  await page.getByRole("button", { name: "添加步骤", exact: true }).click();
  await page.getByLabel("步骤 2 t", { exact: true }).fill("3");
  let saved = await save(page);
  expect(saved.render.state).toBe("ready");
  await page
    .locator(".math-dynamic")
    .getByRole("button", { name: "步骤 2", exact: true })
    .click();
  await expect(page.getByLabel("t 数值", { exact: true })).toHaveValue("3");
  await page.getByLabel("t 数值", { exact: true }).fill("4");
  await expect(page.locator(".math-dynamic svg")).toContainText("横坐标 4");
  const dot = page.locator('.math-dynamic [data-object="P1"] circle');
  const box = await dot.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(page.getByLabel("t 数值", { exact: true })).not.toHaveValue("4");
  await page.getByRole("button", { name: "设为初始状态", exact: true }).click();
  saved = await save(page);
  expect(saved.source.initialStepId).toBe(saved.source.steps[1].id);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "移除参数 t", exact: true }).click();
  saved = await save(page);
  expect(saved.source.parameters).toEqual([]);
  expect(saved.source.drags).toEqual([]);
  await page.getByRole("button", { name: "移除步骤 2", exact: true }).click();
  await page.getByRole("button", { name: "移除步骤 1", exact: true }).click();
  saved = await save(page);
  expect(saved.source.initialStepId).toBeNull();
  await page.reload();
  await tools(page);
  await expect(page.getByLabel("选择对象").locator("option")).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("from-blank.png") });
});

test("对象标识冲突保留原点与拖动绑定", async ({ page }) => {
  await start(page);
  await page.getByLabel("选择对象").selectOption("1");
  await page.getByLabel("id", { exact: true }).fill("f");
  await expect(page.getByRole("alert")).toContainText("对象标识已存在");
  await expect(page.getByLabel("id", { exact: true })).toHaveValue("P");
  const saved = await save(page);
  expect(saved.source.drags[0].pointId).toBe("P");
  expect(saved.render.state).toBe("ready");
});
