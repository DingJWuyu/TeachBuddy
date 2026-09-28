import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
const evidenceDir = fs.mkdtempSync(path.join(os.tmpdir(), "questions-evidence-"));
import { startQuestionsFixture as startFixture } from "../../web/e2e/fixtures/materials-questions/server.mjs";

test("text import preserves original, produces editable drafts and commits once", async (t) => {
  const runtime = await startFixture({
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), "r33-api-")),
    port: 0,
  });
  t.after(() => runtime.close());
  const origin = `http://localhost:${runtime.server.address().port}`;
  const headers = {
    Cookie: runtime.workbench.identity
      .testPrincipalCookie("r33-a")
      .header.split(";")[0],
    Origin: "http://localhost:0",
    "X-TeachBuddy-Request": "1",
    "Content-Type": "application/json",
  };
  const call = async (path, body, method = "POST") => {
    const r = await fetch(origin + "/api/modules/questions/v2" + path, {
      method,
      headers: { ...headers, "Idempotency-Key": randomUUID() },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  };
  const created = await call("/imports", {
    title: "练习",
    origin: "",
    input: {
      kind: "text",
      text: "1. 求 $x^2=4$ 的解。\n答案：$x=\\pm2$\n2. 计算 $2+3$。",
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  let material;
  for (let n = 0; n < 100; n++) {
    material = (await call("/imports/" + created.body.id, null, "GET")).body;
    if (material.drafts?.length) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(material.drafts.length, 2);
  assert.equal(material.drafts[0].answerStatus, "present");
  assert.equal(material.drafts[1].answerStatus, "absent");
  const saved = await call(
    "/imports/" + material.id,
    {
      baseVersion: material.version,
      drafts: material.drafts.map((d) => ({
        ...d,
        issues: d.issues.map((i) => ({ ...i, resolution: "corrected" })),
      })),
      fragments: material.fragments,
    },
    "PUT",
  );
  assert.equal(saved.status, 200);
  const input = {
    baseVersion: saved.body.version,
    draftIds: [material.drafts[0].id],
  };
  const committed = await call("/imports/" + material.id + "/commit", input);
  assert.equal(committed.status, 200, JSON.stringify(committed.body));
  const again = await call("/imports/" + material.id + "/commit", {
    ...input,
    baseVersion: committed.body.import.version,
  });
  assert.equal(again.body.questions[0].id, committed.body.questions[0].id);
  assert.equal((await call("/items", null, "GET")).body.items.length, 1);
});

async function environment(t, provider) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "r33-cases-"));
  let runtime = await startFixture({ dataDir: dir, port: 0, provider });
  t.after(() => runtime.close());
  const call = async (
    path,
    body,
    method = "POST",
    account = "r33-a",
    key = randomUUID(),
  ) => {
    const response = await fetch(
      `http://localhost:${runtime.server.address().port}` + path,
      {
        method,
        headers: {
          Cookie: runtime.workbench.identity
            .testPrincipalCookie(account)
            .header.split(";")[0],
          Origin: "http://localhost:0",
          "X-TeachBuddy-Request": "1",
          "Idempotency-Key": key,
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        ...(body
          ? { body: body instanceof FormData ? body : JSON.stringify(body) }
          : {}),
      },
    );
    return { status: response.status, body: await response.json() };
  };
  return {
    call,
    async bytes(id) {
      const r = await fetch(
        `http://localhost:${runtime.server.address().port}/api/workbench/files/${id}/content`,
        {
          headers: {
            Cookie: runtime.workbench.identity
              .testPrincipalCookie("r33-a")
              .header.split(";")[0],
          },
        },
      );
      assert.equal(r.status, 200);
      return Buffer.from(await r.arrayBuffer());
    },
    q: (path, ...args) => call("/api/modules/questions/v2" + path, ...args),
    async restart() {
      await runtime.close();
      runtime = await startFixture({ dataDir: dir, port: 0, provider });
    },
    async job(id) {
      for (let n = 0; n < 300; n++) {
        const j = (await call("/api/workbench/jobs/" + id, null, "GET")).body;
        if (!["queued", "running", "cancelling"].includes(j.state)) return j;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw Error("Job timeout");
    },
  };
}
const doc = (text) => ({
  version: 2,
  blocks: [{ type: "paragraph", runs: [{ type: "text", text }] }],
});
const manual = () => ({
  title: "独立题",
  body: doc("求值"),
  solution: { version: 2, blocks: [] },
  answerStatus: "absent",
  note: "私密笔记",
  starred: false,
  typeId: null,
  tagIds: [],
  source: { kind: "manual" },
});
test("native text import preserves unnumbered originals and matches only unique normalized question labels", async (t) => {
  const e = await environment(t);
  const cases = [
    { text: "求三加五的和。\n答案：八", count: 1, answers: ["present"] },
    { text: "1. 求三加五的和。\n参考答案\n１、八", count: 1, answers: ["present"] },
    { text: "1.5 是一个有理数，请说明理由。", count: 1, answers: ["absent"], body: "1.5" },
    { text: "1. 第一题。\n１、第二题。\n参考答案\n1）答案不能猜测对应哪道题。", count: 2, answers: ["unresolved", "unresolved"], fragments: 1 },
    { text: "答案：八", count: 0, answers: [], fragments: 1 },
    { text: "教师活动：请同学们讨论。", count: 0, answers: [], fragments: 1 },
    { text: "求三加五的和。\n答案：八\n教师活动：讨论不同解法。\n求九减二的差。\n答案：七", count: 2, answers: ["present", "present"], fragments: 1 },
    { text: "1. 分两步说明。\n（1）说明条件。\n（2）给出结论。\n答案：略", count: 1, answers: ["present"] },
  ];
  for (const expected of cases) {
    const created = (await e.q("/imports", { title: "边界样本", origin: "", input: { kind: "text", text: expected.text } })).body;
    assert.equal((await e.job(created.jobId)).state, "succeeded", expected.text);
    const m = (await e.q(`/imports/${created.id}`, null, "GET")).body;
    assert.equal(m.input.text, expected.text);
    assert.equal(m.drafts.length, expected.count, expected.text);
    assert.deepEqual(m.drafts.map(d => d.answerStatus), expected.answers, expected.text);
    if (expected.fragments) assert.equal(m.fragments.length, expected.fragments, expected.text);
    if (expected.body) assert.ok(JSON.stringify(m.drafts[0].body).includes(expected.body));
    for (const d of m.drafts) for (const part of d.parts) for (const location of part.locations) {
      assert.equal(location.kind, "text");
      assert.ok(location.start >= 0 && location.end <= [...expected.text].length && location.end > location.start);
    }
  }
});

test("permanent question deletion requires archive and current version, replays safely and retains adopted snapshots", async (t) => {
  const e = await environment(t);
  const q = (await e.q("/items", manual())).body;
  const { source, ...copyInput } = manual();
  const copy = (await e.q(`/items/${q.id}/copies`, { ...copyInput, baseVersion: q.version })).body;
  const lesson = await e.call("/api/modules/lessons/v2/items", {
    title: "保留引用", intro: doc(""), sections: [],
    materials: [{ id: randomUUID(), kind: "question", questionId: q.id, questionVersion: q.version, note: "课堂使用" }],
  });
  assert.equal(lesson.status, 201, JSON.stringify(lesson.body));
  const active = await e.q(`/items/${q.id}/purge`, { baseVersion: q.version });
  assert.equal(active.status, 409);
  assert.equal(active.body.type, "/problems/materials/archive-required");
  const archived = (await e.q(`/items/${q.id}/deletion`, { baseVersion: q.version, deleted: true })).body;
  assert.equal((await e.q(`/items/${q.id}/purge`, { baseVersion: archived.version }, "POST", "r33-b")).status, 404);
  assert.equal((await e.q(`/items/${q.id}/purge`, { baseVersion: q.version })).status, 409);
  const key = randomUUID(), input = { baseVersion: archived.version };
  const purged = await e.q(`/items/${q.id}/purge`, input, "POST", "r33-a", key);
  assert.equal(purged.status, 200, JSON.stringify(purged.body));
  assert.deepEqual(purged.body, { id: q.id, permanentlyDeleted: true });
  await e.restart();
  assert.deepEqual(await e.q(`/items/${q.id}/purge`, input, "POST", "r33-a", key), purged);
  assert.equal((await e.q(`/items/${q.id}`, null, "GET")).status, 404);
  assert.equal((await e.q(`/items/${q.id}/purge`, input)).status, 404);
  assert.equal((await e.q(`/items/${q.id}/deletion`, { ...input, deleted: false })).status, 404);
  assert.deepEqual((await e.q(`/items/${copy.id}`, null, "GET")).body.source.snapshot, copy.source.snapshot);
  assert.deepEqual((await e.call(`/api/modules/lessons/v2/items/${lesson.body.id}`, null, "GET")).body.materials,
    lesson.body.materials.map(reference => ({ ...reference, sourceState: "deleted" })));
});

test("permanent import deletion waits for running extraction", async (t) => {
  let finish;
  const processing = new Promise(resolve => { finish = resolve; });
  const e = await environment(t, { extract: async () => { await processing; return { questions: [] }; } });
  t.after(() => finish());
  const form = new FormData();
  form.append("file", new Blob([await (await import("sharp")).default({ create: { width: 100, height: 100, channels: 3, background: "white" } }).png().toBuffer()], { type: "image/png" }), "原稿.png");
  const file = (await e.call("/api/workbench/files", form)).body;
  const created = (await e.q("/imports", { title: "处理中", origin: "", input: { kind: "files", fileIds: [file.id], pages: [] } })).body;
  const archived = (await e.q(`/imports/${created.id}/deletion`, { baseVersion: created.version, deleted: true })).body;
  const blocked = await e.q(`/imports/${created.id}/purge`, { baseVersion: archived.version });
  assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
  assert.equal(blocked.body.type, "/problems/materials/processing-in-progress");
  assert.equal((await e.q(`/imports/${created.id}`, null, "GET")).status, 200);
  finish();
  await e.job(created.jobId);
  const latest = (await e.q(`/imports/${created.id}`, null, "GET")).body;
  assert.equal((await e.q(`/imports/${created.id}/purge`, { baseVersion: latest.version })).status, 200);
  assert.equal((await e.call(`/api/workbench/jobs/${created.jobId}/retry`, { unitIds: [] })).status, 404);
  assert.equal((await e.q(`/imports/${created.id}`, null, "GET")).status, 404);
});

test("permanent import deletion keeps committed questions and cannot be restored or retried", async (t) => {
  const e = await environment(t);
  const created = (await e.q("/imports", { title: "待移除材料", origin: "", input: { kind: "text", text: "1. 求 2+3。\n答案：5" } })).body;
  await e.job(created.jobId);
  const m = (await e.q(`/imports/${created.id}`, null, "GET")).body;
  const saved = await e.q(`/imports/${m.id}`, {
    baseVersion: m.version, fragments: m.fragments,
    drafts: m.drafts.map(d => ({ ...d, issues: d.issues.map(i => ({ ...i, resolution: "corrected" })) })),
  }, "PUT");
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const committed = await e.q(`/imports/${m.id}/commit`, { baseVersion: saved.body.version, draftIds: [m.drafts[0].id] });
  assert.equal(committed.status, 200, JSON.stringify(committed.body));
  const question = committed.body.questions[0];
  assert.equal((await e.q(`/imports/${m.id}/purge`, { baseVersion: committed.body.import.version })).status, 409);
  const archived = (await e.q(`/imports/${m.id}/deletion`, { baseVersion: committed.body.import.version, deleted: true })).body;
  const key = randomUUID(), input = { baseVersion: archived.version };
  assert.equal((await e.q(`/imports/${m.id}/purge`, input, "POST", "r33-b")).status, 404);
  const purged = await e.q(`/imports/${m.id}/purge`, input, "POST", "r33-a", key);
  assert.equal(purged.status, 200, JSON.stringify(purged.body));
  await e.restart();
  assert.deepEqual(await e.q(`/imports/${m.id}/purge`, input, "POST", "r33-a", key), purged);
  assert.equal((await e.q(`/imports/${m.id}`, null, "GET")).status, 404);
  assert.equal((await e.q(`/imports/${m.id}/deletion`, { ...input, deleted: false })).status, 404);
  assert.equal((await e.call(`/api/workbench/jobs/${m.jobId}/retry`, { unitIds: [] })).status, 409);
  assert.deepEqual((await e.q(`/items/${question.id}`, null, "GET")).body, question);
  assert.deepEqual((await e.q("/imports?state=deleted", null, "GET")).body.items, []);
});

test("taxonomy and v2 editing, copies, legacy refusal, account isolation and restart", async (t) => {
  const e = await environment(t);
  const type = randomUUID(),
    tag = randomUUID();
  assert.deepEqual((await e.q("/taxonomy", null, "GET")).body, {
    version: 1,
    types: [],
    tags: [],
  });
  assert.equal(
    (
      await e.q(
        "/taxonomy",
        {
          baseVersion: 1,
          types: [{ id: type, name: "证明" }],
          tags: [{ id: tag, name: "几何" }],
        },
        "PUT",
      )
    ).status,
    200,
  );
  const q = (await e.q("/items", { ...manual(), typeId: type, tagIds: [tag] }))
    .body;
  assert.equal(
    (await e.call("/api/modules/questions/items/" + q.id, null, "GET")).status,
    422,
  );
  assert.equal((await e.q("/items/" + q.id, null, "GET", "r33-b")).status, 404);
  const { source, ...input } = manual();
  const copy = (
    await e.q("/items/" + q.id + "/copies", {
      ...input,
      baseVersion: q.version,
      typeId: type,
      tagIds: [tag],
    })
  ).body;
  assert.equal(copy.source.questionId, q.id);
  assert.equal(copy.source.snapshot.answerStatus, "absent");
  assert.equal(
    (await e.q("/items?typeId=" + type + "&tagIds=" + tag, null, "GET")).body
      .items.length,
    2,
  );
  await e.q("/items/" + q.id + "/deletion", {
    baseVersion: q.version,
    deleted: true,
  });
  assert.equal(
    (await e.q("/taxonomy", { baseVersion: 2, types: [], tags: [] }, "PUT"))
      .status,
    200,
  );
  const deleted = (await e.q("/items/" + q.id, null, "GET")).body;
  assert.equal(deleted.typeId, null);
  assert.equal(deleted.version, 3);
  await e.restart();
  assert.equal(
    (await e.q("/items/" + copy.id + "/for-reference", null, "GET")).body
      .snapshot.title,
    "独立题",
  );
  assert.equal(
    (await e.q("/items/" + copy.id, null, "GET")).body.tagIds.length,
    0,
  );
});
test("blocked provider keeps real image, retry preserves review and supplement originals", async (t) => {
  const e = await environment(t);
  const sharp = (await import("sharp")).default;
  const form = new FormData();
  form.append(
    "file",
    new Blob(
      [
        await sharp({
          create: { width: 100, height: 100, channels: 3, background: "white" },
        })
          .png()
          .toBuffer(),
      ],
      { type: "image/png" },
    ),
    "source.png",
  );
  const file = (await e.call("/api/workbench/files", form)).body;
  assert.ok(file?.id);
  const m = (
    await e.q("/imports", {
      title: "遮挡材料",
      origin: "",
      input: { kind: "files", fileIds: [file.id], pages: [] },
    })
  ).body;
  const first = await e.job(m.jobId);
  assert.equal(first.state, "failed");
  assert.equal(first.issues[0].code, "provider-unavailable");
  const latest = (await e.q("/imports/" + m.id, null, "GET")).body;
  assert.equal(latest.input.fileIds[0], file.id);
  const retried = (
    await e.call("/api/workbench/jobs/" + m.jobId + "/retry", { unitIds: [] })
  ).body;
  assert.equal(retried.attemptOf, m.jobId);
  await e.job(retried.id);
  await e.restart();
  assert.equal(
    (await e.q("/imports/" + m.id, null, "GET")).body.jobId,
    retried.id,
  );
});
test("PPT assets use persisted snapshot, transparent bounded PNG and exclude note", async (t) => {
  const e = await environment(t);
  const q = (await e.q("/items", manual())).body;
  const asset = (
    await e.q("/items/" + q.id + "/assets", {
      baseVersion: 1,
      mode: "question-png",
      figureFileId: null,
      includeAnswers: false,
    })
  ).body;
  const job = await e.job(asset.id);
  assert.equal(job.state, "succeeded", JSON.stringify(job));
  assert.ok(job.outputFileIds.length);
  const file = (
    await e.call("/api/workbench/files/" + job.outputFileIds[0], null, "GET")
  ).body;
  assert.equal(file.mediaType, "image/png");
});

test("fixed native T and W preserve six question boundaries and existing answer roles", async (t) => {
  const e = await environment(t);
  for (const name of ["T.txt", "W.docx"]) {
    let input;
    if (name.endsWith("txt"))
      input = {
        kind: "text",
        text: fs.readFileSync(
          new URL(
            "../../web/e2e/fixtures/materials-questions/" + name,
            import.meta.url,
          ),
          "utf8",
        ),
      };
    else {
      const f = new FormData();
      f.append(
        "file",
        new Blob([
          fs.readFileSync(
            new URL(
              "../../web/e2e/fixtures/materials-questions/" + name,
              import.meta.url,
            ),
          ),
        ]),
        name,
      );
      const file = (await e.call("/api/workbench/files", f)).body;
      input = { kind: "files", fileIds: [file.id], pages: [] };
    }
    const m = (
      await e.q("/imports", {
        title: name,
        origin: "C21 fixed original",
        input,
      })
    ).body;
    await e.job(m.jobId);
    const result = (await e.q("/imports/" + m.id, null, "GET")).body;
    fs.writeFileSync(
      path.join(evidenceDir, "native-" + name + ".json"),
      JSON.stringify(result, null, 2),
    );
    assert.equal(result.drafts.length, 6, name);
    assert.equal(result.drafts[5].answerStatus, "absent");
    assert.equal(result.drafts[0].answerStatus, "present");
    if (name === "W.docx")
      assert.equal(
        result.drafts.reduce(
          (n, d) => n + d.body.blocks.filter((b) => b.type === "image").length,
          0,
        ),
        3,
      );
  }
});

test("truncated Provider retains complete candidates; retry never replaces saved review", async (t) => {
  let mode = "truncated";
  const content = JSON.stringify({
    id: "A",
    stem: "已知 $x=2$，求值。",
    answer_status: "absent",
  });
  const e = await environment(t, {
    extract: async () => ({
      choices: [
        {
          finish_reason: "length",
          message: {
            content:
              mode === "empty"
                ? ""
                : '{"questions":[' + content + ',{"stem":"unfinished',
          },
        },
      ],
    }),
  });
  const form = new FormData();
  form.append(
    "file",
    new Blob([
      fs.readFileSync(
        new URL(
          "../../web/e2e/fixtures/materials-questions/P.pdf",
          import.meta.url,
        ),
      ),
    ]),
    "P.pdf",
  );
  const file = (await e.call("/api/workbench/files", form)).body;
  const created = (
    await e.q("/imports", {
      title: "截断恢复",
      origin: "",
      input: {
        kind: "files",
        fileIds: [file.id],
        pages: [{ fileId: file.id, pages: [1] }],
      },
    })
  ).body;
  const first = await e.job(created.jobId);
  assert.equal(first.state, "partial");
  let m = (await e.q("/imports/" + created.id, null, "GET")).body;
  assert.equal(m.drafts.length, 1);
  assert.ok(m.fragments[0].text.includes("unfinished"));
  m.drafts[0].title = "人工保留";
  const saved = await e.q(
    "/imports/" + m.id,
    { baseVersion: m.version, drafts: m.drafts, fragments: m.fragments },
    "PUT",
  );
  assert.equal(saved.status, 200);
  mode = "empty";
  const retry = (
    await e.call("/api/workbench/jobs/" + first.id + "/retry", { unitIds: [] })
  ).body;
  assert.equal((await e.job(retry.id)).issues[0].code, "empty-response");
  await e.restart();
  m = (await e.q("/imports/" + m.id, null, "GET")).body;
  assert.equal(m.drafts[0].title, "人工保留");
});

test("Word answer-only image stays in solution and out of student asset snapshot", async (t) => {
  const { Document, Paragraph, TextRun, ImageRun, Packer } = await import(
    "docx"
  );
  const sharp = (await import("sharp")).default;
  const picture = await sharp({
    create: { width: 30, height: 30, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const bytes = await Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            new Paragraph("1. 求结果。"),
            new Paragraph({
              children: [
                new TextRun("答案：见图"),
                new ImageRun({
                  data: picture,
                  type: "png",
                  transformation: { width: 30, height: 30 },
                }),
              ],
            }),
          ],
        },
      ],
    }),
  );
  const e = await environment(t);
  const form = new FormData();
  form.append("file", new Blob([bytes]), "answer.docx");
  const file = (await e.call("/api/workbench/files", form)).body;
  const m = (
    await e.q("/imports", {
      title: "答案图",
      origin: "",
      input: { kind: "files", fileIds: [file.id], pages: [] },
    })
  ).body;
  assert.ok(["succeeded", "partial"].includes((await e.job(m.jobId)).state));
  const result = (await e.q("/imports/" + m.id, null, "GET")).body;
  assert.equal(
    result.drafts[0].body.blocks.filter((b) => b.type === "image").length,
    0,
  );
  assert.equal(
    result.drafts[0].solution.blocks.filter((b) => b.type === "image").length,
    1,
  );
});

