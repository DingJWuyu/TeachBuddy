import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import assert from "node:assert/strict";
import { start } from "./server.mjs";
const dir = path.resolve("docs/acceptance/evidence/R34/v1/outputs");
if (fs.existsSync(dir)) {
  const previous = path.resolve(
    "test-results/r34",
    `outputs-previous-${Date.now()}`,
  );
  fs.mkdirSync(path.dirname(previous), { recursive: true });
  fs.renameSync(dir, previous);
}
fs.mkdirSync(dir, { recursive: true });
const runtime = await start({
  dataDir: path.resolve("test-results/r34/outputs-data"),
  port: 48435,
});
const origin = "http://localhost:48435";
const cookie = runtime.context.workbench.identity
  .testPrincipalCookie("r34-a")
  .header.split(";")[0];
async function api(method, url, input, key = randomUUID()) {
  const response = await fetch(origin + url, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      "X-TeachBuddy-Request": "1",
      "Idempotency-Key": key,
      ...(input ? { "Content-Type": "application/json" } : {}),
    },
    body: input ? JSON.stringify(input) : undefined,
  });
  const body = await response.json();
  assert.ok(response.ok, JSON.stringify({ status: response.status, body }));
  return body;
}
const paragraph = (text) => ({
  type: "paragraph",
  runs: [{ type: "text", text }],
});
const q = [...runtime.adapters.questions.values()][0],
  r = [...runtime.adapters.resources.values()][0];
