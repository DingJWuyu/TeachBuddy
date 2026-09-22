/**
 * Block editor for math documents: one editable buffer per paragraph, one
 * LaTeX buffer per display formula, and a live preview next to each buffer so a
 * broken formula is visible in place while its source can still be saved.
 */

import { useEffect, useRef } from 'react';
import { MathFormula, DocumentView } from './MathText.jsx';
import { parseInlineRuns, serializeInlineRuns, unsupportedVersion } from './documents.js';

function AutoTextarea({ value, onChange, ariaLabel, className = '', rows = 1, onKeyDown }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`wb-input wb-auto-textarea ${className}`.trim()}
      value={value}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function InlineTextEditor({ runs, onChange, ariaLabel, placeholder }) {
  const text = serializeInlineRuns(runs);
  // Plain text needs no second rendering of itself; the preview exists to show
  // formulas (and to report one that will not render).
  const previewed = (runs || []).some((run) => run.type === 'math');
  return (
    <div className="wb-inline-editor">
      <AutoTextarea
        value={text}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        onChange={(next) => onChange(parseInlineRuns(next))}
      />
      {previewed && (
        <div className="wb-inline-preview" aria-label={`${ariaLabel}预览`}>
          {(runs || []).map((run, index) => (
            run.type === 'math'
              ? <MathFormula key={`preview-${index}`} latex={run.latex} />
              : <span key={`preview-${index}`}>{run.text}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockControls({ index, count, onMove, onRemove, label }) {
  return (
    <div className="wb-block-controls">
      <button
        type="button"
        className="wb-icon-button"
        aria-label={`上移${label}`}
        title={`上移${label}`}
        disabled={index === 0}
        onClick={() => onMove(index, -1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="wb-icon-button"
        aria-label={`下移${label}`}
        title={`下移${label}`}
        disabled={index === count - 1}
        onClick={() => onMove(index, 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className="wb-icon-button"
        aria-label={`删除${label}`}
        title={`删除${label}`}
        onClick={() => onRemove(index)}
      >
        ×
      </button>
    </div>
  );
}

export function DocumentEditor({ document, onChange, label = '文稿' }) {
  const blocks = document?.blocks || [];
  const futureVersion = unsupportedVersion(document);

  function replaceBlock(index, block) {
    const next = blocks.map((item, itemIndex) => (itemIndex === index ? block : item));
    onChange({ version: 1, blocks: next });
  }

  function moveBlock(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ version: 1, blocks: next });
  }

  function removeBlock(index) {
    onChange({ version: 1, blocks: blocks.filter((item, itemIndex) => itemIndex !== index) });
  }

  function appendBlock(block) {
    onChange({ version: 1, blocks: [...blocks, block] });
  }

  // Paragraphs and formulas are numbered separately: the teacher reads "题面段落 2"
  // or "题面公式 1", not a mixed block index.
  let paragraphCount = 0;
  let formulaCount = 0;
  const displayLabels = blocks.map((block) => {
    if (block.type === 'math') {
      formulaCount += 1;
      return `${label}公式 ${formulaCount}`;
    }
    paragraphCount += 1;
    return `${label}段落 ${paragraphCount}`;
  });

  if (futureVersion !== null) {
    return (
      <div className="wb-document-readonly" data-document-editor={label} data-document-version={futureVersion}>
        <p className="wb-field-error" data-region="unsupported-version">
          这段内容来自更新的文档版本 {futureVersion}，在这里只读保留，不会被改写。
        </p>
        <DocumentView document={document} />
      </div>
    );
  }

  return (
    <div className="wb-document-editor" data-document-editor={label}>
      {blocks.map((block, index) => (
        <div className="wb-block" key={`${label}-${index}`}>
          {block.type === 'math' ? (
            <div className="wb-math-block-editor">
              <AutoTextarea
                value={block.latex || ''}
                rows={2}
                className="wb-latex-input"
                ariaLabel={`${displayLabels[index]}源`}
                onChange={(latex) => replaceBlock(index, { type: 'math', latex })}
              />
              <div className="wb-math-block-preview">
                {(block.latex || '').trim()
                  ? <MathFormula latex={block.latex} display />
                  : <span className="wb-preview-empty">公式预览</span>}
              </div>
            </div>
          ) : (
            <InlineTextEditor
              runs={block.runs || []}
              ariaLabel={displayLabels[index]}
              placeholder="输入文字，行内公式用 $...$"
              onChange={(runs) => replaceBlock(index, { type: 'paragraph', runs })}
            />
          )}
          <BlockControls
            index={index}
            count={blocks.length}
            label={displayLabels[index]}
            onMove={moveBlock}
            onRemove={removeBlock}
          />
        </div>
      ))}
      <div className="wb-block-add">
        <button
          type="button"
          className="wb-button"
          onClick={() => appendBlock({ type: 'paragraph', runs: [] })}
        >
          段落
        </button>
        <button
          type="button"
          className="wb-button"
          onClick={() => appendBlock({ type: 'math', latex: '' })}
        >
          公式
        </button>
      </div>
    </div>
  );
}