test("frozen old visual response runs through Adapter as replay, not live recognition", async (t) => {
  const raw = fs.readFileSync(
    new URL(
      "../../web/e2e/fixtures/materials-questions/old-I.content.json",
      import.meta.url,
    ),
    "utf8",
  );
  const e = await environment(t, {
    extract: async () => ({
      choices: [{ finish_reason: "stop", message: { content: raw } }],
    }),
  });
  const form = new FormData();
  form.append(
    "file",
    new Blob([
      fs.readFileSync(
        new URL(
          "../../web/e2e/fixtures/materials-questions/P.pdf",
          import.meta.url,
        ),
      ),
    ]),
    "P.pdf",
  );
  const file = (await e.call("/api/workbench/files", form)).body;
  const m = (
    await e.q("/imports", {
      title: "Adapter replay only",
      origin: "fixed old I response on matching P page source",
      input: {
        kind: "files",
        fileIds: [file.id],
        pages: [{ fileId: file.id, pages: [1, 2, 3] }],
      },
    })
  ).body;
  const job = await e.job(m.jobId);
  assert.equal(job.state, "succeeded", JSON.stringify(job));
  const result = (await e.q("/imports/" + m.id, null, "GET")).body;
  assert.equal(result.drafts.length, 6);
  assert.equal(
    result.drafts[0].body.blocks.find((b) => b.type === "list").items.length,
    4,
  );
  assert.equal(result.drafts[0].answerStatus, "present");
  assert.equal(result.drafts[5].answerStatus, "absent");
  fs.writeFileSync(
    path.join(evidenceDir, "adapter-replay.json"),
    JSON.stringify(result, null, 2),
  );
  const commit = await e.q("/imports/" + m.id + "/commit", {
    baseVersion: result.version,
    draftIds: [result.drafts[0].id],
  });
  assert.equal(commit.status, 409);
  assert.equal(commit.body.type, "/problems/materials/draft-not-ready");
});

