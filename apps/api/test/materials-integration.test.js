import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createIntegration } from "./fixtures/auth-integration/harness.js";
import { validate as validateSchema } from "../src/modules/math/contract.js";

const root = path.resolve("test-results/r34-integration/api");
fs.mkdirSync(root, { recursive: true });
test("material composition serves the frozen v3 catalog through real page-bound identity", async (t) => {
  const world = await createIntegration({
    directory: fs.mkdtempSync(path.join(root, "catalog-")),
  });
  t.after(() => world.close());
  const raw = world.client();
  const client = {
    post: (url, body) => raw.request("POST", url, { body }),
    get: (url) => raw.request("GET", url),
  };
  await client.post("/api/auth/session", { action: "bootstrap" });
  const sent = await client.post("/api/auth/registration-codes", {
    email: "material@example.test",
  });
  assert.equal(sent.status, 200, JSON.stringify(sent.json));
  const registered = await client.post("/api/auth/register", {
    email: "material@example.test",
    nickname: "材料老师",
    password: "integration-password",
    challengeId: sent.json.challengeId,
    verificationCode: world.mailer.lastCode(
      "registration",
      "material@example.test",
    ),
    termsAccepted: true,
    rememberMe: true,
  });
  assert.equal(registered.status, 201, JSON.stringify(registered.json));
  await client.post("/api/auth/session", {
    action: "activate",
    sessionId: registered.json.id,
    rememberMe: true,
  });
  const catalog = await client.get("/api/modules");
  assert.equal(catalog.status, 200);
  validateSchema("ModuleCatalogV3", catalog.json);
  assert.deepEqual(
    catalog.json.items.map((x) => x.id),
    ["questions", "math", "resources", "classes", "schedule"],
  );
});

import { randomUUID } from "node:crypto";
import { startMaterialsHttp } from "../../web/e2e/fixtures/materials-integration/server.mjs";
import { createWorkbench } from "../src/workbench/index.js";
const doc = (text) => ({
  version: 2,
  blocks: [{ type: "paragraph", runs: [{ type: "text", text }] }],
});

