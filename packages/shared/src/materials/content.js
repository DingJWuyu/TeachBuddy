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