test("review protects confirmed mappings, invalid taxonomy and explicit source range", async (t) => {
  const e = await environment(t);
  const m = (
    await e.q("/imports", {
      title: "复核",
      origin: "",
      input: { kind: "text", text: "1. 求 $x+1$。\n2. 求 $y+2$。" },
    })
  ).body;
  await e.job(m.jobId);
  let r = (await e.q("/imports/" + m.id, null, "GET")).body;
  const forged = structuredClone(r.drafts);
  forged[0].disposition = "confirmed";
  forged[0].questionId = randomUUID();
  assert.equal(
    (
      await e.q(
        "/imports/" + m.id,
        { baseVersion: r.version, drafts: forged, fragments: [] },
        "PUT",
      )
    ).status,
    422,
  );
  const bad = structuredClone(r.drafts);
  bad[0].parts[0].locations[0].end = 9999;
  assert.equal(
    (
      await e.q(
        "/imports/" + m.id,
        { baseVersion: r.version, drafts: bad, fragments: [] },
        "PUT",
      )
    ).body.type,
    "/problems/materials/invalid-location",
  );
  for (const d of r.drafts)
    for (const i of d.issues) i.resolution = "corrected";
  r = (
    await e.q(
      "/imports/" + m.id,
      { baseVersion: r.version, drafts: r.drafts, fragments: r.fragments },
      "PUT",
    )
  ).body;
  const result = (
    await e.q("/imports/" + m.id + "/commit", {
      baseVersion: r.version,
      draftIds: [r.drafts[0].id],
    })
  ).body;
  r = result.import;
  assert.equal(
    (
      await e.q(
        "/imports/" + m.id,
        { baseVersion: r.version, drafts: [r.drafts[1]], fragments: [] },
        "PUT",
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await e.q(
        "/taxonomy",
        {
          baseVersion: 1,
          types: [
            { id: randomUUID(), name: "Ａ" },
            { id: randomUUID(), name: "Ａ" },
          ],
          tags: [],
        },
        "PUT",
      )
    ).body.type,
    "/problems/materials/invalid-taxonomy",
  );
});

test("PNG table keeps cell grid, transparency and bounded dimensions", async (t) => {
  const e = await environment(t);
  const q = (
    await e.q("/items", {
      ...manual(),
      body: {
        version: 2,
        blocks: [
          {
            type: "table",
            rows: [
              [{ blocks: doc("变量").blocks }, { blocks: doc("结果").blocks }],
              [{ blocks: doc("x").blocks }, { blocks: doc("12").blocks }],
            ],
          },
        ],
      },
    })
  ).body;
  const j = (
    await e.q("/items/" + q.id + "/assets", {
      baseVersion: 1,
      mode: "question-png",
      figureFileId: null,
      includeAnswers: false,
    })
  ).body;
  const output = await e.job(j.id);
  assert.equal(output.state, "succeeded");
  const bytes = await e.bytes(output.outputFileIds[0]);
  const sharp = (await import("sharp")).default;
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1600);
  assert.ok(metadata.height <= 2400);
  assert.equal(metadata.hasAlpha, true);
  const { data, info } = await sharp(bytes)
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0);
  const borderOffset = (49 * info.width + 800) * 4;
  assert.ok(data[borderOffset + 3] > 0, "center column border exists");
  fs.writeFileSync(
    path.join(evidenceDir, "table-asset.png"),
    bytes,
  );
});

