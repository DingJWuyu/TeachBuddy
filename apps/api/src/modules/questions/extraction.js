import { locateFigures } from "./extraction-figures.js";
import { readRecognizedPage } from "./recognized-page.js";
import { validateSchema } from "../../workbench/content/schema.js";
import { validateQuestionContent } from "./materials-content.js";
import { randomUUID } from "node:crypto";
import { textDocument } from "./materials-content.js";
import { nativeText } from "./native-text.js";
import {
  readTranscription,
  mergeExtractions,
  reconcileExtraction,
  extractionId,
} from "./extraction-fragments.js";
const issue = (code, unitId, detail) => ({ code, unitId, field: null, detail });
// A transport is explicitly injected by the authorized composition. No keys,
// environment credentials or network fallback are read here.
function adaptProviderResponse(response, locations) {
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
      if (signal.aborted) break;
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
            const preview = await files.ensurePreview(p, id, { signal });
            signal.throwIfAborted();
            task.renditions = task.renditions.concat({
              fileId: id,
              renditionFileId: preview.renditionFileId,
              pages: preview.pageCount,
            });
          } catch (error) {
            // A stop during Word preview must not be downgraded to a conversion failure that keeps reading natively.
            if (signal.aborted) throw error;
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
          signal.throwIfAborted();
          const parsed = await readWord(p, {...file, nativeFileId});
          signal.throwIfAborted();
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
        const preview = await files.ensurePreview(p, id, { signal });
          signal.throwIfAborted();
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
        if (signal.aborted) break;
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
      let result;
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
          const attempt = await recognition?.ensurePage(p, source, { signal, retry: Boolean(job.attemptOf) });
          if (attempt?.evidence) {
            task.recognitionEvidence ??= {};
            // Keep the fixed evidence value as handed over; the shared page cache is overwritten by later attempts.
            task.recognitionEvidence[unit.id] = attempt.evidence;
            if (attempt.stop) {
              task.lateResults ??= {};
              task.lateResults[unit.id] = attempt.evidence;
            }
            s.save("tasks", p, task);
          }
          if (attempt?.stop) {
            outputFileIds.push(...attempt.outputFileIds);
            if (attempt.stop.error) throw attempt.stop.error;
            issues.push(issue(attempt.stop.kind === "cancelled" ? "cancelled" : "provider-result-unknown", unit.id,
              attempt.stop.kind === "timeout" ? "本页识别超时，未自动识别后续页；完整原始结果仅保留为本次任务证据。" : "整理已停止，迟到的识别结果仅保留为本次任务证据。"));
            break;
          }
          signal.throwIfAborted();
          const page = attempt?.page;
          if (page?.state !== "ready") {
            issues.push(issue(page?.state === "unavailable" || !page ? "provider-unavailable" : "provider-result-unknown", unit.id,
              page?.issues?.[0]?.detail ?? "本地识别暂不可用，原稿已保存；配置恢复后可重试本页。"));
            continue;
          }
          result = readRecognizedPage(page, {
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
        if (signal.aborted) {
          issues.push(issue("cancelled", unit.id, "整理已停止，原稿与已完成内容仍保留。"));
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
