import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  backup,
  restore,
  activate,
} from "../../../api/src/workbench/reliability/backup.js";
import { createIntegration } from "../../../api/test/fixtures/auth-integration/harness.js";
let world;
let temporaryDirectory;
test.afterEach(async ({ context }, info) => {
  await context.close();
  await world?.close();
  if (info.status === info.expectedStatus) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  else console.error(`保留失败现场: ${temporaryDirectory}`);
});
test("恢复后新旧格式上传原字节保留且请求隔离", async ({ page }, testInfo) => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "teachbuddy-recovery-upload-"));
  const original = path.join(temporaryDirectory, "original");
  fs.mkdirSync(original);
  world = await createIntegration({ directory: original });
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
  if (await page.getByRole("button", { name: /知道了/ }).count()) await page.getByRole("button", { name: /知道了/ }).first().click();
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
    page.getByRole("heading", { name: "欢迎回来", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("邮箱", { exact: true })
    .fill("manual-data@example.test");
  await page.getByLabel("密码", { exact: true }).fill("Manual-data-123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator(".wb-shell")).toBeVisible();
  if (await page.getByRole("button", { name: /知道了/ }).count()) await page.getByRole("button", { name: /知道了/ }).first().click();

  expect(await page.evaluate(account => localStorage.getItem("teachbuddy:data-recovery:" + account), accountKey)).not.toBe(previousRecovery);
  for (const name of ["题库", "资源库", "数学工坊"]) {
    const route = { "题库": "questions", "资源库": "resources", "数学工坊": "math" }[name];
    await page.locator(`a[href^="/${route}"]`).first().click();
    await expect(page.locator(".wb-shell")).toBeVisible();
  if (await page.getByRole("button", { name: /知道了/ }).count()) await page.getByRole("button", { name: /知道了/ }).first().click();
  }
  await page.reload();
  await expect(page.locator(".wb-shell")).toBeVisible();
  if (await page.getByRole("button", { name: /知道了/ }).count()) await page.getByRole("button", { name: /知道了/ }).first().click();
  await page
    .locator('a[href^="/settings"]').first()
    .click();
  const preserved = await page.evaluate(async account => {
    const recoveryId = localStorage.getItem("teachbuddy:data-recovery:" + account);
    const archive = JSON.parse(localStorage.getItem("teachbuddy:data-recovery-archive:" + account + ":" + recoveryId));
    const files = [];
    const active = [];
    for (const [database, storeName, stem] of [
      ["teachbuddy.questions.uploads", "pending", "question"],
      ["teachbuddy-resources-pending", "requests", "resource"],
      ["teachbuddy.math.uploads", "pending", "math"],
    ]) {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open(database, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const read = key => new Promise((resolve, reject) => { const request = db.transaction(storeName).objectStore(storeName).get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      active.push((await read(account)) ?? null);
      for (const branch of ["first", "second"]) {
        const record = await read(account + ":" + stem + "-" + branch);
        files.push({ name: record.file.name, text: await record.file.text() });
      }
      if (stem !== "question") {
        const record = await read(account + ":recovery:" + recoveryId);
        files.push({ name: record.input.name, text: await record.input.text() });
      }
      db.close();
    }
    return { archive, active, files,
      draft: localStorage.getItem(`tb.workbench.v1:${account}:draft:recovery-test`),
      pending: ["questions-upload", "resources", "math-upload"].map(name => localStorage.getItem(`tb.workbench.v1:${account}:pending:${name}`)) };
  }, accountKey);
  expect(preserved.draft).toBeNull();
  expect(preserved.pending).toEqual([null, null, null]);
  expect(preserved.active).toEqual([null, null, null]);
  expect(JSON.parse(preserved.archive.records[`tb.workbench.v1:${accountKey}:draft:recovery-test`])).toEqual({ pending: { key: "preserve-old-request" }, input: { text: "恢复前待核对内容" } });
  for (const stem of ["question", "resource", "math"]) {
    for (const branch of ["first", "second"]) {
      expect(preserved.files).toContainEqual({ name: `${stem}-${branch}.txt`, text: `新格式原字节:${stem}:${branch}` });
      expect(JSON.stringify(preserved.archive)).toContain(`${stem}-${branch}`);
    }
  }
  expect(preserved.files).toHaveLength(8);
  expect(preserved.files).toContainEqual({ name: "resource-original.txt", text: "恢复前文件原字节" });
  expect(preserved.files).toContainEqual({ name: "math-original.html", text: "恢复前文件原字节" });
  expect(replayed).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("recovered-uploads.png"), fullPage: true });
});