test(
  "real modules: import review, resources, question assets, isolation and restart",
  { timeout: 180000 },
  async (t) => {
    const directory = fs.mkdtempSync(path.join(root, "chain-"));
    let world = await startMaterialsHttp(directory);
    t.after(() => world.close());
    async function call(
      route,
      body,
      method = body === undefined ? "GET" : "POST",
      who = "integration-a",
      key = randomUUID(),
    ) {
      const response = await fetch(world.origin + route, {
        method,
        headers: {
          Cookie: world.workbench.identity
            .testPrincipalCookie(who)
            .header.split(";")[0],
          Origin: "http://localhost",
          "X-TeachBuddy-Request": "1",
          "Idempotency-Key": key,
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const json = response.headers.get("content-type")?.includes("json")
        ? JSON.parse(bytes.toString())
        : null;
      return { status: response.status, body: json, bytes };
    }
    async function ok(route, body, method, status = 200) {
      const r = await call(route, body, method);
      assert.equal(r.status, status, JSON.stringify(r.body));
      return r.body;
    }
    async function wait(id) {
      for (let n = 0; n < 600; n++) {
        const j = await ok("/api/workbench/jobs/" + id);
        if (!["queued", "running", "cancelling"].includes(j.state)) return j;
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.fail("job timeout");
    }
    const q = "/api/modules/questions/v2",
      r = "/api/modules/resources/items";
    const imported = await ok(
      q + "/imports",
      {
        title: "真实文字原稿",
        origin: "",
        input: { kind: "text", text: "1. 求 $x^2=4$ 的解。\n答案：$x=\\pm2$" },
      },
      "POST",
      201,
    );
    assert.equal((await wait(imported.jobId)).state, "succeeded");
    let reviewed = await ok(q + "/imports/" + imported.id);
    reviewed = await ok(
      q + "/imports/" + imported.id,
      {
        baseVersion: reviewed.version,
        drafts: reviewed.drafts.map((d) => ({
          ...d,
          title: "真实采用题",
          body: doc("题干保留"),
          solution: doc("答案专用标记"),
          issues: d.issues.map((i) => ({ ...i, resolution: "corrected" })),
        })),
        fragments: reviewed.fragments,
      },
      "PUT",
    );
    const committed = await ok(q + "/imports/" + imported.id + "/commit", {
      baseVersion: reviewed.version,
      draftIds: reviewed.drafts.map((d) => d.id),
    });
    const question = committed.questions[0];
    async function upload(name) {
      const form = new FormData();
      form.append(
        "file",
        new Blob([
          fs.readFileSync(
            new URL(
              "../../web/e2e/fixtures/materials/samples/c22.pdf",
              import.meta.url,
            ),
          ),
        ]),
        name,
      );
      return ok("/api/workbench/files", form, "POST", 201);
    }
    const original = await upload("原件.pdf");
    const resource = await ok(
      r,
      {
        title: "真实资源",
        fileId: original.id,
        folderId: null,
        tagIds: [],
        note: "长期私密笔记",
      },
      "POST",
      201,
    );
    const replacement = await upload("替换.pdf");
    const replaced = await ok(r + "/" + resource.id + "/file", { baseVersion: resource.version, fileId: replacement.id }, "PUT");
    assert.equal(replaced.fileId, replacement.id);
    assert.equal((await call(r + "/" + resource.id, undefined, "GET", "integration-b")).status, 404);
    const asset = await ok(
      q + "/items/" + question.id + "/assets",
      {
        baseVersion: question.version,
        mode: "question-png",
        includeAnswers: false,
        figureFileId: null,
      },
      "POST",
      202,
    );
    const assetJob = await wait(asset.id);
    assert.equal(assetJob.state, "succeeded");
    assert.equal(assetJob.outputFileIds.length, 1);
    const assetRoute = "/api/workbench/files/" + assetJob.outputFileIds[0] + "/content";
    const assetFile = await call(assetRoute);
    assert.equal(assetFile.status, 200);
    assert.deepEqual([...assetFile.bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal((await call(assetRoute, undefined, "GET", "integration-b")).status, 404);
    const nativeImport = await ok(
      q + "/imports",
      {
        title: "本地文字层 PDF",
        origin: "",
        input: {
          kind: "files",
          fileIds: [original.id],
          pages: [{ fileId: original.id, pages: [1] }],
        },
      },
      "POST",
      201,
    );
    const nativeJob = await wait(nativeImport.jobId);
    assert.equal(nativeJob.state, "succeeded", JSON.stringify(nativeJob));
    const nativeReview = await ok(q + "/imports/" + nativeImport.id);
    assert.equal(nativeReview.drafts.length, 1);
    assert.match(JSON.stringify(nativeReview.drafts[0].body), /二次函数/);
    assert.equal(nativeReview.drafts[0].answerStatus, "absent");
    assert.equal(
      (await call("/api/workbench/files/" + original.id + "/content")).status,
      200,
    );
    // A raster original still requires OCR, independently of native PDF support.
    const imageBytes = fs.readFileSync(
      new URL("../../web/e2e/fixtures/materials-questions/I-clear.jpg", import.meta.url),
    );
    const imageForm = new FormData();
    imageForm.append("file", new Blob([imageBytes], { type: "image/jpeg" }), "扫描题页.jpg");
    const scanned = await ok("/api/workbench/files", imageForm, "POST", 201);
    const failedImport = await ok(
      q + "/imports",
      {
        title: "未配置 OCR 的图片原稿",
        origin: "",
        input: { kind: "files", fileIds: [scanned.id], pages: [] },
      },
      "POST",
      201,
    );
    const failedJob = await wait(failedImport.jobId);
    assert.equal(failedJob.state, "failed", JSON.stringify(failedJob));
    assert.ok(failedJob.issues.some((i) => i.code === "provider-unavailable"));
    assert.equal((await ok(q + "/imports/" + failedImport.id)).drafts.length, 0);
    await world.close();
    world = await startMaterialsHttp(directory);
    assert.deepEqual((await ok(q + "/imports/" + nativeImport.id)).drafts, nativeReview.drafts);
    const retainedScan = await call("/api/workbench/files/" + scanned.id + "/content");
    assert.equal(retainedScan.status, 200);
    assert.deepEqual(retainedScan.bytes, imageBytes);
    assert.deepEqual((await call(assetRoute)).bytes, assetFile.bytes);
    assert.deepEqual(await ok(r + "/" + resource.id), replaced);
    assert.deepEqual(await ok(q + "/items/" + question.id), question);
  },
);

test("production composes real handlers and rejects missing or fixture overrides before serving", async () => {
  for (const [name, override, pass] of [
    ["real", {}, true],
    ["missing", { extraction: null }, false],
    ["fixture", { extraction: { fixture: true, run() {} } }, false],
  ]) {
    const directory = fs.mkdtempSync(path.join(root, "production-"));
    let workbench;
    try {
      workbench = createWorkbench({
        env: {
          nodeEnv: "production",
          sqlitePath: path.join(directory, "db.sqlite"),
          workbench: {
            mode: "none",
            jobHandlers: override,
            logDir: path.join(directory, "logs"),
          },
        },
      });
      if (pass) await workbench.initialize();
      else
        await assert.rejects(workbench.initialize(), /requires extraction handler/);
    } catch (error) {
      if (name !== "fixture") throw error;
      assert.match(error.message, /fixture handlers are forbidden/);
    } finally {
      await workbench?.close();
    }
  }
});
