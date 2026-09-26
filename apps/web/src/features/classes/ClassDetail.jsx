import { useScene } from '../workbench/useScene.js';
/**
 * One class: its actual position, the one-line composer and the record list.
 * A deleted class is read-only until it is restored; records keep their own
 * deletion state either way.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { ConfirmDialog, MenuItem, Popover } from '../workbench/ModuleOverlays.jsx';
import { ModuleDisclosure, ModulePresence } from '../workbench/ModuleMotion.jsx';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useScrollRestore } from '../workbench/useScrollRestore.js';
import { setClassDeletion, updateClass, setNextNoteVisibility } from './api.js';
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
  onChooseClass,
  onHome,
  onDelete,
  onPurgeRecord,
  detailScrollTop,
  onDetailScrollTop
}) {
  const [renameScene, patchRename] = useScene(accountKey, `class-rename:${classroom.id}`, { renaming: false, name: classroom.name, baseVersion: classroom.version });
  const { renaming, name } = renameScene;
  const setRenaming = value => patchRename({ renaming: value, ...(value ? { baseVersion: classroom.version } : {}) });
  const setName = value => patchRename({ name: value });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const renamed = useIdempotentSubmit({ accountKey, name: `pending:class-rename:${classroom.id}` });
  const deletion = useIdempotentSubmit({ accountKey, name: `pending:class-deletion:${classroom.id}` });
  const deleted = classroom.deletedAt !== null;
  const activeRecords = records.active ?? [];
  const locatedRecord = [...activeRecords, ...(records.deleted ?? [])].find(record => record.id === openRecordId);
  const editing = Boolean(openRecordId && !deleted && (!locatedRecord || !locatedRecord.deletedAt));
  const position = latestPosition(activeRecords);
  const latestNext = activeRecords.find(record => record.nextNote?.trim());
  const next = latestNext?.nextNoteHidden ? null : latestNext;
  const nextNote = useIdempotentSubmit({ accountKey, name: `pending:class-next-note:${classroom.id}` });
  const [review, patchReview] = useScene(accountKey, `class-review:${classroom.id}`, { open: false, count: 5 });
  const reviewRecords = activeRecords.filter(record => record.unfinished.trim() || record.commonIssues.trim() || record.nextNote.trim() && !record.nextNoteHidden);
  async function changeNextNote(record, hidden) {
    const run = ({ key, payload }) => setNextNoteVisibility({ key, id: payload.id, payload: { expectedVersion: payload.expectedVersion, hidden: payload.hidden } });
    const result = nextNote.pending ? await nextNote.retry(run) : await nextNote.submit(run, { id: record.id, expectedVersion: record.version, hidden });
    if (result) onReloadRecords();
  }
  const [createdId, setCreatedId] = useState(null);
  const scroll = useScrollRestore(detailScrollTop || 0, onDetailScrollTop, classroom.id);
  const pendingScroll = useRef(detailScrollTop || 0);
  const [reading, patchReading] = useScene(accountKey, `class-reading:${classroom.id}`, { anchor: null });
  const returning = useRef(false);

  function openEditor(id) {
    const node = scroll.ref.current;
    const row = node?.querySelector(`[data-record-id="${CSS.escape(id)}"]`);
    if (row) patchReading({ anchor: { id, offset: row.getBoundingClientRect().top - node.getBoundingClientRect().top } });
    onOpenRecord(id);
  }
  function closeEditor() {
    returning.current = Boolean(openRecordId && reading.anchor);
    onCloseRecord();
  }
  useLayoutEffect(() => {
    if (openRecordId || !returning.current || !reading.anchor) return;
    const node = scroll.ref.current;
    const row = node?.querySelector(`[data-record-id="${CSS.escape(reading.anchor.id)}"]`);
    if (!row) { returning.current = false; return; }
    let frame;
    let settledFrames = 0;
    // Both the composer and the inline editor change height on return. Keep the
    // reading anchor in place through their transitions, including reduced motion.
    const restore = () => {
      node.scrollTop += row.getBoundingClientRect().top - node.getBoundingClientRect().top - reading.anchor.offset;
      const moving = node.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'
        && animation.effect?.target?.matches('.wb-module-presence, .wb-module-disclosure-grid'));
      settledFrames = moving ? 0 : settledFrames + 1;
      if (settledFrames < 3) frame = requestAnimationFrame(restore);
      else {
        returning.current = false;
        row.querySelector('[name="record-open"]')?.focus({ preventScroll: true });
        patchReading({ anchor: null });
      }
    };
    frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [openRecordId, reading.anchor, patchReading, scroll.ref]);

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
    const payload = { expectedVersion: renameScene.baseVersion, name };
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
    <section className="c-class-detail" data-region="class-detail" data-class-id={classroom.id}>
      <header className="c-class-head">
        <button type="button" className="wb-icon-button" aria-label="返回班级主页" title="返回班级主页" onClick={onHome}><Icon name="back" size={20} /></button>
        <h1>班级教学</h1>
          <>
            <button type="button" className="c-class-switch" title={`切换班级 · ${classroom.name}`} aria-label={`切换班级，当前：${classroom.name}`} onClick={onChooseClass}>
              <span>{classroom.name}</span><Icon name="chevron" size={14} />
            </button>
            <span className="c-head-spacer" />
            <Popover label="班级操作" icon="more">
              {({ close }) => <>
                {!deleted && <MenuItem name="rename-class" onClick={() => { close(); setName(classroom.name); setRenaming(true); }}>修改班级名称</MenuItem>}
                {!deleted && <MenuItem name="archive-class" icon="folder" disabled={deletion.isRunning || Boolean(deletion.pending)} onClick={() => { close(); setConfirmingDelete(true); }}>归档班级</MenuItem>}
                {deleted && <MenuItem name="purge-class" icon="trash" danger disabled={deletion.isRunning || Boolean(deletion.pending)} onClick={() => { close(); onDelete(classroom); }}>彻底删除</MenuItem>}
              </>}
            </Popover>
            {deleted ? (
              <button
                type="button"
                className="wb-button is-primary"
                disabled={deletion.isRunning}
                name={deletion.status === 'unconfirmed' ? 'retry-confirm' : 'restore-class'}
                onClick={() => (deletion.status === 'unconfirmed' ? retryDeletion() : submitDeletion(false))}
              >
                {deletion.status === 'unconfirmed' ? '重试确认' : '恢复班级'}
              </button>
            ) : null}
          </>
        <ModulePresence present={renaming} mode="collapse" className="c-rename-reveal">
          {renaming && (
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
          )}
        </ModulePresence>

        {renamed.status === 'failed' && <p className="c-field-error">{renamed.problem?.message || '改名失败'}</p>}
        {deletion.status === 'failed' && <p className="c-field-error">{deletion.problem?.message || '班级操作失败'}</p>}
        {deletion.status === 'unconfirmed' && !deleted && <div className="c-field-error" role="status">归档结果未确认。
          <button className="wb-button" onClick={retryDeletion}>重试确认</button></div>}
      </header>

      <div className="c-detail-scroll" data-region="class-detail-scroll" ref={scroll.ref} onScroll={scroll.onScroll}>
        {(position || next) && <div className="c-overview">
          {position && <div className="c-overview-item" data-region="latest-position">
            <span className="c-overview-label"><Icon name={position.kind === 'position' ? 'prep' : 'history'} size={16} />{position.kind === 'position' ? '最近教到' : '最近记录'}<time dateTime={position.record.recordedOn}>{formatRecordedOn(position.record.recordedOn)}</time></span>
            <p>{position.text}</p>
          </div>}
          {next && <div className="c-overview-item" data-region="latest-next-note">
            <span className="c-overview-label"><Icon name="calendar" size={16} />下次教学想法<time dateTime={next.recordedOn}>{formatRecordedOn(next.recordedOn)}</time></span>
            <p>{next.nextNote}</p>
            {!deleted && <button className="wb-button c-text-action" disabled={nextNote.isRunning || Boolean(nextNote.pending)} onClick={() => changeNextNote(next, true)}>不再提示这条想法</button>}
          </div>}
        </div>}

        {nextNote.status === 'unconfirmed' && <div className="wb-inline-error" role="status">想法提示的修改结果未确认。<button className="wb-button" onClick={() => changeNextNote()}>重试修改想法提示</button></div>}
        {nextNote.status === 'failed' && <p className="wb-inline-error" role="alert">{nextNote.problem?.message}</p>}
        {reviewRecords.length > 0 && <div className="c-review">
          <button className="wb-button c-text-action" aria-expanded={review.open} onClick={() => patchReview({ open: !review.open })}><Icon name="history" size={16} />课前回顾</button>
          <ModuleDisclosure open={review.open}>
            <div className="c-review-records" data-region="class-review">
              {reviewRecords.slice(0, review.count).map(record => <div key={record.id} className="c-review-record">
                <button className="wb-button c-text-action" onClick={() => openEditor(record.id)}><time>{formatRecordedOn(record.recordedOn)}</time><span>查看原记录</span></button>
                {record.unfinished && <p><span className="wb-label">还没讲的内容</span>{record.unfinished}</p>}
                {record.commonIssues && <p><span className="wb-label">学生普遍遇到的问题</span>{record.commonIssues}</p>}
                {record.nextNote && !record.nextNoteHidden && <p><span className="wb-label">下次教学想法</span>{record.nextNote}</p>}
              </div>)}
              {reviewRecords.length > review.count && <button className="wb-button c-text-action" onClick={() => patchReview({ count: review.count + 5 })}>查看更早记录</button>}
            </div>
          </ModuleDisclosure>
        </div>}
        {!deleted && (
          <ModuleDisclosure open={!editing} className="c-composer-disclosure">
          <RecordComposer
            key={classroom.id}
            accountKey={accountKey}
            classId={classroom.id}
            timeZone={timeZone}
            journal
            active={!editing}
            onCreated={record => { setCreatedId(record.id); onRecordStateChange('active'); onReloadRecords(); }}
          />
          </ModuleDisclosure>
        )}

        {activeRecords.some(record => record.sources.some(source => source.unavailable)) && <div className="c-pane-note"><button className="wb-button c-text-action" onClick={onReloadRecords}>重试关联资料</button></div>}
        {recordsStatus === 'loading' && <p className="wb-muted c-pane-note">正在加载记录…</p>}
        {recordsStatus === 'error' && (
          <div className="wb-inline-error c-pane-note" data-region="records-error">
            <span>{records.active !== null ? '未能更新记录，保留上次内容。' : ''}{recordsError?.message || '无法加载记录'}</span>
            <button type="button" className="wb-button" onClick={onReloadRecords}>重试</button>
          </div>
        )}
        {openRecordId && recordsStatus === 'ready' && !locatedRecord && <div className="wb-inline-error" role="status">
          <span>没有找到这条记录，可以返回查看本班的其他记录。</span>
          <button className="wb-button" onClick={closeEditor}>返回教学记录</button>
        </div>}
        {(records.active !== null || records.deleted !== null) && (
          <RecordList
            classId={classroom.id}
            readOnly={deleted}
            accountKey={accountKey}
            generation={generation}
            records={recordState === 'deleted' ? (records.deleted ?? []) : activeRecords}
            state={recordState}
            onStateChange={onRecordStateChange}
            openRecordId={openRecordId}
            onOpen={openEditor}
            onClose={closeEditor}
            onChanged={onReloadRecords}
            onPurge={onPurgeRecord} onNextNote={changeNextNote} nextNoteBusy={nextNote.isRunning || Boolean(nextNote.pending)}
            createdId={createdId}
            onRevealed={() => setCreatedId(null)}
          />
        )}
      </div>

      <ModulePresence present={confirmingDelete}>
      {confirmingDelete && (
        <ConfirmDialog
          title="归档班级"
          message={`将「${classroom.name}」移入归档，课堂记录会保留，以后可以恢复。`}
          confirmLabel="归档"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => submitDeletion(true)}
        />
      )}
      </ModulePresence>
    </section>
  );
}
