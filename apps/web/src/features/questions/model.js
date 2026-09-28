import i18n from "../../i18n/index.js";
const t = (key, options) => i18n.t(key, { ns: "questions", ...options });
/**
 * Question editor input <-> contract payload.
 *
 * Empty formula nodes are pruned before sending: the contract requires a
 * non-empty LaTeX source, and a formula box the teacher cleared is not content.
 */

import { documentFromText, emptyDocument, unsupportedVersion } from '../workbench/documents.js';

export function emptyQuestionInput(source = { kind: 'manual' }) {
  return {
    title: '',
    body: emptyDocument(),
    solution: emptyDocument(),
    note: '',
    starred: false,
    source
  };
}

export function questionInputFrom(question, { forCopy = false } = {}) {
  if (forCopy) {
    return {
      title: question.title,
      body: question.body,
      solution: question.solution,
      note: '',
      starred: false,
      source: question.source
    };
  }
  return {
    title: question.title,
    body: question.body,
    solution: question.solution,
    note: question.note,
    starred: question.starred,
    source: question.source
  };
}

export function pastedQuestionInput(sourceText) {
  return {
    ...emptyQuestionInput({ kind: 'paste', text: sourceText }),
    body: documentFromText(sourceText)
  };
}

function pruneRuns(runs) {
  return (runs || []).filter((run) => (run.type === 'math' ? Boolean((run.latex || '').trim()) : run.text !== ''));
}

function pruneDocument(document) {
  return {
    // The version is carried through unchanged: an unknown version must never be
    // silently converted by the editor.
    version: document?.version ?? 1,
    blocks: (document?.blocks || [])
      .map((block) => (block.type === 'math'
        ? { type: 'math', latex: block.latex }
        : { type: 'paragraph', runs: pruneRuns(block.runs) }))
      .filter((block) => (block.type === 'math' ? Boolean((block.latex || '').trim()) : true))
  };
}

export function validateQuestionInput(input) {
  const body = pruneDocument(input.body);
  // A newer document version is kept read-only; it must not be rewritten here.
  const bodyVersion = unsupportedVersion(body);
  if (bodyVersion !== null) {
    return {
      kind: 'invalid',
      field: '/body',
      reason: 'unsupported-content-version',
      message: t("题面包含文档版本 {{bodyVersion}}，本版本不能保存", { bodyVersion: bodyVersion })
    };
  }
  const solutionVersion = unsupportedVersion(pruneDocument(input.solution));
  if (solutionVersion !== null) {
    return {
      kind: 'invalid',
      field: '/solution',
      reason: 'unsupported-content-version',
      message: t("答案包含文档版本 {{solutionVersion}}，本版本不能保存", { solutionVersion: solutionVersion })
    };
  }
  const hasBody = body.blocks.some((block) => (block.type === 'math'
    ? Boolean((block.latex || '').trim())
    : (block.runs || []).some((run) => (run.type === 'math' ? Boolean((run.latex || '').trim()) : Boolean((run.text || '').trim())))));
  if (!hasBody) {
    return { kind: 'invalid', type: '/problems/workbench/invalid-input', field: '/body', reason: 'empty-content', message: t("题面不能只有空白") };
  }
  if ((input.title || '').length > 200) {
    return { kind: 'invalid', field: '/title', reason: 'out-of-range', message: t("标题超出允许范围") };
  }
  if ((input.note || '').length > 20000) {
    return { kind: 'invalid', field: '/note', reason: 'out-of-range', message: t("笔记超出允许范围") };
  }
  return null;
}

function contentFields(input) {
  return {
    title: input.title || '',
    body: pruneDocument(input.body),
    solution: pruneDocument(input.solution),
    note: input.note || '',
    starred: Boolean(input.starred)
  };
}

export function buildCreatePayload(input) {
  return {
    ...contentFields(input),
    source: input.source?.kind === 'paste'
      ? { kind: 'paste', text: input.source.text }
      : { kind: 'manual' }
  };
}

export function buildUpdatePayload(input, baseline) {
  return {
    baseVersion: baseline.version,
    ...contentFields(input)
  };
}

export function buildCopyPayload(input, baseline) {
  return {
    baseVersion: baseline.version,
    ...contentFields(input)
  };
}
