import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { startQuestionsFixture } from "./fixtures/questions/server.mjs";

async function environment(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "questions-output-"));
  let runtime;
  let successful = false;
  t.after(async () => {
    await runtime?.close();
    if (successful) await fs.rm(dir, { recursive: true, force: true });
    else console.error(`题库输出测试失败现场保留：${dir}`);
  });
  runtime = await startQuestionsFixture({ dataDir: dir, port: 0 });
  const origin = `http://localhost:${runtime.server.address().port}`;
  const headers = {
    Cookie: runtime.workbench.identity.testPrincipalCookie("r33-a").header.split(";")[0],
    Origin: "http://localhost:0",
    "X-TeachBuddy-Request": "1",
    "Content-Type": "application/json",
  };
  async function call(url, body, method = "POST") {
    const requestHeaders = { ...headers, "Idempotency-Key": randomUUID() };
    if (body instanceof FormData) delete requestHeaders["Content-Type"];
    const response = await fetch(origin + url, {
      method, headers: requestHeaders,
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
    const value = await response.json();
    assert.ok(response.ok, JSON.stringify(value));
    return value;
  }
  return {
    complete() { successful = true; },
    async upload(bytes) {
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: "image/png" }), "配图.png");
      return call("/api/workbench/files", form);
    },
    q: (url, ...args) => call("/api/modules/questions/v2" + url, ...args),
    async job(id) {
      for (let n = 0; n < 600; n++) {
        const result = await call("/api/workbench/jobs/" + id, null, "GET");
        if (!["queued", "running", "cancelling"].includes(result.state)) return result;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw Error("题面输出任务超时");
    },
    async bytes(id) {
      const response = await fetch(origin + "/api/workbench/files/" + id + "/content", { headers });
      assert.equal(response.status, 200);
      return Buffer.from(await response.arrayBuffer());
    },
  };
}
const paragraph = (text) => ({ type: "paragraph", runs: [{ type: "text", text }] });
const document = (blocks) => ({ version: 2, blocks });
async function exportQuestion(e, blocks, solution = []) {
  const question = await e.q("/items", {
    title: "输出核查", body: document(blocks), solution: document(solution),
    answerStatus: solution.length ? "present" : "absent", note: "禁止出现在题面里的笔记",
    starred: false, typeId: null, tagIds: [], source: { kind: "manual" },
  });
  const task = await e.q(`/items/${question.id}/assets`, {
    baseVersion: question.version, mode: "question-png", figureFileId: null, includeAnswers: solution.length > 0,
  });
  const job = await e.job(task.id);
  assert.equal(job.state, "succeeded", JSON.stringify(job));
  return Promise.all(job.outputFileIds.map(id => e.bytes(id)));
}
async function evidence(name, bytes) {
  if (!process.env.QUESTIONS_OUTPUT_EVIDENCE_DIR) return;
  await fs.mkdir(process.env.QUESTIONS_OUTPUT_EVIDENCE_DIR, { recursive: true });
  await fs.writeFile(path.join(process.env.QUESTIONS_OUTPUT_EVIDENCE_DIR, name), bytes);
}

