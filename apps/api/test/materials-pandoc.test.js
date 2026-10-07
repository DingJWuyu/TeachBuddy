import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import JSZip from "jszip";
import sharp from "sharp";
import { DOMParser } from "@xmldom/xmldom";
import { startMaterialsHttp } from "../../web/e2e/fixtures/materials-integration/server.mjs";
import { runNativePagination } from "../../web/e2e/fixtures/lessons-pagination/native.mjs";

const fixtures = fileURLToPath(new URL("../../web/e2e/fixtures/lessons-pagination/", import.meta.url));
const binary = process.env.MATERIALS_PANDOC_PATH || "/usr/bin/pandoc";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const walk = (value, type) => {
  if (!value || typeof value !== "object") return [];
  return [...(value.t === type ? [value] : []), ...Object.values(value).flatMap(v => walk(v, type))];
};

test("Pandoc v3 real-auth pagination: all options and required figures stay with a normal-size question", { timeout: 240000 }, async () => {
  const evidence = process.env.R34_PANDOC_EVIDENCE || fs.mkdtempSync(path.join(os.tmpdir(), "lesson-pagination-evidence-"));
  for (const kind of ["lesson-plan", "handout", "practice"]) {
    await runNativePagination({ destination: path.join(evidence, `native-${kind}`), kind });
    await runNativePagination({ destination: path.join(evidence, `native-${kind}-teacher`), kind,
      includeAnswers: true, includeTeacherNotes: true });
  }
  await runNativePagination({ destination: path.join(evidence, "native-long-question"), kind: "practice", lines: 20, longQuestion: true });
  await runNativePagination({ destination: path.join(evidence, "native-long-narrative"), kind: "practice", lines: 20, longQuestion: "narrative" });
});

