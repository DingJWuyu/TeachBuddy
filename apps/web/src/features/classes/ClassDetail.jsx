/**
 * One class: its actual position, the one-line composer and the record list.
 * A deleted class is read-only until it is restored; records keep their own
 * deletion state either way.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { ConfirmDialog } from '../workbench/overlays.jsx';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useScrollRestore } from '../workbench/useScrollRestore.js';
import { setClassDeletion, updateClass } from './api.js';
import { formatRecordedOn, latestPosition } from './model.js';
import { RecordComposer } from './RecordComposer.jsx';
import { RecordList } from './RecordList.jsx';

export function ClassDetail({
  accountKey,
  generation,
  classroom,
  timeZone,
  records,
  recordState,
  onRecordStateChange,
  recordsStatus,
  recordsError,
  onReloadRecords,
  openRecordId,
  onOpenRecord,
  onCloseRecord,
  onClassChanged,
  onBack,
  detailScrollTop,
  onDetailScrollTop
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(classroom.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const renamed = useIdempotentSubmit({ accountKey, name: `pending:class-rename:${classroom.id}` });
  const deletion = useIdempotentSubmit({ accountKey, name: `pending:class-deletion:${classroom.id}` });
  const deleted = classroom.deletedAt !== null;
  const activeRecords = records.active ?? [];
  const position = latestPosition(activeRecords);
  const scroll = useScrollRestore(detailScrollTop || 0, onDetailScrollTop, classroom.id);
  const pendingScroll = useRef(detailScrollTop || 0);

  useEffect(() => {
    const node = scroll.ref.current;
    if (!node || pendingScroll.current <= 0 || recordsStatus !== 'ready') return;
    // The record list and its editor load separately. Restore only after the
    // opened editor has its fields, not against the shorter loading placeholder.
    const restore = () => {
      if (openRecordId && node.querySelector('[data-region="record-editor"]')
        && !node.querySelector('[data-region="record-editor"] textarea')) return;
      node.scrollTop = pendingScroll.current;
      pendingScroll.current = 0;
      observer.disconnect();
    };
    const observer = new MutationObserver(restore);
    observer.observe(node, { childList: true, subtree: true });
    restore();
    return () => observer.disconnect();
  }, [recordsStatus, openRecordId, scroll.ref]);

  async function saveName() {
    if (name.trim() === '') return;
    const payload = { expectedVersion: classroom.version, name };
    const result = await renamed.submit(
      ({ key, payload: body }) => updateClass({ key, id: classroom.id, payload: body }),
      payload
    );
    if (result) {
      setRenaming(false);
      onClassChanged(result);
    }
  }

  async function retryRename() {
    const result = await renamed.retry(({ key, payload }) => updateClass({ key, id: classroom.id, payload }));
    if (result) {
      setRenaming(false);
      onClassChanged(result);
    }
  }

  async function submitDeletion(nextDeleted) {
    setConfirmingDelete(false);
    const payload = { expectedVersion: classroom.version, deleted: nextDeleted };
    const result = await deletion.submit(
      ({ key, payload: body }) => setClassDeletion({ key, id: classroom.id, payload: body }),
      payload
    );
    if (result) onClassChanged(result);
  }

  async function retryDeletion() {
    const result = await deletion.retry(({ key, payload }) => setClassDeletion({ key, id: classroom.id, payload }));
    if (result) onClassChanged(result);
  }

  return (
    <section className="wb-content-pane c-class-detail" data-region="class-detail" data-class-id={classroom.id}>
      <header className="c-class-head">
        {onBack && (
          <button type="button" className="wb-icon-button c-back" aria-label="返回班级列表" name="back-to-classes" onClick={onBack}>
            <Icon name="back" size={16} />
          </button>
        )}
        {renaming ? (
          <div className="c-rename">
            <input
              className="wb-input"
              aria-label="班级名称"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveName();
                if (event.key === 'Escape') {
                  setRenaming(false);
                  setName(classroom.name);
                }
              }}
            />
            <button
              type="button"
              className="wb-button is-primary"
              name={renamed.status === 'unconfirmed' ? 'retry-confirm' : 'save-class-name'}
              onClick={() => (renamed.status === 'unconfirmed' ? retryRename() : saveName())}
            >
              {renamed.status === 'unconfirmed' ? '重试确认' : '保存'}
            </button>
            <button
              type="button"
              className="wb-button"
              onClick={() => {
                setRenaming(false);
                setName(classroom.name);
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <>
            <h1 className="c-class-title">{classroom.name}</h1>
            {deleted && <span className="wb-tag is-deleted">已删除</span>}
            <span className="c-head-spacer" />
            <button
              type="button"
              className="wb-button"
              name="rename-class"
              onClick={() => {
                setName(classroom.name);
                setRenaming(true);
              }}
            >
              改名
            </button>
            {deleted ? (
              <button
                type="button"
                className="wb-button is-primary"
                name={deletion.status === 'unconfirmed' ? 'retry-confirm' : 'restore-class'}
                onClick={() => (deletion.status === 'unconfirmed' ? retryDeletion() : submitDeletion(false))}
              >
                {deletion.status === 'unconfirmed' ? '重试确认' : '恢复班级'}
              </button>
            ) : (
              <button type="button" className="wb-button" name="delete-class" onClick={() => setConfirmingDelete(true)}>删除</button>
            )}
          </>
        )}
        {renamed.status === 'failed' && <p className="c-field-error">{renamed.problem?.message || '改名失败'}</p>}
        {deletion.status === 'failed' && <p className="c-field-error">{deletion.problem?.message || '班级操作失败'}</p>}
        {deletion.status === 'unconfirmed' && !deleted && (
          <p className="c-field-error">上次删除的结果未确认，可再次重试确认</p>
        )}
      </header>

      <div className="c-detail-scroll" data-region="class-detail-scroll" ref={scroll.ref} onScroll={scroll.onScroll}>
        <div className="c-position" data-region="latest-position">
          <span className="wb-label">最近实际位置</span>
          {position ? (
            <p className="c-position-text">
              {position.text}
              <span className="wb-muted"> · {formatRecordedOn(position.record.recordedOn)}</span>
            </p>
          ) : (
            <p className="wb-muted">还没有实际记录</p>
          )}
        </div>

        {deleted && (
          <p className="c-deleted-note" data-region="class-deleted-note">
            班级已删除，记录只读；恢复班级后可继续记录。
          </p>
        )}

        {!deleted && (
          <RecordComposer
            key={classroom.id}
            accountKey={accountKey}
            classId={classroom.id}
            timeZone={timeZone}
            onCreated={onReloadRecords}
          />
        )}

        {recordsStatus === 'loading' && <p className="wb-muted c-pane-note">正在加载记录…</p>}
        {recordsStatus === 'error' && (
          <div className="wb-inline-error c-pane-note" data-region="records-error">
            <span>{records.active !== null ? '未能更新记录，保留上次内容。' : ''}{recordsError?.message || '无法加载记录'}</span>
            <button type="button" className="wb-button" onClick={onReloadRecords}>重试</button>
          </div>
        )}
        {(records.active !== null || records.deleted !== null) && (
          <RecordList
            readOnly={deleted}
            accountKey={accountKey}
            generation={generation}
            records={recordState === 'deleted' ? (records.deleted ?? []) : activeRecords}
            state={recordState}
            onStateChange={onRecordStateChange}
            openRecordId={openRecordId}
            onOpen={onOpenRecord}
            onClose={onCloseRecord}
            onChanged={onReloadRecords}
          />
        )}
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="删除班级"
          message="记录保留，关联显示已删除；不连带删除备课或题目。"
          confirmLabel="删除"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => submitDeletion(true)}
        />
      )}
    </section>
  );
}
