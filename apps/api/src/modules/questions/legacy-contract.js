import { invalidInput } from "../../workbench/problems.js";
// Compatibility contract for the v1 question Document and search projection.
import { workbenchLimits } from '@teachbuddy/shared';
const MAX_DOCUMENT_BLOCKS = workbenchLimits.documentBlocks;
const MAX_PARAGRAPH_RUNS = workbenchLimits.paragraphRuns;
const MAX_TEXT_LENGTH = workbenchLimits.textRunLength;
const MAX_LATEX_LENGTH = workbenchLimits.latexLength;

export function escapePointerSegment(segment) {
  return String(segment).replace(/~/g, '~0').replace(/\//g, '~1');
}

export function pointerField(pointer, segment) {
  const escaped = escapePointerSegment(segment);
  return pointer ? `${pointer}/${escaped}` : `/${escaped}`;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownFields(value, allowed, pointer) {
  const unknown = Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .sort();
  if (unknown.length > 0) {
    throw invalidInput(pointerField(pointer, unknown[0]), 'unknown-field');
  }
}

function assertRun(run, pointer) {
  if (!isPlainObject(run)) throw invalidInput(pointer, 'invalid-type');
  if (run.type === undefined) throw invalidInput(pointerField(pointer, 'type'), 'required');
  if (run.type === 'text') {
    rejectUnknownFields(run, ['type', 'text'], pointer);
    if (run.text === undefined) throw invalidInput(pointerField(pointer, 'text'), 'required');
    if (typeof run.text !== 'string') throw invalidInput(pointerField(pointer, 'text'), 'invalid-type');
    if (run.text.length > MAX_TEXT_LENGTH) throw invalidInput(pointerField(pointer, 'text'), 'out-of-range');
    return;
  }
  if (run.type === 'math') {
    rejectUnknownFields(run, ['type', 'latex'], pointer);
    if (run.latex === undefined) throw invalidInput(pointerField(pointer, 'latex'), 'required');
    if (typeof run.latex !== 'string') throw invalidInput(pointerField(pointer, 'latex'), 'invalid-type');
    if (run.latex.length < 1 || run.latex.length > MAX_LATEX_LENGTH) {
      throw invalidInput(pointerField(pointer, 'latex'), 'out-of-range');
    }
    return;
  }
  throw invalidInput(pointerField(pointer, 'type'), 'invalid-type');
}

function assertBlock(block, pointer) {
  if (!isPlainObject(block)) throw invalidInput(pointer, 'invalid-type');
  if (block.type === undefined) throw invalidInput(pointerField(pointer, 'type'), 'required');
  if (block.type === 'paragraph') {
    rejectUnknownFields(block, ['type', 'runs'], pointer);
    if (block.runs === undefined) throw invalidInput(pointerField(pointer, 'runs'), 'required');
    if (!Array.isArray(block.runs)) throw invalidInput(pointerField(pointer, 'runs'), 'invalid-type');
    if (block.runs.length > MAX_PARAGRAPH_RUNS) throw invalidInput(pointerField(pointer, 'runs'), 'out-of-range');
    block.runs.forEach((run, index) => assertRun(run, `${pointer}/runs/${index}`));
    return;
  }
  if (block.type === 'math') {
    rejectUnknownFields(block, ['type', 'latex'], pointer);
    if (block.latex === undefined) throw invalidInput(pointerField(pointer, 'latex'), 'required');
    if (typeof block.latex !== 'string') throw invalidInput(pointerField(pointer, 'latex'), 'invalid-type');
    if (block.latex.length < 1 || block.latex.length > MAX_LATEX_LENGTH) {
      throw invalidInput(pointerField(pointer, 'latex'), 'out-of-range');
    }
    return;
  }
  throw invalidInput(pointerField(pointer, 'type'), 'invalid-type');
}

// Documents are the only value shape shared by both modules. The public HTTP
// layer validates requests against the OpenAPI schema first; modules re-check
// the stored invariants so direct business callers cannot corrupt storage.
export function assertDocument(document, field) {
  if (!isPlainObject(document)) throw invalidInput(field || '', 'invalid-type');
  rejectUnknownFields(document, ['version', 'blocks'], field);
  if (document.version === undefined) throw invalidInput(pointerField(field, 'version'), 'required');
  if (document.version !== 1) throw invalidInput(pointerField(field, 'version'), 'unsupported-content-version');
  if (document.blocks === undefined) throw invalidInput(pointerField(field, 'blocks'), 'required');
  if (!Array.isArray(document.blocks)) throw invalidInput(pointerField(field, 'blocks'), 'invalid-type');
  if (document.blocks.length > MAX_DOCUMENT_BLOCKS) {
    throw invalidInput(pointerField(field, 'blocks'), 'out-of-range');
  }
  document.blocks.forEach((block, index) => assertBlock(block, `${field}/blocks/${index}`));
}

export function isBlankDocument(document) {
  return !document.blocks.some((block) => {
    if (block.type === 'math') return block.latex.trim() !== '';
    return block.runs.some((run) => {
      if (run.type === 'math') return run.latex.trim() !== '';
      return run.text.trim() !== '';
    });
  });
}

export function flattenDocumentText(document) {
  const parts = [];
  for (const block of document.blocks) {
    if (block.type === 'math') {
      parts.push(block.latex);
      continue;
    }
    for (const run of block.runs) {
      parts.push(run.type === 'text' ? run.text : run.latex);
    }
  }
  return parts.join('\n');
}

export function normalizeSearchQuery(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function matchesSearch(query, parts) {
  if (!query) return true;
  return parts.some((part) => typeof part === 'string' && part.toLowerCase().includes(query));
}

export function compareByUpdatedDescThenId(a, b) {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