test("external E selected pages remain 7 and 8 and original stays complete without online calls", async (t) => {
  const source = process.env.M33_PRIVATE_PDF;
  if (!source) {
    t.skip("fixed private E original unavailable");
    return;
  }
  assert.ok(fs.existsSync(source), "M33_PRIVATE_PDF must point to an existing fixture");
  const bytes = fs.readFileSync(source);
  const { createHash } = await import("node:crypto");
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "b8d34a6aa76a59adfee125c8efb0a12620dffbb797666cbcc6c41b07390d082a",
  );
  const e = await environment(t);
  const form = new FormData();
  form.append("file", new Blob([bytes]), "E.pdf");
  const file = (await e.call("/api/workbench/files", form)).body;
  const m = (
    await e.q("/imports", {
      title: "外部材料选页",
      origin: "",
      input: {
        kind: "files",
        fileIds: [file.id],
        pages: [{ fileId: file.id, pages: [7, 8] }],
      },
    })
  ).body;
  const job = await e.job(m.jobId);
  assert.equal(job.state, "succeeded", JSON.stringify(job));
  const material = (await e.q("/imports/" + m.id, null, "GET")).body;
  assert.ok(material.drafts.length);
  assert.deepEqual([...new Set(material.drafts.flatMap(d => d.parts.flatMap(p => p.locations.map(l => l.page))))].sort(), [7, 8]);
  assert.equal((await e.bytes(file.id)).length, 1115735);
  fs.writeFileSync(
    path.join(evidenceDir, "E-pages.json"),
    JSON.stringify(
      {
        originalSha256: file.sha256,
        byteLength: file.byteLength,
        requestedPages: [7, 8],
        job,
        onlineCalls: 0,
      },
      null,
      2,
    ),
  );
});

