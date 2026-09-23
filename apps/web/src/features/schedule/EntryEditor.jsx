/**
 * Entry editor.
 *
 * One form serves a new entry, a whole repeating group and a single-instance
 * override; the caller decides the scope. Every edit is a local patch, so the
 * pending input survives a failed or unconfirmed save exactly as typed.
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  PRIORITY_VALUES,
  TIME_ZONES,
  dstAdjustment,
  formatClock,
  formatInstantLabel,
  moveItemInArray,
  newItem,
  parseClock,
  reminderInstant,
  weekdayLabel
} from './model.js';

function SaveState({ saveState, onRetry, onReload }) {
  if (!saveState || saveState.status === 'idle') return null;
  if (saveState.status === 'dirty') return <p className="sch-save is-warn" data-region="save-state">未保存，草稿在此设备</p>;
  if (saveState.status === 'saving') return <p className="sch-save is-busy" data-region="save-state">正在保存…</p>;
  if (saveState.status === 'saved-dirty') return <p className="sch-save is-warn" data-region="save-state">提交内容已保存，仍有未保存修改</p>;
  if (saveState.status === 'saved') return <p className="sch-save is-ok" data-region="save-state">已保存</p>;
  if (saveState.status === 'unconfirmed') {
    return (
      <div className="sch-save is-warn" data-region="save-state">
        <p>{saveState.problem?.message || '结果未确认，保留原请求'}</p>
        <button type="button" className="wb-button" data-action="retry" onClick={onRetry}>用原请求重试</button>
      </div>
    );
  }
  if (saveState.status === 'conflict') {
    return (
      <div className="sch-save is-error" data-region="save-state">
        <p>内容已在别处修改（服务器版本 {saveState.currentVersion}），未覆盖。</p>
        <button type="button" className="wb-button" data-action="reload" onClick={onReload}>读取当前版本</button>
      </div>
    );
  }
  if (saveState.status === 'conflict-view') {
    return (
      <div className="sch-save is-warn" data-region="save-state">
        <p>{saveState.problem?.message}</p>
        <p className="sch-server-copy" data-region="server-version">
          {`服务器版本 ${saveState.server.version}：${saveState.server.title}${saveState.server.detail ? ` · ${saveState.server.detail}` : ''}`}
        </p>
        <p className="sch-note">本地修改仍在本表单中，可继续编辑后再次保存为新提交。</p>
      </div>
    );
  }
  return (
    <div className="sch-save is-error" data-region="save-state">
      <p>{saveState.problem?.message || '保存被拒绝'}</p>
    </div>
  );
}

export default function EntryEditor({
  mode,
  scope,
  draft,
  instance,
  canEditGroup,
  canMoveItems,
  onPatch,
  onScope,
  onSave,
  onCancel,
  onDelete,
  onRestore,
  onCancelInstance,
  onRestoreInstance,
  saveState,
  onRetry,
  onReload,
  classes,
  lessons,
  records,
  linksError,
  recordsState,
  onRetryLinks,
  timeZone,
  focusToken,
  exceptions,
  onOpenInstance,
  onInheritInstance,
  onCancelInstanceAt,
  onMoveItemToUnscheduled,
  onRetryMoveOut,
  moveState,
  courseFeedback
}) {
  const titleRef = useRef(null);
  useEffect(() => {
    if (focusToken) titleRef.current?.focus();
  }, [focusToken]);
  const itemRows = draft.items;
  const dueAt = useMemo(() => reminderInstant(draft, timeZone), [draft, timeZone]);
  const dst = useMemo(() => draft.unscheduled ? null : dstAdjustment(draft), [draft]);
  const startMinutes = parseClock(draft.time.startTime);

  function patchItem(index, patch) {
    const items = itemRows.map((item, position) => (position === index ? { ...item, ...patch } : item));
    onPatch({ items });
  }

  function removeItem(index) {
    onPatch({ items: itemRows.filter((_, position) => position !== index) });
  }

  const repeatingInstance = instance && instance.key.originDate !== null;
  // Only a scheduled, non-repeating entry can hand an item back to 未排期.
  const canMoveItemOut = Boolean(
    instance && instance.time && !instance.repeat && !instance.entryDeleted && scope === 'group'
  );

  const unavailable = instance?.entryDeleted ? 'deleted'
    : scope === 'instance' && instance?.state !== 'active' ? instance?.state : null;
  if (unavailable) {
    const text = { deleted: '安排已删除', cancelled: '安排已取消', 'outside-series': '这次已不在重复范围内' }[unavailable];
    return <section className="sch-editor" data-region="entry-editor">
      <h2>{draft.title || draft.items[0]?.text}</h2>
      <p role="status">{text}</p>
      <p>{draft.time.date} {draft.time.startTime}</p>
      {unavailable === 'deleted' && <button className="wb-button" onClick={onRestore}>恢复安排</button>}
      {unavailable === 'cancelled' && <button className="wb-button" onClick={onRestoreInstance}>恢复原安排</button>}
      {unavailable === 'outside-series' && <button className="wb-button" onClick={() => onScope('group')}>打开整组</button>}
      <button className="wb-button" onClick={onCancel}>关闭</button>
    </section>;
  }

  return (
    <section className="sch-editor" data-region="entry-editor" data-mode={mode} data-scope={scope}>
      <header className="sch-editor-head">
        <h2>{mode === 'create' ? '新建安排' : repeatingInstance && scope === 'instance' ? '仅这一次' : '编辑安排'}</h2>
        {repeatingInstance && (
          <div className="sch-scope" role="group" aria-label="修改范围">
            <button
              type="button"
              className={`wb-chip${scope === 'instance' ? ' is-active' : ''}`}
              aria-pressed={scope === 'instance'}
              data-action="scope-instance"
              onClick={() => onScope('instance')}
            >
              仅这一次
            </button>
            <button
              type="button"
              className={`wb-chip${scope === 'group' ? ' is-active' : ''}`}
              aria-pressed={scope === 'group'}
              data-action="scope-group"
              onClick={() => onScope('group')}
            >
              整组
            </button>
          </div>
        )}
      </header>

      {repeatingInstance && scope === 'group' && (
        <p className="sch-note" data-region="group-note">单独改过的安排保持不变</p>
      )}
      {repeatingInstance && scope === 'instance' && (
        <p className="sch-note" data-region="instance-note">
          原始日期 {instance.key.originDate}，身份不变
        </p>
      )}

      <label className="sch-field">
        <span className="sch-label">标题</span>
        <input
          className="wb-input"
          name="entry-title"
          ref={titleRef}
          value={draft.title}
          maxLength={300}
          placeholder="可留空，用首项事项代表"
          onChange={(event) => onPatch({ title: event.target.value })}
        />
      </label>

      <div className="sch-field">
        <span className="sch-label">事项</span>
        <ul className="sch-items" data-region="editor-items">
          {itemRows.map((item, index) => (
            <li key={item.id} className="sch-item-row" data-item-id={item.id}>
              <input
                className="wb-input"
                name="item-text"
                aria-label={`事项 ${index + 1}`}
                value={item.text}
                maxLength={4000}
                onChange={(event) => patchItem(index, { text: event.target.value })}
              />
              <select
                className="wb-input sch-priority"
                name="item-priority"
                aria-label={`优先级 ${index + 1}`}
                value={item.priority}
                onChange={(event) => patchItem(index, { priority: event.target.value })}
              >
                {[...PRIORITY_VALUES].sort((a, b) => PRIORITY_ORDER[a] - PRIORITY_ORDER[b]).map((priority) => (
                  <option key={priority} value={priority}>{PRIORITY_LABEL[priority]}</option>
                ))}
              </select>
              <span className="sch-item-actions">
                <button
                  type="button"
                  className="wb-icon-button"
                  data-action="item-up"
                  aria-label="上移"
                  disabled={index === 0}
                  onClick={() => onPatch({ items: moveItemInArray(itemRows, index, -1) })}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="wb-icon-button"
                  data-action="item-down"
                  aria-label="下移"
                  disabled={index === itemRows.length - 1}
                  onClick={() => onPatch({ items: moveItemInArray(itemRows, index, 1) })}
                >
                  ↓
                </button>
                {canMoveItemOut && (
                  <button
                    type="button"
                    className="wb-icon-button"
                    data-action="item-to-unscheduled"
                    aria-label="移回未排期"
                    title={canMoveItems ? '移回未排期' : '请先保存修改再移动事项'}
                    disabled={!canMoveItems || moveState?.status === 'running'}
                    onClick={() => onMoveItemToUnscheduled(item)}
                  >
                    ↧
                  </button>
                )}
                <button
                  type="button"
                  className="wb-icon-button"
                  data-action="item-remove"
                  aria-label="移除事项"
                  onClick={() => removeItem(index)}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="wb-button"
          data-action="add-item"
          onClick={() => onPatch({ items: [...itemRows, newItem()] })}
        >
          添加事项
        </button>
      </div>

      <div className="sch-field">
        <div className="sch-field-head">
          <span className="sch-label">时间</span>
          <label className="sch-toggle">
            <input
              type="checkbox"
              name="entry-unscheduled"
              checked={draft.unscheduled}
              disabled={scope === 'instance' || Boolean(instance?.repeat)}
              onChange={(event) => onPatch(event.target.checked
                ? { unscheduled: true, weekly: false, reminder: null, course: { ...draft.course, recordIds: [] } }
                : { unscheduled: false })}
            />
            暂不安排时间
          </label>
        </div>
        {!draft.unscheduled && (
          <div className="sch-time-grid">
            <label>
              <span className="sch-sub-label">日期</span>
              <input
                className="wb-input"
                type="date"
                name="entry-date"
                disabled={Boolean(instance?.repeat) && scope === 'group'}
                value={draft.time.date}
                min="1900-01-01"
                max="2100-12-31"
                onChange={(event) => onPatch({ time: { ...draft.time, date: event.target.value } })}
              />
            </label>
            <label>
              <span className="sch-sub-label">开始</span>
              <input
                className="wb-input"
                type="time"
                name="entry-start"
                value={draft.time.startTime}
                onChange={(event) => onPatch({ time: { ...draft.time, startTime: event.target.value } })}
              />
            </label>
            <label>
              <span className="sch-sub-label">时长（分钟）</span>
              <input
                className="wb-input"
                type="number"
                name="entry-duration"
                min="1"
                max="1440"
                value={draft.time.durationMinutes}
                onChange={(event) => onPatch({ time: { ...draft.time, durationMinutes: event.target.value } })}
              />
            </label>
            <label>
              <span className="sch-sub-label">排课时区</span>
              <select
                className="wb-input"
                name="entry-timezone"
                disabled={Boolean(instance?.repeat) && scope === 'group'}
                value={draft.time.timeZone}
                onChange={(event) => onPatch({ time: { ...draft.time, timeZone: event.target.value } })}
              >
                {[...new Set([draft.time.timeZone, ...TIME_ZONES])].map((zone) => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {!draft.unscheduled && scope !== 'instance' && (
        <div className="sch-field">
          <label className="sch-toggle">
            <input
              type="checkbox"
              name="entry-weekly"
              checked={draft.weekly}
              disabled={mode !== 'create'}
              onChange={(event) => onPatch({
                weekly: event.target.checked,
                until: draft.until || draft.time.date,
                course: event.target.checked ? { ...draft.course, recordIds: [] } : draft.course
              })}
            />
            每周重复
          </label>
          {draft.weekly && (
            <div className="sch-time-grid">
              <label>
                <span className="sch-sub-label">
                  结束日期（{weekdayLabel(draft.time.date)}，含首日）
                </span>
                <input
                  className="wb-input"
                  type="date"
                  name="repeat-until"
                  value={draft.until}
                  min={draft.time.date}
                  onChange={(event) => onPatch({ until: event.target.value })}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {!draft.unscheduled && <div className="sch-field">
        <span className="sch-label">提醒</span>
        <div className="sch-reminder">
          <select
            className="wb-input"
            name="reminder-side"
            aria-label="提醒方式"
            value={draft.reminder ? draft.reminder.side : ''}
            onChange={(event) => {
              const value = event.target.value;
              onPatch({ reminder: value === '' ? null : { side: value, minutes: draft.reminder?.minutes ?? 10 } });
            }}
          >
            <option value="">不提醒</option>
            <option value="before">结束前</option>
            <option value="after">结束后</option>
          </select>
          {draft.reminder && (
            <label className="sch-reminder-minutes">
              <input
                className="wb-input"
                type="number"
                name="reminder-minutes"
                aria-label="提醒分钟"
                min="0"
                max="10080"
                step="1"
                value={draft.reminder.minutes}
                onChange={(event) => onPatch({ reminder: { ...draft.reminder, minutes: event.target.value } })}
              />
              <span>分钟</span>
            </label>
          )}
        </div>
        {dueAt && (
          <p className="sch-note" data-region="reminder-instant">
            {formatInstantLabel(dueAt, timeZone)} 提醒
          </p>
        )}
        {dst && (
          <p className="sch-note" data-region="dst-note">
            {`夏令时调整：本地 ${draft.time.startTime} 不存在，实际从 ${dst.date} ${dst.startTime} 开始`}
          </p>
        )}
      </div>}

      <div className="sch-field">
        <span className="sch-label">关联（可选）</span>
        {(linksError || recordsState === 'error') && <div role="alert" className="sch-save is-error">
          {linksError && <p>{linksError}</p>}
          {recordsState === 'error' && <p>实际记录读取失败</p>}
          <button type="button" className="wb-button" onClick={onRetryLinks}>重试关联资料</button>
        </div>}
        <div className="sch-course">
          <label>
            <span className="sch-sub-label">班级</span>
            <select
              className="wb-input"
              name="class-select"
              value={draft.course.classId ?? ''}
              onChange={(event) => onPatch({
                course: { ...draft.course, classId: event.target.value || null, recordIds: [] }
              })}
            >
              <option value="">不关联班级</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sch-sub-label">备课</span>
            <select
              className="wb-input"
              name="lesson-select"
              value={draft.course.lessonId ?? ''}
              onChange={(event) => onPatch({ course: { ...draft.course, lessonId: event.target.value || null } })}
            >
              <option value="">不关联备课</option>
              {lessons.map((item) => (
                <option key={item.id} value={item.id}>{item.title.trim() || '未命名备课'}</option>
              ))}
            </select>
          </label>
          {draft.course.classId && !draft.weekly && !draft.unscheduled && (
            <fieldset className="sch-records">
              <legend className="sch-sub-label">实际记录</legend>
              {recordsState === 'loading' && <p className="wb-muted">正在读取实际记录…</p>}
              {records.length === 0 && recordsState === 'ready' && <p className="wb-muted">本班还没有实际记录</p>}
              {records.map((record) => (
                <label key={record.id} className="sch-toggle">
                  <input
                    type="checkbox"
                    name="record-checkbox"
                    value={record.id}
                    checked={draft.course.recordIds.includes(record.id)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...draft.course.recordIds, record.id]
                        : draft.course.recordIds.filter((id) => id !== record.id);
                      onPatch({ course: { ...draft.course, recordIds: next } });
                    }}
                  />
                  {`${record.recordedOn} ${record.note || record.position || ''}`.trim()}
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </div>

      {courseFeedback}

      {instance?.repeat && exceptions.length > 0 && (
        <div className="sch-field">
          <span className="sch-label">已调整日期</span>
          <ul className="sch-exceptions" data-region="exceptions">
            {exceptions.map((exception) => (
              <li
                key={exception.originDate}
                className="sch-exception"
                data-origin={exception.originDate}
                data-mode={exception.mode}
                data-eligible={String(exception.eligible)}
              >
                <span className="sch-item-text">
                  {`${exception.originDate}${exception.mode === 'cancelled' ? ' 已取消' : ' 已调整'}${exception.eligible ? '' : ' · 不在当前重复范围'}`}
                </span>
                <button
                  type="button"
                  className="wb-button"
                  data-action="open-instance"
                  onClick={() => onOpenInstance(exception.originDate)}
                >
                  打开
                </button>
                <button
                  type="button"
                  className="wb-button"
                  data-action="restore-exception"
                  disabled={!exception.eligible}
                  onClick={() => onInheritInstance(exception.originDate)}
                >
                  恢复原安排
                </button>
                {exception.mode !== 'cancelled' && (
                  <button
                    type="button"
                    className="wb-button"
                    disabled={!exception.eligible}
                    data-action="cancel-exception"
                    onClick={() => onCancelInstanceAt(exception.originDate)}
                  >
                    本次取消
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {moveState?.status === 'unconfirmed' && moveState.direction === 'out' && moveState.request?.fromEntryId === instance?.key.entryId && (
        <div className="sch-save is-warn" data-region="move-state">
          <p>移回未排期的结果未确认</p>
          <button type="button" className="wb-button" onClick={onRetryMoveOut}>重试移回未排期</button>
        </div>
      )}

      <SaveState saveState={saveState} onRetry={onRetry} onReload={onReload} />

      <footer className="sch-editor-actions">
        <button type="button" className="wb-button is-primary" data-action="save" disabled={saveState?.status === 'saving' || saveState?.status === 'unconfirmed'} onClick={onSave}>
          保存
        </button>
        <button type="button" className="wb-button" data-action="cancel" onClick={onCancel}>关闭</button>
        {mode !== 'create' && scope === 'group' && (
          <button type="button" className="wb-button" data-action="delete-entry" onClick={onDelete}>
            {instance?.entryDeleted ? '恢复安排' : '删除安排'}
          </button>
        )}
        {repeatingInstance && scope === 'instance' && (
          <>
            {instance?.state === 'cancelled' ? (
              <button type="button" className="wb-button" data-action="restore-instance" onClick={onRestoreInstance}>
                恢复原安排
              </button>
            ) : (
              <button type="button" className="wb-button" data-action="cancel-instance" onClick={onCancelInstance}>
                本次取消
              </button>
            )}
          </>
        )}
        {mode !== 'create' && instance && !canEditGroup && (
          <span className="wb-muted">整组已删除，仅可恢复</span>
        )}
      </footer>
      {draft.time && !draft.unscheduled && (
        <p className="sch-note" data-region="time-preview">
          {`${draft.time.date} ${draft.time.startTime} - ${formatClock((startMinutes ?? 0) + (Number(draft.time.durationMinutes) || 0))}`}
        </p>
      )}
    </section>
  );
}
