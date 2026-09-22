/**
 * Read-side rendering of math documents.
 *
 * Rendering never destroys the source: a formula that fails to preview shows its
 * LaTeX with an explicit warning while the stored source stays untouched.
 */

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function renderLatex(latex, displayMode) {
  try {
    return {
      html: katex.renderToString(latex, {
        displayMode,
        throwOnError: true,
        strict: 'ignore',
        trust: false,
        output: 'html'
      })
    };
  } catch (error) {
    return { failed: true };
  }
}

export function MathFormula({ latex, display = false }) {
  const result = useMemo(() => renderLatex(latex ?? '', display), [latex, display]);
  if (result.failed) {
    return (
      <span className="wb-formula-failed" data-formula-failed="1">
        公式预览失败：{latex}
      </span>
    );
  }
  return (
    <span
      className={display ? 'wb-formula is-display' : 'wb-formula'}
      data-formula-source={latex}
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  );
}

function ParagraphView({ block }) {
  const runs = block.runs || [];
  if (runs.length === 0) return <p className="wb-paragraph is-empty" aria-hidden="true" />;
  return (
    <p className="wb-paragraph">
      {runs.map((run, index) => (
        run.type === 'math'
          ? <MathFormula key={`run-${index}`} latex={run.latex} />
          : <span key={`run-${index}`}>{run.text}</span>
      ))}
    </p>
  );
}

export function DocumentView({ document, className = '' }) {
  const blocks = document?.blocks || [];
  if (blocks.length === 0) {
    return <p className={`wb-paragraph is-empty ${className}`.trim()}>暂无内容</p>;
  }
  return (
    <div className={`wb-document ${className}`.trim()}>
      {blocks.map((block, index) => (
        block.type === 'math'
          ? (
            <div className="wb-math-block" key={`block-${index}`}>
              <MathFormula latex={block.latex} display />
            </div>
          )
          : <ParagraphView block={block} key={`block-${index}`} />
      ))}
    </div>
  );
}
