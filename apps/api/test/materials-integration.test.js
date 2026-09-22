import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createIntegration } from "./fixtures/auth-integration/harness.js";
import { validateSchema } from "../src/workbench/content/schema.js";

const root = path.resolve("test-results/r34-integration/api");
fs.mkdirSync(root, { recursive: true });
test("material composition serves the frozen v2 catalog through real page-bound identity", async (t) => {
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
  validateSchema("ModuleCatalog", catalog.json);
  assert.deepEqual(
    catalog.json.items.map((x) => x.id),
    ["questions", "resources", "lessons"],
  );
});

import { randomUUID } from "node:crypto";
import { startMaterialsHttp } from "../../web/e2e/fixtures/materials-integration/server.mjs";
import { createWorkbench } from "../src/workbench/index.js";
const evidence = path.resolve("../../docs/acceptance/evidence/R34/v1/attempt2");
const empty = { version: 2, blocks: [] };
const doc = (text) => ({
  version: 2,
  blocks: [{ type: "paragraph", runs: [{ type: "text", text }] }],
});

test(
  "real modules: import review, immutable mixed references, 24 filtered outputs, isolation and restart",
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
      l = "/api/modules/lessons/v2/items",
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
    const sid = randomUUID(),
      refid = randomUUID();
    const lesson = await ok(
      l,
      {
        title: "真实六输出",
        intro: doc("文稿专用标记"),
        sections: [
          {
            id: sid,
            title: "探究",
            content: {
              version: 2,
              blocks: [
                { type: "teacher-note", blocks: doc("教师专用标记").blocks },
              ],
            },
            references: [
              {
                id: randomUUID(),
                kind: "question",
                questionId: question.id,
                questionVersion: question.version,
                note: "本课专用标记",
              },
              {
                id: refid,
                kind: "resource",
                resourceId: resource.id,
                resourceVersion: resource.version,
                note: "",
              },
            ],
          },
        ],
        materials: [],
      },
      "POST",
      201,
    );
    const usages = await ok(
      "/api/modules/lessons/v2/resource-usages/" + resource.id,
    );
    assert.equal(usages.items[0].lessonId, lesson.id);
    const replacement = await upload("替换.pdf");
    await ok(
      r + "/" + resource.id + "/file",
      { baseVersion: resource.version, fileId: replacement.id },
      "PUT",
    );
    const retained = await ok(l + "/" + lesson.id);
    assert.equal(
      retained.sections[0].references[1].snapshot.fileId,
      original.id,
    );
    assert.equal(
      retained.sections[0].references[1].resourceVersion,
      resource.version,
    );
    const manifest = [];
    const outputDir = path.join(directory, "outputs");
    fs.mkdirSync(outputDir);
    for (const kind of ["lesson-plan", "handout", "practice"])
      for (const format of ["docx", "pdf"])
        for (const includeAnswers of [false, true])
          for (const includeTeacherNotes of [false, true]) {
            const options = {
              baseVersion: lesson.version,
              kind,
              format,
              includeAnswers,
              includeTeacherNotes,
              sectionIds: [sid],
              materialReferenceIds: [],
              answerSpaceLines: 1,
            };
            const accepted = await ok(
              l + "/" + lesson.id + "/exports",
              options,
              "POST",
              202,
            );
            const job = await wait(accepted.jobId);
            assert.equal(job.state, "succeeded", JSON.stringify(job));
            const fileId = job.outputFileIds[0];
            const download = await call(
              "/api/workbench/files/" + fileId + "/content",
            );
            assert.equal(download.status, 200);
            const name = `${kind}-${includeAnswers}-${includeTeacherNotes}.${format}`;
            fs.writeFileSync(path.join(outputDir, name), download.bytes);
            assert.equal(
              (
                await call(
                  "/api/workbench/files/" + fileId + "/content",
                  undefined,
                  "GET",
                  "integration-b",
                )
              ).status,
              404,
            );
            manifest.push({
              name,
              options,
              fileId,
              jobId: job.id,
              bytes: download.bytes.length,
            });
          }
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
    assert.equal((await wait(asset.id)).state, "succeeded");
    const failedImport = await ok(
      q + "/imports",
      {
        title: "无在线Provider",
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
    const failedJob = await wait(failedImport.jobId);
    assert.equal(failedJob.state, "failed");
    assert.ok(failedJob.issues.some((i) => i.code === "provider-unavailable"));
    assert.equal(
      (await call("/api/workbench/files/" + original.id + "/content")).status,
      200,
    );
    await world.close();
    world = await startMaterialsHttp(directory);
    assert.equal((await ok(l + "/" + lesson.id + "/exports")).items.length, 24);
    assert.equal(
      (await ok(l + "/" + lesson.id)).sections[0].references.length,
      2,
    );
    fs.writeFileSync(
      path.join(directory, "manifest.json"),
      JSON.stringify({ directory, manifest, failedJob }, null, 2),
    );
    console.log("R34_OUTPUT_MANIFEST " + path.join(directory, "manifest.json"));
  },
);

test("production composes real handlers and rejects missing or fixture overrides before serving", async () => {
  for (const [name, override, pass] of [
    ["real", {}, true],
    ["missing", { export: null }, false],
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
        await assert.rejects(workbench.initialize(), /requires export handler/);
    } catch (error) {
      if (name !== "fixture") throw error;
      assert.match(error.message, /fixture handlers are forbidden/);
    } finally {
      workbench?.close();
    }
  }
});