test("Pandoc real HTTP: six rich questions, 24 outputs, editable math readback, isolation and retained sources", { timeout: 240000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "r34-pandoc-http-"));
  const evidence = process.env.R34_PANDOC_EVIDENCE || path.join(directory, "evidence");
  fs.mkdirSync(evidence, { recursive: true });
  let world = await startMaterialsHttp(directory);
  t.after(() => world.close());
  async function call(route, body, method = body === undefined ? "GET" : "POST", account = "integration-a") {
    const response = await fetch(world.origin + route, {
      method, headers: {
        Cookie: world.workbench.identity.testPrincipalCookie(account).header.split(";")[0],
        Origin: "http://localhost", "X-TeachBuddy-Request": "1", "Idempotency-Key": randomUUID(),
        ...(body instanceof FormData || body === undefined ? {} : { "Content-Type": "application/json" }),
      }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, bytes, json: response.headers.get("content-type")?.includes("json") ? JSON.parse(bytes) : null };
  }
  async function ok(route, body, method, status = 200) {
    const result = await call(route, body, method);
    assert.equal(result.status, status, JSON.stringify(result.json));
    return result.json;
  }
  async function wait(id) {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const job = await ok(`/api/workbench/jobs/${id}`);
      if (!["queued", "running", "cancelling"].includes(job.state)) return job;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail("export deadline");
  }
  const source = JSON.parse(fs.readFileSync(path.join(fixtures, "lesson.json")));
  const images = new Map();
  for (const name of fs.readdirSync(fixtures).filter(n => n.endsWith(".png"))) {
    const bytes = fs.readFileSync(path.join(fixtures, name));
    const form = new FormData(); form.append("file", new Blob([bytes], { type: "image/png" }), name);
    const file = await ok("/api/workbench/files", form, "POST", 201);
    images.set(name.slice(0, -4), { file, bytes });
  }
  const remap = value => {
    if (!value || typeof value !== "object") return;
    if (value.type === "image") value.fileId = images.get(value.fileId).file.id;
    Object.values(value).forEach(remap);
  };
  const references = [];
  for (const original of source.sections.flatMap(s => s.references).filter(r => r.kind === "question")) {
    const snapshot = structuredClone(original.snapshot); remap(snapshot);
    const question = await ok("/api/modules/questions/v2/items", {
      ...snapshot, source: { kind: "manual" }, note: "长期私密笔记不得输出", starred: false, typeId: null, tagIds: [],
    }, "POST", 201);
    references.push({ id: randomUUID(), kind: "question", questionId: question.id, questionVersion: question.version, note: original.note });
  }
  const sid = randomUUID();
  const table = { type: "table", rows: [[
    { blocks: [{ type: "paragraph", runs: [{ type: "text", text: "表格中文与符号 $ < & \\alpha" }] }] },
    { blocks: [{ type: "math", latex: "\\sqrt[3]{x}+\\frac{1}{2}" }] },
  ]] };
  const lessonInput = {
    title: "函数与空间几何 - Pandoc产品验收", intro: source.intro,
    sections: [{ id: sid, title: "自主探究", content: { version: 2, blocks: [table, ...source.sections[0].content.blocks] }, references }],
    materials: [],
  };
  const lesson = await ok("/api/modules/lessons/v2/items", lessonInput, "POST", 201);
  fs.writeFileSync(path.join(evidence, "accepted-lesson.json"), JSON.stringify(lesson, null, 2));
  const manifest = [];
  for (const kind of ["lesson-plan", "handout", "practice"])
    for (const includeAnswers of [false, true])
      for (const includeTeacherNotes of [false, true])
        for (const format of ["docx", "pdf"]) {
          const options = { baseVersion: lesson.version, kind, format, includeAnswers, includeTeacherNotes,
            sectionIds: [sid], materialReferenceIds: [], answerSpaceLines: 4 };
          const accepted = await ok(`/api/modules/lessons/v2/items/${lesson.id}/exports`, options, "POST", 202);
          const job = await wait(accepted.jobId);
          assert.equal(job.state, "succeeded", JSON.stringify(job));
          const download = await call(`/api/workbench/files/${job.outputFileIds[0]}/content`);
          assert.equal(download.status, 200);
          assert.equal((await call(`/api/workbench/files/${job.outputFileIds[0]}/content`, undefined, "GET", "integration-b")).status, 404);
          const name = `${kind}-${Number(includeAnswers)}${Number(includeTeacherNotes)}.${format}`;
          const target = path.join(evidence, name); fs.writeFileSync(target, download.bytes);
          let content, formulas = null, pages = null;
          if (format === "docx") {
            const zip = await JSZip.loadAsync(download.bytes);
            const xml = await zip.file("word/document.xml").async("string");
            const ast = JSON.parse(execFileSync(binary, [target, "--fail-if-warnings", "-t", "json"], { maxBuffer: 8 * 1024 * 1024 }));
            formulas = walk(ast, "Math").map(m => m.c[1]);
            // Fixed six-question source: 17 body formulas, 9 answer formulas,
            // plus the table formula in lesson-plan/handout.
            const expectedFormulas = (kind === "practice" ? 17 : 18) + (includeAnswers ? 9 : 0);
            assert.equal(formulas.length, expectedFormulas, `editable formulas lost: ${formulas.length}`);
            assert.ok(formulas.some(f => f.includes("\\frac")));
            assert.ok(formulas.some(f => f.includes("\\sqrt")));
            assert.ok(formulas.some(f => f.includes("\\begin{matrix}")));
            assert.equal(walk(ast, "Image").length, 3);
            assert.equal(walk(ast, "Table").length, kind === "practice" ? 0 : 1);
            assert.match(xml, /w:w="11906"/); assert.match(xml, /w:h="16838"/);
            assert.match(xml, /w:left="1134"/);
            const styles = new DOMParser().parseFromString(await zip.file("word/styles.xml").async("string"), "application/xml");
            const styleIds = Array.from(styles.getElementsByTagName("w:style")).map(s => s.getAttribute("w:styleId"));
            assert.equal(new Set(styleIds).size, styleIds.length, "unique styles preserve pagination constraints");
            const parsed = new DOMParser().parseFromString(xml, "application/xml");
            const blankLines = Array.from(parsed.getElementsByTagName("w:p")).filter(p => p.textContent === " ");
            assert.equal(blankLines.length, kind === "lesson-plan" ? 0 : 24);
            const outputImages = await Promise.all(Object.values(zip.files).filter(f => f.name.startsWith("word/media/") && !f.dir).map(f => f.async("nodebuffer")));
            const pixelHashes = await Promise.all(outputImages.map(async b => hash(await sharp(b).raw().toBuffer())));
            for (const { bytes } of images.values()) assert.ok(pixelHashes.includes(hash(await sharp(bytes).raw().toBuffer())));
            content = xml;
          } else {
            content = execFileSync("pdftotext", [target, "-"], { encoding: "utf8" }).replace(/\s/g, "");
            const info = execFileSync("pdfinfo", [target], { encoding: "utf8" });
            assert.match(info, /A4/); pages = Number(info.match(/Pages:\s+(\d+)/)[1]);
            for (let i = 1; i <= 6; i++) assert.ok(content.includes(`W-Q${i}`));
            const prefix = path.join(directory, name + "-page");
            execFileSync("pdftoppm", ["-scale-to", "200", "-png", target, prefix]);
            const pageImages = fs.readdirSync(directory).filter(n => n.startsWith(name + "-page-"));
            for (const image of pageImages) {
              const stats = await sharp(path.join(directory, image)).stats();
              assert.ok(stats.channels.some(c => c.min < 250), `blank output page: ${name}/${image}`);
            }
          }
          for (const marker of ["答案与解析", "根号内非负且分母不为零", "单调递增区间为"])
            assert.equal(content.includes(marker), includeAnswers, marker);
          for (const marker of ["教师注记", "R35教师块只给教师", "R35本课注记只给教师"])
            assert.equal(content.includes(marker), includeTeacherNotes, marker);
          assert.ok(!content.includes("长期私密笔记"));
          manifest.push({ name, options, sha256: hash(download.bytes), formulas, pages, fileId: job.outputFileIds[0] });
        }
  for (const { file, bytes } of images.values()) assert.equal(hash((await call(`/api/workbench/files/${file.id}/content`)).bytes), hash(bytes));
  await world.close(); world = await startMaterialsHttp(directory);
  assert.equal((await ok(`/api/modules/lessons/v2/items/${lesson.id}/exports`)).items.length, 24);
  for (const item of manifest) assert.equal(hash((await call(`/api/workbench/files/${item.fileId}/content`)).bytes), item.sha256);
  fs.writeFileSync(path.join(evidence, "manifest.json"), JSON.stringify({ directory, lessonId: lesson.id, manifest }, null, 2));
  console.log(`R34_PANDOC_EVIDENCE ${evidence}`);
});