test("native math generalizes across changed labels and values without solving missing answers", async (t) => {
  const e = await environment(t);
  const m = (
    await e.q("/imports", {
      title: "非固定样本",
      origin: "",
      input: {
        kind: "text",
        text: "17. 求 g(t)=√(5t+9)/(t+6) 的定义域。\nA. (−∞,6)    B. [0,+∞)\n18. h(t)={ 3t+8, t<4; t²+7, t≥4 }。\n（1）求 h(2)；（2）求 h(8)。\n说明：保留公式源以便校对。\n参考答案\n17. 原稿未提供答案解析。\n18. 答案 h(2)=14。",
      },
    })
  ).body;
  const job = await e.job(m.jobId);
  assert.equal(job.state, "succeeded", JSON.stringify(job));
  const result = (await e.q("/imports/" + m.id, null, "GET")).body;
  assert.equal(result.drafts.length, 2);
  assert.equal(result.drafts[0].answerStatus, "absent");
  assert.match(
    JSON.stringify(result.drafts[0].body),
    /\\\\frac\{\\\\sqrt\{5t\+9\}\}\{t\+6\}/,
  );
  assert.equal(result.drafts[0].body.blocks[1].role, "options");
  assert.match(JSON.stringify(result.drafts[1].body), /begin\{cases\}/);
  assert.equal(result.drafts[1].body.blocks[1].items.length, 2);
  assert.equal(result.fragments[0].text, "说明：保留公式源以便校对。");
  assert.ok(!JSON.stringify(result.drafts[1].body).includes("说明"));
  assert.equal(
    result.drafts[1].solution.blocks[0].runs.find((r) => r.type === "math")
      .latex,
    "h(2)=14",
  );
});

