import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = "/tmp/teacher-r35-local2-candidate";
const at = (p) => p.startsWith("docs/acceptance/evidence/R33/v1/attempt4/") ? path.join("/home/liam_t/\u9879\u76ee/TeacherWorkspace-r35-local-recheck/docs/acceptance/evidence/R35/v1/local2/fragments-api", path.basename(p)) : path.resolve(root, p);
import sharp from "/tmp/teacher-r35-local2-candidate/node_modules/sharp/dist/index.mjs";
import { startQuestionsFixture } from "/tmp/teacher-r35-local2-candidate/apps/web/e2e/fixtures/materials-questions/server.mjs";

const fragment = (role, text, extra = {}) => ({
  role,
  label: "7.",
  section: "集合",
  group: "练习",
  text,
  content: [{ text }],
  continues: "",
  doubts: [],
  ...extra,
});
async function setup(t, responses, options = {}) {
  let calls = 0;
  const dataDir = fs.mkdtempSync("/tmp/r35-local2-fragments-");
  const provider = {
    extract: async () => {
      const result = responses[calls++];
      if (result instanceof Error) throw result;
      return typeof result === "string"
        ? { content: result }
        : { content: JSON.stringify({ fragments: result }) };
    },
  };
  let runtime = await startQuestionsFixture({ dataDir, port: 0, provider });
  t.after(async () => {
    runtime.server.closeAllConnections();
    await runtime.close();
  });
  const call = async (path, body, method = "POST") => {
    const response = await fetch(
      `http://localhost:${runtime.server.address().port}${path}`,
      {
        method,
        headers: {
          Cookie: runtime.workbench.identity
            .testPrincipalCookie("r33-a")
            .header.split(";")[0],
          Origin: "http://localhost:0",
          "X-TeachBuddy-Request": "1",
          "Idempotency-Key": randomUUID(),
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        ...(body
          ? { body: body instanceof FormData ? body : JSON.stringify(body) }
          : {}),
      },
    );
    const result = await response.json();
    assert.ok(response.ok, JSON.stringify(result));
    return result;
  };
  const fileIds = [];
  for (let i = 0; i < (options.file ? 1 : responses.length); i++) {
    const form = new FormData();
    form.append(
      "file",
      new Blob([
        options.file
          ? fs.readFileSync(at(options.file))
          : await sharp({
              create: {
                width: 100,
                height: 100,
                channels: 3,
                background: i ? "white" : "blue",
              },
            })
              .png()
              .toBuffer(),
      ]),
      options.file ? options.file.split("/").at(-1) : `page-${i + 1}.png`,
    );
    fileIds.push((await call("/api/workbench/files", form)).id);
  }
  const base = "/api/modules/questions/v2/imports";
  const material = await call(base, {
    title: "合成控制流，不计识别质量",
    origin: "",
    input: {
      kind: "files",
      fileIds,
      pages: options.pages
        ? [{ fileId: fileIds[0], pages: options.pages }]
        : [],
    },
  });
  const wait = async (id) => {
    for (let n = 0; n < 300; n++) {
      const job = await call("/api/workbench/jobs/" + id, null, "GET");
      if (!["queued", "running", "cancelling"].includes(job.state)) return job;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw Error("timeout");
  };
  const job = await wait(material.jobId);
  return {
    call,
    wait,
    job,
    fileIds,
    async restart() {
      runtime.server.closeAllConnections();
      await runtime.close();
      runtime = await startQuestionsFixture({ dataDir, port: 0, provider });
    },
    async bytes(id) {
      const response = await fetch(
        `http://localhost:${runtime.server.address().port}/api/workbench/files/${id}/content`,
        {
          headers: {
            Cookie: runtime.workbench.identity
              .testPrincipalCookie("r33-a")
              .header.split(";")[0],
          },
        },
      );
      assert.equal(response.status, 200);
      return Buffer.from(await response.arrayBuffer());
    },
    read: () => call(base + "/" + material.id, null, "GET"),
    get calls() {
      return calls;
    },
  };
}

test("selected original pages merge a unique question and independently located answer", async (t) => {
  const e = await setup(t, [
    [fragment("question", "求集合的交集。")],
    [fragment("answer", "交集为空集。")],
  ]);
  const m = await e.read();
  fs.writeFileSync(
    at("docs/acceptance/evidence/R33/v1/attempt4/first-http.json"),
    JSON.stringify({ job: e.job, material: m }, null, 2),
  );
  assert.equal(m.drafts.length, 1);
  assert.equal(m.drafts[0].answerStatus, "present");
  assert.deepEqual(
    m.drafts[0].parts.map((p) => [p.role, p.locations[0].fileId]),
    [
      ["body", e.fileIds[0]],
      ["solution", e.fileIds[1]],
    ],
  );
});

test("failed answer page remains unresolved; explicit retry preserves human review and successful pages", async (t) => {
  const responses = [
    [fragment("question", "求交集。")],
    new Error("synthetic unknown"),
  ];
  const e = await setup(t, responses);
  let m = await e.read();
  assert.equal(e.job.state, "partial");
  assert.equal(m.drafts[0].answerStatus, "unresolved");
  const original = structuredClone(m.drafts[0]);
  m.drafts[0].title = "人工标题";
  m = await e.call(
    "/api/modules/questions/v2/imports/" + m.id,
    { baseVersion: m.version, drafts: m.drafts, fragments: m.fragments },
    "PUT",
  );
  responses.push([fragment("answer", "空集。")]);
  const retry = await e.call("/api/workbench/jobs/" + m.jobId + "/retry", {
    unitIds: [],
  });
  await e.wait(retry.id);
  m = await e.read();
  assert.equal(e.calls, 3);
  assert.equal(m.drafts.find((d) => d.id === original.id).title, "人工标题");
  assert.equal(
    m.drafts.find((d) => d.id === original.id).answerStatus,
    "unresolved",
  );
  assert.equal(m.drafts.filter((d) => d.answerStatus === "present").length, 1);
  await e.restart();
  assert.deepEqual((await e.read()).drafts, m.drafts);
  assert.equal(e.calls, 3);
});

test("only explicit unique continuation merges; duplicate labels and ambiguous answers remain unassigned", async (t) => {
  const e = await setup(t, [
    [fragment("question", "已知集合 A。")],
    [fragment("continuation", "求其补集。", { continues: "7." })],
    [fragment("answer", "补集为 B。")],
  ]);
  const m = await e.read();
  assert.equal(m.drafts.length, 1);
  assert.equal(m.drafts[0].parts.filter((p) => p.role === "body").length, 2);
  assert.equal(m.drafts[0].answerStatus, "present");
  assert.match(JSON.stringify(m.drafts[0].body), /求其补集/);
  const ambiguous = await setup(t, [
    [fragment("question", "第一题。"), fragment("question", "另一同号题。")],
    [fragment("answer", "不能选定归属。")],
  ]);
  const a = await ambiguous.read();
  assert.ok(a.drafts.every((d) => d.answerStatus === "unresolved"));
  assert.equal(a.fragments.length, 1);
});

test("truncated fragment prefix is retained without constructing the incomplete question", async (t) => {
  const raw =
    '{"fragments":[' +
    JSON.stringify(fragment("other", "标题")) +
    ',{"role":"question","text":"缺失';
  const e = await setup(t, [raw]);
  const m = await e.read();
  assert.equal(e.job.state, "partial");
  assert.equal(e.job.issues[0].code, "truncated-response");
  assert.equal(m.drafts.length, 0);
  assert.ok(m.fragments.some((f) => f.text === "标题"));
});

test("own PDF layout binds a real crop; unverified image associations remain blocked", async (t) => {
  const e = await setup(
    t,
    [[fragment("question", "如图，求函数性质。", { label: "Q2." })]],
    {
      file: "apps/web/e2e/fixtures/materials-questions/P.pdf",
      pages: [1],
    },
  );
  const m = await e.read();
  fs.writeFileSync(
    at("docs/acceptance/evidence/R33/v1/attempt4/pdf-crop.json"),
    JSON.stringify(m, null, 2),
  );
  const d = m.drafts[0];
  assert.ok(d.body.blocks.some((b) => b.type === "image"));
  const source = d.parts.find((p) => p.role === "figure").locations[0];
  assert.equal(source.fileId, e.fileIds[0]);
  assert.equal(source.page, 1);
  assert.ok(source.box.width > 0.1);
  const crop = d.body.blocks.find((b) => b.type === "image");
  fs.writeFileSync(
    at("docs/acceptance/evidence/R33/v1/attempt4/own-pdf-crop.png"),
    await e.bytes(crop.fileId),
  );
  const preview = await e.call(
    "/api/workbench/files/" + e.fileIds[0] + "/preview",
    null,
    "GET",
  );
  const page = preview.pages[0];
  const expected = await sharp(await e.bytes(page.imageFileId))
    .extract({
      left: Math.floor(source.box.x * page.width),
      top: Math.floor(source.box.y * page.height),
      width: Math.round(source.box.width * page.width),
      height: Math.round(source.box.height * page.height),
    })
    .png()
    .toBuffer();
  assert.deepEqual(await e.bytes(crop.fileId), expected);
  const ambiguous = await setup(t, [[fragment("question", "如图求值。")]]);
  assert.ok(
    (await ambiguous.read()).drafts[0].issues.some(
      (i) => i.code === "missing-figure" && i.resolution === "open",
    ),
  );
});

test("fixed O page 2 replay retains only complete prefix and never invents Q3/Q4", async (t) => {
  const raw = fs.readFileSync(
    at(
      "apps/web/e2e/fixtures/materials-questions/attempt4/old-page-2.content.txt",
    ),
    "utf8",
  );
  const e = await setup(t, [raw], {
    file: "apps/web/e2e/fixtures/materials-questions/attempt4/old-page-2.png",
  });
  const m = await e.read();
  assert.equal(m.drafts.length, 0);
  assert.equal(e.job.issues[0].code, "truncated-response");
  assert.ok(m.fragments.some((f) => f.text === "第2页 · 原题"));
  fs.writeFileSync(
    at("docs/acceptance/evidence/R33/v1/attempt4/old-response-replay.json"),
    JSON.stringify({ job: e.job, material: m }, null, 2),
  );
});

test(
  "selected actual pages 7 and 8 retain original numbering and explicit continuation",
  {
    skip: !fs.existsSync(
      "/home/liam_t/项目/TeacherWorkspace-c21/experiments/C21/data/external/E.pdf",
    ),
  },
  async (t) => {
    assert.equal(
      createHash("sha256")
        .update(
          fs.readFileSync(
            "/home/liam_t/项目/TeacherWorkspace-c21/experiments/C21/data/external/E.pdf",
          ),
        )
        .digest("hex"),
      "b8d34a6aa76a59adfee125c8efb0a12620dffbb797666cbcc6c41b07390d082a",
    );
    const e = await setup(
      t,
      [
        [fragment("question", "合成题面。")],
        [fragment("continuation", "合成续文。", { continues: "7." })],
      ],
      {
        file: "/home/liam_t/项目/TeacherWorkspace-c21/experiments/C21/data/external/E.pdf",
        pages: [8, 7],
      },
    );
    const m = await e.read();
    assert.deepEqual(
      m.drafts[0].parts
        .filter((p) => p.role === "body")
        .map((p) => p.locations[0].page),
      [7, 8],
    );
    assert.equal(m.drafts[0].answerStatus, "absent");
    fs.writeFileSync(
      at(
        "docs/acceptance/evidence/R33/v1/attempt4/selected-pages-synthetic.json",
      ),
      JSON.stringify({ job: e.job, material: m }, null, 2),
    );
  },
);

test("identical native text imports keep independent editable draft identities", async (t) => {
  const e = await setup(t, [[fragment("other", "fixture")]]);
  const base = "/api/modules/questions/v2/imports";
  const materials = [];
  for (let i = 0; i < 2; i++) {
    const m = await e.call(base, {
      title: "同文不同材料",
      origin: "",
      input: { kind: "text", text: "1. 求值。" },
    });
    await e.wait(m.jobId);
    materials.push(await e.call(base + "/" + m.id, null, "GET"));
  }
  assert.notEqual(materials[0].drafts[0].id, materials[1].drafts[0].id);
  const m = materials[1];
  m.drafts[0].title = "局部校对";
  assert.equal(
    (
      await e.call(
        base + "/" + m.id,
        { baseVersion: m.version, drafts: m.drafts, fragments: m.fragments },
        "PUT",
      )
    ).drafts[0].title,
    "局部校对",
  );
});

test("uncertain explicit absence and incomplete selected pages stay unresolved", async (t) => {
  for (const responses of [
    [
      [fragment("question", "求值。")],
      [fragment("answer", "未提供答案", { doubts: ["局部遮挡"] })],
    ],
    [
      [fragment("question", "求值。")],
      [fragment("answer", "未提供答案")],
      new Error("unknown page"),
    ],
  ]) {
    const e = await setup(t, responses);
    assert.equal((await e.read()).drafts[0].answerStatus, "unresolved");
  }
});

// An intentionally synthetic two-column original, with one right-column figure.
// PDF offsets are format framing, not a second implementation of extraction.
function twoColumnPdf() {
  const content =
    "BT /F1 14 Tf 40 750 Td (1. Left question) Tj ET\nBT /F1 14 Tf 320 750 Td (2. Right question) Tj ET\n320 480 180 160 re S\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
test("two same-height column anchors cannot claim the same figure", async (t) => {
  const dir = fs.mkdtempSync("/tmp/r33-columns-");
  const file = path.join(dir, "columns.pdf");
  fs.writeFileSync(file, twoColumnPdf());
  const e = await setup(
    t,
    [
      [
        fragment("question", "如图，左栏题。", { label: "1." }),
        fragment("question", "如图，右栏题。", { label: "2." }),
      ],
    ],
    { file },
  );
  const m = await e.read();
  assert.equal(m.drafts.length, 2);
  assert.ok(
    m.drafts.every((d) => !d.body.blocks.some((b) => b.type === "image")),
  );
  assert.ok(
    m.drafts.every((d) =>
      d.issues.some(
        (i) => i.code === "missing-figure" && i.resolution === "open",
      ),
    ),
  );
});
