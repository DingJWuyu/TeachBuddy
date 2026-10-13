import { locateFigures } from "./extraction-figures.js";
import { readRecognizedPage } from "./recognized-page.js";
import { validateSchema } from "../../workbench/content/schema.js";
import { validateQuestionContent, documentText } from "./materials-content.js";
import { randomUUID } from "node:crypto";
import { textDocument, emptyDocument } from "./materials-content.js";
import {
  readTranscription,
  mergeExtractions,
  reconcileExtraction,
  extractionId,
  questionLabel,
} from "./extraction-fragments.js";
const issue = (code, unitId, detail) => ({ code, unitId, field: null, detail });
export const questionStart = /^\s*(Q\s*[0-9０-９]+(?=\s*$)|(?:Q\s*)?[0-9０-９]+(?:[.．](?![0-9０-９])|[、:：)）])|例\s*[0-9０-９]+[:：.、]?|练习\s*[0-9０-９]+[:：.、]?)[ \t]*(.*)$/i;
export const answerHeading = /^\s*(?:【.*(?:答案|解析).*】|(?:第.+页[:：]\s*)?(?:已有答案(?:解析)?|原有答案|(?:原有)?(?:参考答案|答案解析|参考解答)|答案|解析|解答))\s*[:：]?\s*$/;
export const continuationHeading = /^(?:续第\s*([0-9０-９]+)\s*题|第\s*([0-9０-９]+)\s*题[（(]续[）)])[ \t]*[:：]?[ \t]*(?:\r?\n|$)/;
const inlineAnswer = /^\s*(?:参考答案|答案|解析|解答)\s*[:：]\s*(.*)$/;
export function nativeText(text, location) {
  const lines = [];
  let cursor = 0;
  for (const line of text.split("\n")) {
    lines.push({ text: line, start: cursor, end: cursor + [...line].length });
    cursor += [...line].length + 1;
  }
  const drafts = [],
    fragments = [],
    answers = [];
  let group = null,
    answer = false,
    answerSection = false;
  const answerHeadingIndex = lines.findIndex(line => answerHeading.test(line.text));
  const numbered = lines.slice(0, answerHeadingIndex < 0 ? lines.length : answerHeadingIndex)
    .some(line => questionStart.test(line.text));
  const locate = (start, end) => location ?? { kind: "text", start, end };
  function finish() {
    if (!group) return;
    const body = group.body.join("\n").trim(),
      solution = group.solution.join("\n").trim();
    if (body) {
      const ranges = (start, end) => {
        const locations = [];
        for (const excluded of group.excluded ?? []) {
          if (excluded.start >= end || excluded.end <= start) continue;
          if (excluded.start > start)
            locations.push(locate(start, excluded.start));
          start = Math.max(start, excluded.end);
        }
        if (end > start) locations.push(locate(start, end));
        return locations;
      };
      const locations = ranges(group.start, group.answerStart ?? group.end);
      if (answerSection) answers.push({ ...group, text: body, locations });
      else
        drafts.push({
          id: randomUUID(),
          title: group.title,
          body: textDocument(body),
          solution: textDocument(solution),
          answerStatus: solution ? "present" : "absent",
          typeId: null,
          tagIds: [],
          parts: [
            { role: "body", locations },
            ...(group.answerStart !== undefined
              ? [
                  {
                    role: "solution",
                    locations: ranges(group.answerStart, group.end),
                  },
                ]
              : []),
          ],
          issues: [
            {
              id: randomUUID(),
              code: "split-boundary",
              field: "/body",
              locations,
              resolution: "open",
            },
          ],
          disposition: "pending",
          questionId: null,
        });
    }
    group = null;
  }
  for (const [index, line] of lines.entries()) {
    if (answerHeading.test(line.text)) {
      // An answer section can introduce unknown answers before known labels.
      // Evidence belongs to this heading only, never a later answer section.
      const following = [];
      for (const item of lines.slice(index + 1)) {
        if (answerHeading.test(item.text)) break;
        following.push(item);
      }
      const next = following.find(item => item.text.trim());
      const knownLabels = new Set([...drafts, ...(group ? [group] : [])].map(item => questionLabel(item.title)));
      const resumesKnownLabel = following.some(item => {
        const numbered = item.text.match(questionStart);
        return numbered && knownLabels.has(questionLabel(numbered[1]));
      });
      if (group && !answerSection && /^\s*(?:答案|解析|解答)\s*[:：]?\s*$/.test(line.text) && !questionStart.test(next?.text ?? "") && !resumesKnownLabel) {
        answer = true;
        group.answerStart ??= line.start;
        continue;
      }
      finish();
      answerSection = true;
      continue;
    }
    if (/^\s*【第.+页.*】\s*$/.test(line.text)) {
      finish();
      continue;
    }
    const match = line.text.match(questionStart);
    if (match) {
      finish();
      group = {
        title: match[1].trim(),
        body: [match[2]],
        solution: [],
        start: line.start,
        end: line.end,
      };
      answer = false;
    } else if (
      /^\s*(?:教师活动|教学点评|教学建议|(?:说明|注释|编者注)[:：]|(?:(?:本页|本段|本文)\s*)?(?:保留|转换|导出|格式说明).*?(?:OMML|LaTeX|文字层|公式源|公式转成图片))/.test(
        line.text,
      )
    ) {
      if (/^\s*(?:教师活动|教学点评|教学建议)/.test(line.text)) finish();
      else if (group)
        (group.excluded ??= []).push({ start: line.start, end: line.end + 1 });
      if (line.text.trim())
        fragments.push({
          id: randomUUID(),
          text: line.text,
          locations: [locate(line.start, line.end)],
          disposition: "unassigned",
        });
    } else if (group || (!numbered && !answerSection && line.text.trim() && !inlineAnswer.test(line.text))) {
      if (!group) {
        group = { title: "未编号题目", body: [], solution: [], start: line.start, end: line.end };
        answer = false;
      }
      const a = line.text.match(inlineAnswer);
      if (a) {
        answer = true;
        group.answerStart ??= line.start;
        group.solution.push(a[1]);
      } else (answer ? group.solution : group.body).push(line.text);
      if (line.text.trim()) group.end = line.end;
    } else if (line.text.trim())
      fragments.push({
        id: randomUUID(),
        text: line.text,
        locations: [locate(line.start, line.end)],
        disposition: "unassigned",
      });
  }
  finish();
  for (const a of answers) {
    const candidates = drafts.filter((d) => questionLabel(d.title) === questionLabel(a.title));
    if (
      candidates.length !== 1 ||
      answers.filter((x) => questionLabel(x.title) === questionLabel(a.title)).length !== 1
    ) {
      for (const d of candidates) {
        d.answerStatus = "unresolved";
        d.issues.push({
          id: randomUUID(),
          code: "incomplete-answer",
          field: "/solution",
          locations: a.locations,
          resolution: "open",
        });
      }
      fragments.push({
        id: randomUUID(),
        text: a.text,
        locations: a.locations,
        disposition: "unassigned",
      });
      continue;
    }
    const d = candidates[0];
    d.parts.push({ role: "solution", locations: a.locations });
    if (!/^(?:原稿)?未提供答案(?:解析)?[。.]?$/.test(a.text)) {
      d.solution = textDocument(a.text);
      d.answerStatus = "present";
    }
  }
  for (const d of drafts) {
    const body = documentText(d.body);
    if (/如图|[配附]图|\[图[:：]|图示/.test(body))
      d.issues.push({
        id: randomUUID(),
        code: "missing-figure",
        field: "/body",
        locations: d.parts[0].locations,
        resolution: "open",
      });
    if (
      /[√²₁₂≥≤]|log[_(]|f\(x\)=/.test(body) &&
      !d.body.blocks.some((b) => b.runs?.some((r) => r.type === "math"))
    )
      d.issues.push({
        id: randomUUID(),
        code: "uncertain-formula",
        field: "/body",
        locations: d.parts[0].locations,
        resolution: "open",
      });
  }
  return { drafts, fragments };
}
// A transport is explicitly injected by the authorized composition. No keys,
// environment credentials or network fallback are read here.
export function adaptProviderResponse(response, locations) {
  const choice = response?.choices?.[0],
    raw = choice?.message?.content ?? response?.content ?? "";
  if (typeof raw !== "string" || !raw.trim())
    return {
      drafts: [],
      fragments: [],
      code: "empty-response",
      evidence: {
        content: typeof raw === "string" ? raw : "",
        finishReason: choice?.finish_reason ?? null,
      },
    };
  let value,
    truncated = false,
    fragments = [];
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  try {
    value = JSON.parse(cleaned);
  } catch {
    truncated = true;
    // Only complete array objects are decoded. Never synthesize closing JSON.
    const start = cleaned.search(/"(?:questions|groups|fragments)"\s*:\s*\[/);
    const rows = [];
    let depth = 0,
      quoted = false,
      escaped = false,
      objectStart = -1;
    if (start >= 0) {
      for (let i = cleaned.indexOf("[", start) + 1; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (quoted) {
          if (escaped) escaped = false;
          else if (ch === "\\") escaped = true;
          else if (ch === '"') quoted = false;
          continue;
        }
        if (ch === '"') {
          quoted = true;
          continue;
        }
        if (ch === "{") {
          if (depth === 0) objectStart = i;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && objectStart >= 0) {
            try {
              rows.push(JSON.parse(cleaned.slice(objectStart, i + 1)));
            } catch {}
            objectStart = -1;
          }
        } else if (ch === "]" && depth === 0) break;
      }
    }
    value = /"fragments"\s*:/.test(cleaned)
      ? { fragments: rows }
      : { questions: rows };
    for (let i = 0; i < raw.length; i += 20000)
      fragments.push({
        id: randomUUID(),
        text: raw.slice(i, i + 20000),
        locations,
        disposition: "unassigned",
      });
  }
  if (Array.isArray(value?.fragments)) {
    const parsed = readTranscription(value.fragments, locations);
    return {
      drafts: [],
      fragments: [...fragments, ...parsed.fragments],
      records: parsed.records,
      evidence: { content: raw, finishReason: choice?.finish_reason ?? null },
      code:
        truncated || choice?.finish_reason === "length"
          ? "truncated-response"
          : parsed.invalid || !parsed.records.length
            ? "invalid-output"
            : null,
    };
  }
  const rows = value?.questions ?? value?.groups ?? [];
  if (!Array.isArray(rows))
    return { drafts: [], fragments, code: "invalid-output" };
  const drafts = [];
  for (const row of rows) {
    const pageMatch = String(
      row.source_location ?? row.source_fragment ?? "",
    ).match(/(?:page|第)\s*(\d+)/i);
    if (
      pageMatch &&
      locations[0]?.kind === "page" &&
      Number(pageMatch[1]) !== locations[0].page
    )
      continue;
    const stem = row.stem ?? row.body ?? row.text;
    if (typeof stem !== "string" || !stem.trim()) continue;
    const answer =
      typeof row.answer === "string"
        ? row.answer
        : typeof row.solution === "string"
          ? row.solution
          : typeof row.existing_answer_explanation === "string"
            ? row.existing_answer_explanation
            : "";
    const uncertain = row.answer_status === "unresolved";
    const body = textDocument(stem);
    if (Array.isArray(row.options) && row.options.length)
      body.blocks.push({
        type: "list",
        role: "options",
        items: row.options
          .filter((x) => typeof x === "string")
          .map((x, i) => ({
            label: String.fromCharCode(65 + i),
            blocks: textDocument(x.replace(/^[A-Z][.、]\s*/, "")).blocks,
          })),
      });
    const sub = row.subquestions ?? [];
    if (Array.isArray(sub)) {
      const items = sub.filter(
        (x) => typeof x === "string" && !stem.includes(x),
      );
      if (items.length)
        body.blocks.push({
          type: "list",
          role: "subquestions",
          items: items.map((x, i) => ({
            label: String(i + 1),
            blocks: textDocument(x).blocks,
          })),
        });
    }
    const issues = [
      {
        id: randomUUID(),
        code: "unverified-location",
        field: "/parts",
        locations,
        resolution: "open",
      },
    ];
    if (row.figure || row.figures?.length || row.image_page)
      issues.push({
        id: randomUUID(),
        code: "missing-figure",
        field: "/body",
        locations,
        resolution: "open",
      });
    if (row.formula_source || row.formulas)
      issues.push({
        id: randomUUID(),
        code: "uncertain-formula",
        field: "/body",
        locations,
        resolution: "open",
      });
    drafts.push({
      id: randomUUID(),
      title: String(row.title ?? row.id ?? "").slice(0, 200),
      body,
      solution: textDocument(answer),
      answerStatus: uncertain ? "unresolved" : answer ? "present" : "absent",
      typeId: null,
      tagIds: [],
      parts: [
        { role: "body", locations },
        ...(answer ? [{ role: "solution", locations }] : []),
      ],
      issues,
      disposition: "pending",
      questionId: null,
    });
  }
  return {
    drafts,
    fragments,
    evidence: { content: raw, finishReason: choice?.finish_reason ?? null },
    code:
      truncated || choice?.finish_reason === "length"
        ? "truncated-response"
        : drafts.length
          ? null
          : "invalid-output",
  };
}
export function createExtractionHandler({
  store: s,
  files,
  jobs,
  provider,
  recognition,
  readWord,
  readPdf,
  content,
  validateLocations,
}) {
  async function run({ principal: p, job, signal, reportProgress }) {
    let task = s.get("tasks", p, job.id),
      m = s.get("imports", p, task.importId);
    const units = [],
      issues = [],
      outputFileIds = [];
    if (
      m.input.kind === "text" &&
      (!task.units || task.units.some((x) => x.startsWith("text:")))
    )
      units.push({
        id: `text:0:${[...m.input.text].length}`,
        text: m.input.text,
      });
    for (const id of [...(m.input.fileIds ?? []), ...m.supplementFileIds]) {
      if (
        task.units &&
        !task.units.some(
          (u) => u === `file:${id}` || u.startsWith(`file:${id}:`),
        )
      )
        continue;
      const file = files.read(p, id);
      try {
        if (
          (file.mediaType.endsWith("wordprocessingml.document") || file.mediaType === "application/msword") &&
          readWord &&
          !m.input.pages?.some((x) => x.fileId === id)
        ) {
          try {
            const preview = await files.ensurePreview(p, id);
            task.renditions = task.renditions.concat({
              fileId: id,
              renditionFileId: preview.renditionFileId,
              pages: preview.pageCount,
            });
          } catch (error) {
            issues.push(
              issue(
                "conversion-failed",
                `file:${id}`,
                "Word 原稿预览失败，已保留原生段落用于校对。",
              ),
            );
          }
          let nativeFileId;
          if (file.mediaType === "application/msword") {
            task.nativeWordSources ??= {};
            let source = task.nativeWordSources[id];
            if (!source) {
              const converted = await files.convertWord(p, id, {signal});
              source = {fileId: converted.id, sha256: converted.sha256, originalSha256: file.sha256, format: "libreoffice-docx-v1"};
              task.nativeWordSources[id] = source;
              s.save("tasks", p, task);
            }
            nativeFileId = source.fileId;
            outputFileIds.push(nativeFileId);
          }
          const parsed = await readWord(p, {...file, nativeFileId});
          task.paragraphs[id] = parsed.paragraphs;
          task.originalDocuments ??= {};
          task.originalDocuments[id] = parsed.original;
          for (const unit of parsed.units)
            units.push({
              ...unit,
              id: `file:${id}:page:${unit.paragraph}`,
              word: true,
            });
          continue;
        }
        const preview = await files.ensurePreview(p, id);
        if (
          preview.state === "failed" ||
          !preview.renditionFileId ||
          !preview.pages.length
        )
          throw Error(
            "原稿转换失败，未取得可读取页面；原文件仍可下载并可补充清晰照片。",
          );
        task.renditions = task.renditions
          .filter((x) => x.renditionFileId !== preview.renditionFileId)
          .concat({
            fileId: id,
            renditionFileId: preview.renditionFileId,
            pages: preview.pageCount,
          });
        const selection =
          m.input.pages?.find((x) => x.fileId === id)?.pages ??
          preview.pages.map((x) => x.page);
        if (selection.some((n) => n > preview.pageCount))
          throw Error("所选页码超出原件");
        for (const page of [...selection].sort((a, b) => a - b)) {
          const unitId = `file:${id}:page:${page}`;
          if (
            task.units &&
            !task.units.includes(`file:${id}`) &&
            !task.units.includes(unitId)
          )
            continue;
          units.push({
            id: unitId,
            file,
            page,
            preview,
            location: {
              kind: "page",
              fileId: id,
              renditionFileId: preview.renditionFileId,
              page,
              box: null,
            },
          });
        }
      } catch (e) {
        issues.push(
          issue("corrupt-file", `file:${id}`, e.message.slice(0, 500)),
        );
      }
    }
    const expandedFiles = new Set(
      units.filter((u) => u.file).map((u) => `file:${u.file.id}`),
    );
    task.expectedUnits = [
      ...new Set([
        ...(task.expectedUnits ?? []).filter((id) => !expandedFiles.has(id)),
        ...units.map((u) => u.id),
        ...issues.map((i) => i.unitId),
      ]),
    ];
    s.save("tasks", p, task);
    let completed = 0;
    for (const unit of units) {
      if (signal.aborted) break;
      if (task.completed.includes(unit.id)) {
        completed++;
        continue;
      }
      let result, recognitionSource;
      try {
        const previous = unit.file && task.machineResults?.[`file:${unit.file.id}:page:${unit.page - 1}`]?.tableContext;
        if (unit.file && !provider && recognition) {
          const source = {fileId: unit.file.id, renditionFileId: unit.preview.renditionFileId, page: unit.page};
          const ready = recognition.readPage(p, source);
          if (ready.state === 'ready' && ready.revision === recognition.get(p, source).revision) {
            const projected = readRecognizedPage(recognition.readResult(p, ready.resultId, source), {section: unit.file.id, previous});
            if (projected.teachingTables) result = projected;
          }
        }
        if (unit.text !== undefined)
          result = unit.result ?? nativeText(unit.text, unit.location);
        else if (provider)
          result = adaptProviderResponse(
            await provider.extract({
              principal: p,
              file: unit.file,
              page: unit.page,
              preview: unit.preview,
              signal,
            }),
            [unit.location],
          );
        else if (!result && readPdf && files.read(p, unit.preview.renditionFileId).mediaType === "application/pdf") {
          result = await readPdf(p, unit, signal);
        }
        if (!result) {
          const source = { fileId: unit.file.id, renditionFileId: unit.preview.renditionFileId, page: unit.page };
          recognitionSource = source;
          const page = await recognition?.ensurePage(p, source, { signal, retry: Boolean(job.attemptOf) });
          signal.throwIfAborted();
          if (page?.state !== "ready") {
            const terminated = page?.issues?.find(issue => ["recognition-timeout", "recognition-cancelled"].includes(issue.code));
            if (terminated) throw Object.assign(new Error("Recognition stopped"), { code: terminated.code });
            issues.push(issue(page?.state === "unavailable" || !page ? "provider-unavailable" : "provider-result-unknown", unit.id,
              page?.issues?.[0]?.detail ?? "本地识别暂不可用，原稿已保存；配置恢复后可重试本页。"));
            continue;
          }
          result = readRecognizedPage(recognition.readResult(p, page.resultId, source), {
            section: unit.file.id, previous,
          });
        }
        result.records?.forEach((record, index) => {
          record.id = extractionId(m.id, unit.id, "records", record.sourceKey ?? index);
          if (result.recognition || !provider) record.collection = m.id;
        });
        if (unit.file)
          result.source = {
            fileId: unit.file.id,
            sha256: unit.file.sha256,
            page: unit.page,
            renditionFileId: unit.preview.renditionFileId,
          };
        if (signal.aborted) break;
        if (result.records && unit.file && !result.recognition) {
          try {
            await locateFigures({ files, principal: p, unit, result, signal });
          } catch {
            /* Unproven layout leaves the existing blocking figure issue. */
          }
        }
        if (signal.aborted) break;
        if (
          !result.drafts.length &&
          !result.fragments.length &&
          !result.records?.length &&
          !result.code
        )
          result.code = "invalid-output";
        if (result.code)
          issues.push(
            issue(result.code, unit.id, result.issueDetail ?? "提取结果不完整，请对照原稿继续。"),
          );
        for (const draft of result.drafts) {
          validateSchema("Draft", draft);
          validateQuestionContent(content, p, draft, { draft: true });
          validateLocations(p, m, draft.parts);
        }
        for (const fragment of result.fragments) {
          validateSchema("Fragment", fragment);
          validateLocations(p, m, [fragment]);
          if (fragment.document) content.validate(p, fragment.document);
        }
        s.db.transaction(() => {
          m = s.get("imports", p, m.id);
          task.machineResults ??= {};
          for (const key of ["drafts", "fragments"])
            result[key].forEach((x, i) => {
              x.id = extractionId(m.id, unit.id, key, i);
            });
          task.machineResults[unit.id] = structuredClone(result);
          if (!result.code && !task.completed.includes(unit.id))
            task.completed.push(unit.id);
          const complete = task.expectedUnits.every((id) =>
            task.completed.includes(id),
          );
          const next = mergeExtractions(task.machineResults, complete);
          for (const draft of next.drafts) {
            validateSchema("Draft", draft);
            validateQuestionContent(content, p, draft, { draft: true });
            validateLocations(p, m, draft.parts);
          }
          reconcileExtraction(m, task, next);
          s.save("imports", p, s.bump(m));
          s.save("tasks", p, task);
        })();
        completed++;
        reportProgress({ completed, total: units.length, unit: "pages" });
      } catch (e) {
        if (e?.code === "recognition-cleanup") throw e;
        const recognitionTerminated = ["recognition-timeout", "recognition-cancelled"].includes(e?.code);
        if (signal.aborted || recognitionTerminated) {
          // A late complete page is evidence of this attempt, never a draft.
          // Freeze its files before a retry replaces the shared page record.
          if (recognitionSource && recognition && s.db.open) {
            const late = recognition.readPage(p, recognitionSource);
            if (late.rawFileId) {
              task.lateResults ??= {};
              task.lateResults[unit.id] = {
                source: structuredClone(late.location), resultId: late.resultId,
                revision: late.revision, inputHash: late.inputHash, rawFileId: late.rawFileId,
                assetFileIds: late.assetFileIds ?? [], originalAssetFileIds: late.originalAssetFileIds ?? [],
                derivations: late.derivations ?? [],
              };
              s.save("tasks", p, task);
              outputFileIds.push(late.rawFileId, ...(late.assetFileIds ?? []));
            }
          }
          issues.push(issue(signal.aborted || e?.code === "recognition-cancelled" ? "cancelled" : "provider-result-unknown", unit.id,
            e?.code === "recognition-timeout" ? "本页识别超时，未自动识别后续页；完整原始结果仅保留为本次任务证据。" : "整理已停止，迟到的识别结果仅保留为本次任务证据。"));
          break;
        }
        issues.push(
          issue(
            "provider-result-unknown",
            unit.id,
            "未取得可验证结果，未自动重发。",
          ),
        );
      }
    }
    // A processed empty response is not partial success. Earlier retained
    // candidates (including teacher edits) still count when a retry fails.
    const hasContent = Boolean(m.drafts.length || m.fragments.length);
    return {
      state: issues.length ? (hasContent ? "partial" : "failed") : "succeeded",
      outputFileIds: [...new Set(outputFileIds)],
      issues,
    };
  }
  function retry({ principal: p, job, unitIds }) {
    const old = s.get("tasks", p, job.id),
      m = s.get("imports", p, old.importId);
    if (m.jobId !== job.id)
      throw Object.assign(Error("已有更新的提取任务"), {
        status: 409,
        problem: { type: "/problems/materials/job-not-retryable" },
      });
    const selected = unitIds.length
      ? unitIds
      : [...new Set([
          ...(old.expectedUnits ?? []).filter(id => !old.completed.includes(id)),
          ...job.issues.map((x) => x.unitId).filter(Boolean),
        ])];
    const next = jobs.enqueue(
      {
        principal: p,
        kind: "extraction",
        target: { kind: "import", id: m.id, version: m.version + 1 },
      },
      { attemptOf: job.id },
    );
    s.save("tasks", p, {
      ...old,
      id: next.id,
      units: selected.length ? selected : old.units,
    });
    s.save("imports", p, { ...s.bump(m), jobId: next.id });
    return next;
  }
  return { run, retry };
}
