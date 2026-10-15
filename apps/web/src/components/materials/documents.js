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