test("complex native OMML keeps nested structures and flags unsupported nodes", async (t) => {
  const { Document, Paragraph, TextRun, ImportedXmlComponent, Packer } =
    await import("docx");
  const math = (xml) =>
    ImportedXmlComponent.fromXmlString(
      `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${xml}</m:oMath>`,
    );
  const r = (x) => `<m:r><m:t>${x}</m:t></m:r>`;
  const fraction = `<m:f><m:num><m:rad><m:e>${r("7z+2")}</m:e></m:rad></m:num><m:den>${r("z-8")}</m:den></m:f>`;
  const matrix = `<m:m><m:mr><m:e>${r("z+3")}</m:e><m:e>${r("z&lt;5")}</m:e></m:mr><m:mr><m:e><m:sSup><m:e>${r("z")}</m:e><m:sup>${r("3")}</m:sup></m:sSup></m:e><m:e>${r("z≥5")}</m:e></m:mr></m:m>`;
  const bytes = await Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun("23. 求 "), math(fraction)],
            }),
            new Paragraph({
              children: [
                new TextRun("24. 分段表达式 "),
                math(
                  `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e>${matrix}</m:e></m:d>`,
                ),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun("25. 核对特殊结构 "),
                math(`<m:phant>${r("q+9")}</m:phant>`),
              ],
            }),
          ],
        },
      ],
    }),
  );
  const e = await environment(t);
  const form = new FormData();
  form.append("file", new Blob([bytes]), "complex.docx");
  const file = (await e.call("/api/workbench/files", form)).body;
  const m = (
    await e.q("/imports", {
      title: "复杂OMML",
      origin: "",
      input: { kind: "files", fileIds: [file.id], pages: [] },
    })
  ).body;
  await e.job(m.jobId);
  const result = (await e.q("/imports/" + m.id, null, "GET")).body;
  assert.equal(result.drafts.length, 3);
  const source = (d) =>
    d.body.blocks
      .flatMap((b) => b.runs ?? [])
      .filter((r) => r.type === "math")
      .map((r) => r.latex)
      .join("");
  assert.equal(source(result.drafts[0]), "\\frac{\\sqrt{7z+2}}{z-8}");
  assert.match(
    source(result.drafts[1]),
    /\\left\\\{\\begin\{matrix\}z\+3 & z<5\\\\\{z\}\^\{3\} & z\\ge 5\\end\{matrix\}\\right\./,
  );
  assert.ok(
    result.drafts[2].issues.some(
      (i) => i.code === "uncertain-formula" && i.resolution === "open",
    ),
  );
  fs.writeFileSync(
    path.join(evidenceDir, "complex-omml.json"),
    JSON.stringify(result, null, 2),
  );
});

