/**
 * Actual records for one class: newest first, readable in place, editable,
 * deletable and restorable. Opening a record edits it inline, so the list keeps
 * its scroll and the editor's draft survives leaving and returning.
 */
import { useState } from 'react';
import { ConfirmDialog, MenuItem, Popover } from '../workbench/overlays.jsx';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { setRecordDeletion, decodeRecordRequest, recordRequest } from './api.js';
import { formatRecordedOn } from './model.js';
import { RecordEditor, RECORD_EXTRA_FIELDS } from './RecordEditor.jsx';
import { SourceChips } from './SourcePicker.jsx';

function RecordCard({ accountKey, generation, record, open, onOpen, onClose, onChanged }) {
  const [confirming, setConfirming] = useState(false);
  const deletion = useIdempotentSubmit({ accountKey, name: `pending:class-record-deletion:${record.id}` });
  const deleted = record.deletedAt !== null;

  async function submitDeletion(nextDeleted) {
    setConfirming(false);
    const payload = { expectedVersion: record.version, deleted: nextDeleted };
    const result = await deletion.submit(
      ({ key, payload: body }) => setRecordDeletion({ key, id: record.id, ...decodeRecordRequest(body) }),
      recordRequest(payload)
    );
    if (result) onChanged();
  }

  async function retryDeletion() {
    const result = await deletion.retry(({ key, payload }) => setRecordDeletion({ key, id: record.id, ...decodeRecordRequest(payload) }));
    if (result) onChanged();
  }

  return (
    <li className={`c-record${deleted ? ' is-deleted' : ''}`} data-record-id={record.id} data-record-state={deleted ? 'deleted' : 'active'}>
      <div className="c-record-head">
        <span className="c-record-date">{formatRecordedOn(record.recordedOn)}</span>
        {deleted && <span className="wb-tag is-deleted">已删除</span>}
        <span className="c-record-spacer" />
        {!deleted && (
          <button type="button" className="wb-button" name="record-open" onClick={() => (open ? onClose() : onOpen(record.id))}>
            {open ? '收起' : '编辑'}
          </button>
        )}
        <Popover label="记录操作" icon="more">
          {({ close }) => (
            <>
              {deleted ? (
                <MenuItem
                  icon="back"
                  name="record-restore"
                  onClick={() => {
                    close();
                    submitDeletion(false);
                  }}
                >
                  恢复记录
                </MenuItem>
              ) : (
                <MenuItem
                  icon="trash"
                  danger
                  name="record-delete"
                  onClick={() => {
                    close();
                    setConfirming(true);
                  }}
                >
                  删除记录
                </MenuItem>
              )}
            </>
          )}
        </Popover>
      </div>
      {record.note && <p className="c-record-note">{record.note}</p>}
      {RECORD_EXTRA_FIELDS.map(([key, label]) => (record[key]
        ? (
          <p className="c-record-field" key={key}>
            <span className="wb-label">{label}</span>
            <span>{record[key]}</span>
          </p>
        )
        : null))}
      {record.sources.length > 0 && <SourceChips sources={record.sources} returnPath={`/classes/${record.classId}/records/${record.id}`} />}
      {deletion.status === 'unconfirmed' && (
        <div className="c-record-problem" data-region="record-action-problem">
          <span>上次操作的结果未确认，请重试确认</span>
          <button type="button" className="wb-button" name="record-action-retry" onClick={retryDeletion}>重试确认</button>
        </div>
      )}
      {deletion.status === 'failed' && (
        <p className="wb-inline-error" data-region="record-action-problem">{deletion.problem?.message || '操作失败'}</p>
      )}
      {open && (
        <RecordEditor
          accountKey={accountKey}
          generation={generation}
          record={record}
          onSaved={onChanged}
          onClose={onClose}
        />
      )}
      {confirming && (
        <ConfirmDialog
          title="删除记录"
          message="记录会保留在“已删除”中，可随时恢复。"
          confirmLabel="删除"
          onCancel={() => setConfirming(false)}
          onConfirm={() => submitDeletion(true)}
        />
      )}
    </li>
  );
}

export function RecordList({ accountKey, generation, records, state, onStateChange, openRecordId, onOpen, onClose, onChanged }) {
  return (
    <section className="c-records" data-region="record-list">
      <div className="c-records-head">
        <h2 className="c-section-title">实际记录</h2>
        <div className="wb-filters" role="group" aria-label="记录过滤">
          <button
            type="button"
            className={`wb-chip${state === 'active' ? ' is-active' : ''}`}
            aria-pressed={state === 'active'}
            onClick={() => onStateChange('active')}
          >
            教学记录
          </button>
          <button
            type="button"
            className={`wb-chip${state === 'deleted' ? ' is-active' : ''}`}
            aria-pressed={state === 'deleted'}
            onClick={() => onStateChange('deleted')}
          >
            已删除
          </button>
        </div>
      </div>
      {records.length === 0 && (
        <p className="wb-empty-note" data-region="record-empty">
          {state === 'deleted' ? '没有已删除的记录' : '还没有实际记录，先写一句'}
        </p>
      )}
      <ul className="c-record-list" data-region="record-rows">
        {records.map((record) => (
          <RecordCard
            key={record.id}
            accountKey={accountKey}
            generation={generation}
            record={record}
            open={openRecordId === record.id}
            onOpen={onOpen}
            onClose={onClose}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </section>
  );
}
