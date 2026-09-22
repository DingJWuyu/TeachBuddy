/**
 * One reference inside a lesson: the adopted snapshot, this lesson's note, the
 * source state, and the explicit actions the teacher owns (adopt an update,
 * place the same question again, move or remove the reference).
 */

import { useEffect, useState } from 'react';
import { DocumentView } from '../workbench/MathText.jsx';
import { Icon } from '../workbench/icons.jsx';
import { excerptFor } from '../workbench/documents.js';
import { getQuestion } from '../questions/api.js';

function UpdateCompareDialog({ reference, onAdopt, onClose }) {
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getQuestion(reference.questionId)
      .then((question) => { if (!cancelled) setCurrent(question); })
      .catch((problem) => { if (!cancelled) setError(problem.problem?.message || '无法读取原题'); });
    return () => { cancelled = true; };
  }, [reference.questionId]);

  return (
    <div className="wb-dialog-host" data-overlay="dialog">
      <div className="wb-dialog-scrim" onClick={onClose} role="presentation" />
      <div className="wb-dialog wb-compare-dialog" role="dialog" aria-modal="true" aria-label="对照更新">
        <header className="wb-dialog-head">
          <h2>对照更新</h2>
          <button type="button" className="wb-icon-button" aria-label="关闭" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {error && <p className="wb-inline-error">{error}</p>}
        <div className="wb-compare-grid">
          <section className="wb-compare-side" data-region="reference-old">
            <h3>本课采用版本 {reference.questionVersion}</h3>
            <DocumentView document={reference.snapshot?.body} />
            <DocumentView document={reference.snapshot?.solution} />
          </section>
          <section className="wb-compare-side" data-region="reference-new">
            <h3>原题当前版本 {current?.version ?? '…'}</h3>
            {current && (
              <>
                <DocumentView document={current.body} />
                <DocumentView document={current.solution} />
              </>
            )}
          </section>
        </div>
        <div className="wb-dialog-actions">
          <button
            type="button"
            className="wb-button is-primary"
            name="adopt-update"
            disabled={!current || current.version === reference.questionVersion}
            onClick={() => onAdopt(current.version)}
          >
            采用更新
          </button>
          <button type="button" className="wb-button" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

export function ReferenceCard({
  reference,
  position,
  targets = [],
  onNoteChange,
  onRemove,
  onMove,
  onAdopt,
  onPlaceAgain,
  onOpenLesson
}) {
  const [compareOpen, setCompareOpen] = useState(false);
  const excerpt = excerptFor(reference.snapshot?.title || '', reference.snapshot?.body, 40) || '题目';
  const hasUpdate = reference.sourceState === 'active'
    && Number.isInteger(reference.latestVersion)
    && reference.latestVersion > reference.questionVersion;

  return (
    <article className="wb-reference" data-reference-id={reference.id} data-source-state={reference.sourceState}>
      <header className="wb-reference-head">
        <h4>{excerpt}</h4>
        <span className="wb-muted">采用版本 {reference.questionVersion}</span>
        {reference.sourceState === 'deleted' && (
          <span className="wb-tag is-deleted" data-region="source-deleted">原题已删除</span>
        )}
        {hasUpdate && (
          <button
            type="button"
            className="wb-chip is-attention"
            name="view-update"
            onClick={() => setCompareOpen(true)}
          >
            有更新 · 查看
          </button>
        )}
        <div className="wb-reference-actions">
          <button
            type="button"
            className="wb-icon-button"
            aria-label="再放一次"
            title="再放一次"
            name="place-again"
            onClick={onPlaceAgain}
          >
            <Icon name="copy" size={15} />
          </button>
          {targets.length > 0 && (
            <select
              className="wb-input wb-move-select"
              aria-label="移动引用"
              value={position}
              onChange={(event) => onMove(event.target.value)}
            >
              <option value={position}>移到…</option>
              {targets.map((targetOption) => (
                <option key={targetOption.value} value={targetOption.value}>{targetOption.label}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="wb-icon-button"
            aria-label="移出引用"
            title="移出引用"
            name="remove-reference"
            onClick={onRemove}
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </header>
      <div className="wb-reference-body">
        <DocumentView document={reference.snapshot?.body} />
      </div>
      {reference.snapshot?.solution && (reference.snapshot.solution.blocks || []).length > 0 && (
        <details className="wb-answer">
          <summary>答案与解析</summary>
          <DocumentView document={reference.snapshot.solution} />
        </details>
      )}
      <label className="wb-reference-note">
        <span className="wb-label">本课备注</span>
        <textarea
          className="wb-input"
          rows={2}
          aria-label={`本课备注 ${excerpt}`}
          value={reference.note || ''}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </label>
      {onOpenLesson && (
        <button type="button" className="wb-text-button" onClick={onOpenLesson}>查看原题</button>
      )}
      {compareOpen && (
        <UpdateCompareDialog
          reference={reference}
          onClose={() => setCompareOpen(false)}
          onAdopt={(version) => {
            onAdopt(version);
            setCompareOpen(false);
          }}
        />
      )}
    </article>
  );
}