test("native nested checks and explanation separation protect confirmation", async (t) => {
  const e = await environment(t),
    text =
      "1. 选择正确选项。\nA. 如图所示 B. 无图\n2. 解方程 x=2。\n说明：以下为格式说明\n答案：x=2";
  const m = (
    await e.q("/imports", {
      title: "审查回归",
      origin: "",
      input: { kind: "text", text },
    })
  ).body;
  await e.job(m.jobId);
  const result = (await e.q("/imports/" + m.id, null, "GET")).body;
  assert.ok(result.drafts[0].issues.some((i) => i.code === "missing-figure"));
  const saved = await e.q(
    "/imports/" + m.id,
    {
      baseVersion: result.version,
      drafts: result.drafts.map((d) => ({
        ...d,
        issues: d.issues.map((i) => ({ ...i, resolution: "acknowledged" })),
      })),
      fragments: result.fragments,
    },
    "PUT",
  );
  assert.equal(saved.status, 200);
  const commit = await e.q("/imports/" + m.id + "/commit", {
    baseVersion: saved.body.version,
    draftIds: [result.drafts[0].id],
  });
  assert.equal(commit.status, 409);
  assert.equal(commit.body.type, "/problems/materials/draft-not-ready");
  assert.equal(result.drafts[1].answerStatus, "present");
  for (const part of result.drafts[1].parts)
    for (const loc of part.locations)
      assert.ok(
        ![...text].slice(loc.start, loc.end).join("").includes("格式说明"),
      );
});

test("native PDF automatically retains six questions, cross-page answers and diagrams", async (t) => {
  const e = await environment(t);
  const original = fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/P.pdf', import.meta.url));
  const form = new FormData();
  form.append('file', new Blob([original]), 'questions.pdf');
  const file = (await e.call('/api/workbench/files', form)).body;
  const created = (await e.q('/imports', {title:'原生 PDF', origin:'隔离样本', input:{kind:'files',fileIds:[file.id],pages:[]}})).body;
  const job = await e.job(created.jobId);
  assert.equal(job.state, 'succeeded', JSON.stringify(job));
  const material = (await e.q('/imports/' + created.id, null, 'GET')).body;
  assert.equal(material.drafts.length, 6);
  assert.equal(material.drafts[0].answerStatus, 'present');
  assert.equal(material.drafts[5].answerStatus, 'absent');
  assert.match(JSON.stringify(material.drafts[0].solution), /根号内非负/);
  assert.ok(material.drafts[0].parts.some(p => p.role === 'solution' && p.locations.some(l => l.page === 4)));
  for (const number of [1, 4, 5]) assert.ok(material.drafts[number].body.blocks.some(b => b.type === 'image'), 'diagram for Q' + (number + 1));
  const paragraphs = number => material.drafts[number].body.blocks.filter(b => b.type === 'paragraph')
    .map(b => b.runs.map(r => r.text ?? r.latex).join(''));
  assert.deepEqual(paragraphs(1), [
    '已知 f(x)=x^{2}-2x-3，配坐标轴与抛物线图，标出顶点和两个横轴交点。',
    '图中红点为 (-1,0)、(1,-4)、(3,0)。',
  ]);
  assert.deepEqual(paragraphs(4), [
    '如图，直角三角形 ABC，\\angle A=90^{\\circ}。求 BC 的长及 \\tan  B。',
    '图示 A 在左下、B 在右下、C 在左上；AB 边标 4，AC 边标 3。',
  ]);
  assert.deepEqual(paragraphs(5), ['正方体 ABCD-A_{1}B_{1}C_{1}D_{1} 的棱长为 2。']);
  assert.match(JSON.stringify(material.drafts[5].body.blocks.find(b => b.type === 'list')), /AC_\{1\}/);
  const cube = material.drafts[5].parts.find(p => p.role === 'figure').locations[0];
  // D₁'s original-page text box ends at 898 / 1262. The old crop cut off
  // both that vertex and the dashed lower edges, even though an image existed.
  assert.ok(cube.box.y + cube.box.height >= 898 / 1262);
  assert.deepEqual(await e.bytes(file.id), original);
  await e.restart();
  assert.deepEqual((await e.q('/imports/' + created.id, null, 'GET')).body, material);
});

