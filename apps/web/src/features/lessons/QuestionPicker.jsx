/**
 * In-lesson question picker (U5): the main area temporarily becomes 找题 for one
 * lesson target. Selection order is the reference order, already-used questions
 * are marked, and a selection that disappeared on the server is reported instead
 * of being silently replaced.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { excerptFor } from '../workbench/documents.js';
import { getQuestion, listQuestions } from '../questions/api.js';
import { QuestionRow } from '../questions/QuestionList.jsx';
import { QuestionBody, SolutionDetails } from '../questions/QuestionReader.jsx';

export function QuestionPicker({
  lessonTitle,
  targetLabel,
  existingQuestionIds,
  selected,
  onToggle,
  onRemoveSelection,
  onConfirm,
  onCancel,
  busy = false,
  problem = null
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [missing, setMissing] = useState([]);
  const seqRef = useRef(0);

  useEffect(() => {
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setStatus('loading');
    listQuestions({ q: query, state: 'active' })
      .then((rows) => {
        if (seq !== seqRef.current) return;
        setItems(rows);
        setStatus('ready');
      })
      .catch((error) => {
        if (seq !== seqRef.current) return;
        setLoadError(error.problem || { message: '读取失败' });
        setStatus('error');
      });
  }, [query]);

  useEffect(() => {
    if (!previewId) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    getQuestion(previewId)
      .then((question) => { if (!cancelled) setPreview(question); })
      .catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [previewId]);

  /**
   * A selection is only "gone" when the server says so: the current search
   * result set must never be mistaken for the whole question bank.
   */
  async function handleConfirm() {
    const available = new Map(items.map((item) => [item.id, item]));
    const unknown = selected.filter((id) => !available.has(id));
    const resolved = [...items];
    const gone = [];
    for (const id of unknown) {
      try {
        resolved.push(await getQuestion(id));
      } catch (error) {
        gone.push(id);
      }
    }
    setMissing(gone);
    if (gone.length > 0) return;
    onConfirm(resolved);
  }

  const existing = new Set(existingQuestionIds);

  return (
    <div className="wb-module wb-page wb-picker" data-region="question-picker">
      <header className="wb-picker-head">
        <button type="button" className="wb-button" name="picker-back" onClick={onCancel}>
          <Icon name="back" size={15} />
          返回「{lessonTitle} · {targetLabel}」
        </button>
        <div className="wb-search">
          <Icon name="search" size={15} />
          <input
            className="wb-input"
            type="search"
            aria-label="搜索题目"
            placeholder="搜索题目"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="wb-button is-primary"
          name="picker-confirm"
          disabled={busy || selected.length === 0}
          onClick={handleConfirm}
        >
          {busy ? '正在加入…' : `确认加入 ${selected.length} 题`}
        </button>
      </header>

      {(missing.length > 0 || problem) && (
        <div className="wb-picker-notice" data-region="picker-notice" role="alert">
          {missing.length > 0 && (
            <>
              <p>有选中项已不可用，未加入任何题目。</p>
              <button type="button" className="wb-button" onClick={() => { onRemoveSelection(missing); setMissing([]); }}>
                移除这些选择
              </button>
            </>
          )}
          {problem && <p data-region="picker-problem">{problem.message}</p>}
        </div>
      )}

      <div className="wb-picker-body">
        <section className="wb-list-pane" data-region="picker-list" aria-label="找题">
          {status === 'loading' && <p className="wb-muted">正在加载题目…</p>}
          {status === 'error' && (
            <div className="wb-inline-error">
              <p>{loadError?.message}</p>
              <button type="button" className="wb-button" onClick={() => setQuery((current) => current)}>重试</button>
            </div>
          )}
          {status === 'ready' && items.length === 0 && <p className="wb-empty-note">没有匹配的题目</p>}
          <ul className="wb-list">
            {items.map((item) => (
              <QuestionRow
                key={item.id}
                item={item}
                selectedIndex={selected.indexOf(item.id)}
                inTarget={existing.has(item.id)}
                disabled={existing.has(item.id)}
                onOpen={() => setPreviewId(item.id)}
                onToggleSelect={() => onToggle(item.id)}
              />
            ))}
          </ul>
        </section>

        <section className="wb-preview-pane" data-region="picker-preview" aria-label="题目预览">
          {preview ? (
            <article className="wb-reader">
              <h2 className="wb-object-title">
                {preview.title || excerptFor('', preview.body, 30) || '未命名题目'}
              </h2>
              <QuestionBody document={preview.body} />
              <SolutionDetails document={preview.solution} />
            </article>
          ) : (
            <p className="wb-empty-note">选择题目后可预览</p>
          )}
        </section>
      </div>
    </div>
  );
}
