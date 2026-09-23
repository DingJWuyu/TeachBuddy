import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import {
  backup,
  restore,
  activate,
} from "../../../api/src/workbench/reliability/backup.js";
import { createIntegration } from "../../../api/test/fixtures/auth-integration/harness.js";
let world;
test.afterEach(async ({ context }) => {
  await context.close();
  await world?.close();
});
test("个人资料入口、导出与最近删除", async ({ page }) => {
  world = await createIntegration({
    directory: fs.mkdtempSync(path.resolve(".tmp-md/run-")),
  });
  await page.goto(world.origin);
  await page.getByRole("button", { name: "创建账户" }).click();
  await page.getByLabel("昵称", { exact: true }).fill("资料老师");
  await page
    .getByLabel("邮箱", { exact: true })
    .fill("manual-data@example.test");
  await page.getByLabel("密码", { exact: true }).fill("Manual-data-123");
  await page.getByLabel("确认密码", { exact: true }).fill("Manual-data-123");
  await page.getByRole("button", { name: "发送验证码" }).click();
  await expect
    .poll(() =>
      world.mailer.lastCode("registration", "manual-data@example.test"),
    )
    .toBeTruthy();
  await page
    .getByLabel("邮箱验证码")
    .fill(world.mailer.lastCode("registration", "manual-data@example.test"));
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.locator(".wb-shell")).toBeVisible();
  await page
    .locator(".wb-sidebar")
    .getByRole("link", { name: "题库", exact: true })
    .click();
  await page.getByRole("button", { name: "自建", exact: true }).click();
  await page.getByLabel("题目标题", { exact: true }).fill("需要恢复的函数题");
  await page.getByRole("button", { name: "段落", exact: true }).first().click();
  await page
    .locator(".q-question textarea")
    .first()
    .fill("求函数 f(x)=x² 的最小值。");
  await page.getByRole("button", { name: "保存题目", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "删除题目", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "删除题目", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "恢复题目", exact: true }),
  ).toBeVisible();
  await page
    .locator(".wb-sidebar")
    .getByRole("link", { name: "设置", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "导出个人资料", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "已删除资料" })).toContainText(
    "需要恢复的函数题",
  );
  await page.reload();
  await page
    .getByRole("list", { name: "已删除资料" })
    .getByRole("button", { name: "恢复", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("已恢复");
  let lost = false;
  await page.route("**/api/reliability/v1/exports", async (route) => {
    if (route.request().method() === "POST" && !lost) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "导出个人资料", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重试确认操作", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "重试确认操作", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "重试确认操作", exact: true }),
  ).toHaveCount(0);
  expect(
    world.workbench.db
      .prepare("SELECT count(*) n FROM reliability_exports")
      .get().n,
  ).toBe(1);
  await expect(
    page.getByRole("button", { name: "下载资料包", exact: true }),
  ).toBeVisible();
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载资料包", exact: true }).click();
  const download = await waiting;
  const archive = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  const manifest = JSON.parse(
    await archive.file("manifest.json").async("string"),
  );
  expect(
    manifest.objects.some(
      (o) => o.key.kind === "question" && o.state === "active",
    ),
  ).toBeTruthy();
  const index = await archive.file("index.html").async("string");
  expect(index).toContain("需要恢复的函数题");
  expect(index).not.toContain("<script");
  const offlineDirectory=path.join(world.directory,'offline-personal');
  for(const entry of Object.values(archive.files))if(!entry.dir){const target=path.join(offlineDirectory,entry.name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,await entry.async('nodebuffer'));}
  const offline=await page.context().newPage();
  await offline.goto(pathToFileURL(path.join(offlineDirectory,'index.html')).href);
  await offline.getByRole('link',{name:'需要恢复的函数题',exact:true}).click();
  await expect(offline.getByText('求函数 f(x)=x² 的最小值。',{exact:true})).toBeVisible();
  await offline.close();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "下载资料包", exact: true }),
  ).toBeVisible();
  const evidence = path.resolve(
    process.env.MANUAL_DATA_EVIDENCE_DIR || "test-results/manual-data/evidence",
  );
  fs.mkdirSync(evidence, { recursive: true });
  await page.screenshot({
    path: path.join(evidence, "data-settings.png"),
    animations: "disabled",
  });
  await page
    .locator(".wb-sidebar")
    .getByRole("link", { name: "题库", exact: true })
    .click();
  await expect(page.getByLabel("题目标题", { exact: true })).toHaveValue(
    "需要恢复的函数题",
  );
  const directory = world.directory;
  const originalPort = Number(new URL(world.origin).port);
  const accountKey = world.workbench.db
    .prepare("SELECT accountKey FROM auth_accounts")
    .get().accountKey;
  await page.evaluate(
    (account) =>
      localStorage.setItem(
        `tb.workbench.v1:${account}:draft:recovery-test`,
        JSON.stringify({
          pending: { key: "preserve-old-request" },
          input: { text: "恢复前待核对内容" },
        }),
      ),
    accountKey,
  );
  const backupPath = directory + "-backup",
    restoredPath = directory + "-restored";
  await page.evaluate(async (account) => {
    for (const [name, storeName, fileName] of [
      ["teachbuddy-resources-pending", "requests", "resource-original.txt"],
      ["teachbuddy.math.uploads", "pending", "math-original.html"],
    ]) {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(
          {
            key: crypto.randomUUID(),
            input: new File(["恢复前文件原字节"], fileName, {
              type: "text/plain",
            }),
          },
          account,
        );
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }
  }, accountKey);
  await world.close();
  world = null;
  await backup({
    database: path.join(directory, "workspace.sqlite"),
    files: path.join(directory, "files"),
    target: backupPath,
    stopped: true,
  });
  restore({ source: backupPath, target: restoredPath, stopped: true });
  activate({ target: restoredPath, stopped: true });
  world = await createIntegration({
    directory: restoredPath,
    port: originalPort,
  });
  await page.goto(world.origin + "/settings");
  await expect(
    page.getByRole("heading", { name: "登录", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("邮箱", { exact: true })
    .fill("manual-data@example.test");
  await page.getByLabel("密码", { exact: true }).fill("Manual-data-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator(".wb-shell")).toBeVisible();
  await page
    .locator(".wb-sidebar")
    .getByRole("link", { name: "题库", exact: true })
    .click();
  await expect(
    page.getByText("需要恢复的函数题", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".wb-shell")).toBeVisible();
  await page
    .locator(".wb-sidebar")
    .getByRole("link", { name: "设置", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "恢复前的本设备草稿" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (account) =>
        localStorage.getItem(`tb.workbench.v1:${account}:draft:recovery-test`),
      accountKey,
    ),
  ).toBeNull();
  await page.getByText(/项设备记录/).click();
  await expect(page.getByText(/恢复前待核对内容/)).toBeVisible();
  await page
    .getByRole("button", { name: "查看恢复前上传", exact: true })
    .click();
  const oldFileDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载 resource-original.txt", exact: true })
    .click();
  expect(fs.readFileSync(await (await oldFileDownload).path(), "utf8")).toBe(
    "恢复前文件原字节",
  );
  await expect(
    page.getByRole("button", { name: "下载 math-original.html", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(evidence, "restored-login.png"),
    animations: "disabled",
  });
});