test("standalone common answer headings match numbered answers instead of splitting new questions", async t => {
  const e = await environment(t);
  for (const heading of ["答案：", "答案", "解析：", "解答：", "参考答案："]) {
    const input = `1. 计算 $1+1$。\n2. 计算 $2+2$。\n${heading}\n1. $2$。\n2. $4$。`;
    const created = await e.q("/imports", { title: "答案分节", origin: "", input: { kind: "text", text: input } });
    assert.equal((await e.job(created.jobId)).state, "succeeded");
    const result = await e.q(`/imports/${created.id}`, null, "GET");
    assert.equal(result.drafts.length, 2, heading);
    assert.deepEqual(result.drafts.map(d => d.answerStatus), ["present", "present"], heading);
    assert.deepEqual(result.drafts.map(d => d.solution.blocks[0].runs[0].latex), ["2", "4"], heading);
    assert.equal(result.fragments.length, 0, heading);
    assert.equal(result.input.text, input);
  }
  for (const text of ["计算 1+1。\n答案：\n2", "1. 计算 1+1。\n答案：\n2", "1. 计算 1+1。\n答案：2\n2. 计算 2+2。\n答案：4", "1. 计算 1+1。\n答案：\n先求和得2。\n2. 计算 2+2。\n答案：\n得4。"]) {
    const created = await e.q("/imports", { title: "逐题答案", origin: "", input: { kind: "text", text } });
    assert.equal((await e.job(created.jobId)).state, "succeeded");
    const result = await e.q(`/imports/${created.id}`, null, "GET");
    assert.equal(result.drafts.length, text.includes("2. 计算") ? 2 : 1);
    assert.ok(result.drafts.every(d => d.answerStatus === "present"));
    assert.equal(result.fragments.length, 0);
  }
  e.complete();
});

test("standalone answer section preserves introduction before numbered answers", async t => {
  const e = await environment(t);
  const input = "1. 计算1+1。\n2. 计算2+2。\n答案：\n以下为各题答案。\n1. 2\n2. 4";
  const created = await e.q("/imports", { title: "答案区说明", origin: "", input: { kind: "text", text: input } });
  assert.equal((await e.job(created.jobId)).state, "succeeded");
  const result = await e.q(`/imports/${created.id}`, null, "GET");
  await evidence("answer-introduction.json", Buffer.from(JSON.stringify(result, null, 2)));
  assert.equal(result.drafts.length, 2);
  assert.deepEqual(result.drafts.map(d => d.answerStatus), ["present", "present"]);
  assert.deepEqual(result.drafts.map(d => d.solution.blocks[0].runs[0].text), ["2", "4"]);
  assert.equal(result.fragments.length, 1);
  assert.equal(result.fragments[0].text, "以下为各题答案。");
  assert.equal(result.fragments[0].disposition, "unassigned");
  const location = result.fragments[0].locations[0];
  assert.equal([...input].slice(location.start, location.end).join(""), "以下为各题答案。");
  assert.equal(result.input.text, input);
  const repeatedInput = "1. 第一题。\n1. 第二题。\n答案：\n以下为各题答案。\n1. 2\n1. 4";
  const repeated = await e.q("/imports", { title: "重复题号答案区", origin: "", input: { kind: "text", text: repeatedInput } });
  assert.equal((await e.job(repeated.jobId)).state, "succeeded");
  const ambiguous = await e.q(`/imports/${repeated.id}`, null, "GET");
  assert.equal(ambiguous.drafts.length, 2);
  assert.deepEqual(ambiguous.drafts.map(d => d.answerStatus), ["unresolved", "unresolved"]);
  assert.ok(ambiguous.drafts.every(d => d.solution.blocks.length === 0));
  assert.deepEqual(ambiguous.fragments.map(f => f.text), ["以下为各题答案。", "2", "4"]);
  e.complete();
});

test("question PNG keeps text and inline math on one normal line and answers in a separate PNG", async t => {
  const e = await environment(t);
  const outputs = await exportQuestion(e, [{ type: "paragraph", runs: [
    { type: "text", text: "已知 " }, { type: "math", latex: "f(x)=x^2-2x+3" },
    { type: "text", text: "，求函数的最小值。" },
  ] }], [paragraph("答案：最小值为 2。")]);
  assert.equal(outputs.length, 2);
  await evidence("mixed-body.png", outputs[0]);
  await evidence("mixed-answer.png", outputs[1]);
  const meta = await sharp(outputs[0]).metadata();
  assert.equal(meta.width, 1600);
  assert.equal(meta.hasAlpha, true);
  assert.ok(meta.height <= 190, `短句应连排成一行，实际高度 ${meta.height}`);
  const { data } = await sharp(outputs[0]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0);
  e.complete();
});

