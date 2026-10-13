// Public HTTP fixture shared by the materials API and browser checks.
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
export const Q = "/api/modules/questions/v2/items";
export const paragraph = (text) => ({
  type: "paragraph",
  runs: [{ type: "text", text }],
});
export const doc = (text, version = 2) => ({
  version,
  blocks: text ? [paragraph(text)] : [],
});
export const question = (title = "丰富题目", version = 2) => ({
  title,
  body: doc("求二次函数的零点", version),
  solution: doc("", version),
  answerStatus: "absent",
  note: "原始私密笔记",
  starred: false,
  typeId: null,
  tagIds: [],
  source: { kind: "manual" },
});
export const writable = (q) =>
  Object.fromEntries(
    [
      "title",
      "body",
      "solution",
      "answerStatus",
      "note",
      "starred",
      "typeId",
      "tagIds",
    ].map((k) => [k, q[k]]),
  );
export function http(client, trace = []) {
  return async (
    method,
    url,
    body,
    status = 200,
    key = randomUUID(),
    options = {},
  ) => {
    const r = await client.request(method, url, {
      ...options,
      body,
      headers: { "Idempotency-Key": key, ...options.headers },
    });
    trace.push({
      method,
      url,
      request: body,
      status: r.status,
      response: r.json,
      key,
    });
    assert.equal(
      r.status,
      status,
      `${method} ${url}: ${JSON.stringify(r.json)}`,
    );
    return r.json;
  };
}
export async function seedRich(client) {
  const call = http(client);
  const boundary = "mta-" + randomUUID();
  const png = fs.readFileSync(
    new URL(
      "../../web/e2e/fixtures/materials-questions/figure.png",
      import.meta.url,
    ),
  );
  const uploaded = await client.request("POST", "/api/workbench/files", {
    headers: { "Idempotency-Key": randomUUID() },
    contentType: `multipart/form-data; boundary=${boundary}`,
    rawBody: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="triangle.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.json));
  const input = question("丰富题目：零点与图形");
  input.body.blocks.push(
    {
      type: "image",
      fileId: uploaded.json.id,
      alt: "零点三角形配图",
      widthMm: 60,
    },
    {
      type: "table",
      rows: [
        [{ blocks: [paragraph("x")] }, { blocks: [paragraph("y")] }],
        [{ blocks: [paragraph("2")] }, { blocks: [paragraph("0")] }],
      ],
    },
    {
      type: "list",
      role: "options",
      items: [
        { label: "A", blocks: [paragraph("两个零点")] },
        { label: "B", blocks: [paragraph("没有零点")] },
      ],
    },
    { type: "math", latex: "x^2-4=0" },
  );
  input.solution = doc("答案：两个零点，分别为 -2 与 2");
  input.answerStatus = "present";
  const rich = await call("POST", Q, input, 201);
  const v1 = await call("POST", Q, question("手工旧题", 1), 201);
  const copy = await call(
    "POST",
    `${Q}/${rich.id}/copies`,
    { ...writable(rich), title: "丰富复制题", baseVersion: rich.version },
    201,
  );
  const imp = await call(
    "POST",
    "/api/modules/questions/v2/imports",
    {
      title: "已确认导入题",
      origin: "固定纯文本，未调用模型",
      input: { kind: "text", text: "1. 求 $x^2=4$ 的解。\n答案：$x=\\pm2$" },
    },
    201,
  );
  let material;
  for (let n = 0; n < 200; n++) {
    material = await call("GET", `/api/modules/questions/v2/imports/${imp.id}`);
    if (material.drafts.length) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(material.drafts.length);
  material = await call("PUT", `/api/modules/questions/v2/imports/${imp.id}`, {
    baseVersion: material.version,
    drafts: material.drafts.map((d) => ({
      ...d,
      issues: d.issues.map((i) => ({ ...i, resolution: "corrected" })),
    })),
    fragments: material.fragments,
  });
  const committed = await call(
    "POST",
    `/api/modules/questions/v2/imports/${imp.id}/commit`,
    { baseVersion: material.version, draftIds: [material.drafts[0].id] },
  );
  return {
    rich,
    v1,
    copy,
    imported: committed.questions[0],
    fileId: uploaded.json.id,
  };
}
