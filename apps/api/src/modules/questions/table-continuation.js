import { parseFragment } from 'parse5';

export const hasMathRelation = latex => /\S\s*(?:[=<>≤≥≠]|\\(?:leq?|geq?|neq?|in|equiv)(?![a-zA-Z]))\s*\S/.test(latex);

// Document intentionally flattens spans. Inspect the retained HTML with the
// same parser only to prove that a row contains separate, unmerged cells.
// Formula runs and cell contents still come exclusively from Document.
export function unmergedTableRows(raw, tables) {
  if (!tables.length) return new Map();
  const nodes = [];
  const visit = node => {
    if (node.tagName === 'table') nodes.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parseFragment(raw.block_content ?? ''));
  const result = new Map();
  if (nodes.length !== tables.length) return result;
  const span = (cell, name) => cell.attrs?.find(attr => attr.name === name)?.value ?? '1';
  nodes.forEach((node, index) => {
    const rows = (node.childNodes ?? []).flatMap(child => child.tagName === 'tr' ? [child]
      : ['thead', 'tbody', 'tfoot'].includes(child.tagName) ? child.childNodes.filter(row => row.tagName === 'tr') : []);
    const cells = rows.map(row => row.childNodes.filter(cell => ['td', 'th'].includes(cell.tagName)));
    if (rows.length !== tables[index].rows.length || cells.some(row => row.some(cell => span(cell, 'rowspan') !== '1'))) return;
    result.set(tables[index], new Set(cells.flatMap((row, i) => row.length === tables[index].rows[i].length &&
      row.every(cell => span(cell, 'colspan') === '1') ? [i] : [])));
  });
  return result;
}

// Only a leading, uninterrupted list of mathematical data can supply missing
// subquestions. Prose instructions, teachers' speech and new titles are not
// continuations merely because they contain numbers or formulas.
export function isOrderedMathList(blocks) {
  let number = 0, relation = false;
  for (const block of blocks) {
    const runs = block.type === 'math' ? [{type: 'math', latex: block.latex}]
      : block.type === 'paragraph' ? block.runs : null;
    if (!runs) return false;
    for (const run of runs) {
      if (run.type === 'math') {
        if (!number) return false;
        relation ||= hasMathRelation(run.latex);
        continue;
      }
      for (const piece of run.text.split(/([（(][0-9０-９]+[）)])/)) {
        if (/^[（(][0-9０-９]+[）)]$/.test(piece)) {
          if (number && !relation || Number(piece.slice(1, -1).normalize('NFKC')) !== number + 1) return false;
          number++; relation = false;
        } else if (!/^[\s,，;；。.：:]*$/.test(piece)) return false;
      }
    }
  }
  return number >= 2 && relation;
}
