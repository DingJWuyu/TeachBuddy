// Hard line breaks in prose can be split without flattening formulas or images.
export function reviewParagraphs(document) {
  return document.blocks.flatMap(block => {
    if (block.type !== 'paragraph') return [block];
    const paragraphs = [];
    let runs = [];
    const finish = () => {
      if (runs.some(run => run.type !== 'text' || run.text.trim())) paragraphs.push({ ...block, runs });
      runs = [];
    };
    for (const run of block.runs) {
      if (run.type !== 'text') { runs.push(run); continue; }
      run.text.split(/\r\n?|\n/).forEach((text, index) => {
        if (index) finish();
        if (text) runs.push({ ...run, text });
      });
    }
    finish();
    return paragraphs;
  });
}

export function splitReviewDraft(draft, at) {
  const blocks = reviewParagraphs(draft.body);
  if (!Number.isInteger(at) || at < 1 || at >= blocks.length) return null;
  const hasAnswer = draft.answerStatus !== 'absent' || draft.solution.blocks.length > 0;
  return [blocks.slice(0, at), blocks.slice(at)].map((body, index) => {
    const next = structuredClone(draft);
    if (index) {
      next.id = crypto.randomUUID();
      next.title = (draft.title.slice(0, 197) + '（续）');
      next.solution = { version: 2, blocks: [] };
      next.issues = next.issues.map(issue => ({ ...issue, id: crypto.randomUUID() }));
    }
    next.body.blocks = body;
    const requireCheck = (code, field, locations) => {
      const existing = next.issues.find(issue => issue.code === code);
      if (existing) existing.resolution = 'open';
      else next.issues.push({ id: crypto.randomUUID(), code, field, locations, resolution: 'open' });
    };
    requireCheck('split-boundary', '/body', next.parts.filter(part => part.role === 'body').flatMap(part => part.locations));
    if (hasAnswer) {
      next.answerStatus = 'unresolved';
      requireCheck('incomplete-answer', '/solution', next.parts.filter(part => part.role === 'solution').flatMap(part => part.locations));
    }
    return next;
  });
}
