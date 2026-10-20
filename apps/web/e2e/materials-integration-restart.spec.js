import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const evidence = path.resolve(process.env.MATERIALS_INTEGRATION_EVIDENCE_DIR ?? "test-results/materials-integration/evidence");

test("独立普通进程重启保持同一origin、未知上传原键和新浏览器持久数据", async ({
  page,
  browser,
}) => {
  fs.mkdirSync(evidence, { recursive: true });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "materials-process-"));
  const origin = "https://127.0.0.1:48437";
  let child;
  let passed = false;
  async function start() {
    child = spawn(
      process.execPath,
      ["apps/api/test/fixtures/materials/integration.mjs"],
      {
        env: {
          ...process.env,
          NODE_ENV: "test",
          R34_PORT: "48437",
          R34_DATA_DIR: directory,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("server startup timeout")),
        15000,
      );
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error("server exit " + code));
      });
      child.stdout.on("data", (data) => {
        output += data;
        fs.appendFileSync(path.join(directory, "process.log"), data);
        if (output.includes("R34 real-auth")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.stderr.on("data", (data) =>
        fs.appendFileSync(path.join(directory, "process.log"), data),
      );
    });
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const old = child;
    await new Promise((resolve) => {
      old.once("exit", resolve);
      old.kill("SIGTERM");
    });
    child = null;
  }
  try {
    await start();
    await page.goto(origin);
    await page.getByRole("button", { name: "创建账户" }).click();
    await page.getByLabel("昵称", { exact: true }).fill("重启老师");
    await page.getByLabel("邮箱", { exact: true }).fill("restart@example.test");
    await page.getByLabel("密码", { exact: true }).fill("restart-password");
    await page.getByLabel("确认密码", { exact: true }).fill("restart-password");
    await page.getByRole("button", { name: "发送验证码" }).click();
    await expect
      .poll(() => fs.existsSync(path.join(directory, "mail.json")))
      .toBe(true);
    await page
      .getByLabel("邮箱验证码")
      .fill(
        JSON.parse(fs.readFileSync(path.join(directory, "mail.json")))
          .verificationCode,
      );
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "注册", exact: true }).click();
    await expect(page.locator(".wb-shell")).toBeVisible();
    const coach = page.getByRole("button", { name: "知道了", exact: true });
  if (await coach.count()) await coach.click();
    await page
      .getByRole("navigation", { name: "功能模块" })
      .getByRole("link", { name: /^资源库/ })
      .click();
    let key;
    await page.route("**/api/workbench/files", async (route) => {
      if (route.request().method() === "POST") {
        key = route.request().headers()["idempotency-key"];
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await page
      .getByLabel("上传资料", { exact: true })
      .setInputFiles("test/fixtures/materials/c22.pdf");
    await expect(
      page.getByRole("button", { name: "重试确认原请求", exact: true }),
    ).toBeVisible();
    await page.unroute("**/api/workbench/files");
    const before = child.pid;
    await stop();
    await start();
    expect(child.pid).not.toBe(before);
    await page.reload();
    await expect(page.getByLabel("重新选择原文件", { exact: true })).toBeVisible();
    const retried = page.waitForRequest(
      (r) => r.url().endsWith("/api/workbench/files") && r.method() === "POST",
    );
    await page.getByLabel("重新选择原文件", { exact: true }).setInputFiles("test/fixtures/materials/c22.pdf");
    expect((await retried).headers()["idempotency-key"]).toBe(key);
    await expect(page.locator(".tbx-res-main")).toHaveAttribute("aria-busy", "false");
    await page.locator(".tbx-res-open").filter({ hasText: "c22.pdf" }).click();
    await expect(page.getByLabel("资源名称")).toHaveValue("c22.pdf");
    await expect(page.getByAltText("第 1 页", { exact: true })).toBeVisible({
      timeout: 60000,
    });
    await page.screenshot({
      animations: "disabled",
      path: path.join(evidence, "process-upload-recovered.png"),
    });
    const state = await page.context().storageState();
    const fresh = await browser.newContext({
      storageState: { cookies: state.cookies, origins: [] },
      ignoreHTTPSErrors: true,
    });
    const next = await fresh.newPage();
    await next.goto(origin + "/resources");
    await expect(
      next.getByRole("button", { name: /c22.pdf/ }).first(),
    ).toBeVisible();
    await fresh.close();
    fs.writeFileSync(
      path.join(evidence, "process-restart.json"),
      JSON.stringify(
        {
          directory,
          origin,
          pids: [before, child.pid],
          unknownUpload: "same-key restored",
          freshBrowser: "server data readable",
        },
        null,
        2,
      ),
    );
    passed = true;
  } finally {
    await stop();
    if (passed) fs.rmSync(directory, { recursive: true, force: true });
    else console.error(`材料进程重启失败现场保留：${directory}`);
  }
});
