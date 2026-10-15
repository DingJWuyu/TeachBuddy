import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test, expect, chromium } from "@playwright/test";
import { startRealMath } from "../../api/test/fixtures/math-real.mjs";
import {
  register,
  save,
  download,
  evidence,
} from "./fixtures/math-dynamic/helpers.mjs";

test("M-D edit, step consistency, pointer/keyboard, persistence and cold isolated download", async ({
  page,
  browser,
}) => {
  let world = await startRealMath();
  const directory = world.directory;
  let passed = false;
  try {
    await register(page, world, "m42-dynamic@example.test");
    await page
      .getByRole("button", { name: "新建演示", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "二次函数起点", exact: true })
      .click();
    await page.getByLabel("作品名称").fill("参数函数探究");
    await page.getByLabel("parameter-0-min", { exact: true }).fill("-2");
    await page.getByLabel("parameter-0-max", { exact: true }).fill("2");
    await page.getByLabel("parameter-0-step", { exact: true }).fill("1");
    await page.getByRole("button", { name: "应用参数 1", exact: true }).click();
    expect((await save(page)).version).toBe(1);
    await page.getByLabel("parameter-0-min", { exact: true }).fill("-3");
    await page.getByLabel("parameter-0-max", { exact: true }).fill("3");
    await page.getByLabel("parameter-0-initial", { exact: true }).fill("0.5");
    await page.getByLabel("parameter-0-step", { exact: true }).fill("0.5");
    await page.getByRole("button", { name: "应用参数 1", exact: true }).click();
    await page.getByText("步骤", { exact: true }).click();
    await page.getByLabel("步骤 2 标题").fill("平移与定位");
    await page.getByLabel("初始步骤").selectOption("translate");
    await page
      .getByLabel("步骤 1 标题")
      .locator("..")
      .locator("..")
      .getByLabel("P", { exact: true })
      .uncheck();
    await page.getByRole("button", { name: "上移步骤 3", exact: true }).click();
    await page.getByText("拖动绑定", { exact: true }).click();
    await page.getByLabel("拖动 1 y", { exact: true }).selectOption("");
    await expect(page.locator(".math-dynamic svg")).toBeVisible();
    await expect(page.locator(".math-dynamic svg")).toContainText(
      "定位点 (1,-4)",
    );
    const first = await save(page);
    expect(first.version).toBe(2);
    expect(first.source.parameters[0]).toMatchObject({
      min: -3,
      max: 3,
      step: 0.5,
      initial: 0.5,
    });
    expect(first.source.drags[0].yParameter).toBeNull();
    expect(first.source.steps.map((s) => s.id)).toEqual([
      "base",
      "full",
      "translate",
    ]);
    expect(first.source.steps[0].visibleIds).toEqual(["f"]);
    expect(first.render.state).toBe("ready");
    expect(first.render.presentationFileId).toBeTruthy();
    await page
      .getByRole("button", { name: "带系数完整式", exact: true })
      .click();
    await expect(page.locator(".math-dynamic svg")).toContainText(
      "y=-2(x-(0))²+(1)",
    );
    const points = await page
      .locator('.math-dynamic [data-object="f"] path')
      .evaluateAll((paths) =>
        paths.flatMap((p) =>
          [...p.getAttribute("d").matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(
            (m) => [Number(m[1]), Number(m[2])],
          ),
        ),
      );
    // Independent viewport arithmetic: equal scale min(892/12,652/10)=65.2; (0,1)->(480,294.8), (1,-1)->(545.2,425.2).
    expect(
      points.some(
        ([x, y]) => Math.abs(x - 480) < 0.01 && Math.abs(y - 294.8) < 0.01,
      ),
    ).toBe(true);
    expect(
      points.some(
        ([x, y]) => Math.abs(x - 545.2) < 3 && Math.abs(y - 425.2) < 12,
      ),
    ).toBe(true);
    await page.getByLabel("a 数值", { exact: true }).fill("0");
    await expect(page.locator(".math-dynamic svg")).toContainText(
      "y=0(x-(0))²+(1)",
    );
    await page.getByLabel("a 滑杆", { exact: true }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByLabel("a 数值", { exact: true })).toHaveValue(
      "-0.5",
    );
    const dot = page.locator('.math-dynamic [data-object="P"] circle');
    const box = await dot.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y - 40, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByLabel("h 数值", { exact: true })).not.toHaveValue(
      "0",
    );
    await page.getByRole("button", { name: "重置", exact: true }).click();
    await expect(page.getByLabel("h 数值", { exact: true })).toHaveValue("0");
    await page.screenshot({ path: path.join(evidence, "dynamic-desktop.png") });
    for (const [width, height] of [
      [1024, 768],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: path.join(evidence, `dynamic-${width}.png`),
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await world.close();
    world = await startRealMath({ directory });
    await page.goto(world.origin);
    await page.getByRole("button", { name: /参数函数探究.*v2/ }).click();
    await expect(
      page.getByRole("button", { name: "平移与定位", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("parameter-0-initial", { exact: true }),
    ).toHaveValue("0.5");
    await page.getByText("拖动绑定", { exact: true }).click();
    await expect(page.getByLabel("拖动 1 y", { exact: true })).toHaveValue("");
    const file = await download(page, "html", "dynamic.html");
    await world.close();
    world = null;
    const coldBrowser = await chromium.launch();
    const cold = await coldBrowser.newContext({ offline: true });
    const viewer = await cold.newPage();
    await viewer.goto(pathToFileURL(file).href);
    const frame = viewer.frameLocator("iframe");
    await expect(frame.locator("svg")).toBeVisible();
    await expect(frame.locator("svg")).toContainText("定位点 (1,-4)");
    await frame.getByRole("button", { name: "带系数完整式" }).click();
    await frame.getByLabel("a 数值", { exact: true }).fill("-2");
    await expect(frame.locator("svg")).toContainText("y=-2(x-(0))²+(1)");
    await frame.getByLabel("a 滑杆", { exact: true }).focus();
    await viewer.keyboard.press("Home");
    await expect(frame.getByLabel("a 数值", { exact: true })).toHaveValue("-3");
    await viewer.keyboard.press("End");
    await expect(frame.getByLabel("a 数值", { exact: true })).toHaveValue("3");
    await frame.getByLabel("a 数值", { exact: true }).fill("0");
    await expect(frame.locator("svg")).toContainText("y=0");
    const coldDot = await frame
      .locator('[data-object="P"] circle')
      .boundingBox();
    await viewer.mouse.move(
      coldDot.x + coldDot.width / 2,
      coldDot.y + coldDot.height / 2,
    );
    await viewer.mouse.down();
    await viewer.mouse.move(coldDot.x + 80, coldDot.y - 40, { steps: 8 });
    await viewer.mouse.up();
    await expect(frame.getByLabel("h 数值", { exact: true })).not.toHaveValue(
      "0",
    );
    await frame.getByRole("button", { name: "重置", exact: true }).click();
    await expect(frame.getByLabel("a 数值", { exact: true })).toHaveValue("-2");
    await viewer.screenshot({
      path: path.join(evidence, "dynamic-offline.png"),
    });
    await cold.close();
    await coldBrowser.close();
    fs.writeFileSync(
      path.join(evidence, "dynamic.json"),
      JSON.stringify(first, null, 2),
    );
    passed = true;
  } finally {
    if (world) await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("scientific numeric tokens remain valid beside an e3 parameter", async ({
  page,
}) => {
  const world = await startRealMath();
  let passed = false;
  try {
    await register(page, world, "m42-scientific@example.test");
    await page
      .getByRole("button", { name: "新建演示", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "二次函数起点", exact: true })
      .click();
    await page.getByLabel("parameter-0-name", { exact: true }).fill("e3");
    await page.getByRole("button", { name: "应用参数 1", exact: true }).click();
    await page.getByText("步骤", { exact: true }).click();
    for (let i = 3; i >= 1; i--)
      await page
        .getByRole("button", { name: `移除步骤 ${i}`, exact: true })
        .click();
    await page.getByLabel("选择对象").selectOption("0");
    await page.getByLabel("expression", { exact: true }).fill("1e3*x+e3");
    await expect(page.locator('.math-dynamic [data-object="f"]')).toBeVisible();
    await page.getByLabel("parameter-0-name", { exact: true }).fill("b");
    await page.getByRole("button", { name: "应用参数 1", exact: true }).click();
    await expect(page.getByLabel("expression", { exact: true })).toHaveValue(
      "1e3*x+b",
    );
    const result = await save(page);
    expect(result.render.state).toBe("ready");
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
