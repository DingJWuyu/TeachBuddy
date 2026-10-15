export function documentText(document) {
  const values = [];
  walkBlocks(document.blocks, (b) => {
    if (b.latex) values.push(b.latex);
    for (const r of b.runs ?? []) values.push(r.text ?? r.latex);
    if (b.type === "image") values.push(b.alt);
  });
  return values.join("\n");
}
export function walkBlocks(blocks, fn) {
  for (const b of blocks) {
    fn(b);
    if (b.blocks) walkBlocks(b.blocks, fn);
    for (const i of b.items ?? []) walkBlocks(i.blocks, fn);
    for (const row of b.rows ?? [])
      for (const cell of row) walkBlocks(cell.blocks, fn);
  }
}
export function images(document) {
  const ids = [];
  walkBlocks(document.blocks, (b) => {
    if (b.type === "image") ids.push(b.fileId);
  });
  return ids;
}
