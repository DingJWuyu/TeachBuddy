/**
 * One-line class record composer.
 *
 * The shortest path is: type one sentence, save. Date defaults to the account
 * day; position/unfinished/commonIssues/nextNote and material links are one
 * "补充" away and never required. A confirmed save clears only its input and keeps
 * the teacher in this class for the next sentence; an unknown result keeps the
 * exact request and the typed input.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { readLocal, removeLocal, writeLocal } from '../workbench/storage.js';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useSaveShortcut } from '../workbench/useSaveShortcut.js';
import { createRecord, decodeRecordRequest, recordRequest } from './api.js';
import { emptyRecordInput, hasAnyRecordText, recordCreatePayload, todayInZone } from './model.js';
import { SourceChips, SourcePicker } from './SourcePicker.jsx';

export function RecordComposer({ accountKey, classId, timeZone, onCreated, initialSources = [], draftKey }) {
  const draftName = `draft:class-record-new:${draftKey ?? classId}`;
  const [input, setInput] = useState(() => {
    const stored = readLocal(accountKey, draftName);
    return stored?.input ?? { ...emptyRecordInput(classId, todayInZone(timeZone)), sources: initialSources };
  });
  const [expanded, setExpanded] = useState(() => readLocal(accountKey, draftName)?.expanded ?? false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const inputRef = useRef(input);
  const alive = useRef(true);
  const submit = useIdempotentSubmit({ accountKey, name: `pending:class-record-new:${draftKey ?? classId}` });

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!hasAnyRecordText(input) && input.sources.length === 0) {
      removeLocal(accountKey, draftName);
      return;
    }
    writeLocal(accountKey, draftName, { input, expanded });
  }, [accountKey, draftName, input, expanded]);

  function patch(values) {
    setNotice(null);
    inputRef.current = { ...inputRef.current, ...values };
    setInput(inputRef.current);
  }

  function settle(result, payload) {
    if (!result || !alive.current) return;
    const unchanged = JSON.stringify(recordCreatePayload(inputRef.current)) === JSON.stringify(payload);
    if (unchanged) {
      inputRef.current = emptyRecordInput(classId, inputRef.current.recordedOn);
      setInput(inputRef.current);
      setExpanded(false);
    }
    setNotice({ kind: 'saved', message: unchanged ? '已保存' : '上次内容已保存，新输入仍为草稿' });
    onCreated(result);
  }

  async function save() {
    if (!hasAnyRecordText(input)) {
      setNotice({ kind: 'error', message: '至少写一句再保存' });
      return;
    }
    const payload = recordCreatePayload(input);
    settle(await submit.submit(({ key, payload: body }) => createRecord({ key, ...decodeRecordRequest(body) }), recordRequest(payload)), payload);
  }

  async function retryConfirm() {
    const payload = decodeRecordRequest(submit.pending?.payload).payload;
    settle(await submit.retry(({ key, payload }) => createRecord({ key, ...decodeRecordRequest(payload) })), payload);
  }

  useSaveShortcut(() => (submit.status === 'unconfirmed' ? retryConfirm() : save()), submit.status !== 'running');

  const problem = submit.problem;
  const statusText = submit.status === 'unconfirmed'
    ? '暂时无法确认是否保存'
    : submit.status === 'failed' ? (problem?.message || '保存失败') : notice?.message;
  const statusKind = submit.status === 'unconfirmed'
    ? 'unconfirmed'
    : submit.status === 'failed' ? 'error' : (notice?.kind || 'idle');

  return (
    <form
      className="c-composer"
      data-region="record-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (submit.status === 'unconfirmed') retryConfirm();
        else save();
      }}
    >
      <div className="c-composer-row">
        <textarea
          className="wb-input c-composer-input"
          aria-label="写一句"
          rows={2}
          placeholder="写一句…（例：例2没讲，任意性还需强调）"
          value={input.note}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </div>
      <div className="c-composer-actions">
        <label className="c-date-field">
          <span className="wb-label">日期</span>
          <input
            className="wb-input"
            type="date"
            aria-label="记录日期"
            value={input.recordedOn}
            onChange={(event) => patch({ recordedOn: event.target.value })}
          />
        </label>
        <button
          type="button"
          className="wb-button"
          name="toggle-supplement"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? '收起补充' : '补充'}
        </button>
        <span className="c-composer-spacer" />
        {submit.status === 'unconfirmed' ? (
          <button type="button" className="wb-button is-primary" name="retry-confirm" onClick={retryConfirm}>
            重试确认
          </button>
        ) : (
          <button type="submit" className="wb-button is-primary" name="save-record">
            保存
          </button>
        )}
      </div>

      {expanded && (
        <div className="c-composer-extra" data-region="record-supplement">
          <label className="wb-field">
            <span className="wb-label">教到哪里</span>
            <textarea
              className="wb-input c-textarea"
              aria-label="教学位置"
              rows={2}
              value={input.position}
              onChange={(event) => patch({ position: event.target.value })}
            />
          </label>
          <label className="wb-field">
            <span className="wb-label">未讲内容</span>
            <textarea
              className="wb-input c-textarea"
              aria-label="未讲内容"
              rows={2}
              value={input.unfinished}
              onChange={(event) => patch({ unfinished: event.target.value })}
            />
          </label>
          <label className="wb-field">
            <span className="wb-label">共性问题</span>
            <textarea
              className="wb-input c-textarea"
              aria-label="共性问题"
              rows={2}
              value={input.commonIssues}
              onChange={(event) => patch({ commonIssues: event.target.value })}
            />
          </label>
          <label className="wb-field">
            <span className="wb-label">下次备注</span>
            <textarea
              className="wb-input c-textarea"
              aria-label="下次备注"
              rows={2}
              value={input.nextNote}
              onChange={(event) => patch({ nextNote: event.target.value })}
            />
          </label>
          <div className="wb-field">
            <span className="wb-label">关联资料</span>
            <SourceChips
              sources={input.sources}
              onRemove={(source) => patch({
                sources: input.sources.filter((item) => !(item.kind === source.kind && item.id === source.id))
              })}
              onPick={() => setPickerOpen(true)}
            />
          </div>
        </div>
      )}

      <div className={`c-composer-status is-${statusKind}`} data-region="composer-status" role="status" aria-live="polite">
        {statusText && (
          <span className="c-status-text">
            {statusKind === 'saved' && <Icon name="check" size={13} />}
            {statusText}
          </span>
        )}
        {!statusText && hasAnyRecordText(input) && <span className="wb-draft-hint">草稿在此设备</span>}
      </div>

      {pickerOpen && (
        <SourcePicker
          accountKey={accountKey}
          value={input.sources}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(sources) => {
            patch({ sources });
            setPickerOpen(false);
          }}
        />
      )}
    </form>
  );
}