test("answer section keeps leading unknown labels unassigned without crossing later answer headings", async t => {
  const e = await environment(t);
  for (const prefix of ["", "3. 原稿缺题的答案\n"]) {
    const input = `1. 计算1+1。\n2. 计算2+2。\n答案：\n以下为各题答案。\n${prefix}1. 2\n2. 4`;
    const created = await e.q("/imports", { title: "未知答案题号", origin: "", input: { kind: "text", text: input } });
    assert.equal((await e.job(created.jobId)).state, "succeeded");
    const result = await e.q(`/imports/${created.id}`, null, "GET");
    await evidence(`answer-leading-${prefix ? "unknown" : "known"}.json`, Buffer.from(JSON.stringify(result, null, 2)));
    assert.equal(result.drafts.length, 2);
    assert.deepEqual(result.drafts.map(d => d.answerStatus), ["present", "present"]);
    assert.deepEqual(result.drafts.map(d => d.solution.blocks[0].runs[0].text), ["2", "4"]);
    assert.deepEqual(result.fragments.map(f => f.text), ["以下为各题答案。", ...(prefix ? ["原稿缺题的答案"] : [])]);
    assert.ok(result.fragments.every(f => f.disposition === "unassigned"));
    assert.equal(result.input.text, input);
  }
  for (const heading of ["参考答案", "答案："]) {
    const input = `1. 计算1+1。\n答案：\n逐题非编号解答。\n2. 计算2+2。\n${heading}\n3. 原稿缺题的答案\n1. 2\n2. 4`;
    const created = await e.q("/imports", { title: "独立答案标题边界", origin: "", input: { kind: "text", text: input } });
    assert.equal((await e.job(created.jobId)).state, "succeeded");
    const result = await e.q(`/imports/${created.id}`, null, "GET");
    await evidence(`answer-boundary-${heading === "参考答案" ? "reference" : "plain"}.json`, Buffer.from(JSON.stringify(result, null, 2)));
    assert.equal(result.drafts.length, 2, heading);
    assert.deepEqual(result.drafts[1].body.blocks[0].runs, [
      { type: "text", text: "计算" }, { type: "math", latex: "2+2" }, { type: "text", text: "。" },
    ], heading);
    assert.deepEqual(result.drafts.map(d => d.answerStatus), ["present", "present"], heading);
    assert.deepEqual(result.fragments.map(f => f.text), ["原稿缺题的答案"], heading);
    assert.ok(result.drafts[0].parts.filter(part => part.role === "solution").some(part => part.locations.some(location => [...input].slice(location.start, location.end).join("").includes("逐题非编号解答。"))), heading);
  }
  e.complete();
});

test("long paragraph PNG fragments retain every complete line including the tail", async t => {
  const e = await environment(t);
  const lines = Array.from({ length: 80 }, (_, index) => `第${String(index + 1).padStart(3, "0")}行：保留完整文字，不允许丢失末尾。`);
  const outputs = await exportQuestion(e, [paragraph(lines.join("\n"))]);
  assert.ok(outputs.length >= 3, "长内容应生成多个分片");
  let bands = 0;
  for (const [index, png] of outputs.entries()) {
    await evidence(`long-${index + 1}.png`, png);
    const meta = await sharp(png).metadata();
    assert.equal(meta.width, 1600);
    assert.ok(meta.height <= 2400);
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let active = false;
    for (let y = 0; y < info.height; y++) {
      let ink = false;
      for (let x = 48; x < 1500 && !ink; x++) ink = data[(y * info.width + x) * 4 + 3] > 20;
      if (ink && !active) bands++;
      active = ink;
    }
  }
  assert.equal(bands, lines.length, "每一条真实文字行都应完整出现，不能丢行或截断成两行");
  e.complete();
});