q.snapshot.solution.blocks[0] = paragraph("ANSWER-ONLY Q2配方：");
q.snapshot.body.blocks.push(
  { type: "math", latex: "\\sqrt[3]{x_1^2+1}+\\log_2 x\\in(-\\infty,3]" },
  {
    type: "list",
    role: "subquestions",
    items: [
      { label: "(1)", blocks: [paragraph("写出分式有意义的条件。")] },
      { label: "(2)", blocks: [paragraph("讨论分段函数在零点两侧的取值。")] },
    ],
  },
);
const picture = await runtime.context.workbench.files.store(
  { accountKey: "r34-a" },
  {
    name: "triangle.png",
    mediaType: "image/png",
    bytes: await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="190"><rect width="360" height="190" fill="white"/><path d="M40 160 L180 20 L320 160 Z" stroke="black" stroke-width="2" fill="none"/><text x="174" y="16">A</text><text x="20" y="176">B</text><text x="326" y="176">C</text></svg>',
      ),
    )
      .png()
      .toBuffer(),
  },
  { key: randomUUID(), method: "POST", path: "/fixture/diagram" },
);
q.snapshot.body.blocks.push({
  type: "image",
  fileId: picture.id,
  alt: "三角形 ABC",
  widthMm: 80,
});
const q2 = structuredClone(q);
q2.id = randomUUID();
q2.snapshot.title = "未提供答案的练习";
q2.snapshot.solution = { version: 2, blocks: [] };
q2.snapshot.answerStatus = "absent";
runtime.adapters.questions.set(q2.id, q2);
const sectionId = randomUUID();
const input = {
  title: "函数与定义域 - 输出核验",
  intro: {
    version: 2,
    blocks: [
      paragraph("INTRO-PUBLIC 本课从定义域出发，讨论代数表达式的意义。"),
      {
        type: "paragraph",
        runs: [
          { type: "text", text: "行内分式：" },
          { type: "math", latex: "\\frac{2x-1}{x+3}" },
        ],
      },
      {
        type: "teacher-note",
        blocks: [paragraph("TEACHER-ONLY 关注条件遗漏。")],
      },
    ],
  },
  sections: [
    {
      id: sectionId,
      title: "自主探究",
      content: {
        version: 2,
        blocks: [
          paragraph("SECTION-PUBLIC 请先独立思考，再交流。"),
          {
            type: "table",
            rows: [
              [
                { blocks: [paragraph("表达式")] },
                { blocks: [paragraph("限制条件")] },
              ],
              [
                { blocks: [{ type: "math", latex: "\\sqrt{x-1}" }] },
                { blocks: [{ type: "math", latex: "x\\ge1" }] },
              ],
            ],
          },
        ],
      },
      references: [
        {
          id: randomUUID(),
          kind: "question",
          questionId: q.id,
          questionVersion: 1,
          note: "LESSON-NOTE 留意分母不为零。",
        },
        {
          id: randomUUID(),
          kind: "resource",
          resourceId: r.id,
          resourceVersion: 1,
          note: "RESOURCE-LESSON-NOTE",
        },
        {
          id: randomUUID(),
          kind: "question",
          questionId: q2.id,
          questionVersion: 1,
          note: "",
        },
      ],
    },
  ],
  materials: [],
};
const results = [];
try {
  const lesson = await api("POST", "/api/modules/lessons/v2/items", input);
  fs.writeFileSync(
    path.join(dir, "lesson.json"),
    JSON.stringify(lesson, null, 2),
  );
  for (const kind of ["lesson-plan", "handout", "practice"])
    for (const format of ["docx", "pdf"])
      for (const flags of ["00", "10", "01", "11"]) {
        const name = `${kind}-${format}-${flags}`;
        const record = await api(
          "POST",
          `/api/modules/lessons/v2/items/${lesson.id}/exports`,
          {
            baseVersion: lesson.version,
            kind,
            format,
            includeAnswers: flags[0] === "1",
            includeTeacherNotes: flags[1] === "1",
            sectionIds: [sectionId],
            materialReferenceIds: [],
            answerSpaceLines: 3,
          },
        );
        let job;
        const deadline = Date.now() + 120000;
        do {
          job = await api("GET", `/api/workbench/jobs/${record.jobId}`);
          if (!["queued", "running"].includes(job.state)) break;
          await new Promise((r) => setTimeout(r, 100));
        } while (Date.now() < deadline);
        assert.equal(job.state, "succeeded", JSON.stringify(job));
        const file = await api(
          "GET",
          `/api/workbench/files/${job.outputFileIds[0]}`,
        );
        const response = await fetch(
          `${origin}/api/workbench/files/${file.id}/content`,
          { headers: { Cookie: cookie } },
        );
        assert.equal(response.status, 200);
        const bytes = Buffer.from(await response.arrayBuffer()),
          output = path.join(dir, `${name}.${format}`);
        fs.writeFileSync(output, bytes);
        let text;
        if (format === "docx") {
          const zip = await JSZip.loadAsync(bytes);
          text = (
            await Promise.all(
              Object.values(zip.files)
                .filter((f) => f.name.endsWith(".xml"))
                .map((f) => f.async("string")),
            )
          ).join("\n");
          assert.match(text, /<m:f>/);
          assert.match(text, /<m:rad>/);
          assert.match(text, /<m:m>/);
        } else {
          text = execFileSync("pdftotext", ["-layout", output, "-"], {
            encoding: "utf8",
          });
          execFileSync(
            "pdftoppm",
            ["-scale-to", "1400", "-png", output, path.join(dir, name)],
            { stdio: "pipe" },
          );
        }
        assert.equal(
          text.includes("ANSWER-ONLY"),
          flags[0] === "1",
          `${name} answer`,
        );
        assert.equal(
          text.includes("TEACHER-ONLY"),
          flags[1] === "1",
          `${name} teacher`,
        );
        assert.equal(
          text.includes("LESSON-NOTE"),
          flags[1] === "1",
          `${name} lesson-note`,
        );
        assert.equal(
          text.includes("INTRO-PUBLIC"),
          kind !== "practice",
          `${name} intro`,
        );
        assert.equal(
          text.includes("SECTION-PUBLIC"),
          kind !== "practice",
          `${name} section`,
        );
        if (kind === "practice") assert.ok(!text.includes("课堂阅读资料"));
        fs.writeFileSync(path.join(dir, `${name}.txt`), text);
        results.push({
          name,
          fileId: file.id,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          byteLength: bytes.length,
          jobId: job.id,
          state: job.state,
        });
        console.log(`${name} PASS`);
      }
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(results, null, 2),
  );
} finally {
  await runtime.close();
}
