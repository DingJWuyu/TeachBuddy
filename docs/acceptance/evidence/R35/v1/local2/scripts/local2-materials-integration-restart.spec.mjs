import { test, expect } from "/tmp/teacher-r35-local2-candidate/node_modules/@playwright/test/index.mjs";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("/tmp/teacher-r35-local2-e2e/integration");
const evidence = path.resolve("/home/liam_t/项目/TeacherWorkspace-r35-local-recheck/docs/acceptance/evidence/R35/v1/local2/e2e");

test("独立普通进程重启保持同一origin、未知上传原键和新浏览器持久数据", async ({
  page,
  browser,
}) => {
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, "process-"));
  const origin = "https://127.0.0.1:49937";
  let child;
  async function start() {
    child = spawn(
      process.execPath,
      ["apps/web/e2e/fixtures/materials-integration/server.mjs"],
      {
        env: {
          ...process.env,
          NODE_ENV: "test",
          R34_PORT: "49937",
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
    await page
      .locator(".wb-sidebar")
      .getByRole("link", { name: "资源库", exact: true })
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
      .setInputFiles("apps/web/e2e/fixtures/materials/samples/c22.pdf");
    await expect(
      page.getByRole("button", { name: "重试确认原请求", exact: true }),
    ).toBeVisible();
    await page.unroute("**/api/workbench/files");
    const before = child.pid;
    await stop();
    await start();
    expect(child.pid).not.toBe(before);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "重试确认原请求", exact: true }),
    ).toBeVisible();
    const retried = page.waitForRequest(
      (r) => r.url().endsWith("/api/workbench/files") && r.method() === "POST",
    );
    await page.getByRole("button", { name: "重试确认原请求", exact: true }).click();
    expect((await retried).headers()["idempotency-key"]).toBe(key);
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
  } finally {
    await stop();
  }
});