test("mixed formula, original figure, option and table order survives actual PNG export", async t => {
  const e = await environment(t);
  const original = await sharp({ create: { width: 160, height: 100, channels: 4, background: "#cc2277" } }).png().toBuffer();
  const file = await e.upload(original);
  const outputs = await exportQuestion(e, [
    { type: "paragraph", runs: [{ type: "text", text: "已知 " }, { type: "math", latex: "\\frac{x+1}{x-1}=2" }, { type: "text", text: "，选择正确答案并填写下表。" }] },
    { type: "image", fileId: file.id, alt: "保留原图", widthMm: 80 },
    { type: "list", role: "options", items: [
      { label: "A", blocks: [{ type: "paragraph", runs: [{ type: "math", latex: "x=1" }] }] },
      { label: "B", blocks: [{ type: "paragraph", runs: [{ type: "math", latex: "x=3" }] }] },
    ] },
    { type: "table", rows: [
      [{ blocks: [paragraph("变量")] }, { blocks: [paragraph("结果")] }],
      [{ blocks: [paragraph("x")] }, { blocks: [{ type: "paragraph", runs: [{ type: "math", latex: "\\sqrt{9}=3" }] }] }],
    ] },
    paragraph("最后一段必须保留。"),
  ]);
  assert.equal(outputs.length, 1);
  await evidence("structured.png", outputs[0]);
  assert.deepEqual(await e.bytes(file.id), original, "导出不能更改受管原图");
  const { data, info } = await sharp(outputs[0]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let figurePixels = 0;
  let firstFigureRow = info.height;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const offset = (y * info.width + x) * 4;
    if (data[offset] === 204 && data[offset + 1] === 34 && data[offset + 2] === 119 && data[offset + 3] === 255) {
      figurePixels++;
      firstFigureRow = Math.min(firstFigureRow, y);
    }
  }
  assert.equal(figurePixels, 160 * 100, "原图保持尺寸、颜色及完整像素");
  assert.ok(firstFigureRow > 100, "原图应位于题干之后");
  e.complete();
});

test("oversized table cells keep all lines across bounded PNG fragments", async t => {
  const e = await environment(t);
  const lines = Array.from({ length: 80 }, (_, index) => `表格第${String(index + 1).padStart(3, "0")}行`);
  const outputs = await exportQuestion(e, [{ type: "table", rows: [[
    { blocks: [paragraph(lines.join("\n"))] }, { blocks: [paragraph("第二列保持位置")] },
  ]] }]);
  let bands = 0;
  for (const [index, png] of outputs.entries()) {
    await evidence(`long-table-${index + 1}.png`, png);
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 1600);
    assert.ok(info.height <= 2400);
    let active = false;
    for (let y = 0; y < info.height; y++) {
      let ink = false;
      for (let x = 80; x < 700 && !ink; x++) {
        const offset = (y * info.width + x) * 4;
        ink = data[offset] < 50 && data[offset + 3] > 20;
      }
      if (ink && !active) bands++;
      active = ink;
    }
  }
  assert.equal(bands, 80, "表格各行文字必须完整，不能整体缩成难以辨认的小字或丢失末行");
  e.complete();
});

test("oversized display formula scales intact instead of exceeding a PNG fragment", async t => {
  const e = await environment(t);
  const outputs = await exportQuestion(e, [{ type: "math", latex: `\\begin{matrix}${Array.from({ length: 80 }, (_, index) => `x_{${index + 1}}`).join("\\\\")}\\end{matrix}` }]);
  assert.equal(outputs.length, 1, "公式应保持完整，超高时等比缩放");
  await evidence("tall-formula.png", outputs[0]);
  const meta = await sharp(outputs[0]).metadata();
  assert.equal(meta.width, 1600);
  assert.ok(meta.height <= 2400);
  e.complete();
});

