import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test, expect, chromium } from "@playwright/test";
import { startRealMath } from "./fixtures/math-static/real.mjs";
import {
  register,
  save,
  download,
  evidence,
} from "./fixtures/math-dynamic/helpers.mjs";
const fixture = path.resolve(
  "apps/web/e2e/fixtures/math-dynamic/mx-model-revised.html",
);
async function importFile(page, file) {
  await page.getByLabel("导入 HTML 文件").setInputFiles(file);
  await expect(
    page.getByRole("button", { name: "运行预览", exact: true }),
  ).toBeEnabled();
}
const inner = (page) =>
  page
    .frameLocator('iframe[title="作品隔离预览"]')
    .frameLocator('iframe[title="隔离作品"]');
test("exact C23 import, source edits, immutable original, restart and cold download", async ({
  page,
  browser,
}) => {
  let world = await startRealMath();
  const directory = world.directory;
  let passed = false;
  try {
    await register(page, world, "m42-html@example.test");
    await importFile(page, fixture);
    await expect(page.locator("iframe")).toHaveCount(0);
    const original = await save(page);
    expect(original.render.state).toBe("source-only");
    await page.getByRole("button", { name: "编辑源码", exact: true }).click();
    const text = await page.getByLabel("HTML 源码").inputValue();
    expect(Buffer.from(text)).toEqual(fs.readFileSync(fixture));
    const edited = text
      .replace(/正比例函数斜率探究/g, "课堂修改标题")
      .replace('min="-8"', 'min="-10"')
      .replace("（-8 到 8", "（-10 到 8");
    expect(edited).toContain('min="-10"');
    await page.getByLabel("HTML 源码").fill(edited);
    await page.getByLabel("作品名称").fill("外部作品目录名");
    const updated = await save(page);
    expect(updated.originalFileId).toBe(original.originalFileId);
    expect(updated.source.fileId).not.toBe(original.source.fileId);
    await world.close();
    world = await startRealMath({ directory });
    await page.goto(world.origin);
    await page.getByRole("button", { name: /外部作品目录名.*v2/ }).click();
    await page.getByRole("button", { name: "编辑源码", exact: true }).click();
    await expect(page.getByLabel("HTML 源码")).toHaveValue(edited);
    await expect(page.getByText("参数", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "运行预览", exact: true }).click();
    await expect(inner(page).locator("svg,canvas").first()).toBeVisible();
    await expect(inner(page).locator("#k")).toHaveAttribute("min", "-10");
    await page.screenshot({ path: path.join(evidence, "html-preview.png") });
    const originalEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "取回原文件" }).click();
    const originalDownload = await originalEvent;
    const originalPath = path.join(evidence, "original.html");
    await originalDownload.saveAs(originalPath);
    expect(fs.readFileSync(originalPath)).toEqual(fs.readFileSync(fixture));
    const current = await download(page, "source", "modified.html");
    expect(fs.readFileSync(current, "utf8")).toBe(edited);
    const isolated = await download(page, "html", "external-isolated.html");
    const copyResponse = page.waitForResponse((r) => r.url().endsWith("/copy"));
    await page.getByRole("button", { name: "另存作品", exact: true }).click();
    const copy = await (await copyResponse).json();
    expect(copy.id).not.toBe(updated.id);
    expect(copy.originalFileId).toBe(original.originalFileId);
    await expect(
      page.getByRole("status").filter({ hasText: "已保存" }),
    ).toBeVisible();
    await world.close();
    world = null;
    const coldBrowser = await chromium.launch();
    const cold = await coldBrowser.newContext({ offline: true });
    const viewer = await cold.newPage();
    await viewer.goto(pathToFileURL(isolated).href);
    await expect(
      viewer.frameLocator("iframe").locator("svg,canvas").first(),
    ).toBeVisible();
    const slider = viewer.frameLocator("iframe").getByLabel("正比例函数系数 k");
    await slider.focus();
    await viewer.keyboard.press("Home");
    await expect(viewer.frameLocator("iframe").locator("#eq")).toHaveText(
      "y = -10x",
    );
    for (let i = 0; i < 10; i++) await viewer.keyboard.press("ArrowRight");
    await expect(viewer.frameLocator("iframe").locator("#eq")).toHaveText(
      "y = 0x",
    );
    await viewer.keyboard.press("End");
    await expect(viewer.frameLocator("iframe").locator("#eq")).toHaveText(
      "y = 8x",
    );
    await viewer.screenshot({
      path: path.join(evidence, "external-offline.png"),
    });
    await cold.close();
    await coldBrowser.close();
    fs.writeFileSync(
      path.join(evidence, "html.json"),
      JSON.stringify({ original, updated }, null, 2),
    );
    passed = true;
  } finally {
    if (world) await world.close();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("hostile HTML cannot read identity or write business; CSP blocks resources and navigation destroys preview", async ({
  page,
}) => {
  const world = await startRealMath();
  let passed = false;
  const requests = [],
    failed = [],
    errors = [];
  page.on("request", (r) => {
    if (r.url().includes("m42-external.invalid")) requests.push(r.url());
  });
  page.on("requestfailed", (r) => {
    if (r.url().includes("m42-external.invalid"))
      failed.push({ url: r.url(), failure: r.failure() });
  });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const hostile = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline'"><base href="https://m42-external.invalid/"><meta http-equiv="refresh" content="0;url=https://m42-external.invalid/meta"><a href="https://m42-external.invalid/link">link</a><pre id="results"></pre><button id="navigate" onclick="location.href='about:blank'">自导航</button><button id="network" onclick="document.querySelector('form').requestSubmit();window.open('https://m42-external.invalid/popup');try{top.location='https://m42-external.invalid/top'}catch{}">受限请求</button><form action="https://m42-external.invalid/form"><input name="secret" value="none"></form><script>
const result={};for(const [key,read] of Object.entries({parent:()=>parent.document.body.innerText,cookie:()=>document.cookie,storage:()=>localStorage.length,page:()=>parent.sessionStorage.length})) {try{result[key]=read()}catch(e){result[key]='blocked'}}
parent.postMessage({type:'saveWork',title:'HOSTILE',accountKey:'fake'},'*');
fetch('https://m42-external.invalid/fetch').catch(()=>{});try{new WebSocket('wss://m42-external.invalid/socket')}catch{};try{new Worker('https://m42-external.invalid/worker')}catch{};
document.querySelector('#results').textContent=JSON.stringify(result);
</script><script src="https://m42-external.invalid/script"></script><img src="https://m42-external.invalid/img"><iframe src="https://m42-external.invalid/frame"></iframe>`;
  try {
    await register(page, world, "m42-isolation@example.test");
    await importFile(page, {
      name: "hostile.html",
      mimeType: "text/html",
      buffer: Buffer.from(hostile),
    });
    const work = await save(page);
    const writes = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/modules/math") && r.method() !== "GET")
        writes.push(r.url());
    });
    await page.getByRole("button", { name: "运行预览", exact: true }).click();
    await expect(inner(page).locator("#results")).toHaveText(
      JSON.stringify({
        parent: "blocked",
        cookie: "blocked",
        storage: "blocked",
        page: "blocked",
      }),
    );
    await expect(inner(page).locator("a")).not.toHaveAttribute("href", /./);
    await inner(page).getByRole("button", { name: "受限请求" }).click();
    expect(writes).toEqual([]);
    await page.screenshot({ path: path.join(evidence, "isolation.png") });
    await inner(page).getByRole("button", { name: "自导航" }).click();
    await expect(
      page.frameLocator('iframe[title="作品隔离预览"]').getByRole("status"),
    ).toContainText("预览已停止");
    await expect(
      page.frameLocator('iframe[title="作品隔离预览"]').locator("iframe"),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "停止预览", exact: true }).click();
    await page.getByRole("button", { name: "运行预览", exact: true }).click();
    await expect(inner(page).locator("#results")).toBeVisible();
    world.clock.advance(8 * 86400000);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "登录", exact: true }),
    ).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.getByLabel("HTML 源码")).toHaveCount(0);
    expect(errors.some((x) => x.includes("Content Security Policy"))).toBe(
      true,
    );
    fs.writeFileSync(
      path.join(evidence, "isolation.json"),
      JSON.stringify(
        { requests, failed, errors, writes, workId: work.id },
        null,
        2,
      ),
    );
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});

test("restricted bytes and broken scripts remain recoverable; unknown source save confirms once", async ({
  page,
}) => {
  const world = await startRealMath();
  let passed = false;
  try {
    await register(page, world, "m42-recovery@example.test");
    let firstUpload = true;
    const uploadKeys = [];
    await page.route("**/api/workbench/files", async (route) => {
      uploadKeys.push(route.request().headers()["idempotency-key"]);
      const response = await route.fetch();
      if (firstUpload) {
        firstUpload = false;
        return route.abort();
      }
      await route.fulfill({ response });
    });
    await page.getByLabel("导入 HTML 文件").setInputFiles(fixture);
    await expect(
      page.getByRole("button", { name: "重试原文件上传" }),
    ).toBeEnabled();
    await page.reload();
    await page.getByRole("button", { name: "重试原文件上传" }).click();
    await expect(
      page.getByRole("button", { name: "运行预览", exact: true }),
    ).toBeEnabled();
    expect(uploadKeys).toHaveLength(2);
    expect(uploadKeys[0]).toBe(uploadKeys[1]);
    await save(page);
    await page.unroute("**/api/workbench/files");
    for (const [name, buffer] of [
      ["large.html", Buffer.alloc(1024 * 1024 + 1, 65)],
      ["encoding.html", Buffer.from([255, 254, 253])],
    ]) {
      await page
        .getByLabel("导入 HTML 文件")
        .setInputFiles({ name, mimeType: "application/octet-stream", buffer });
      await expect(
        page.getByText(/无法编辑或运行；可以取回原件/),
      ).toBeVisible();
      await save(page);
      await expect(
        page.getByRole("button", { name: "运行预览", exact: true }),
      ).toBeDisabled();
      const event = page.waitForEvent("download");
      await page.getByRole("button", { name: "取回原文件" }).click();
      const file = await event;
      const output = path.join(evidence, name);
      await file.saveAs(output);
      expect(fs.readFileSync(output)).toEqual(buffer);
    }
    const source =
      '<!doctype html><h1>损坏脚本</h1><script src="https://m42-external.invalid/cdn.js"></script><script>throw new Error("broken-script")</script><p>原件保留</p>';
    await importFile(page, {
      name: "broken.html",
      mimeType: "text/html",
      buffer: Buffer.from(source),
    });
    await save(page);
    await page.getByRole("button", { name: "运行预览", exact: true }).click();
    await expect(
      page.frameLocator('iframe[title="作品隔离预览"]').getByRole("status"),
    ).toContainText("执行失败或依赖受限");
    await page.getByRole("button", { name: "停止预览", exact: true }).click();
    await page.getByRole("button", { name: "编辑源码", exact: true }).click();
    await page
      .getByLabel("HTML 源码")
      .fill(source.replace("损坏脚本", "修订源码"));
    let lost = true;
    const requests = [];
    await page.route("**/api/modules/math/v1/works/*", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      requests.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postDataJSON(),
      });
      const response = await route.fetch();
      if (lost) {
        lost = false;
        return route.abort();
      }
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "保存结果待确认" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "确认保存结果", exact: true }),
    ).toBeVisible();
    const saved = await save(page);
    expect(saved.version).toBe(2);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual(requests[1]);
    await page.getByRole("button", { name: "编辑源码", exact: true }).click();
    await expect(page.getByLabel("HTML 源码")).toHaveValue(
      source.replace("损坏脚本", "修订源码"),
    );
    await page.screenshot({ path: path.join(evidence, "html-recovery.png") });
    fs.writeFileSync(
      path.join(evidence, "recovery.json"),
      JSON.stringify({ requests, version: saved.version }, null, 2),
    );
    passed = true;
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});

test("first source edit requires original save and preserves original bytes", async ({
  page,
}) => {
  const world = await startRealMath();
  let passed = false;
  try {
    await register(page, world, "m42-first-edit@example.test");
    await importFile(page, fixture);
    await expect(
      page.getByRole("button", { name: "编辑源码", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("原件已上传，保存作品后可修改源码。"),
    ).toBeVisible();
    await save(page);
    await page.getByRole("button", { name: "编辑源码", exact: true }).click();
    const original = fs.readFileSync(fixture, "utf8");
    await page
      .getByLabel("HTML 源码")
      .fill(original.replace(/正比例函数斜率探究/g, "首次修改"));
    const work = await save(page);
    expect(work.originalFileId).not.toBe(work.source.fileId);
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name: "取回原文件" }).click();
    const downloaded = await event;
    const file = path.join(evidence, "first-edit-original.html");
    await downloaded.saveAs(file);
    expect(fs.readFileSync(file, "utf8")).toBe(original);
    passed = true;
  } finally {
    await world.close();
    if (passed) fs.rmSync(world.directory, { recursive: true, force: true });
  }
});
