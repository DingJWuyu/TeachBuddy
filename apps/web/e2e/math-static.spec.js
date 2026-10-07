import { test, expect } from "@playwright/test";
import fs from "node:fs";
import sharp from "sharp";
import { createIntegration } from "../../api/test/fixtures/auth-integration/harness.js";
import { register } from "./fixtures/math-dynamic/helpers.mjs";
import { pathToFileURL } from "node:url";

// Sample the rendered stroke, including its gaps. Attributes alone cannot catch
// a solid face boundary drawn underneath the dashed edge.
async function strokePixels(image, edge) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = Math.min(info.width / 960, info.height / 720);
  const offsetX = (info.width - 960 * scale) / 2;
  const offsetY = (info.height - 720 * scale) / 2;
  const [x1, y1, x2, y2] = edge;
  const length = Math.hypot(x2 - x1, y2 - y1);
  let gaps = 0, ink = 0;
  for (let d = 26; d < length - 26; d += 0.5) {
    const x = offsetX + (x1 + (x2 - x1) * d / length) * scale;
    const y = offsetY + (y1 + (y2 - y1) * d / length) * scale;
    // Include neighbouring pixels so raster antialiasing cannot turn a
    // continuous thin diagonal into false gaps.
    let redOnWhite = 255;
    for (const pixelY of [Math.floor(y), Math.ceil(y)]) for (const pixelX of [Math.floor(x), Math.ceil(x)]) {
      const i = (pixelY * info.width + pixelX) * 4;
      const alpha = data[i + 3] / 255;
      redOnWhite = Math.min(redOnWhite, data[i] * alpha + 255 * (1 - alpha));
    }
    if (redOnWhite > 180) gaps++;
    if (redOnWhite < 100) ink++;
  }
  return { gaps, ink };
}

