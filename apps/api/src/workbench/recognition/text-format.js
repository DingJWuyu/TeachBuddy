import { checkFormula } from '@teachbuddy/shared/math/formula';

export const hasUnparsedMath = text => /\\(?!n(?:\W|$))[A-Za-z]+|\\[{}]|[_^]\{/.test(text);

// Only complete geometric labels with explicit integer subscripts. This is a
// bounded notation recognizer, not a TeX parser or an algebraic repairer.
const labels = /(?:[A-Z](?:_\{\d+\})?)+(?:-(?:[A-Z](?:_\{\d+\})?)+)*/g;
const continuation = /[A-Za-z0-9_{}\\^+*/=<>:@%.-]/;
const wordAt = (text, start, end) =>
  text.slice(0, start).match(/\S*$/)[0] + text.slice(start, end) + text.slice(end).match(/^\S*/)[0];
const quotedRanges = text => [...text.matchAll(/"[^"\n]*"|'[^'\n]*'|“[^”\n]*”|‘[^’\n]*’/g)]
  .map(m => [m.index, m.index + m[0].length]);

export function recoverTextFormat(source, before = '', after = '') {
  const parts = [];
  let mathRecovered = false, linesRecovered = false, uncertainLines = false;
  function append(text, left = before, right = after) {
    let end = 0;
    const quotes = quotedRanges(text);
    for (const match of text.matchAll(labels)) {
      const latex = match[0], start = match.index, stop = start + latex.length;
      if (!latex.includes('_{') || latex.length > 1000 ||
          continuation.test(text[start - 1] ?? left) || continuation.test(text[stop] ?? right) ||
          quotes.some(([a,b]) => start >= a && stop <= b) ||
          /[\\/`"'“”‘’]/.test(wordAt(text, start, stop))) continue;
      try { checkFormula(latex); } catch { continue; }
      if (start > end) parts.push({type: 'text', text: text.slice(end, start)});
      parts.push({type: 'math', latex});
      mathRecovered = true;
      end = stop;
    }
    if (end < text.length) parts.push({type: 'text', text: text.slice(end)});
  }
  let end = 0;
  const quotes = quotedRanges(source);
  for (const match of source.matchAll(/\\n/g)) {
    const start = match.index, stop = start + 2;
    const previous = source[start - 1] ?? '', next = source[stop] ?? '';
    // TeX control words, escaped backslashes and identifiers are not line
    // separators. Inspect the original source, before Markdown decodes escapes.
    if (previous === '\\' || /[A-Za-z]/.test(next)) continue;
    // A number is only a list marker with punctuation and a following body;
    // bare numeric macro arguments and decimals remain literal.
    const numberedLine = /^\d{1,9}[.)、．）](?:[ \t]+(?=\S)|(?=[\p{Script=Han}【（]))/u
      .test(source.slice(stop));
    if (/[0-9_{}\[\]^]/.test(next) && !numberedLine) {
      uncertainLines = true;
      continue;
    }
    const word = wordAt(source, start, stop);
    if ((!previous.trim() && !next.trim()) ||
        quotes.some(([a,b]) => start >= a && stop <= b) ||
        /[A-Za-z0-9_\\/:"'“”‘’]/.test(previous) || /["'“”‘’]/.test(next) ||
        /[\/]|[A-Za-z]:|\\\\/.test(word)) {
      uncertainLines = true;
      continue;
    }
    append(source.slice(end, start), end ? '' : before, '');
    parts.push({type: 'break'});
    linesRecovered = true;
    end = stop;
  }
  append(source.slice(end), end ? '' : before, after);
  return {parts, mathRecovered, linesRecovered, uncertainLines};
}
