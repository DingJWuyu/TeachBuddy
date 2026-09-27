import { DocumentView } from '../workbench/materials/DocumentView.jsx';
/**
 * Actual records for one class: newest first, readable in place, editable,
 * deletable and restorable. Opening a record edits it inline, so the list keeps
 * its scroll and the editor's draft survives leaving and returning.
 */
import { useScene } from '../workbench/useScene.js';
import { RecordSearch, EMPTY_FILTER, hasRecordFilter, matchesRecord } from './RecordSearch.jsx';
import { ModulePresence } from '../workbench/ModuleMotion.jsx';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { ConfirmDialog, MenuItem, Popover } from '../workbench/ModuleOverlays.jsx';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { setRecordDeletion, decodeRecordRequest, recordRequest } from './api.js';
import { formatRecordedOn } from './model.js';
import { RecordEditor, RECORD_EXTRA_FIELDS } from './RecordEditor.jsx';
import { SourceChips } from './SourcePicker.jsx';

function RecordCard({ accountKey, generation, record, open, onOpen, onClose, onChanged, readOnly, justCreated, onRevealed, onPurge, onNextNote, nextNoteBusy, onMove, moveBusy }) {
  const [confirming, setConfirming] = useState(false);
  const deletion = useIdempotentSubmit({ accountKey, name: `pending:class-record-deletion:${record.id}` });
  const deleted = record.deletedAt !== null;
  const row = useRef(null);
  useEffect(() => {
    if (!justCreated) return;
    row.current?.scrollIntoView({ block: 'nearest' });
    onRevealed();
  }, [justCreated, onRevealed]);

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
    <li ref={row} className={`c-record${open && !deleted && !readOnly ? ' is-editing' : ''}${deleted ? ' is-deleted' : ''}`} data-record-id={record.id} data-record-state={deleted ? 'deleted' : 'active'}>
      <div className="c-record-head">
        <time className="c-record-date" dateTime={record.recordedOn}><Icon name="calendar" size={14} />{formatRecordedOn(record.recordedOn)}</time>
        {deleted && <span className="wb-tag is-deleted">已删除</span>}
        <span className="c-record-spacer" />
        {!deleted && !readOnly && !open && (
          <button type="button" className="wb-button c-text-action" name="record-open" onClick={() => onOpen(record.id)}>
            编辑记录
          </button>
        )}
        {!readOnly && <Popover label="记录操作" icon="more">
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
              {!deleted && <MenuItem icon="classes" disabled={moveBusy || deletion.isRunning || Boolean(deletion.pending)} onClick={() => { close(); onMove(record); }}>移到其他班级</MenuItem>}
              {deleted && <MenuItem icon="trash" danger onClick={() => { close(); onPurge(record); }}>彻底删除记录</MenuItem>}
              {!deleted && record.nextNote?.trim() && <MenuItem icon="calendar" disabled={nextNoteBusy} onClick={() => { close(); onNextNote(record, !record.nextNoteHidden); }}>
                {record.nextNoteHidden ? '恢复想法提示' : '不再提示这条想法'}
              </MenuItem>}
            </>
          )}
        </Popover>}
      </div>
      <ModulePresence present={!open || readOnly || deleted} mode="collapse">
      {record.note && <p className="c-record-note">{record.note}</p>}
      {record.content?.blocks.length > 0 && <DocumentView value={record.content} className="c-record-content" />}
      {RECORD_EXTRA_FIELDS.map(([key, label]) => (record[key]
        ? (
          <p className="c-record-field" key={key}>
            <span className="wb-label">{label}</span>
            <span>{record[key]}</span>
          </p>
        )
        : null))}
      {record.sources.length > 0 && <SourceChips sources={record.sources} returnPath={`/classes/${record.classId}/records/${record.id}`} />}
      </ModulePresence>
      {deletion.status === 'unconfirmed' && (
        <div className="c-record-problem" data-region="record-action-problem">
          <span>上次操作的结果未确认，请重试确认</span>
          <button type="button" className="wb-button" name="record-action-retry" onClick={retryDeletion}>重试确认</button>
        </div>
      )}
      {deletion.status === 'failed' && (
        <p className="wb-inline-error" data-region="record-action-problem">{deletion.problem?.message || '操作失败'}</p>
      )}
      <ModulePresence present={open && !readOnly && !deleted} mode="collapse">
      {open && !readOnly && !deleted && (
        <RecordEditor
          accountKey={accountKey}
          generation={generation}
          record={record}
          onSaved={onChanged}
          onClose={onClose}
        />
      )}
      </ModulePresence>
      <ModulePresence present={confirming}>
      {confirming && (
        <ConfirmDialog
          title="删除记录"
          message="记录会保留在“已删除”中，可随时恢复。"
          confirmLabel="删除"
          onCancel={() => setConfirming(false)}
          onConfirm={() => submitDeletion(true)}
        />
      )}
      </ModulePresence>
    </li>
  );
}

