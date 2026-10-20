var TeachBuddyAdapters;
(TeachBuddyAdapters ||= {}).questions = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // prototype/current-ui/data/data/questions.js
  var questions_exports = {};
  __export(questions_exports, {
    handleQuestions: () => handleQuestions
  });
  var empty = () => ({ version: 2, blocks: [] });
  var clone = (value) => structuredClone(value);
  function documentText(document2) {
    const lines = [];
    function walk(blocks = []) {
      for (const block of blocks) {
        if (block.latex) lines.push(block.latex);
        if (block.runs) lines.push(block.runs.map((run) => run.text ?? run.latex ?? "").join(""));
        for (const item of block.items ?? []) walk(item.blocks);
        for (const row of block.rows ?? []) for (const cell of row) walk(cell.blocks);
      }
    }
    walk(document2?.blocks);
    return lines.join("\n");
  }
  function textDocument(text) {
    return { version: 2, blocks: String(text).split(/\r?\n/).filter((line) => line.trim()).map((line) => {
      const runs = [];
      let end = 0;
      for (const match of line.matchAll(/\$([^$]+)\$|\\\((.*?)\\\)/g)) {
        if (match.index > end) runs.push({ type: "text", text: line.slice(end, match.index) });
        runs.push({ type: "math", latex: match[1] ?? match[2] });
        end = match.index + match[0].length;
      }
      if (end < line.length) runs.push({ type: "text", text: line.slice(end) });
      return { type: "paragraph", runs };
    }) };
  }
  function hasContent(document2) {
    return Boolean(documentText(document2).trim() || JSON.stringify(document2?.blocks ?? []).includes('"type":"image"'));
  }
  function parseText(text, ctx, location) {
    const drafts = [], fragments = [], answerRows = [];
    const start = /^\s*((?:Q\s*)?[0-9０-９]+(?:[.．](?![0-9０-９])|[、:：)）])|例\s*[0-9０-９]+[:：.、]?|练习\s*[0-9０-９]+[:：.、]?)[ \t]*(.*)$/i;
    const answerHeading = /^\s*(?:【.*(?:答案|解析).*】|参考答案|答案解析|参考解答|答案|解析|解答)\s*[:：]?\s*$/;
    const inlineAnswer = /^\s*(?:参考答案|答案|解析|解答)\s*[:：]\s*(.*)$/;
    let current = null, offset = 0, answerSection = false;
    const locate = (from, to) => clone(location ?? { kind: "text", start: from, end: to });
    function finish() {
      if (!current) return;
      const body = current.body.join("\n").trim(), answer = current.answer.join("\n").trim();
      if (body) {
        const locations = [locate(current.start, Math.max(current.start + 1, current.end))];
        if (answerSection) answerRows.push({ label: current.title, text: body, locations });
        else drafts.push({ id: ctx.id(), title: current.title, body: textDocument(body), solution: textDocument(answer), answerStatus: answer ? "present" : "absent", typeId: null, tagIds: [], parts: [{ role: "body", locations }, ...answer ? [{ role: "solution", locations }] : []], issues: [{ id: ctx.id(), code: "split-boundary", field: "/body", locations, resolution: "open" }], disposition: "pending", questionId: null });
      }
      current = null;
    }
    const numbered = text.split("\n").some((line) => start.test(line));
    const sourceLines = text.split("\n");
    for (const [index, line] of sourceLines.entries()) {
      const from = offset;
      offset += [...line].length + 1;
      const match = line.match(start), answer = line.match(inlineAnswer);
      if (answerHeading.test(line)) {
        const following = sourceLines.slice(index + 1);
        const next = following.find((value) => value.trim()) ?? "";
        const known = [...drafts.map((draft) => draft.title), current?.title].filter(Boolean).map((value) => value.replace(/[^0-9０-９]/g, ""));
        const resumesKnown = following.some((value) => {
          const found = value.match(start);
          return found && known.includes(found[1].replace(/[^0-9０-９]/g, ""));
        });
        if (current && !answerSection && !start.test(next) && !resumesKnown && /^\s*(?:答案|解析|解答)\s*[:：]?\s*$/.test(line)) current.answering = true;
        else {
          finish();
          answerSection = true;
        }
        continue;
      }
      if (match) {
        finish();
        current = { title: match[1].trim(), body: [match[2]], answer: [], start: from, end: offset - 1, answering: false };
      } else if (/^\s*(?:教师活动|教学点评|教学建议|说明[:：]|注释[:：])/.test(line)) {
        finish();
        fragments.push({ id: ctx.id(), text: line, document: textDocument(line), locations: [locate(from, offset - 1)], disposition: "unassigned" });
      } else if (current || !numbered && line.trim()) {
        current ??= { title: "\u672A\u7F16\u53F7\u9898\u76EE", body: [], answer: [], start: from, end: offset - 1, answering: false };
        if (answer) {
          current.answering = true;
          current.answer.push(answer[1]);
        } else (current.answering ? current.answer : current.body).push(line);
        current.end = offset - 1;
      } else if (line.trim()) fragments.push({ id: ctx.id(), text: line, document: textDocument(line), locations: [locate(from, offset - 1)], disposition: "unassigned" });
    }
    finish();
    const label = (value) => value.replace(/[^0-9０-９]/g, "");
    for (const row of answerRows) {
      const matches = drafts.filter((draft) => label(draft.title) === label(row.label));
      if (matches.length === 1) {
        matches[0].solution = textDocument(row.text);
        matches[0].answerStatus = "present";
        matches[0].parts.push({ role: "solution", locations: row.locations });
      } else fragments.push({ id: ctx.id(), text: row.text, document: textDocument(row.text), locations: row.locations, disposition: "unassigned" });
    }
    return { drafts, fragments };
  }
  function stamp(ctx) {
    const value = ctx.now();
    return new Date(value).toISOString();
  }
  function fresh(ctx) {
    const now = stamp(ctx);
    return { id: ctx.id(), version: 1, createdAt: now, updatedAt: now, deletedAt: null };
  }
  function bump(value, ctx) {
    return { ...value, version: value.version + 1, updatedAt: stamp(ctx) };
  }
  function makeJob(ctx, kind, target, outputFileIds = []) {
    const job = { id: ctx.id(), kind, target, state: "succeeded", createdAt: stamp(ctx), updatedAt: stamp(ctx), attemptOf: null, progress: { completed: 1, total: 1, unit: "stages" }, outputFileIds, issues: [] };
    ctx.state.jobs ??= /* @__PURE__ */ new Map();
    ctx.state.jobs.set(job.id, job);
    return job;
  }
  async function collectFiles(material, ids, ctx) {
    for (const fileId of ids) {
      const stored = ctx.files.get(fileId);
      if (!stored) continue;
      const file = stored.metadata;
      const extracted = ctx.extractFile ? await ctx.extractFile(fileId) : null;
      const text = extracted?.text ?? stored.text ?? file.text ?? "";
      const pages = extracted?.pages ?? [];
      const selected = material.input.pages?.find((item) => item.fileId === fileId)?.pages;
      const location = { kind: "page", fileId, renditionFileId: extracted?.renditionFileId ?? fileId, page: selected?.[0] ?? 1, box: null };
      if (text.trim()) {
        const textPages = extracted?.textPages;
        const sections = Array.isArray(textPages) && textPages.length ? textPages.map((page, index) => typeof page === "string" ? { page: index + 1, text: page } : page).filter((page) => !selected || selected.includes(page.page)) : [{ page: location.page, text }];
        for (const section of sections) {
          const result = parseText(section.text ?? "", ctx, { ...location, page: section.page });
          material.drafts.push(...result.drafts);
          material.fragments.push(...result.fragments);
        }
      } else {
        const images = pages.filter((page) => !selected || selected.includes(page.page));
        if (!images.length && file.mediaType.startsWith("image/")) images.push({ page: 1, imageFileId: fileId });
        for (const page of images) {
          const loc = { ...location, page: page.page };
          material.drafts.push({ id: ctx.id(), title: file.name, body: { version: 2, blocks: [{ type: "image", fileId: page.imageFileId, alt: file.name, widthMm: 150 }] }, solution: empty(), answerStatus: "absent", typeId: null, tagIds: [], parts: [{ role: "body", locations: [loc] }], issues: [{ id: ctx.id(), code: "split-boundary", field: "/body", locations: [loc], resolution: "open" }], disposition: "pending", questionId: null });
        }
        if (!images.length) material.fragments.push({ id: ctx.id(), text: file.name, locations: [location], disposition: "unassigned" });
      }
      if (extracted?.paragraphs) (material.originalDocuments ??= []).push({ fileId, paragraphs: extracted.paragraphs });
    }
  }
  async function renderAsset(question, input, ctx) {
    if (input.mode === "figure-png") {
      const source = ctx.files.get(input.figureFileId);
      if (source?.blob?.type === "image/png") return [input.figureFileId];
      if (!source) return [];
      const image = await createImageBitmap(source.blob);
      const canvas2 = document.createElement("canvas");
      canvas2.width = image.width;
      canvas2.height = image.height;
      canvas2.getContext("2d").drawImage(image, 0, 0);
      image.close();
      const blob2 = await new Promise((resolve) => canvas2.toBlob(resolve, "image/png"));
      return [saveBlob(blob2, question.title, ctx)];
    }
    const canvas = document.createElement("canvas"), width = 1600, padding = 100, lineHeight = 60;
    const painter = canvas.getContext("2d");
    painter.font = "36px sans-serif";
    const lines = [];
    for (const line of [question.title, documentText(question.body), ...input.includeAnswers ? [documentText(question.solution)] : []].join("\n").split("\n")) {
      let current = "";
      for (const char of line) {
        if (painter.measureText(current + char).width > width - padding * 2) {
          lines.push(current);
          current = char;
        } else current += char;
      }
      lines.push(current);
    }
    const imageBlocks = [...question.body.blocks, ...input.includeAnswers ? question.solution.blocks : []].filter((block) => block.type === "image");
    const images = [];
    for (const block of imageBlocks) {
      const file = ctx.files.get(block.fileId);
      if (file) {
        const bitmap = await createImageBitmap(file.blob);
        const ratio = Math.min(1, (width - padding * 2) / bitmap.width);
        images.push({ bitmap, width: bitmap.width * ratio, height: bitmap.height * ratio });
      }
    }
    canvas.width = width;
    canvas.height = Math.max(300, padding * 2 + lines.length * lineHeight + images.reduce((sum, image) => sum + image.height + 40, 0));
    painter.fillStyle = "#fff";
    painter.fillRect(0, 0, canvas.width, canvas.height);
    painter.fillStyle = "#222";
    painter.font = "36px sans-serif";
    painter.textBaseline = "top";
    lines.forEach((line, index) => painter.fillText(line, padding, padding + index * lineHeight));
    let y = padding + lines.length * lineHeight;
    for (const image of images) {
      painter.drawImage(image.bitmap, padding, y, image.width, image.height);
      y += image.height + 40;
      image.bitmap.close();
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return [saveBlob(blob, question.title, ctx)];
  }
  function saveBlob(blob, title, ctx) {
    const id = ctx.id();
    ctx.files.set(id, { metadata: { id, name: (title || "\u9898\u9762") + ".png", mediaType: "image/png", byteLength: blob.size, createdAt: stamp(ctx), duplicateOfFileId: null }, blob, url: URL.createObjectURL(blob) });
    return id;
  }
  async function handleQuestionsRequest(req, ctx) {
    const match = req.path.match(/^\/api\/modules\/questions\/(?:v2\/)?(taxonomy|items|imports)(?:\/([^/]+))?(?:\/([^/]+))?$/);
    if (!match) return void 0;
    const [, kind, id, action] = match;
    const state = ctx.state.questions ??= { items: [], imports: [], taxonomy: { version: 1, types: [], tags: [] } };
    const input = req.body ?? {}, method = req.method.toUpperCase(), query = req.url.searchParams;
    const error = (type, status = 422, extra = {}) => ctx.problem(type.startsWith("/") ? type : "/problems/materials/" + type, status, extra);
    const invalid = (field, reason = "out-of-range") => error("/problems/workbench/invalid-input", 422, { field, reason });
    const check = (value2, active = true) => {
      if (input.baseVersion !== value2.version) return error("/problems/workbench/version-conflict", 409, { currentVersion: value2.version });
      if (active && value2.deletedAt) return error("/problems/workbench/object-deleted", 409);
    };
    const validate = (value2, draft = false) => {
      if (!hasContent(value2.body)) return invalid("/body", "empty-content");
      const answered = hasContent(value2.solution);
      if (value2.answerStatus === "absent" && answered || value2.answerStatus === "present" && !answered || !draft && value2.answerStatus === "unresolved") return invalid("/answerStatus");
      if (value2.typeId && !state.taxonomy.types.some((term) => term.id === value2.typeId) || (value2.tagIds ?? []).some((tag) => !state.taxonomy.tags.some((term) => term.id === tag))) return error("invalid-taxonomy");
    };
    const snapshot = (value2) => clone({ title: value2.title, body: value2.body, solution: value2.solution, answerStatus: value2.answerStatus });
    if (kind === "taxonomy") {
      if (method === "GET") return ctx.json(state.taxonomy);
      if (method !== "PUT") return void 0;
      const conflict2 = check(state.taxonomy, false);
      if (conflict2) return conflict2;
      const ids = /* @__PURE__ */ new Set();
      for (const key of ["types", "tags"]) {
        const names = /* @__PURE__ */ new Set();
        for (const term of input[key] ?? []) {
          const name = term.name.trim().toLocaleLowerCase();
          if (!name || names.has(name) || ids.has(term.id)) return error("invalid-taxonomy");
          names.add(name);
          ids.add(term.id);
        }
      }
      state.taxonomy = { version: state.taxonomy.version + 1, types: clone(input.types).map((term) => ({ ...term, name: term.name.trim() })), tags: clone(input.tags).map((term) => ({ ...term, name: term.name.trim() })) };
      for (const item of state.items) {
        const typeId = state.taxonomy.types.some((term) => term.id === item.typeId) ? item.typeId : null;
        const tagIds = item.tagIds.filter((tag) => state.taxonomy.tags.some((term) => term.id === tag));
        if (typeId !== item.typeId || tagIds.length !== item.tagIds.length) Object.assign(item, bump(item, ctx), { typeId, tagIds });
      }
      return ctx.json(state.taxonomy);
    }
    const rows = state[kind];
    if (!id && method === "GET") {
      let items = rows.filter((value2) => Boolean(value2.deletedAt) === (query.get("state") === "deleted"));
      const needle = (query.get("q") ?? "").trim().toLocaleLowerCase();
      if (needle) items = items.filter((value2) => [value2.title, value2.note, documentText(value2.body), ...(value2.noteFragments ?? []).map((fragment) => documentText(fragment.document)), query.get("searchAnswers") === "true" ? documentText(value2.solution) : ""].join("\n").toLocaleLowerCase().includes(needle));
      if (kind === "items") {
        if (query.has("typeId")) items = items.filter((value2) => value2.typeId === query.get("typeId"));
        if (query.has("starred")) items = items.filter((value2) => value2.starred === (query.get("starred") === "true"));
        items = items.filter((value2) => query.getAll("tagIds").every((tag) => value2.tagIds.includes(tag)));
      } else items = items.map((value2) => ({ ...value2, jobState: ctx.state.jobs?.get(value2.jobId)?.state ?? "succeeded" }));
      items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return ctx.json({ items });
    }
    if (!id && method === "POST") {
      if (kind === "items") {
        const issue = validate(input);
        if (issue) return issue;
        const item = { ...fresh(ctx), note: "", starred: false, typeId: null, tagIds: [], ...clone(input), source: clone(input.source ?? { kind: "manual" }) };
        rows.push(item);
        return ctx.json(item, 201);
      }
      if (!input.title?.trim() || !input.input || input.input.kind === "text" && !input.input.text?.trim()) return invalid("/input", "empty-content");
      if (input.input.kind === "files" && (!input.input.fileIds?.length || input.input.fileIds.some((fileId) => !ctx.files.has(fileId)))) return invalid("/input/fileIds");
      const material = { ...fresh(ctx), ...clone(input), supplementFileIds: [], drafts: [], fragments: [] };
      if (material.input.kind === "text") Object.assign(material, parseText(material.input.text, ctx));
      else await collectFiles(material, material.input.fileIds, ctx);
      material.jobId = makeJob(ctx, "extraction", { kind: "import", id: material.id, version: material.version }).id;
      rows.push(material);
      return ctx.json(material, 201);
    }
    const value = rows.find((item) => item.id === id);
    if (!value) return error("/problems/workbench/not-found", 404);
    if (method === "GET") {
      if (!action) return ctx.json(value);
      if (action === "copies" && kind === "items") return ctx.json({ items: state.items.filter((item) => !item.deletedAt && item.source.kind === "copy" && item.source.questionId === id) });
      if (action === "for-reference") return ctx.json({ id, version: value.version, deletedAt: value.deletedAt, snapshot: snapshot(value) });
      return void 0;
    }
    const conflict = check(value, !["deletion", "purge"].includes(action));
    if (conflict) return conflict;
    if (method === "PUT" && !action) {
      if (kind === "items") {
        const issue = validate(input);
        if (issue) return issue;
        const { baseVersion, ...fields } = clone(input);
        Object.assign(value, bump(value, ctx), fields);
      } else {
        for (const draft of input.drafts ?? []) {
          const issue = validate(draft, true);
          if (issue) return issue;
          const previous = value.drafts.find((item) => item.id === draft.id);
          if (previous?.disposition === "confirmed" && JSON.stringify(previous) !== JSON.stringify(draft)) return invalid("/drafts");
        }
        Object.assign(value, bump(value, ctx), { drafts: clone(input.drafts), fragments: clone(input.fragments) });
      }
      return ctx.json(value);
    }
    if (kind === "items" && action === "source-location" && method === "PUT") {
      if (value.source.kind !== "import") return invalid("/source");
      Object.assign(value, bump(value, ctx), { source: { ...value.source, parts: clone(input.parts) } });
      return ctx.json(value);
    }
    if (method !== "POST") return void 0;
    if (action === "deletion") {
      Object.assign(value, bump(value, ctx), { deletedAt: input.deleted ? stamp(ctx) : null });
      return ctx.json(value);
    }
    if (action === "purge") {
      if (!value.deletedAt) return error("archive-required", 409);
      rows.splice(rows.indexOf(value), 1);
      return ctx.json({ id, permanentlyDeleted: true });
    }
    if (kind === "items" && action === "copies") {
      const issue = validate(input);
      if (issue) return issue;
      const { baseVersion, ...fields } = clone(input);
      const copy = { ...fresh(ctx), ...fields, source: { kind: "copy", questionId: id, questionVersion: value.version, snapshot: snapshot(value) } };
      state.items.push(copy);
      return ctx.json(copy, 201);
    }
    if (kind === "items" && action === "assets") {
      const output = await renderAsset(value, input, ctx);
      return ctx.json(makeJob(ctx, "question-asset", { kind: "question", id, version: value.version }, output), 202);
    }
    if (kind === "imports" && action === "supplements") {
      if (input.fileIds.some((fileId) => !ctx.files.has(fileId))) return invalid("/fileIds");
      value.supplementFileIds.push(...input.fileIds);
      await collectFiles(value, input.fileIds, ctx);
      Object.assign(value, bump(value, ctx));
      value.jobId = makeJob(ctx, "extraction", { kind: "import", id, version: value.version }).id;
      return ctx.json(value, 202);
    }
    if (kind === "imports" && action === "commit") {
      const drafts = input.draftIds.map((draftId) => value.drafts.find((draft) => draft.id === draftId));
      if (drafts.some((draft) => !draft)) return invalid("/draftIds");
      for (const draft of drafts) {
        if (draft.disposition === "confirmed") continue;
        if (draft.disposition !== "pending" || draft.answerStatus === "unresolved" || draft.issues.some((issue2) => issue2.resolution === "open" || ["uncertain-formula", "missing-figure", "incomplete-answer", "unverified-location"].includes(issue2.code) && issue2.resolution !== "corrected")) return error("draft-not-ready", 409);
        const issue = validate(draft);
        if (issue) return issue;
      }
      const questions = drafts.map((draft) => {
        if (draft.questionId) return state.items.find((item) => item.id === draft.questionId);
        const { id: draftId, parts, issues, disposition, questionId, ...fields } = clone(draft);
        const question = { ...fresh(ctx), ...fields, note: "", starred: false, source: { kind: "import", importId: id, draftId, parts } };
        state.items.push(question);
        draft.disposition = "confirmed";
        draft.questionId = question.id;
        return question;
      });
      Object.assign(value, bump(value, ctx));
      return ctx.json({ import: value, questions });
    }
    return void 0;
  }
  async function handleQuestions(req, ctx) {
    if (!req.path.startsWith("/api/modules/questions/")) return void 0;
    const key = req.headers.get("Idempotency-Key");
    if (req.method === "GET" || !key) return handleQuestionsRequest(req, ctx);
    const state = ctx.state.questions ??= { items: [], imports: [], taxonomy: { version: 1, types: [], tags: [] } };
    const receipts = state.receipts ??= {};
    const signature = JSON.stringify({ path: req.path, method: req.method, body: req.body });
    if (receipts[key]) {
      const receipt = receipts[key];
      if (receipt.signature !== signature) return ctx.problem("/problems/workbench/idempotency-key-reused", 409);
      return ctx.json(clone(receipt.body), receipt.status);
    }
    const response = await handleQuestionsRequest(req, ctx);
    if (response?.ok) receipts[key] = { signature, body: await response.clone().json(), status: response.status };
    return response;
  }
  return __toCommonJS(questions_exports);
})();
