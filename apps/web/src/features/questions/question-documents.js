export const empty = () => ({ version: 2, blocks: [] });
export function sourceText(document) {
  const out = [];
  function visit(blocks) {
    for (const b of blocks) {
      if (b.latex) out.push(b.latex);
      if (b.runs)
        out.push(b.runs.map((r) => r.text ?? `$${r.latex}$`).join(""));
      for (const i of b.items ?? []) {
        out.push(i.label);
        visit(i.blocks);
      }
      for (const row of b.rows ?? [])
        for (const cell of row) visit(cell.blocks);
    }
  }
  visit(document?.blocks ?? []);
  return out.join("\n");
}

export function documentAssets(document) {
  const figures = [],
    formulas = [];
  function visit(blocks) {
    for (const block of blocks) {
      if (block.type === "image") figures.push(block);
      if (block.latex) formulas.push(block.latex);
      for (const run of block.runs ?? [])
        if (run.latex) formulas.push(run.latex);
      for (const item of block.items ?? []) visit(item.blocks);
      for (const row of block.rows ?? [])
        for (const cell of row) visit(cell.blocks);
    }
  }
  visit(document?.blocks ?? []);
  return { figures, formulas };
}