for (const twoColumns of [false, true]) test(`native PDF figure boundary preserves nearby formula and prose, columns=${twoColumns}`, async t => {
  const e = await environment(t);
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(new URL(`./fixtures/questions/pdf-figure-${twoColumns ? 'columns' : 'boundary'}.pdf`, import.meta.url))]), 'figure-boundary.pdf');
  const file = (await e.call('/api/workbench/files', form)).body;
  const created = (await e.q('/imports', {title:'图边界', origin:'', input:{kind:'files',fileIds:[file.id],pages:[]}})).body;
  assert.equal((await e.job(created.jobId)).state, 'succeeded');
  const material = (await e.q('/imports/' + created.id, null, 'GET')).body;
  assert.equal(material.drafts.length, twoColumns ? 2 : 1);
  const body = JSON.stringify(material.drafts[0].body);
  assert.match(body, /Keep the question text/);
  assert.match(body, /Keep this explanation/);
  assert.match(body, /x ?\+ ?1 ?= ?5/);
  if (twoColumns) {
    assert.ok(material.drafts.every(d => !d.body.blocks.some(b => b.type === 'image')));
    assert.match(JSON.stringify(material.drafts[1].body), /z ?\+ ?2 ?= ?7/);
    assert.doesNotMatch(body, /Right column|z ?\+ ?2/);
  } else {
    assert.ok(material.drafts[0].body.blocks.some(b => b.type === 'image'));
    const paragraphs = material.drafts[0].body.blocks.filter(b => b.type === 'paragraph');
    assert.ok(!paragraphs.some(b => /^[AB]$/.test(b.runs.map(r => r.text ?? r.latex).join(''))));
  }
});

test("question search excludes answers by default and accepts only explicit boolean answer scope", async (t) => {
  const e = await environment(t);
  const q = (await e.q('/items', { ...manual(), title: '题干检索', solution: doc('只在答案中的蓝莓'), answerStatus: 'present' })).body;
  assert.equal((await e.q('/items?q=蓝莓', null, 'GET')).body.items.length, 0);
  assert.equal((await e.q('/items?q=蓝莓&searchAnswers=false', null, 'GET')).body.items.length, 0);
  assert.deepEqual((await e.q('/items?q=蓝莓&searchAnswers=true', null, 'GET')).body.items.map(x => x.id), [q.id]);
  assert.deepEqual((await e.q('/items?q=检索', null, 'GET')).body.items.map(x => x.id), [q.id]);
  assert.equal((await e.q('/items?searchAnswers=1', null, 'GET')).status, 422);
  assert.equal((await e.q('/items?searchAnswers=true&searchAnswers=false', null, 'GET')).status, 422);
  assert.equal((await e.q('/items?q=蓝莓&searchAnswers=true', null, 'GET', 'r33-b')).body.items.length, 0);
});

test("missing PDF reading tool preserves the original and can retry after configuration is restored", async (t) => {
  const e = await environment(t);
  const original = fs.readFileSync(new URL('../../web/e2e/fixtures/materials-questions/P.pdf', import.meta.url));
  const form = new FormData();
  form.append('file', new Blob([original]), 'questions.pdf');
  const file = (await e.call('/api/workbench/files', form)).body;
  const configured = process.env.QUESTIONS_XPDF_PDFTOHTML;
  let created;
  try {
    process.env.QUESTIONS_XPDF_PDFTOHTML = '/nonexistent/questions-pdftohtml';
    const response = await e.q('/imports', { title: '读取工具不可用', origin: '', input: {kind: 'files', fileIds: [file.id], pages: []} });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    created = response.body;
    const failed = await e.job(created.jobId);
    assert.equal(failed.state, 'failed');
    assert.ok(failed.issues.some(i => i.code === 'provider-result-unknown'));
    assert.equal((await e.q('/imports/' + created.id, null, 'GET')).body.drafts.length, 0);
    assert.deepEqual(await e.bytes(file.id), original);
  } finally {
    if (configured === undefined) delete process.env.QUESTIONS_XPDF_PDFTOHTML;
    else process.env.QUESTIONS_XPDF_PDFTOHTML = configured;
  }
  const retried = (await e.call('/api/workbench/jobs/' + created.jobId + '/retry', {unitIds: []})).body;
  assert.equal((await e.job(retried.id)).state, 'succeeded');
  assert.ok((await e.q('/imports/' + created.id, null, 'GET')).body.drafts.length > 0);
  assert.deepEqual(await e.bytes(file.id), original);
});
