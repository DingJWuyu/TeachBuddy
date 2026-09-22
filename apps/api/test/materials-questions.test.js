import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
      new URL(
        "../../../docs/acceptance/evidence/R33/v1/attempt2/native-" +
          name +
          ".json",
        import.meta.url,
      ),
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
    new URL(
      "../../../docs/acceptance/evidence/R33/v1/attempt2/adapter-replay.json",
      import.meta.url,
    ),
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
    new URL(
      "../../../docs/acceptance/evidence/R33/v1/attempt2/table-asset.png",
      import.meta.url,
    ),
    bytes,
  );
});

test("external E selected pages remain 7 and 8 and original stays complete without online calls", async (t) => {
  const source =
    "/home/liam_t/项目/TeacherWorkspace-c21/experiments/C21/data/external/E.pdf";
  if (!fs.existsSync(source)) {
    t.skip("fixed private E original unavailable");
    return;
  }
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
  assert.equal(job.state, "failed");
  assert.deepEqual(
    job.issues.map((i) => i.unitId),
    [`file:${file.id}:page:7`, `file:${file.id}:page:8`],
  );
  assert.equal((await e.bytes(file.id)).length, 1115735);
  fs.writeFileSync(
    new URL(
      "../../../docs/acceptance/evidence/R33/v1/attempt2/E-pages.json",
      import.meta.url,
    ),
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
    new URL(
      "../../../docs/acceptance/evidence/R33/v1/attempt2/complex-omml.json",
      import.meta.url,
    ),
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