test("real space edge dash has visible gaps after reopening and PNG SVG export", async ({ page, context }, info) => {
  const world = await createIntegration();
  let passed = false;
  try {
    await register(page, world, "space-edge-regression@example.test");
    await page.getByRole("button", { name: "知道了", exact: true }).click();
    await page.getByRole("navigation", { name: "功能模块", exact: true }).getByRole("link", { name: /^数学工坊/ }).click();
    await page.getByRole("button", { name: "新建空间图形", exact: true }).click();
    await page.getByRole("button", { name: "正方体示例", exact: true }).click();
    await page.getByLabel("作品名称").fill("遮挡棱真实虚线");
    async function saveAndReopen() {
      const response = page.waitForResponse(r => r.url().includes("/api/modules/math/v1/works") && ["POST", "PUT"].includes(r.request().method()));
      await page.getByRole("button", { name: "保存", exact: true }).click();
      const result = await response;
      expect(result.ok(), await result.text()).toBe(true);
      await expect(page.locator(".math-workspace-status")).toHaveText("已保存");
      await page.reload();
      await page.getByRole("button", { name: "图形与标注", exact: true }).click();
    }
    await saveAndReopen();
    await page.getByLabel("图形列表").getByRole("button", { name: "D → A", exact: true }).click();
    await page.getByLabel("style-dash", { exact: true }).selectOption("dashed");
    await saveAndReopen();
    await expect(page.getByLabel("style-dash", { exact: true })).toHaveValue("dashed");
    // Move selection away so an editing highlight cannot mask the real line.
    await page.getByLabel("图形列表").getByRole("button", { name: "A", exact: true }).click();
    const svg = page.locator(".math-graphic-preview svg");
    const path = svg.locator('path[stroke-dasharray="8 5"]').first();
    const edge = (await path.getAttribute("d")).match(/-?\d+(?:\.\d+)?/g).map(Number);
    const canvasFile = info.outputPath("cube-canvas.png");
    await svg.screenshot({ path: canvasFile });
    const samples = { canvas: await strokePixels(canvasFile, edge) };
    const viewer = await context.newPage();
    try {
      for (const format of ["png", "svg", "source"]) {
        if (!await page.locator("#math-export-options").isVisible()) await page.getByRole("button", { name: "下载图片", exact: true }).click();
        await page.getByLabel("导出格式", { exact: true }).selectOption(format);
        const event = page.waitForEvent("download");
        await page.getByRole("button", { name: "下载作品", exact: true }).click();
        const file = info.outputPath(`cube.${format === "source" ? "json" : format}`);
        await (await event).saveAs(file);
        if (format === "source") {
          expect(JSON.parse(fs.readFileSync(file, "utf8")).edges.find(e => e.from === "D" && e.to === "A").style.dash).toBe("dashed");
        } else {
          await viewer.setViewportSize({ width: 1600, height: 1200 });
          await viewer.goto(pathToFileURL(file).href);
          const opened = info.outputPath(`cube-${format}-opened.png`);
          if (format === "svg") await viewer.locator("svg").screenshot({ path: opened });
          else await viewer.locator("img").screenshot({ path: opened });
          samples[format] = await strokePixels(format === "png" ? file : opened, edge);
        }
      }
    } finally { await viewer.close(); }
    fs.writeFileSync(info.outputPath("stroke-pixels.json"), JSON.stringify(samples, null, 2));
    for (const [format, sample] of Object.entries(samples)) {
      expect(sample.ink, `${format} has visible ink`).toBeGreaterThan(20);
      expect(sample.gaps, `${format} has actual gaps, not a solid face outline`).toBeGreaterThan(10);
    }
    // A section owns its boundary even though the solid has explicit edges.
    await page.getByRole("button", { name: "添加图形", exact: true }).click();
    await page.getByRole("menuitem", { name: "添加截面", exact: true }).click();
    await page.getByLabel("section-d", { exact: true }).fill("0.5");
    const styles = page.getByRole("button", { name: "颜色与样式", exact: true });
    if (await styles.getAttribute("aria-expanded") !== "true") await styles.click();
    await page.getByLabel("style-stroke", { exact: true }).fill("#166534");
    await page.getByLabel("style-width", { exact: true }).fill("4");
    await saveAndReopen();
    await expect(page.getByLabel("section-d", { exact: true })).toHaveValue("0.5");
    const section = svg.locator('[data-surface="S1"] polygon:not(.math-graphic-hit)');
    await expect(section).toHaveAttribute("stroke", "#166534");
    await expect(section).toHaveAttribute("stroke-width", "4");
    await svg.screenshot({ path: info.outputPath("cube-section-canvas.png") });
    for (const format of ["png", "svg"]) {
      if (!await page.locator("#math-export-options").isVisible()) await page.getByRole("button", { name: "下载图片", exact: true }).click();
      await page.getByLabel("导出格式", { exact: true }).selectOption(format);
      const event = page.waitForEvent("download");
      await page.getByRole("button", { name: "下载作品", exact: true }).click();
      await (await event).saveAs(info.outputPath(`cube-section.${format}`));
    }
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});

test("real standalone face and partial explicit edge keep selectable styled boundaries", async ({ page }, info) => {
  const world = await createIntegration();
  let passed = false;
  try {
    await register(page, world, "space-face-regression@example.test");
    await page.getByRole("button", { name: "知道了", exact: true }).click();
    await page.getByRole("navigation", { name: "功能模块", exact: true }).getByRole("link", { name: /^数学工坊/ }).click();
    await page.getByRole("button", { name: "新建空间图形", exact: true }).click();
    await page.getByLabel("作品名称").fill("独立面和部分棱");
    async function add(name) {
      await page.getByRole("button", { name: "添加图形", exact: true }).click();
      await page.getByRole("menuitem", { name, exact: true }).click();
    }
    async function save() {
      const response = page.waitForResponse(r => r.url().includes("/api/modules/math/v1/works") && ["POST", "PUT"].includes(r.request().method()));
      await page.getByRole("button", { name: "保存", exact: true }).click();
      const result = await response;
      expect(result.ok(), await result.text()).toBe(true);
      await expect(page.locator(".math-workspace-status")).toHaveText("已保存");
      return result.json();
    }
    await add("添加点");
    await add("添加点"); await page.getByLabel("x", { exact: true }).fill("2");
    await add("添加点"); await page.getByLabel("y", { exact: true }).fill("2");
    await add("添加面");
    await page.getByRole("button", { name: "颜色与样式", exact: true }).click();
    await page.getByLabel("style-stroke", { exact: true }).fill("#166534");
    await page.getByLabel("style-width", { exact: true }).fill("4");
    const work = await save();
    expect(work.source.edges).toEqual([]);
    await page.reload();
    const surface = page.locator('.math-graphic-preview [data-surface="F1"]');
    const polygon = surface.locator("polygon:not(.math-graphic-hit)");
    await expect(polygon).toHaveAttribute("stroke", "#166534");
    await expect(polygon).toHaveAttribute("stroke-width", "4");
    await surface.click();
    await expect(page.getByLabel("面顶点 1", { exact: true })).toHaveValue("P1");
    await page.locator(".math-graphic-preview svg").screenshot({ path: info.outputPath("face-only-canvas.png") });
    await add("添加棱");
    await page.getByLabel("棱起点", { exact: true }).selectOption("P1");
    await page.getByLabel("棱终点", { exact: true }).selectOption("P2");
    await page.getByLabel("style-dash", { exact: true }).selectOption("dashed");
    await save(); await page.reload();
    await expect(polygon).toHaveAttribute("stroke", "none");
    await expect(surface.locator('path:not(.math-graphic-hit)')).toHaveCount(2);
    for (const boundary of await surface.locator('path:not(.math-graphic-hit)').all()) {
      await expect(boundary).toHaveAttribute("stroke", "#166534");
      await expect(boundary).toHaveAttribute("stroke-width", "4");
    }
    await page.locator(".math-graphic-preview svg").screenshot({ path: info.outputPath("partial-face-canvas.png") });
    for (const format of ["png", "svg"]) {
      if (!await page.locator("#math-export-options").isVisible()) await page.getByRole("button", { name: "下载图片", exact: true }).click();
      await page.getByLabel("导出格式", { exact: true }).selectOption(format);
      const event = page.waitForEvent("download");
      await page.getByRole("button", { name: "下载作品", exact: true }).click();
      await (await event).saveAs(info.outputPath(`partial-face.${format}`));
    }
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
test("blank canvas to saved graph, reopen edit and real transparent downloads", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建平面图形" }).first().click();
  const title = `Q2 browser ${Date.now()}`;
  await page.getByLabel("作品名称").fill(title);
  await page.getByRole("button", { name: "添加函数", exact: true }).click();
  await page.getByLabel("expression", { exact: true }).fill("x^2-2*x-3");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.reload();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByLabel("expression", { exact: true })).toHaveValue(
    "x^2-2*x-3",
  );
  await page.getByLabel("expression", { exact: true }).fill("x^2-2*x-2");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  fs.mkdirSync("test-results/m41/browser-output", { recursive: true });
  for (const format of ["png", "svg", "source"]) {
    await page.getByLabel("导出格式").selectOption(format);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载", exact: true }).click();
    const download = await downloaded;
    const target = `test-results/m41/browser-output/Q2.${format === "source" ? "json" : format}`;
    await download.saveAs(target);
    if (format === "png") {
      const { data, info } = await sharp(target)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(1600);
      expect(data.some((v, i) => i % 4 === 3 && v === 0)).toBe(true);
      expect(data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
    }
    if (format === "svg") {
      const svg = fs.readFileSync(target, "utf8");
      expect(svg).toContain("<svg");
      expect(svg.replace(/<style>[\s\S]*?<\/style>/g, "")).not.toMatch(
        /NaN|Infinity/,
      );
    }
    if (format === "source")
      expect(
        JSON.parse(fs.readFileSync(target, "utf8")).scene.elements[0]
          .expression,
      ).toBe("x^2-2*x-2");
  }
  await page.screenshot({
    path: "test-results/m41/browser-output/desktop.png",
  });
  for (const [width, height] of [
    [1024, 768],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/m41/browser-output/${width}.png`,
    });
  }
});
test("space points and edges remain editable after saving", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建空间图形" }).first().click();
  await page.getByRole("button", { name: "正方体起点" }).click();
  await page.getByLabel("作品名称").fill(`Q6 browser ${Date.now()}`);
  await page.getByLabel("azimuth", { exact: true }).fill("45");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.reload();
  await expect(page.getByLabel("azimuth", { exact: true })).toHaveValue("45");
  await page.screenshot({ path: "test-results/m41/browser-output/space.png" });
});

test("lost save response confirms same request without losing newer draft", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建平面图形" }).first().click();
  await page.getByRole("button", { name: "添加函数", exact: true }).click();
  await page.getByLabel("expression", { exact: true }).fill("x^2");
  const title = `unknown ${Date.now()}`;
  await page.getByLabel("作品名称").fill(title);
  let intercepted = false;
  await page.route("**/api/modules/math/v1/works", async (route) => {
    if (route.request().method() !== "POST" || intercepted)
      return route.continue();
    intercepted = true;
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("保存结果待确认");
  await page.getByLabel("expression", { exact: true }).fill("x^2-2");
  await page.getByRole("button", { name: "确认保存结果", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("未保存");
  await expect(page.getByLabel("expression", { exact: true })).toHaveValue(
    "x^2-2",
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("expression", { exact: true })).toHaveValue(
    "x^2-2",
  );
});

test("failed save keeps draft, deletion and export confirm unknown requests", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建平面图形" }).first().click();
  await page.getByRole("button", { name: "添加函数", exact: true }).click();
  const title = `recovery ${Date.now()}`;
  await page.getByLabel("作品名称").fill(title);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.getByLabel("expression", { exact: true }).fill("x^2");
  await page.getByRole("button", { name: "删除作品", exact: true }).click();
  await expect(page.getByLabel("expression", { exact: true })).toHaveValue(
    "x^2",
  );
  await expect(page.getByRole("alert")).toHaveText(
    "请先保存当前修改，再删除作品",
  );
  // Make the source structurally invalid to receive a genuine server 422.
  await page.getByLabel("style-width", { exact: true }).fill("99");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("保存失败");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.getByLabel("style-width", { exact: true })).toHaveValue(
    "99",
  );
  await page.getByLabel("style-width", { exact: true }).fill("2");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  for (const kind of ["exports", "deletion"]) {
    const keys = [];
    let first = true;
    await page.route(
      `**/api/modules/math/v1/works/*/${kind}`,
      async (route) => {
        keys.push(route.request().headers()["idempotency-key"]);
        if (!first) return route.continue();
        first = false;
        await route.fetch();
        await route.abort("failed");
      },
    );
    await page
      .getByRole("button", {
        name: kind === "exports" ? "下载" : "删除作品",
        exact: true,
      })
      .click();
    const confirmation = page.getByRole("button", {
      name: kind === "exports" ? "确认导出结果" : "确认删除结果",
      exact: true,
    });
    await expect(confirmation).toBeVisible();
    if (kind === "exports") {
      const download = page.waitForEvent("download");
      await confirmation.click();
      await download;
    } else {
      await confirmation.click();
      await expect(
        page.getByRole("button", { name: "恢复作品", exact: true }),
      ).toBeVisible();
    }
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  }
});

test("narrow floating point coordinate window stays responsive", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建平面图形" }).first().click();
  await page.getByRole("button", { name: "添加点", exact: true }).click();
  await page.getByText("坐标窗", { exact: true }).click();
  await page.getByLabel("xMin", { exact: true }).fill("999999.9999999999");
  await page.getByLabel("xMax", { exact: true }).fill("1000000");
  await page.getByLabel("yMin", { exact: true }).fill("999999.9999999999");
  await page.getByLabel("yMax", { exact: true }).fill("1000000");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
});

test("double click cannot leave a late export that marks new edits saved", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建平面图形" }).first().click();
  await page.getByRole("button", { name: "添加函数", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  let requests = 0;
  await page.route("**/api/modules/math/v1/works/*/exports", async (route) => {
    requests++;
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ response });
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).dblclick();
  await download;
  await page.getByLabel("expression", { exact: true }).fill("x^2+3");
  await expect(page.getByRole("status")).toHaveText("未保存");
  expect(requests).toBe(1);
});

test("triangle from blank draft has editable vertices and side labels", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建平面图形" }).first().click();
  await page.getByLabel("作品名称").fill(`Q5 triangle ${Date.now()}`);
  await page.getByRole("button", { name: "添加多边形", exact: true }).click();
  await page.getByLabel("points-1-x", { exact: true }).fill("4");
  await page.getByLabel("points-2-y", { exact: true }).fill("3");
  await page.getByRole("button", { name: "添加顶点", exact: true }).click();
  await expect(page.getByLabel("points-3-x", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "移除顶点 4", exact: true }).click();
  for (const [label, x, y, color] of [
    ["4", "2", "-0.3", "#cc2222"],
    ["3", "-0.5", "1.5", "#2855a6"],
    ["A", "-0.3", "-0.3", "#2855a6"],
  ]) {
    await page.getByRole("button", { name: "添加文字", exact: true }).click();
    await page.getByLabel("text", { exact: true }).fill(label);
    await page.getByLabel("at-x", { exact: true }).fill(x);
    await page.getByLabel("at-y", { exact: true }).fill(y);
    await page.getByLabel("style-stroke", { exact: true }).fill(color);
  }
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.reload();
  await page.getByLabel("选择对象").selectOption("1");
  await expect(page.getByLabel("text", { exact: true })).toHaveValue("4");
  await page.getByLabel("导出格式").selectOption("svg");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  const file = await downloaded;
  await file.saveAs("test-results/m41/browser-output/Q5-ui.svg");
  expect(
    fs.readFileSync("test-results/m41/browser-output/Q5-ui.svg", "utf8"),
  ).toContain(">4</tspan>");
  await page.screenshot({
    path: "test-results/m41/browser-output/triangle.png",
  });
});

test("space dimensions, vertex label and AC1 dash reopen; pyramid saves", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page.getByRole("button", { name: "新建空间图形" }).first().click();
  await page.getByRole("button", { name: "正方体起点" }).click();
  for (let i = 0; i < 8; i++) {
    await page.getByLabel("选择对象").selectOption(String(i));
    if ([1, 2, 5, 6].includes(i))
      await page.getByLabel("x", { exact: true }).fill("3");
    if ([2, 3, 6, 7].includes(i))
      await page.getByLabel("y", { exact: true }).fill("3");
    if (i >= 4) await page.getByLabel("z", { exact: true }).fill("3");
  }
  await page.getByLabel("选择对象").selectOption("6");
  await page.getByLabel("label-text", { exact: true }).fill("C′");
  await page.getByLabel("azimuth", { exact: true }).fill("-30");
  await page.getByRole("button", { name: "添加棱", exact: true }).click();
  await page.getByText("棱", { exact: true }).click();
  await page.getByLabel("edge-12-id", { exact: true }).fill("AC1");
  await page.getByLabel("edge-12-to", { exact: true }).fill("C1");
  await page
    .getByLabel("edge-12-style-dash", { exact: true })
    .selectOption("dashed");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.reload();
  await page.getByLabel("选择对象").selectOption("6");
  await expect(page.getByLabel("z", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("label-text", { exact: true })).toHaveValue(
    "C′",
  );
  await page.getByText("棱", { exact: true }).click();
  await expect(
    page.getByLabel("edge-12-style-dash", { exact: true }),
  ).toHaveValue("dashed");
  await page.getByRole("button", { name: "新建空间图形" }).first().click();
  await page.getByRole("button", { name: "棱锥起点", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.reload();
  await expect(page.getByLabel("选择对象").locator("option")).toHaveCount(5);
  await page.screenshot({
    path: "test-results/m41/browser-output/pyramid.png",
  });
});
test("reciprocal and square root keep undefined domains open and interval annotations editable", async ({
  page,
}) => {
  await page.goto("/fixture/session");
  await page
    .getByRole("button", { name: "新建平面图形", exact: true })
    .first()
    .click();
  await page.getByLabel("作品名称").fill(`定义域与单调标注 ${Date.now()}`);
  await page.getByRole("button", { name: "添加函数", exact: true }).click();
  await page.getByLabel("expression", { exact: true }).fill("1/x");
  await page.getByRole("button", { name: "添加函数", exact: true }).click();
  await page.getByLabel("expression", { exact: true }).fill("sqrt(x)");
  await page.getByLabel("style-stroke", { exact: true }).fill("#cc2222");
  await page.getByRole("button", { name: "添加线段", exact: true }).click();
  for (const [field, value] of [
    ["from-x", "1"],
    ["from-y", "-2"],
    ["to-x", "4"],
    ["to-y", "-2"],
  ])
    await page.getByLabel(field, { exact: true }).fill(value);
  await page.getByLabel("arrow", { exact: true }).selectOption("end");
  await page.getByRole("button", { name: "添加文字", exact: true }).click();
  await page.getByLabel("text", { exact: true }).fill("sqrt(x) 递增");
  await page.getByLabel("at-x", { exact: true }).fill("2");
  await page.getByLabel("at-y", { exact: true }).fill("-3");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("已保存");
  await page.reload();
  await page.getByLabel("选择对象").selectOption("1");
  await expect(page.getByLabel("expression", { exact: true })).toHaveValue(
    "sqrt(x)",
  );
  await page.getByLabel("导出格式").selectOption("svg");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  const file = await event;
  const target = "test-results/m41/browser-output/domains.svg";
  await file.saveAs(target);
  const svg = fs
    .readFileSync(target, "utf8")
    .replace(/<style>[\s\S]*?<\/style>/g, "");
  expect(svg).not.toMatch(/NaN|Infinity/);
  const paths = (id) =>
    [
      ...svg
        .match(new RegExp(`data-object="${id}">([\\s\\S]*?)<\\/g>`))[1]
        .matchAll(/d="([ML][^"]+)"/g),
    ].map((match) =>
      [...match[1].matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((p) => [
        Number(p[1]),
        Number(p[2]),
      ]),
    );
  expect(paths("f1").length).toBeGreaterThanOrEqual(2);
  expect(
    paths("f1").every(
      (points) =>
        points.every((p) => p[0] <= 480) || points.every((p) => p[0] >= 480),
    ),
  ).toBe(true);
  expect(
    paths("f2")
      .flat()
      .every((p) => p[0] >= 480 && p[1] <= 360),
  ).toBe(true);
  expect(svg).toContain("sqrt(x) 递增");
  await page.screenshot({
    path: "test-results/m41/browser-output/domains.png",
  });
});
