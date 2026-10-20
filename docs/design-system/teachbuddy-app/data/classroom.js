"use strict";
/*
 * Prototype service for the classroom module (班级), following the classroom
 * contract: classes, students, records, seating, exams, tags, Excel imports
 * with review and confirmation, versioned results and statistics. Everything
 * lives in memory on the shared prototype context, like the other adapters.
 * Scores are kept in hundredths of a point so ties and sums stay exact.
 */
(globalThis.TeachBuddyAdapters ||= {}).classroom = (() => {
  const base = "/api/modules/classroom";
  const clone = (value) => structuredClone(value);
  const collections = ["classes", "students", "records", "exams", "tags", "imports", "results"];
  const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
  const text = (value, max) => typeof value === "string" && value.length <= max;
  const cents = (value) => Math.round(Number(value) * 100);
  const points = (value) => value == null ? null : Math.round(value) / 100;
  const normal = (value) => String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");

  function store(ctx) {
    const state = ctx.state.classroom ??= {};
    for (const name of collections) state[name] ??= {};
    state.receipts ??= {};
    return state;
  }
  class Problem extends Error {
    constructor(status, type, extra = {}) { super(type); this.status = status; this.type = type; this.extra = extra; }
  }
  const invalid = (field, detail) => new Problem(422, "/problems/invalid-input", { field, detail });
  const missing = () => new Problem(404, "/problems/not-found");
  const conflict = (currentVersion) => new Problem(409, "/problems/version-conflict", { currentVersion });

  function stamp(ctx, fields) {
    const now = ctx.now();
    return { id: ctx.id(), version: 1, createdAt: now, updatedAt: now, deletedAt: null, ...fields };
  }
  function bump(ctx, item, fields = {}) {
    Object.assign(item, fields, { version: item.version + 1, updatedAt: ctx.now() });
    return item;
  }
  function get(state, name, id, { active = false } = {}) {
    const item = state[name][id];
    if (!item || (active && item.deletedAt)) throw missing();
    return item;
  }
  function expectVersion(item, body) {
    if (!Number.isSafeInteger(body?.baseVersion)) throw invalid("/baseVersion", "需要基线版本");
    if (body.baseVersion !== item.version) throw conflict(item.version);
  }
  const listed = (items, query) => {
    const wanted = query.get("state") || "active";
    if (!["active", "deleted", "all"].includes(wanted)) throw invalid("state", "未知的状态");
    return items.filter((item) => wanted === "all" || (wanted === "deleted") === Boolean(item.deletedAt));
  };

  /* ---------- classes, students, records ---------- */
  function classBody(body, partial) {
    const out = {};
    if (!partial || "name" in body) {
      if (!text(body.name, 60) || !normal(body.name)) throw invalid("/name", "请输入班级名称");
      out.name = normal(body.name);
    }
    if ("term" in body) {
      if (body.term !== null && !text(body.term, 60)) throw invalid("/term", "学期描述最多 60 字");
      out.term = body.term ? normal(body.term) : "";
    }
    return out;
  }
  function studentBody(body, partial) {
    const out = {};
    if (!partial || "name" in body) {
      if (!text(body.name, 40) || !normal(body.name)) throw invalid("/name", "请输入学生姓名");
      out.name = normal(body.name);
    }
    for (const [field, max] of [["studentNo", 32], ["interests", 400], ["personality", 1000]]) {
      if (field in body) {
        if (body[field] !== null && !text(body[field], max)) throw invalid("/" + field, "内容过长");
        out[field] = body[field] ? String(body[field]).trim() : "";
      }
    }
    if ("birthday" in body) {
      if (body.birthday !== null && body.birthday !== "" && !isDate(body.birthday)) throw invalid("/birthday", "日期无效");
      out.birthday = body.birthday || null;
    }
    return out;
  }
  function checkStudentNo(state, classId, studentNo, selfId) {
    if (!studentNo) return;
    const clash = Object.values(state.students).find((s) => !s.deletedAt && s.classId === classId && s.studentNo === studentNo && s.id !== selfId);
    if (clash) throw new Problem(409, "/problems/classroom/duplicate-student-number", { field: "/studentNo", detail: "本班已有同一学号的学生" });
  }
  function unseat(ctx, state, classId, studentId) {
    const cls = state.classes[classId];
    if (!cls) return;
    const before = cls.seating.seats.length;
    cls.seating.seats = cls.seating.seats.filter((seat) => seat.studentId !== studentId);
    if (cls.seating.seats.length !== before) bump(ctx, cls);
  }
  function recordBody(state, body, partial) {
    const out = {};
    if (!partial) {
      const subject = body.subject;
      if (!subject || !["student", "class"].includes(subject.kind) || typeof subject.id !== "string") throw invalid("/subject", "需要记录对象");
      get(state, subject.kind === "student" ? "students" : "classes", subject.id);
      out.subject = { kind: subject.kind, id: subject.id };
    }
    if (!partial || "date" in body) {
      if (!isDate(body.date)) throw invalid("/date", "日期无效");
      out.date = body.date;
    }
    if (!partial || "body" in body) {
      if (!text(body.body, 20000) || !body.body.trim()) throw invalid("/body", "请写下记录内容");
      out.body = body.body.trim();
    }
    return out;
  }

  /* ---------- tags and exams ---------- */
  function tagName(state, name, selfId) {
    const value = normal(name);
    if (!value || value.length > 40) throw invalid("/name", "标签名称为 1–40 字");
    const clash = Object.values(state.tags).find((t) => !t.deletedAt && !t.mergedInto && t.id !== selfId && t.name === value);
    if (clash) throw new Problem(409, "/problems/classroom/duplicate-tag", { field: "/name", detail: "已有同名标签", tagId: clash.id });
    return value;
  }
  function examBody(ctx, state, body, current) {
    const out = {};
    if (!current || "name" in body) {
      if (!text(body.name, 80) || !normal(body.name)) throw invalid("/name", "请输入考试名称");
      out.name = normal(body.name);
    }
    if (!current || "date" in body) {
      if (!isDate(body.date)) throw invalid("/date", "日期无效");
      out.date = body.date;
    }
    if (!current || "subject" in body) {
      if (!text(body.subject ?? "", 40)) throw invalid("/subject", "学科最多 40 字");
      out.subject = normal(body.subject ?? "");
    }
    if (!current || "questions" in body) {
      if (!Array.isArray(body.questions) || body.questions.length > 200) throw invalid("/questions", "最多 200 道计分题");
      const known = new Map((current?.questions ?? []).map((q) => [q.id, q]));
      const ids = new Set();
      out.questions = body.questions.map((q, i) => {
        const field = `/questions/${i}`;
        if (!text(q.label, 40) || !normal(q.label)) throw invalid(field + "/label", "请写题号");
        const full = Number(q.fullScore);
        if (!Number.isFinite(full) || full <= 0 || full > 1000 || cents(full) !== full * 100) throw invalid(field + "/fullScore", "满分需为正数，最多两位小数");
        if (q.id && !known.has(q.id)) throw invalid(field + "/id", "题目不属于这场考试");
        const id = q.id || ctx.id();
        if (ids.has(id)) throw invalid(field + "/id", "题目重复");
        ids.add(id);
        const tagIds = [...new Set(q.tagIds ?? [])];
        for (const tagId of tagIds) {
          const tag = state.tags[tagId];
          if (!tag || tag.deletedAt || tag.mergedInto) throw invalid(field + "/tagIds", "标签不可用");
        }
        if (!text(q.group ?? "", 40)) throw invalid(field + "/group", "分组标题最多 40 字");
        return { id, label: normal(q.label), group: normal(q.group ?? ""), fullScore: full, tagIds, locations: Array.isArray(q.locations) ? q.locations : [] };
      });
      if (current) {
        const scored = new Set();
        for (const r of Object.values(state.results)) {
          if (r.examId !== current.id || r.deletedAt) continue;
          for (const [qid, v] of Object.entries(r.scores)) if (v != null) scored.add(qid);
        }
        for (const id of scored) if (!ids.has(id)) throw new Problem(409, "/problems/classroom/question-has-scores", { detail: "有成绩的题目不能移除" });
      }
    }
    const questions = out.questions ?? current?.questions ?? [];
    const sum = questions.reduce((a, q) => a + cents(q.fullScore), 0);
    if (!current || "fullScore" in body) {
      const full = Number(body.fullScore ?? sum / 100);
      if (!Number.isFinite(full) || full <= 0 || full > 10000) throw invalid("/fullScore", "总满分需为正数");
      out.fullScore = full;
    }
    if ("source" in body) {
      if (!Array.isArray(body.source?.files) || body.source.files.length > 20) throw invalid("/source", "原卷最多 20 个文件");
      out.source = { files: body.source.files.map((f, i) => {
        const entry = ctx.files.get(f.fileId);
        if (!entry) throw invalid(`/source/files/${i}`, "原卷文件不存在");
        return { fileId: f.fileId, name: entry.metadata.name, mediaType: entry.metadata.mediaType };
      }) };
    }
    if (current) {
      const full = cents(out.fullScore ?? current.fullScore);
      const byId = new Map(questions.map((q) => [q.id, q]));
      for (const r of Object.values(state.results)) {
        if (r.examId !== current.id || r.deletedAt) continue;
        if (r.total != null && r.total > full) throw new Problem(409, "/problems/classroom/score-out-of-range", { detail: "已有总分超过新的满分" });
        for (const [qid, v] of Object.entries(r.scores)) if (v != null && byId.has(qid) && v > cents(byId.get(qid).fullScore)) throw new Problem(409, "/problems/classroom/score-out-of-range", { detail: "已有题目得分超过新的满分" });
      }
    }
    return out;
  }

  /* ---------- workbook reading (xlsx) ---------- */
  async function inflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function unzip(buffer) {
    const data = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (data.getUint32(i, true) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Problem(422, "/problems/classroom/unreadable-workbook", { detail: "不是有效的 Excel 文件" });
    const count = data.getUint16(end + 10, true);
    let offset = data.getUint32(end + 16, true);
    const files = new Map();
    let expanded = 0;
    const decoder = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (data.getUint32(offset, true) !== 0x02014b50) break;
      const method = data.getUint16(offset + 10, true);
      const flags = data.getUint16(offset + 8, true);
      const size = data.getUint32(offset + 20, true);
      const full = data.getUint32(offset + 24, true);
      const nameLength = data.getUint16(offset + 28, true);
      const extra = data.getUint16(offset + 30, true);
      const comment = data.getUint16(offset + 32, true);
      const local = data.getUint32(offset + 42, true);
      const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
      if (flags & 1) throw new Problem(422, "/problems/classroom/encrypted-workbook", { detail: "文件已加密，请先取消密码" });
      expanded += full;
      if (expanded > 64 * 1024 * 1024) throw new Problem(422, "/problems/classroom/workbook-too-large", { detail: "表格展开后超过 64 MiB" });
      const start = local + 30 + data.getUint16(local + 26, true) + data.getUint16(local + 28, true);
      const raw = bytes.subarray(start, start + size);
      files.set(name, { method, raw });
      offset += 46 + nameLength + extra + comment;
    }
    return { async read(name) {
      const entry = files.get(name);
      if (!entry) return null;
      const out = entry.method === 0 ? entry.raw : await inflate(entry.raw);
      return decoder.decode(out);
    } };
  }
  const xml = (source) => new DOMParser().parseFromString(source, "application/xml");
  const columnIndex = (ref) => [...ref.replace(/\d+/g, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  async function readWorkbook(blob, name) {
    if (blob.size > 10 * 1024 * 1024) throw new Problem(422, "/problems/classroom/workbook-too-large", { detail: "原件超过 10 MiB" });
    const buffer = await blob.arrayBuffer();
    const head = new Uint8Array(buffer.slice(0, 8));
    if (head[0] === 0xd0 && head[1] === 0xcf) throw new Problem(422, "/problems/classroom/unsupported-workbook", { detail: "原型暂不能读取 .xls，请在 Excel 中另存为 .xlsx 后再试" });
    if (!(head[0] === 0x50 && head[1] === 0x4b)) throw new Problem(422, "/problems/classroom/unreadable-workbook", { detail: "这不是 Excel 表格（.xlsx）" });
    const zip = await unzip(buffer);
    const book = await zip.read("xl/workbook.xml");
    if (!book) throw new Problem(422, "/problems/classroom/unreadable-workbook", { detail: "不是有效的 Excel 文件" });
    const rels = xml(await zip.read("xl/_rels/workbook.xml.rels") || "<r/>");
    const target = new Map([...rels.getElementsByTagName("Relationship")].map((r) => [r.getAttribute("Id"), r.getAttribute("Target")]));
    const sharedXml = await zip.read("xl/sharedStrings.xml");
    const shared = sharedXml ? [...xml(sharedXml).getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((t) => t.textContent).join("")) : [];
    const sheets = [];
    let cells = 0;
    const entries = [...xml(book).getElementsByTagName("sheet")];
    if (entries.length > 20) throw new Problem(422, "/problems/classroom/workbook-too-large", { detail: "工作表超过 20 个" });
    for (const sheet of entries) {
      const id = sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      let path = target.get(id) || "";
      path = path.startsWith("/") ? path.slice(1) : "xl/" + path.replace(/^\.\//, "");
      const doc = xml(await zip.read(path) || "<worksheet/>");
      const rows = [];
      for (const row of doc.getElementsByTagName("row")) {
        const r = Number(row.getAttribute("r"));
        if (r > 2000) throw new Problem(422, "/problems/classroom/workbook-too-large", { detail: "工作表超过 2000 行" });
        for (const c of row.getElementsByTagName("c")) {
          const ref = c.getAttribute("r");
          const col = columnIndex(ref);
          if (col > 256) throw new Problem(422, "/problems/classroom/workbook-too-large", { detail: "工作表超过 256 列" });
          if (++cells > 100000) throw new Problem(422, "/problems/classroom/workbook-too-large", { detail: "表格超过 100000 个单元格" });
          const type = c.getAttribute("t");
          const v = c.getElementsByTagName("v")[0]?.textContent ?? null;
          const formula = c.getElementsByTagName("f").length > 0;
          let cell;
          if (type === "s") cell = { text: shared[Number(v)] ?? "", kind: "text" };
          else if (type === "inlineStr") cell = { text: [...c.getElementsByTagName("t")].map((t) => t.textContent).join(""), kind: "text" };
          else if (type === "str") cell = { text: v ?? "", kind: "text", formula };
          else if (type === "b") cell = { text: v === "1" ? "TRUE" : "FALSE", kind: "boolean" };
          else if (type === "e") cell = { text: v ?? "#ERROR", kind: "error" };
          else if (v == null) cell = formula ? { text: "", kind: "error", formula, detail: "公式没有缓存值" } : null;
          else cell = { text: String(Number(v)), kind: "number", formula };
          if (!cell) continue;
          (rows[r - 1] ||= [])[col - 1] = cell;
        }
      }
      const width = Math.max(0, ...rows.filter(Boolean).map((r) => r.length));
      sheets.push({ name: sheet.getAttribute("name"), rows: Array.from({ length: rows.length }, (_, i) => Array.from({ length: width }, (_, j) => rows[i]?.[j] ?? null)) });
    }
    return { name, sheets };
  }

  /* ---------- import review ---------- */
  const ABSENT = /^(缺考|缺|是|y|yes|true|1|√|✓|absent)$/i;
  function parseScore(cell, full, field) {
    if (!cell || cell.text === "") return { value: null };
    if (cell.kind === "error") return { value: null, issue: { level: "error", code: "cell-error", field, ...say("单元格有错误或公式没有结果") } };
    if (cell.kind !== "number" && !/^-?\d+(\.\d+)?$/.test(cell.text.trim())) return { value: null, issue: { level: "error", code: "not-a-number", field, ...say("“{{text}}”不是分数", { text: cell.text }) } };
    const n = Number(cell.text);
    if (cents(n) !== Math.round(n * 100) || Math.abs(cents(n) - n * 100) > 1e-6) return { value: null, issue: { level: "error", code: "precision", field, ...say("分数最多两位小数") } };
    // range is checked in review(), where the question label is known
    return { value: cents(n) };
  }
  // issues carry their template and values, so a client can word them in its own language
  const say = (template, params = {}) => ({ message: template.replace(/{{(\w+)}}/g, (_, k) => params[k]), template, params });
  function candidates(state, imp, mapping) {
    const exam = state.exams[imp.examId];
    const sheet = imp.workbook.sheets[mapping.sheet];
    if (!sheet) throw invalid("/mapping/sheet", "工作表不存在");
    const rows = [];
    const last = Math.min(mapping.lastRow || sheet.rows.length, sheet.rows.length);
    for (let r = mapping.firstRow; r <= last; r++) {
      const line = sheet.rows[r - 1] || [];
      const at = (col) => (col ? line[col - 1] : null);
      const name = normal(at(mapping.nameCol)?.text ?? "");
      const studentNo = (at(mapping.numberCol)?.text ?? "").trim();
      const blank = line.every((c) => !c || c.text === "");
      if (blank) continue;
      const absent = mapping.absentCol ? ABSENT.test((at(mapping.absentCol)?.text ?? "").trim()) : false;
      const totalCell = at(mapping.totalCol);
      const scores = {};
      for (const q of exam.questions) scores[q.id] = { cell: at(mapping.questionCols?.[q.id]), full: q.fullScore };
      rows.push({ sourceRow: r, name, studentNo, studentId: null, status: absent ? "absent" : "present", totalCell, scoreCells: scores, ignored: (mapping.ignoredRows || []).includes(r) });
    }
    return rows.map((row) => {
      const total = parseScore(row.totalCell, exam.fullScore, "total");
      const parsed = Object.fromEntries(Object.entries(row.scoreCells).map(([qid, s]) => [qid, parseScore(s.cell, s.full, qid)]));
      const issues = [total.issue, ...Object.values(parsed).map((p) => p.issue)].filter(Boolean);
      return {
        sourceRow: row.sourceRow,
        source: { name: row.name, studentNo: row.studentNo },
        studentId: null,
        status: row.status,
        total: row.status === "absent" ? null : points(total.value),
        scores: Object.fromEntries(Object.entries(parsed).map(([qid, p]) => [qid, row.status === "absent" ? null : points(p.value)])),
        ignored: row.ignored,
        sourceIssues: issues,
      };
    });
  }
  function review(state, imp) {
    const exam = state.exams[imp.examId];
    const roster = Object.values(state.students).filter((s) => !s.deletedAt && s.classId === imp.classId);
    const counts = new Map();
    for (const row of imp.rows) {
      row.issues = row.reviewed ? [] : [...(row.sourceIssues || [])];
      if (row.ignored) { row.issues = []; continue; }
      const issues = row.issues;
      if (!row.reviewed) {
        row.studentId = null;
        if (row.source.studentNo) {
          const match = roster.filter((s) => s.studentNo === row.source.studentNo);
          if (match.length === 1) {
            row.studentId = match[0].id;
            if (row.source.name && match[0].name !== row.source.name) issues.push({ level: "error", code: "name-number-conflict", ...say("学号 {{no}} 是 {{name}}，表中写的是 {{sheet}}", { no: row.source.studentNo, name: match[0].name, sheet: row.source.name }) });
          } else issues.push({ level: "error", code: "unmatched", ...say("本班没有学号 {{no}}", { no: row.source.studentNo }) });
        } else if (row.source.name) {
          const match = roster.filter((s) => s.name === row.source.name);
          if (match.length === 1) { row.studentId = match[0].id; issues.push({ level: "warning", code: "matched-by-name", ...say("表中没有学号，按姓名匹配") }); }
          else if (match.length > 1) issues.push({ level: "error", code: "duplicate-name", ...say("本班有 {{n}} 位 {{name}}，请选择是哪一位", { n: match.length, name: row.source.name }) });
          else issues.push({ level: "error", code: "unmatched", ...say("本班没有 {{name}}", { name: row.source.name }) });
        } else issues.push({ level: "error", code: "unmatched", ...say("这一行没有姓名或学号") });
      } else if (!row.studentId) {
        issues.push({ level: "error", code: "unmatched", ...say("请选择这一行是哪位学生，或忽略这一行") });
      } else if (!roster.some((s) => s.id === row.studentId)) {
        issues.push({ level: "error", code: "unmatched", ...say("所选学生不在本班当前名单中") });
      }
      if (row.studentId) counts.set(row.studentId, (counts.get(row.studentId) || 0) + 1);
      if (row.status === "present") {
        for (const q of exam.questions) {
          const v = row.scores[q.id];
          if (v != null && (v < 0 || cents(v) > cents(q.fullScore))) issues.push({ level: "error", code: "out-of-range", field: q.id, ...say("{{label}} 的 {{v}} 超出满分 {{full}}", { label: q.label, v, full: q.fullScore }) });
        }
        if (row.total != null && (row.total < 0 || cents(row.total) > cents(exam.fullScore))) issues.push({ level: "error", code: "out-of-range", field: "total", ...say("总分 {{v}} 超出满分 {{full}}", { v: row.total, full: exam.fullScore }) });
        const known = exam.questions.map((q) => row.scores[q.id]);
        const covers = exam.questions.reduce((a, q) => a + cents(q.fullScore), 0) === cents(exam.fullScore);
        if (row.total != null && covers && exam.questions.length && known.every((v) => v != null)) {
          const sum = known.reduce((a, v) => a + cents(v), 0);
          if (sum !== cents(row.total)) issues.push({ level: "warning", code: "totalMismatch", ...say("逐题合计 {{sum}}，总分写的是 {{total}}；排名用表中的总分", { sum: points(sum), total: row.total }) });
        }
        if (row.total == null) issues.push({ level: "warning", code: "missing-total", ...say("没有总分，这次不参与排名") });
      }
    }
    for (const row of imp.rows) {
      if (!row.ignored && row.studentId && counts.get(row.studentId) > 1) row.issues.push({ level: "error", code: "duplicate-match", ...say("同一位学生出现在多行，请保留一行") });
    }
    const matched = new Set(imp.rows.filter((r) => !r.ignored && r.studentId).map((r) => r.studentId));
    imp.unrecorded = roster.filter((s) => !matched.has(s.id)).map((s) => s.id);
    imp.summary = {
      rows: imp.rows.length,
      ignored: imp.rows.filter((r) => r.ignored).length,
      errors: imp.rows.reduce((a, r) => a + r.issues.filter((i) => i.level === "error").length, 0),
      warnings: imp.rows.reduce((a, r) => a + r.issues.filter((i) => i.level === "warning").length, 0),
      unrecorded: imp.unrecorded.length,
    };
    return imp;
  }

  /* ---------- statistics ---------- */
  const activeExams = (state) => Object.values(state.exams).filter((e) => !e.deletedAt).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const resultsFor = (state, examId, classId) => Object.values(state.results).filter((r) => !r.deletedAt && r.examId === examId && (!classId || r.classId === classId));
  function median(sorted) {
    if (!sorted.length) return null;
    const m = sorted.length >> 1;
    return sorted.length % 2 ? sorted[m] : Math.round((sorted[m - 1] + sorted[m]) / 2);
  }
  function rankOf(results) {
    const present = results.filter((r) => r.status === "present" && r.total != null).sort((a, b) => b.total - a.total);
    const ranks = new Map();
    present.forEach((r, i) => ranks.set(r.id, i > 0 && present[i - 1].total === r.total ? ranks.get(present[i - 1].id) : i + 1));
    return { ranks, count: present.length };
  }
  function questionStats(exam, results) {
    return exam.questions.map((q) => {
      const observable = results.filter((r) => r.status === "present");
      const known = observable.filter((r) => r.scores[q.id] != null);
      const sum = known.reduce((a, r) => a + r.scores[q.id], 0);
      return { id: q.id, label: q.label, group: q.group, fullScore: q.fullScore, tagIds: q.tagIds, observable: observable.length, known: known.length, missing: observable.length - known.length, rate: known.length ? sum / (known.length * cents(q.fullScore)) : null };
    });
  }
  function tagStats(state, exam, results, tagIds) {
    const ids = tagIds?.length ? tagIds : [...new Set(exam.questions.flatMap((q) => q.tagIds))];
    return ids.map((tagId) => {
      const qs = exam.questions.filter((q) => q.tagIds.includes(tagId));
      if (!qs.length) return { id: tagId, name: state.tags[tagId]?.name, state: "not-assessed" };
      let got = 0, possibleKnown = 0, knownCells = 0, missingCells = 0;
      for (const r of results.filter((x) => x.status === "present")) for (const q of qs) {
        if (r.scores[q.id] == null) { missingCells++; continue; }
        got += r.scores[q.id]; possibleKnown += cents(q.fullScore); knownCells++;
      }
      return { id: tagId, name: state.tags[tagId]?.name, state: knownCells ? "ok" : "missing-scores", rate: knownCells ? got / possibleKnown : null, knownCells, missingCells, questionIds: qs.map((q) => q.id), possible: points(qs.reduce((a, q) => a + cents(q.fullScore), 0) * results.filter((x) => x.status === "present").length) };
    });
  }
  function classPoint(state, exam, classId, tagIds) {
    const results = resultsFor(state, exam.id, classId);
    const head = { exam: { id: exam.id, name: exam.name, date: exam.date, subject: exam.subject, fullScore: exam.fullScore, version: exam.version } };
    if (!results.length) return { ...head, state: "no-result" };
    const present = results.filter((r) => r.status === "present");
    const totals = present.filter((r) => r.total != null).map((r) => r.total).sort((a, b) => a - b);
    const full = cents(exam.fullScore);
    const { ranks, count } = rankOf(results);
    const distribution = Array.from({ length: 10 }, (_, i) => ({ bin: i, count: 0, studentIds: [] }));
    for (const r of present) {
      if (r.total == null) continue;
      const bin = Math.min(9, Math.floor((r.total / full) * 10 + 1e-9));
      distribution[bin].count++;
      distribution[bin].studentIds.push(r.studentId);
    }
    return {
      ...head,
      state: "ok",
      present: present.length,
      absent: results.filter((r) => r.status === "absent").length,
      unrecorded: results.filter((r) => r.status === "unrecorded").length,
      missingTotal: present.filter((r) => r.total == null).length,
      mean: totals.length ? points(totals.reduce((a, v) => a + v, 0) / totals.length) : null,
      median: points(median(totals)),
      max: points(totals.at(-1) ?? null),
      min: points(totals[0] ?? null),
      distribution,
      questions: questionStats(exam, results),
      tags: tagStats(state, exam, results, tagIds),
      students: results.map((r) => ({ studentId: r.studentId, name: r.snapshot.name, studentNo: r.snapshot.studentNo, status: r.status, total: points(r.total), rate: r.total != null ? r.total / full : null, rank: ranks.get(r.id) ?? null, rankCount: count, resultId: r.id })).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.name.localeCompare(b.name, "zh")),
    };
  }
  function filterExams(state, query) {
    const examIds = query.getAll("examId");
    if (new Set(examIds).size !== examIds.length) throw invalid("examId", "重复的考试");
    const from = query.get("from"), to = query.get("to");
    return activeExams(state).filter((e) => (!examIds.length || examIds.includes(e.id)) && (!from || e.date >= from) && (!to || e.date <= to));
  }
  function tagFilter(state, query) {
    const tagIds = query.getAll("tagId");
    if (new Set(tagIds).size !== tagIds.length) throw invalid("tagId", "重复的标签");
    for (const id of tagIds) get(state, "tags", id);
    return tagIds;
  }

  /* ---------- request handling ---------- */
  async function route(req, ctx, state) {
    const parts = req.path.slice(base.length).split("/").filter(Boolean);
    const [collection, id, action] = parts;
    const query = req.url.searchParams;
    const body = req.body ?? {};
    const method = req.method;
    const created = (item) => ctx.json(clone(item), 201);
    const ok = (item) => ctx.json(clone(item));
    if (!collections.includes(collection)) throw missing();

    if (action === "deletion" && method === "PUT") {
      const item = get(state, collection, id);
      expectVersion(item, body);
      if (typeof body.deleted !== "boolean") throw invalid("/deleted", "需要删除状态");
      if (collection === "imports" && item.state === "confirmed") throw new Problem(409, "/problems/classroom/import-confirmed", { detail: "确认的导入是成绩来源，不能单独删除" });
      if (collection === "results" && !body.deleted) {
        const live = resultsFor(state, item.examId, item.classId).find((r) => r.studentId === item.studentId);
        if (live) throw new Problem(409, "/problems/classroom/result-exists", { detail: "这位学生在这场考试已有成绩" });
      }
      bump(ctx, item, { deletedAt: body.deleted ? ctx.now() : null });
      if (collection === "students" && body.deleted) unseat(ctx, state, item.classId, item.id);
      return ok(item);
    }

    switch (collection) {
      case "classes": {
        if (!id && method === "GET") return ok({ items: listed(Object.values(state.classes), query).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
        if (!id && method === "POST") {
          const item = stamp(ctx, { term: "", ...classBody(body), seating: { rows: 6, cols: 8, seats: [] } });
          state.classes[item.id] = item;
          return created(item);
        }
        if (id && action === "statistics" && method === "GET") {
          get(state, "classes", id);
          const tagIds = tagFilter(state, query);
          return ok({ classId: id, points: filterExams(state, query).map((exam) => classPoint(state, exam, id, tagIds)), dataVersions: { exams: Object.fromEntries(activeExams(state).map((e) => [e.id, e.version])) } });
        }
        const item = get(state, "classes", id);
        if (action === "seating" && method === "PUT") {
          expectVersion(item, body);
          const rows = Number(body.rows), cols = Number(body.cols);
          if (!Number.isInteger(rows) || rows < 1 || rows > 15 || !Number.isInteger(cols) || cols < 1 || cols > 15) throw invalid("/rows", "座位为 1–15 行、1–15 列");
          if (!Array.isArray(body.seats)) throw invalid("/seats", "需要完整座位");
          const taken = new Set(), seated = new Set();
          for (const [i, seat] of body.seats.entries()) {
            const s = state.students[seat.studentId];
            if (!s || s.deletedAt || s.classId !== id) throw invalid(`/seats/${i}/studentId`, "学生不在本班");
            if (!Number.isInteger(seat.row) || !Number.isInteger(seat.col) || seat.row < 0 || seat.col < 0 || seat.row >= rows || seat.col >= cols) throw invalid(`/seats/${i}`, "座位不在教室内");
            const key = seat.row + ":" + seat.col;
            if (taken.has(key) || seated.has(seat.studentId)) throw invalid(`/seats/${i}`, "一个座位一位学生，一位学生一个座位");
            taken.add(key); seated.add(seat.studentId);
          }
          return ok(bump(ctx, item, { seating: { rows, cols, seats: body.seats.map((s) => ({ studentId: s.studentId, row: s.row, col: s.col })) } }));
        }
        if (method === "GET") return ok(item);
        if (method === "PUT") { expectVersion(item, body); return ok(bump(ctx, item, classBody(body, true))); }
        break;
      }
      case "students": {
        if (!id && method === "GET") {
          const classId = query.get("classId");
          return ok({ items: listed(Object.values(state.students), query).filter((s) => !classId || s.classId === classId).sort((a, b) => (a.studentNo || "~").localeCompare(b.studentNo || "~") || a.name.localeCompare(b.name, "zh")) });
        }
        if (!id && method === "POST") {
          get(state, "classes", body.classId, { active: true });
          const fields = studentBody(body);
          checkStudentNo(state, body.classId, fields.studentNo, null);
          const item = stamp(ctx, { classId: body.classId, studentNo: "", birthday: null, interests: "", personality: "", ...fields });
          state.students[item.id] = item;
          return created(item);
        }
        if (id && action === "statistics" && method === "GET") {
          const student = get(state, "students", id);
          const tagIds = tagFilter(state, query);
          const out = [];
          for (const exam of filterExams(state, query)) {
            const mine = resultsFor(state, exam.id).find((r) => r.studentId === id);
            if (!mine) continue;
            const peers = resultsFor(state, exam.id, mine.classId);
            const { ranks, count } = rankOf(peers);
            const cls = classPoint(state, exam, mine.classId, tagIds);
            out.push({
              exam: { id: exam.id, name: exam.name, date: exam.date, subject: exam.subject, fullScore: exam.fullScore },
              classId: mine.classId, className: state.classes[mine.classId]?.name ?? "",
              status: mine.status, total: points(mine.total), rate: mine.total != null ? mine.total / cents(exam.fullScore) : null,
              rank: ranks.get(mine.id) ?? null, rankCount: count, classMean: cls.mean, classMedian: cls.median,
              questions: exam.questions.map((q) => ({ id: q.id, label: q.label, fullScore: q.fullScore, score: mine.status === "present" ? points(mine.scores[q.id]) : null, classRate: cls.questions.find((x) => x.id === q.id)?.rate ?? null, tagIds: q.tagIds })),
              tags: tagStats(state, exam, [mine], tagIds),
            });
          }
          return ok({ studentId: id, name: student.name, points: out });
        }
        const item = get(state, "students", id);
        if (method === "GET") return ok(item);
        if (method === "PUT") {
          expectVersion(item, body);
          const fields = studentBody(body, true);
          if ("classId" in body && body.classId !== item.classId) {
            get(state, "classes", body.classId, { active: true });
            checkStudentNo(state, body.classId, fields.studentNo ?? item.studentNo, item.id);
            unseat(ctx, state, item.classId, item.id);
            fields.classId = body.classId;
          } else checkStudentNo(state, item.classId, fields.studentNo ?? item.studentNo, item.id);
          return ok(bump(ctx, item, fields));
        }
        break;
      }
      case "records": {
        if (!id && method === "GET") {
          const studentId = query.get("studentId"), classId = query.get("classId"), q = normal(query.get("q") || "").toLowerCase();
          const from = query.get("from"), to = query.get("to");
          if ((from && !isDate(from)) || (to && !isDate(to))) throw invalid("from", "日期无效");
          const items = listed(Object.values(state.records), query).filter((r) => (!studentId || (r.subject.kind === "student" && r.subject.id === studentId)) && (!classId || (r.subject.kind === "class" && r.subject.id === classId)) && (!q || r.body.toLowerCase().includes(q)) && (!from || r.date >= from) && (!to || r.date <= to));
          return ok({ items: items.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) });
        }
        if (!id && method === "POST") { const item = stamp(ctx, recordBody(state, body)); state.records[item.id] = item; return created(item); }
        const item = get(state, "records", id);
        if (method === "GET") return ok(item);
        if (method === "PUT") { expectVersion(item, body); return ok(bump(ctx, item, recordBody(state, body, true))); }
        break;
      }
      case "tags": {
        if (!id && method === "GET") return ok({ items: listed(Object.values(state.tags), query).sort((a, b) => a.name.localeCompare(b.name, "zh")) });
        if (!id && method === "POST") { const item = stamp(ctx, { name: tagName(state, body.name), mergedInto: null }); state.tags[item.id] = item; return created(item); }
        const item = get(state, "tags", id);
        if (action === "merge" && method === "POST") {
          expectVersion(item, body);
          const target = get(state, "tags", body.targetId, { active: true });
          if (target.mergedInto || target.id === item.id) throw invalid("/targetId", "不能合并到这个标签");
          if (body.targetVersion !== target.version) throw conflict(target.version);
          for (const exam of Object.values(state.exams)) {
            let touched = false;
            for (const q of exam.questions) if (q.tagIds.includes(item.id)) { q.tagIds = [...new Set(q.tagIds.map((t) => (t === item.id ? target.id : t)))]; touched = true; }
            if (touched) bump(ctx, exam);
          }
          for (const old of Object.values(state.tags)) if (old.mergedInto === item.id) bump(ctx, old, { mergedInto: target.id });
          bump(ctx, item, { mergedInto: target.id });
          bump(ctx, target);
          return ok({ source: item, target });
        }
        if (method === "GET") return ok(item);
        if (method === "PUT") { expectVersion(item, body); if (item.mergedInto) throw invalid("/name", "已合并的标签不能改名"); return ok(bump(ctx, item, { name: tagName(state, body.name, item.id) })); }
        break;
      }
      case "exams": {
        if (!id && method === "GET") return ok({ items: listed(Object.values(state.exams), query).sort((a, b) => b.date.localeCompare(a.date)) });
        if (!id && method === "POST") { const item = stamp(ctx, { subject: "", source: { files: [] }, ...examBody(ctx, state, body) }); state.exams[item.id] = item; return created(item); }
        if (id && action === "comparison" && method === "GET") {
          const exam = get(state, "exams", id, { active: true });
          const classIds = query.getAll("classId");
          if (new Set(classIds).size !== classIds.length) throw invalid("classId", "重复的班级");
          const ids = classIds.length ? classIds : Object.values(state.classes).filter((c) => !c.deletedAt).map((c) => c.id);
          return ok({ exam: { id: exam.id, name: exam.name, date: exam.date, fullScore: exam.fullScore, questions: exam.questions.map(({ id: qid, label, fullScore }) => ({ id: qid, label, fullScore })) }, classes: ids.map((cid) => ({ classId: cid, name: get(state, "classes", cid).name, ...classPoint(state, exam, cid, []) })) });
        }
        const item = get(state, "exams", id);
        if (method === "GET") return ok(item);
        if (method === "PUT") { expectVersion(item, body); return ok(bump(ctx, item, examBody(ctx, state, body, item))); }
        break;
      }
      case "imports": {
        if (!id && method === "GET") {
          const examId = query.get("examId"), classId = query.get("classId");
          return ok({ items: listed(Object.values(state.imports), query).filter((i) => (!examId || i.examId === examId) && (!classId || i.classId === classId)).map(({ workbook, ...rest }) => rest) });
        }
        if (!id && method === "POST") {
          get(state, "exams", body.examId, { active: true });
          get(state, "classes", body.classId, { active: true });
          const file = ctx.files.get(body.fileId);
          if (!file) throw invalid("/fileId", "成绩表不存在");
          const workbook = await readWorkbook(file.blob, file.metadata.name);
          const item = stamp(ctx, { examId: body.examId, classId: body.classId, fileId: body.fileId, fileName: file.metadata.name, workbook, mapping: null, rows: [], state: "draft", summary: null, unrecorded: [], reviewedSourceRows: [] });
          state.imports[item.id] = item;
          return created(item);
        }
        const item = get(state, "imports", id);
        if (action === "confirmation" && method === "POST") {
          expectVersion(item, body);
          if (item.deletedAt) throw new Problem(409, "/problems/object-deleted");
          if (item.state === "confirmed") throw new Problem(409, "/problems/classroom/import-confirmed");
          if (!item.mapping) throw invalid("/mapping", "请先对应表格的列");
          review(state, item);
          const errors = item.rows.flatMap((r) => r.issues.filter((i) => i.level === "error").map((i) => ({ sourceRow: r.sourceRow, ...i })));
          if (errors.length) throw new Problem(422, "/problems/classroom/import-has-errors", { detail: `还有 ${errors.length} 处需要处理`, errors });
          const exam = state.exams[item.examId];
          const roster = Object.values(state.students).filter((s) => !s.deletedAt && s.classId === item.classId);
          const existing = resultsFor(state, item.examId, item.classId);
          const rosterIds = new Set(roster.map((s) => s.id));
          for (const r of existing) if (rosterIds.has(r.studentId)) bump(ctx, r, { deletedAt: ctx.now(), replacedBy: item.id });
          for (const s of roster) {
            const row = item.rows.find((x) => !x.ignored && x.studentId === s.id);
            const status = row ? row.status : "unrecorded";
            const result = stamp(ctx, {
              examId: exam.id, classId: item.classId, studentId: s.id, importId: item.id,
              snapshot: { name: s.name, studentNo: s.studentNo },
              status,
              total: status === "present" && row.total != null ? cents(row.total) : null,
              scores: Object.fromEntries(exam.questions.map((q) => [q.id, status === "present" && row.scores[q.id] != null ? cents(row.scores[q.id]) : null])),
            });
            state.results[result.id] = result;
          }
          bump(ctx, item, { state: "confirmed", confirmedAt: ctx.now() });
          const { workbook, ...rest } = item;
          return ok(rest);
        }
        if (method === "GET") return ok(item);
        if (method === "PUT") {
          expectVersion(item, body);
          if (item.state === "confirmed") throw new Problem(409, "/problems/classroom/import-confirmed", { detail: "已确认的导入不能再改，请新建一次导入" });
          if (body.mapping) {
            const m = body.mapping;
            for (const key of ["sheet", "firstRow"]) if (!Number.isInteger(m[key]) || m[key] < (key === "sheet" ? 0 : 1)) throw invalid("/mapping/" + key, "行列从 1 开始，工作表从 0 开始");
            if (!m.nameCol && !m.numberCol) throw invalid("/mapping/nameCol", "至少对应姓名或学号一列");
            item.mapping = { sheet: m.sheet, headerRow: m.headerRow ?? null, firstRow: m.firstRow, lastRow: m.lastRow ?? null, nameCol: m.nameCol ?? null, numberCol: m.numberCol ?? null, totalCol: m.totalCol ?? null, absentCol: m.absentCol ?? null, questionCols: m.questionCols ?? {}, ignoredRows: m.ignoredRows ?? [] };
            item.reviewedSourceRows = [];
          }
          if (body.rows === null || body.mapping) {
            if (!item.mapping) throw invalid("/mapping", "请先对应表格的列");
            item.rows = candidates(state, item, item.mapping);
          } else if (Array.isArray(body.rows)) {
            const bySource = new Map(item.rows.map((r) => [r.sourceRow, r]));
            for (const edit of body.rows) {
              const row = bySource.get(edit.sourceRow);
              if (!row) throw invalid("/rows", "不能新增或遗漏原表的行");
              row.ignored = Boolean(edit.ignored);
              if ("studentId" in edit) row.studentId = edit.studentId || null;
              if (edit.status) {
                if (!["present", "absent"].includes(edit.status)) throw invalid("/rows/status", "状态无效");
                row.status = edit.status;
              }
              if ("total" in edit) row.total = edit.total === "" || edit.total == null ? null : Number(edit.total);
              if (edit.scores) for (const [qid, v] of Object.entries(edit.scores)) row.scores[qid] = v === "" || v == null ? null : Number(v);
              if (row.status === "absent") { row.total = null; for (const k of Object.keys(row.scores)) row.scores[k] = null; }
              row.reviewed = true;
              row.sourceIssues = [];
              if (!item.reviewedSourceRows.includes(row.sourceRow)) item.reviewedSourceRows.push(row.sourceRow);
            }
          }
          review(state, item);
          return ok(bump(ctx, item));
        }
        break;
      }
      case "results": {
        if (!id && method === "GET") {
          const examId = query.get("examId"), classId = query.get("classId"), studentId = query.get("studentId");
          return ok({ items: listed(Object.values(state.results), query).filter((r) => (!examId || r.examId === examId) && (!classId || r.classId === classId) && (!studentId || r.studentId === studentId)).map((r) => ({ ...r, total: points(r.total), scores: Object.fromEntries(Object.entries(r.scores).map(([k, v]) => [k, points(v)])) })) });
        }
        const item = get(state, "results", id);
        const view = (r) => ({ ...r, total: points(r.total), scores: Object.fromEntries(Object.entries(r.scores).map(([k, v]) => [k, points(v)])) });
        if (method === "GET") return ok(view(item));
        if (method === "PUT") {
          expectVersion(item, body);
          const exam = state.exams[item.examId];
          const status = body.status ?? item.status;
          if (!["present", "absent", "unrecorded"].includes(status)) throw invalid("/status", "状态无效");
          const scores = { ...item.scores };
          if (body.scores) for (const [qid, v] of Object.entries(body.scores)) {
            const q = exam.questions.find((x) => x.id === qid);
            if (!q) throw invalid("/scores", "题目不属于这场考试");
            const p = parseScore(v == null || v === "" ? null : { text: String(v), kind: "number" }, q.fullScore, qid);
            if (p.issue) throw invalid("/scores/" + qid, p.issue.message);
            scores[qid] = p.value;
          }
          let total = item.total;
          if ("total" in body) {
            const p = parseScore(body.total == null || body.total === "" ? null : { text: String(body.total), kind: "number" }, exam.fullScore, "total");
            if (p.issue) throw invalid("/total", p.issue.message);
            total = p.value;
          }
          if (status !== "present") { total = null; for (const k of Object.keys(scores)) scores[k] = null; }
          return ok(view(bump(ctx, item, { status, total, scores, corrected: true })));
        }
        break;
      }
    }
    throw missing();
  }

  async function handleClassroom(req, ctx) {
    if (!req.path.startsWith(base + "/") && req.path !== base) return undefined;
    const state = store(ctx);
    const key = req.headers.get("Idempotency-Key");
    const fingerprint = `${req.method}:${req.path}:${JSON.stringify(req.body ?? null)}`;
    if (req.method !== "GET" && key && state.receipts[key]) {
      const receipt = state.receipts[key];
      return receipt.fingerprint === fingerprint ? ctx.json(clone(receipt.body), receipt.status) : ctx.problem("/problems/idempotency-conflict", 409);
    }
    try {
      const response = await route(req, ctx, state);
      if (req.method !== "GET" && key && response.ok) {
        const body = await response.clone().json();
        state.receipts[key] = { fingerprint, body, status: response.status };
      }
      return response;
    } catch (error) {
      if (error instanceof Problem) return ctx.problem(error.type, error.status, error.extra);
      console.error(error);
      return ctx.problem("/problems/internal", 500, { detail: String(error.message || error) });
    }
  }
  return { handleClassroom };
})();
