// Classes contract helpers consume the shared B11/T50 problem vocabulary.
import { workbenchProblemTypes, recordContentText } from '@refatos/shared';
import { ContractError, problemStatus, problems as baseProblems } from '../../workbench/problems.js';

/** Build a contract error for a base or module-owned problem. */
export function contractError(problem, message) {
  const status = problemStatus(problem);
  return new ContractError(status, problem, message);
}

const problems = Object.freeze({
  ...baseProblems,
  referenceDeleted: () => ({ type: workbenchProblemTypes.referenceDeleted }),
  classMismatch: () => ({ type: workbenchProblemTypes.classMismatch })
});

export function invalidInput(field, reason) {
  return contractError(problems.invalidInput(field, reason));
}

export function notFound() {
  return contractError(problems.notFound());
}

export function objectDeleted() {
  return contractError(problems.objectDeleted());
}

export function versionConflict(currentVersion, objectId) {
  return contractError({ ...problems.versionConflict(currentVersion), ...(objectId ? { objectId } : {}) });
}

export function referenceDeleted() {
  return contractError(problems.referenceDeleted());
}

export function classMismatch() {
  return contractError(problems.classMismatch());
}

// ---------------------------------------------------------------- projections

export const MAX_LABEL_LENGTH = 300;
export const MAX_NAME_LENGTH = 100;
export const MAX_TEXT_LENGTH = 10000;
export const MAX_SOURCES = 100;

/** First 300 Unicode code points; never an ellipsis, never a truncated surrogate. */
export function truncateLabel(value) {
  return Array.from(String(value ?? '')).slice(0, MAX_LABEL_LENGTH).join('');
}

/** Display fallback for an empty provider title; never written back to the provider. */
export function sourceFallbackLabel(kind) {
  return kind === 'question' ? '未命名题目' : '未命名作品';
}

/**
 * The title the provider actually holds, trimmed and cut to 300 code points.
 * It is what a new link saves as `labelAtLink`: an empty title stays empty, so
 * the stored title and the display fallback never become indistinguishable.
 */
export function sourceRawTitle(kind, reference) {
  if (kind === 'math') return reference.title;
  const raw = kind === 'question' ? reference?.snapshot?.title : reference?.title;
  return truncateLabel(String(raw ?? '').trim());
}

/** The label shown for a source; the fallback is a projection, not stored data. */
export function sourceDisplayTitle(kind, reference) {
  const raw = sourceRawTitle(kind, reference);
  if (kind === 'math') return raw;
  return raw === '' ? sourceFallbackLabel(kind) : raw;
}

/**
 * The record label shared by the record port and reverse feedback: the note, or
 * the first non-empty position/unfinished/commonIssues/nextNote, trimmed and
 * cut to 300 Unicode code points. It is derived from stored text, never stored.
 */
export function recordLabel(record) {
  const candidates = [record.note, record.position, record.unfinished, record.commonIssues, record.nextNote];
  for (const candidate of candidates) {
    const text = String(candidate ?? '').trim();
    if (text !== '') return truncateLabel(text);
  }
  return truncateLabel(recordContentText(record.content));
}