test('long mixed text and formula PNG splits into transparent bounded fragments', async t => {
  const e = await environment(t);
  const question = await e.q('/items', {
    title: '长题分片', source: { kind: 'manual' }, note: '禁止出现在题面里的笔记', starred: false, typeId: null, tagIds: [],
    answerStatus: 'absent', solution: document([]),
    body: { version: 2, blocks: Array.from({ length: 36 }, (_, i) => [
      paragraph('第' + (i + 1) + '段 长题分片可见边界'),
      { type: 'math', latex: 'f(x)=\\frac{\\sqrt{2x-1}}{x-2}' },
    ]).flat() },
  });
  const accepted = await e.q('/items/' + question.id + '/assets', { baseVersion: question.version, includeAnswers: false, mode: 'question-png', figureFileId: null });
  const result = await e.job(accepted.id);
  assert.equal(result.state, 'succeeded');
  assert.ok(result.outputFileIds.length > 1);
  const dimensions = [];
  for (const [i, id] of result.outputFileIds.entries()) {
    const bytes = await e.bytes(id);
    const meta = await sharp(bytes).metadata();
    dimensions.push({ width: meta.width, height: meta.height, alpha: meta.hasAlpha });
    await evidence(`long-mixed-${i}.png`, bytes);
  }
  for (const size of dimensions) {
    assert.equal(size.width, 1600);
    assert.equal(size.alpha, true);
    assert.ok(size.height <= 2400, `height ${size.height} exceeds 2400`);
  }
  e.complete();
});

test('question PNG preserves exact height boundaries and scales oversized figures', async t => {
  const e = await environment(t);
  async function picture(height) {
    return e.upload(await sharp({ create: { width: 1504, height, channels: 4, background: '#1267ab' } }).png().toBuffer());
  }
  const first = await picture(1000);
  for (const target of [2399, 2400, 2401]) {
    const second = await picture(target - 112 - 1000);
    const question = await e.q('/items', {
      title: `边界${target}`, source: { kind: 'manual' }, note: '', starred: false, typeId: null, tagIds: [], answerStatus: 'absent', solution: document([]),
      body: { version: 2, blocks: [first, second].map(file => ({ type: 'image', fileId: file.id, alt: '边界色块', widthMm: 100 })) },
    });
    const accepted = await e.q('/items/' + question.id + '/assets', { baseVersion: question.version, includeAnswers: false, mode: 'question-png', figureFileId: null });
    const job = await e.job(accepted.id);
    assert.equal(job.state, 'succeeded');
    assert.equal(job.outputFileIds.length, target <= 2400 ? 1 : 2);
    const heights = [];
    for (const [i, id] of job.outputFileIds.entries()) {
      const bytes = await e.bytes(id);
      const meta = await sharp(bytes).metadata();
      heights.push(meta.height);
      assert.equal(meta.width, 1600);
      assert.ok(meta.height <= 2400);
      assert.equal(meta.hasAlpha, true);
      await evidence(`boundary-${target}-${i}.png`, bytes);
    }
    if (target <= 2400) assert.equal(heights[0], target);
  }
  const tall = await picture(5000);
  const question = await e.q('/items', {
    title: '超高单图', source: { kind: 'manual' }, note: '', starred: false, typeId: null, tagIds: [], answerStatus: 'absent', solution: document([]),
    body: { version: 2, blocks: [{ type: 'image', fileId: tall.id, alt: '超高图', widthMm: 100 }] },
  });
  for (const mode of ['question-png', 'figure-png']) {
    const accepted = await e.q('/items/' + question.id + '/assets', { baseVersion: question.version, includeAnswers: false, mode, figureFileId: mode === 'figure-png' ? tall.id : null });
    const job = await e.job(accepted.id);
    assert.equal(job.state, 'succeeded');
    const bytes = await e.bytes(job.outputFileIds[0]);
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.height, 2292);
    assert.equal(meta.width, 1600);
  }
  e.complete();
});