export function RecordList({ classId, accountKey, generation, records, state, onStateChange, openRecordId, onOpen, onClose, onChanged, readOnly = false, createdId, onRevealed, onPurge, onNextNote, nextNoteBusy, onMove, moveBusy }) {
  const [scene, patchScene] = useScene(accountKey, `class-search:${classId}:${state}`, { ...EMPTY_FILTER, open: false, advanced: false });
  const searchTrigger = useRef(null);
  function closeSearch() {
    patchScene({ ...EMPTY_FILTER, open: false });
    searchTrigger.current?.focus({ preventScroll: true });
  }
  const filtered = records.filter(record => matchesRecord(record, scene));
  const pinned = records.find(record => record.id === openRecordId && !filtered.includes(record));
  const visible = pinned ? [pinned, ...filtered] : filtered;
  return (
    <section className="c-records" data-region="record-list">
      <div className="c-records-head">
        <h2 className="c-section-title"><Icon name="history" size={18} />{state === 'deleted' ? '已删除的记录' : '教学记录'} <span className="c-record-count">{hasRecordFilter(scene) ? `${filtered.length} / ${records.length}` : records.length}</span></h2>
        <button ref={searchTrigger} className="wb-icon-button" aria-label="查找记录" title="查找记录" aria-expanded={scene.open} onClick={() => patchScene({ ...(scene.open ? EMPTY_FILTER : {}), open: !scene.open })}><Icon name="search" size={17} /></button>
        {state === 'deleted' ? <button className="wb-button c-text-action" onClick={() => { onClose(); onStateChange('active'); }}><Icon name="back" size={14} />返回教学记录</button>
          : <Popover label="教学记录选项">{({ close }) => <MenuItem icon="trash" onClick={() => { close(); onClose(); onStateChange('deleted'); }}>已删除的记录</MenuItem>}</Popover>}
      </div>
      <ModulePresence present={scene.open} mode="collapse">
        {scene.open && <RecordSearch filter={scene} onChange={patchScene} records={records} advanced={scene.advanced}
          onAdvanced={advanced => patchScene({ advanced })} onClose={closeSearch} />}
      </ModulePresence>
      {pinned && <p className="wb-muted">当前打开的记录不在筛选范围内，仍显示在下方。</p>}
      {records.length > 0 && filtered.length === 0 && <p className="wb-empty-note" role="status">没有符合条件的记录，试试其他关键词或清除筛选。</p>}
      {records.length === 0 && (
        <p className="wb-empty-note" data-region="record-empty">
          {state === 'deleted' ? '没有已删除的记录' : '保存的课堂记录会按日期留在这里，下次上课前随时回看。'}
        </p>
      )}
      <ul className="c-record-list" data-region="record-rows">
        {visible.map((record) => (
          <RecordCard
            key={record.id}
            accountKey={accountKey}
            generation={generation}
            record={record}
            readOnly={readOnly}
            open={openRecordId === record.id}
            onOpen={onOpen}
            onClose={onClose}
            onChanged={onChanged}
            justCreated={createdId === record.id}
            onRevealed={onRevealed}
            onPurge={onPurge} onNextNote={onNextNote} nextNoteBusy={nextNoteBusy} onMove={onMove} moveBusy={moveBusy}
          />
        ))}
      </ul>
    </section>
  );
}
