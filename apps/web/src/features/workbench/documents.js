/**
 * Math document v1 helpers.
 *
 * The contract stores an ordered list of paragraph and math blocks. Paragraphs
 * mix text and inline math, so the editor keeps one plain-text buffer per
 * paragraph where `$...$` marks inline math and `\$` is a literal dollar. The
 * LaTeX source is what gets stored; the editor never rewrites it.
 */

export const DOCUMENT_VERSION = 1;

export function emptyDocument() {
  return { version: DOCUMENT_VERSION, blocks: [] };
}

/**
 * A document from a newer content version is preserved read-only: it is never
 * converted, rewritten or silently dropped.
 */
export function isSupportedDocument(document) {
  return Boolean(document) && document.version === DOCUMENT_VERSION;
}

export function unsupportedVersion(document) {
  return document && document.version !== undefined && document.version !== DOCUMENT_VERSION
    ? document.version
    : null;
}

/** `$latex$` inline math, `\$` literal dollar, unclosed `$` stays as text. */
export function parseInlineRuns(text) {
  const source = text || '';
  const runs = [];
  let buffer = '';
  let index = 0;

  const flushText = () => {
    if (buffer) {
      runs.push({ type: 'text', text: buffer });
      buffer = '';
    }
  };

  while (index < source.length) {
    const char = source[index];
    if (char === '\\' && source[index + 1] === '$') {
      buffer += '$';
      index += 2;
      continue;
    }
    if (char === '$') {
      const end = source.indexOf('$', index + 1);
      if (end > index + 1) {
        flushText();
        runs.push({ type: 'math', latex: source.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }
    buffer += char;
    index += 1;
  }
  flushText();
  return runs;
}

export function serializeInlineRuns(runs) {
  return (runs || [])
    .map((run) => {
      if (run.type === 'math') return `$${run.latex}$`;
      return (run.text || '').replace(/\$/g, '\\$');
    })
    .join('');
}

export function documentFromText(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const blocks = lines.map((line) => {
    const runs = parseInlineRuns(line);
    return { type: 'paragraph', runs };
  });
  return { version: 1, blocks };
}

export function hasMath(document) {
  return (document?.blocks || []).some((block) => (
    block.type === 'math' || (block.runs || []).some((run) => run.type === 'math')
  ));
}

function documentPlainText(document) {
  return (document?.blocks || [])
    .map((block) => (block.type === 'math' ? block.latex : (block.runs || [])
      .map((run) => (run.type === 'math' ? run.latex : run.text))
      .join('')))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** List recognition text: title, or the leading body text when there is none. */
export function excerptFor(title, document, limit = 60) {
  const head = (title || '').trim() || documentPlainText(document);
  if (head.length <= limit) return head;
  return `${head.slice(0, limit)}…`;
}
