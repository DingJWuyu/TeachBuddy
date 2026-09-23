import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
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
test("恢复后新旧格式上传原文件可下载且请求隔离", async ({ page }, testInfo) => {
  world = await createIntegration();
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
  const directory = world.directory;
  const originalPort = Number(new URL(world.origin).port);
  const accountKey = world.workbench.db
    .prepare("SELECT accountKey FROM auth_accounts")
    .get().accountKey;
  const previousRecovery = await page.evaluate(account => localStorage.getItem("teachbuddy:data-recovery:" + account), accountKey);
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

  await page.evaluate(async (account) => {
    for (const [database, storeName, logicalName, stem] of [
      ["teachbuddy.questions.uploads", "pending", "pending:questions-upload", "question"],
      ["teachbuddy-resources-pending", "requests", "pending:resources", "resource"],
      ["teachbuddy.math.uploads", "pending", "pending:math-upload", "math"],
    ]) {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      for (const branch of ["first", "second"]) {
        const idbKey = account + ":" + stem + "-" + branch;
        await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put({
            key: stem + "-" + branch,
            file: new File(["新格式原字节:" + stem + ":" + branch], stem + "-" + branch + ".txt"),
          }, idbKey);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        const envelope = { formatVersion: 2, accountKey: account, name: logicalName, value: { idbKey } };
        localStorage.setItem("tb.workbench.v1:" + account + ":branch:" + branch + ":" + logicalName, JSON.stringify(envelope));
        localStorage.setItem("tb.workbench.v1:" + account + ":" + logicalName, JSON.stringify({ idbKey }));
      }
      db.close();
    }
  }, accountKey);
  const replayed = [];
  page.on("request", request => {
    if (request.method() === "POST" && (new URL(request.url()).pathname === "/api/workbench/files" || /^(question|resource|math)-(first|second)$/.test(request.headers()["idempotency-key"] ?? ""))) replayed.push(request.url());
  });
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

  expect(await page.evaluate(account => localStorage.getItem("teachbuddy:data-recovery:" + account), accountKey)).not.toBe(previousRecovery);
  for (const name of ["题库", "资源库", "数学工坊"]) {
    await page.locator(".wb-sidebar").getByRole("link", { name, exact: true }).click();
    await expect(page.locator(".wb-shell")).toBeVisible();
  }
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
  expect(await page.evaluate(account => localStorage.getItem("tb.workbench.v1:" + account + ":pending:questions-upload"), accountKey)).toBeNull();
  expect(replayed).toEqual([]);
  // The archived pointer and original bytes survive the restore; the UI must expose them.
  const preserved = await page.evaluate(async account => {
    const archiveKey = Object.keys(localStorage).find(key => key.startsWith("teachbuddy:data-recovery-archive:" + account + ":"));
    const db = await new Promise(resolve => {
      const request = indexedDB.open("teachbuddy.questions.uploads", 1);
      request.onsuccess = () => resolve(request.result);
    });
    const record = await new Promise(resolve => {
      const request = db.transaction("pending").objectStore("pending").get(account + ":question-first");
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return { archive: localStorage.getItem(archiveKey), bytes: await record.file.text() };
  }, accountKey);
  expect(preserved.archive).toContain("question-first");
  expect(preserved.bytes).toBe("新格式原字节:question:first");
  for (const stem of ["question", "resource", "math"]) {
    for (const branch of ["first", "second"]) {
      const button = page.getByRole("button", { name: "下载 " + stem + "-" + branch + ".txt", exact: true });
      await expect(button).toHaveCount(1);
      const waiting = page.waitForEvent("download");
      await button.click();
      expect(fs.readFileSync(await (await waiting).path(), "utf8")).toBe("新格式原字节:" + stem + ":" + branch);
    }
  }
  const oldFileDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载 resource-original.txt", exact: true })
    .click();
  expect(fs.readFileSync(await (await oldFileDownload).path(), "utf8")).toBe(
    "恢复前文件原字节",
  );
  const mathDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 math-original.html", exact: true }).click();
  expect(fs.readFileSync(await (await mathDownload).path(), "utf8")).toBe("恢复前文件原字节");
  expect(replayed).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("recovered-uploads.png"), fullPage: true });
});
