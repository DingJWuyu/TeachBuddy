// Text projection for the classes module's optional Document. Plain journal
// fields stay literal; only this explicitly structured content contains math.
export const emptyRecordContent = () => ({ version: 2, blocks: [] });

export function recordContentText(document) {
  const values = [];
  function visit(blocks) {
    for (const block of blocks ?? []) {
      if (block.latex) values.push(block.latex);
      if (block.runs) values.push(block.runs.map(run => run.text ?? run.latex ?? '').join(''));
      if (block.type === 'image') values.push(block.alt?.trim() || '课堂图片');
      visit(block.blocks);
      for (const item of block.items ?? []) { values.push(item.label); visit(item.blocks); }
      for (const row of block.rows ?? []) for (const cell of row) visit(cell.blocks);
    }
  }
  visit(document?.blocks);
  return values.join('\n').trim();
}
