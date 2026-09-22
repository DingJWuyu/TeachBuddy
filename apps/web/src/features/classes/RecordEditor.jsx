/**
 * Inline editor for one actual record.
 *
 * It is the shared save lifecycle: the server object is loaded, the local draft
 * is kept, an unknown result keeps the exact request, and a version conflict is
 * compared instead of overwritten. The record list stays mounted around it, so
 * closing the editor returns to the same scroll position.
 */
import { useEffect, useRef, useState } from 'react';
import { ConflictResolution } from '../workbench/ConflictResolution.jsx';
import { SaveActions, SaveStatus } from '../workbench/SaveStatus.jsx';
import { useSavableDocument } from '../workbench/useSavableDocument.js';
import { getRecord, updateRecord, decodeRecordRequest, recordRequest } from './api.js';
import { recordInputFromRecord, recordUpdatePayload } from './model.js';
import { SourceChips, SourcePicker } from './SourcePicker.jsx';

export const RECORD_EXTRA_FIELDS = [
  ['position', '教学位置'],
  ['unfinished', '未讲内容'],
  ['commonIssues', '共性问题'],
  ['nextNote', '下次备注']
];

export function RecordEditor({ accountKey, generation, record, onSaved, onClose }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const notifiedVersionRef = useRef(null);
  const [readWarning, setReadWarning] = useState(null);
  const [reload, setReload] = useState(0);
  const loadGeneration = `${generation}:${reload}`;
  const initializedGeneration = useRef(null);
  const knownRecord = useRef(record);
  if (record.version > knownRecord.current.version) knownRecord.current = record;

  async function loadRecord() {
    const initialRead = initializedGeneration.current !== loadGeneration;
    initializedGeneration.current = loadGeneration;
    try {
      const current = await getRecord(record.id);
      if (current.version >= knownRecord.current.version) knownRecord.current = current;
      setReadWarning(null);
      return current;
    } catch (error) {
      // A full projection can fail because a source is unavailable, even while
      // the record exists. Keep the already-read record for initial editing;
      // every write still checks its version/ownership on the server. Later
      // conflict/adoption reads must fail normally rather than adopt a cache.
      if (error.problem?.kind === 'identity') throw error;
      setReadWarning(error.problem || { message: '未能读取记录' });
      if (!initialRead) throw error;
      return knownRecord.current;
    }
  }
  const savable = useSavableDocument({
    accountKey,
    generation: loadGeneration,
    kind: 'class-record',
    draftId: record.id,
    mode: 'update',
    load: loadRecord,
    update: async ({ key, id, payload }) => {
      const result = await updateRecord({ key, id, ...decodeRecordRequest(payload) });
      if (result.version >= knownRecord.current.version) knownRecord.current = result;
      setReadWarning(null);
      return result;
    },
    buildUpdate: (input, baseline) => recordRequest(recordUpdatePayload(input, baseline)),
    inputFromObject: recordInputFromRecord
  });
  const { input, setInput } = savable;

  useEffect(() => {
    // Refresh the list once per confirmed server version; the refresh must not
    // re-trigger itself through a changed callback identity.
    if (savable.status === 'saved' && savable.baseline && notifiedVersionRef.current !== savable.baseline.version) {
      notifiedVersionRef.current = savable.baseline.version;
      onSaved(savable.baseline);
    }
  }, [savable.status, savable.baseline, onSaved]);

  if (!input) {
    return (
      <div className="c-record-editor" data-region="record-editor">
        <p className="wb-muted">
          {savable.loadState === 'error' ? (savable.loadError?.message || '无法读取记录') : '正在加载记录…'}
        </p>
        <button type="button" className="wb-button" name="record-close" onClick={onClose}>返回</button>
      </div>
    );
  }

  return (
    <div className="c-record-editor" data-region="record-editor">
      {readWarning && <div className="wb-inline-error" role="status" data-region="record-read-warning">
        未能更新记录，当前显示上次内容；草稿保留，可移除异常关联后保存。
        <button type="button" className="wb-button" onClick={() => setReload(value => value + 1)} disabled={savable.isSaving}>重试读取</button>
      </div>}
      <div className="c-editor-head">
        <span className="wb-label">编辑记录</span>
        <button type="button" className="wb-button" name="record-close" onClick={onClose}>返回</button>
      </div>
      <label className="wb-field">
        <span className="wb-label">日期</span>
        <input
          className="wb-input"
          type="date"
          aria-label="编辑记录日期"
          value={input.recordedOn}
          onChange={(event) => setInput((current) => ({ ...current, recordedOn: event.target.value }))}
        />
      </label>
      <label className="wb-field">
        <span className="wb-label">一句话</span>
        <textarea
          className="wb-input c-textarea"
          aria-label="编辑记录内容"
          rows={3}
          value={input.note}
          onChange={(event) => setInput((current) => ({ ...current, note: event.target.value }))}
        />
      </label>
      {RECORD_EXTRA_FIELDS.map(([key, label]) => (
        <label className="wb-field" key={key}>
          <span className="wb-label">{label}</span>
          <textarea
            className="wb-input c-textarea"
            aria-label={label}
            rows={2}
            value={input[key]}
            onChange={(event) => setInput((current) => ({ ...current, [key]: event.target.value }))}
          />
        </label>
      ))}
      <div className="wb-field">
        <span className="wb-label">关联资料</span>
        <SourceChips
          sources={input.sources}
          onRemove={(source) => setInput((current) => ({
            ...current,
            sources: current.sources.filter((item) => !(item.kind === source.kind && item.id === source.id))
          }))}
          onPick={() => setPickerOpen(true)}
        />
      </div>
      <SaveStatus savable={savable} />
      {savable.status === 'conflict' && (
        <ConflictResolution
          savable={savable}
          hint="当前草稿保留在这里。采用服务器版本会丢弃本地输入，请先对照。"
          onAdopt={async () => {
            const object = await savable.adoptServer();
            if (object) onSaved(object);
          }}
          renderServer={(server) => (
            <div>
              <p>{server.note}</p>
              {RECORD_EXTRA_FIELDS.map(([key, label]) => (server[key]
                ? <p key={key}><span className="wb-muted">{label}：</span>{server[key]}</p>
                : null))}
            </div>
          )}
        />
      )}
      <SaveActions savable={savable} />
      {pickerOpen && (
        <SourcePicker
          accountKey={accountKey}
          value={input.sources}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(sources) => {
            setInput((current) => ({ ...current, sources }));
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
