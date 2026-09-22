// Display policy only: the stored LaTeX remains untouched, including unsupported source.
export function canRenderMath(source) {
  return (
    typeof source === 'string' &&
    source.length <= 10000 &&
    !/\\(?:def|gdef|edef|xdef|let|futurelet|newcommand|renewcommand|providecommand|input|include|openin|openout|read|write|catcode|csname|usepackage|require|href|url|html\w*|includegraphics)(?![a-zA-Z])/.test(
      source
    )
  );
}
export function supportedDocument(value) {
  return value?.version === 1 || value?.version === 2;
}

// Enumerate only owned Documents, including immutable question snapshots.
export function questionDocuments(question) {
  const documents = [['/body', question.body], ['/solution', question.solution]];
  if (question.source?.kind === 'copy') {
    documents.push(
      ['/source/snapshot/body', question.source.snapshot.body],
      ['/source/snapshot/solution', question.source.snapshot.solution],
    );
  }
  return documents;
}

export function lessonDocuments(lesson) {
  const documents = [['/intro', lesson.intro]];
  const references = (items, path) => items.forEach((reference, index) => {
    if ((reference.kind ?? 'question') === 'question') {
      documents.push(
        [`${path}/${index}/snapshot/body`, reference.snapshot.body],
        [`${path}/${index}/snapshot/solution`, reference.snapshot.solution],
      );
    }
  });
  (lesson.sections ?? []).forEach((section, index) => {
    documents.push([`/sections/${index}/content`, section.content]);
    references(section.references ?? [], `/sections/${index}/references`);
  });
  references(lesson.materials ?? [], '/materials');
  return documents;
}
