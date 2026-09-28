import i18n from "../../i18n/index.js";
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { CalendarDialog, CalendarIcon, CalendarMenu, CalendarOverlay, IconButton } from './CalendarControls.jsx';
import { COLORS, changeEnd, endOf, formatClock, presetRepeat, repeatLabel, todayInZone } from './calendarModel.js';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import * as api from './api.js';
import { ConflictPreview, CourseDialog, CourseSummary, ReminderDialog, reminderLabel } from './CalendarDetails.jsx';
import { EntryItems } from './CalendarItems.jsx';
import { dstAdjustment, weekdayLabel } from './model.js';

export function RepeatDialog({ value, date, onSave, onClose }) {
  const { t } = useTranslation("schedule");
  const [rule, setRule] = useState(() => ({ ...presetRepeat('weekly', date), ...value }));
  const [ending, setEnding] = useState(value?.count ? 'count' : value?.until && value.until !== '2100-12-31' ? 'until' : 'never');
  const patch = value => setRule(current => ({ ...current, ...value }));
  return <CalendarDialog title={t("重复")} onClose={onClose}>
    <div className="cal-repeat-row"><span>{t("每")}</span><input aria-label={t("重复间隔")} type="number" min="1" max="999" value={rule.interval} onChange={e => patch({ interval: Number(e.target.value) })}/><select aria-label={t("重复单位")} value={rule.frequency} onChange={e => patch({ frequency: e.target.value })}><option value="daily">{t("天")}</option><option value="weekly">{t("周")}</option><option value="monthly">{t("月")}</option><option value="yearly">{t("年")}</option></select></div>
    {rule.frequency === 'weekly' && <div className="cal-repeat-row"><span>{t("在")}</span><div className="cal-repeat-days">{[1, 2, 3, 4, 5, 6, 0].map((day, index) => <button key={day} type="button" aria-label={weekdayLabel(`2024-01-${String(index + 1).padStart(2, '0')}`)} aria-pressed={rule.weekdays.includes(day)} className={rule.weekdays.includes(day) ? 'is-selected' : ''} onClick={() => patch({ weekdays: rule.weekdays.includes(day) ? rule.weekdays.filter(x => x !== day) : [...rule.weekdays, day] })}>{weekdayLabel(`2024-01-${String(index + 1).padStart(2, '0')}`)}</button>)}</div></div>}
    {rule.frequency === 'monthly' && <label className="cal-field">{t("重复方式")}<select value={rule.monthly} onChange={e => patch({ monthly: e.target.value })}><option value="date">{t("monthlyDate", { day: Number(date.slice(8)) })}</option><option value="weekday">{t("monthlyWeekday", { ordinal: t(`ordinal.${Math.ceil(Number(date.slice(8)) / 7)}`), weekday: weekdayLabel(date) })}</option></select></label>}
    <fieldset className="cal-repeat-end"><legend>{t("结束")}</legend>
      <label><input type="radio" name="repeat-end" checked={ending === 'never'} onChange={() => setEnding('never')}/>{t("从不")}</label>
      <label><input type="radio" name="repeat-end" checked={ending === 'until'} onChange={() => setEnding('until')}/>{t("于")}<input type="date" aria-label={t("重复结束日期")} min={date} max="2100-12-31" disabled={ending !== 'until'} value={rule.until === '2100-12-31' ? date : rule.until} onChange={e => patch({ until: e.target.value })}/></label>
      <label><input type="radio" name="repeat-end" checked={ending === 'count'} onChange={() => setEnding('count')}/>{t("次数")}<input type="number" aria-label={t("重复次数")} min="1" max="10000" disabled={ending !== 'count'} value={rule.count || 4} onChange={e => patch({ count: Number(e.target.value) })}/>{t("次")}</label>
    </fieldset><footer><button onClick={onClose}>{t("取消")}</button><button className="is-primary" disabled={!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 999 || (rule.frequency === 'weekly' && !rule.weekdays.length) || (ending === 'until' && rule.until < date) || (ending === 'count' && (!Number.isInteger(rule.count) || rule.count < 0 || rule.count > 10000))} onClick={() => onSave({ ...rule, until: ending === 'until' ? rule.until === '2100-12-31' ? date : rule.until : '2100-12-31', count: ending === 'count' ? rule.count || 4 : 0 })}>{t("完成")}</button></footer>
  </CalendarDialog>;
}

function LabelDialog({ label, accountKey, onDone, onClose }) {
  const { t } = useTranslation("schedule");
  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState(label?.color ?? COLORS[0]);
  const operation = useIdempotentSubmit({ accountKey, name: 'pending:schedule-label' });
  const run = ({ key, payload }) => payload.id ? api.updateLabel({ key, id: payload.id, payload: payload.body }) : api.createLabel({ key, payload: payload.body });
  async function save(deleted = false) {
    const result = operation.pending ? await operation.retry(run) : await operation.submit(run, { id: label?.id,
      body: label ? { name: name.trim(), color, expectedVersion: label.version, deleted } : { name: name.trim(), color } });
    if (result) onDone(result);
  }
  return <CalendarDialog title={label ? t("编辑标签") : t("创建标签")} onClose={onClose}>
    <label className="cal-field">{t("名称")}<input aria-label={t("标签名称")} maxLength="60" value={name} onChange={e => setName(e.target.value)}/></label>
    <fieldset className="cal-label-colors"><legend>{t("颜色")}</legend>{COLORS.map(value => <button key={value} type="button" aria-label={t("颜色 {{value}}", { value: value })} aria-pressed={color === value} style={{ background: value }} onClick={() => setColor(value)}>{value === color && <CalendarIcon name="check" size={16}/>}</button>)}</fieldset>
    {operation.problem && <p className="cal-error" role="alert">{operation.problem.message}</p>}
    <footer>{label && <button className="is-danger" disabled={operation.isRunning} onClick={() => save(true)}>{t("删除标签")}</button>}<button onClick={onClose}>{t("取消")}</button><button className="is-primary" disabled={!name.trim() || operation.isRunning} onClick={() => save()}>{operation.pending ? t("重试确认") : t("保存")}</button></footer>
  </CalendarDialog>;
}
export function TagPicker({ tags, labels, onChange, accountKey, onLabels }) {
  const { t } = useTranslation("schedule");
  const [editing, setEditing] = useState(null);
  return <><CalendarMenu label={t("标签")} className="cal-tag-picker" trigger={<><span className="cal-tags">{tags.length && labels.some(x => tags.includes(x.id)) ? labels.filter(x => tags.includes(x.id)).map(label => <span className="cal-tag" style={{ '--tag-color': label.color }} key={label.id}>{label.name}</span>) : <span className="cal-placeholder">{t("选择标签...")}</span>}</span><CalendarIcon name="down" size={16}/></>}>
    {close => <>{labels.map(label => <div className="cal-label-option" key={label.id}><button type="button" role="menuitemcheckbox" aria-checked={tags.includes(label.id)} onClick={() => onChange(tags.includes(label.id) ? tags.filter(x => x !== label.id) : [...tags, label.id])}><span className="cal-tag" style={{ '--tag-color': label.color }}>{label.name}</span>{tags.includes(label.id) && <CalendarIcon name="check" size={14}/>}</button><IconButton name="edit" label={t("编辑标签 {{name}}", { name: label.name })} onClick={() => { setEditing(label); close(); }}/></div>)}<div className="cal-menu-divider"/><button type="button" role="menuitem" onClick={() => { setEditing({}); close(); }}>{t("+ 创建标签")}</button></>}
  </CalendarMenu><CalendarOverlay present={Boolean(editing)}>{editing && <LabelDialog label={editing.id ? editing : null} accountKey={accountKey} onClose={() => setEditing(null)} onDone={label => { onLabels(label); if (!label.deleted && !editing.id) onChange([...tags, label.id]); setEditing(null); }}/>}</CalendarOverlay></>;
}

export default function CalendarEditor({ draft, onPatch, onClose, onDelete, onRestore, onMoveItem, locked, labels, onLabels, accountKey, status, onRetry, onReload, onAdoptServer, error }) {
  const { t } = useTranslation("schedule");
  const content = draft.content;
  const end = endOf(content);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const notes = useRef(null);
  const title = useRef(null);
  useEffect(() => { if (!draft.id) title.current?.focus({ preventScroll: true }); }, [draft.clientId]);
  useEffect(() => { if (notes.current && document.activeElement !== notes.current) notes.current.textContent = content.calendar.notes; }, [draft.clientId, content.calendar.notes]);
  const patchCalendar = value => onPatch({ calendar: { ...content.calendar, ...value } });
  const patchTime = value => onPatch({ time: { ...content.time, ...value } });
  const setRepeat = repeat => { onPatch({ repeat }, true); setRepeatOpen(false); };
  const allDay = content.calendar.allDay;
  const adjustment = dstAdjustment(content);
  const errorPanel = error && <div className="cal-error" role="alert">{error}<div>{onReload && <button onClick={onReload}>{t("读取最新版本")}</button>}<button onClick={draft.readOnly ? onRestore : onRetry} disabled={status === 'running'}>{status === 'unconfirmed' ? t("重试确认") : t("重新保存")}</button></div></div>;
  if (locked) return <section className="cal-editor"><h3>{t("正在移动事项")}</h3><p className="cal-help">{t("确认移动结果后可继续编辑，原内容已保存。")}</p>{errorPanel}</section>;
  if (draft.readOnly) return <section className="cal-editor" data-region="entry-editor"><header className="cal-editor-heading"><span>{draft.readOnly}</span><IconButton name="close" label={t("关闭任务")} onClick={onClose}/></header><h3>{content.title}</h3>{content.time && <p className="cal-help">{content.time.date} · {content.time.startTime}</p>}{content.calendar.notes && <div className="cal-notes">{content.calendar.notes}</div>}{content.items.map(item => <p key={item.id}>{item.text}</p>)}{(draft.entry.deletedAt || draft.occurrenceState === 'cancelled') && <button className="cal-restore-button" disabled={status === 'running' || status === 'unconfirmed'} onClick={onRestore}>{draft.entry.deletedAt ? t("恢复任务") : t("恢复这次任务")}</button>}{errorPanel}</section>;
  return <section className="cal-editor" data-region="entry-editor">
    <header className="cal-editor-heading"><label htmlFor="calendar-entry-title">{t("标题")}</label><div>
      <span className={`cal-save-dot is-${status}`} role="status" aria-label={status === 'running' ? t("正在保存") : status === 'done' ? t("已保存") : t("任务编辑")} title={status === 'done' ? t("已保存") : ''}/>
      <CalendarMenu label={t("任务操作")} className="cal-task-menu" trigger={<CalendarIcon name="more" size={18}/>}>
        {close => <><div className="cal-submenu-host"><button role="menuitem" type="button" disabled={!content.time}>{t("重复")}<CalendarIcon name="right" size={15}/></button><div className="cal-submenu" role="menu">
          {[['none', t("不重复")], ['daily', t("每天")], ['weekdays', t("每个工作日")], ['weekly', t("每周")], ['biweekly', t("每两周")], ['monthly', t("每月（日期）")], ['monthly-weekday', t("每月（星期）")], ['yearly', t("每年")]].map(([kind, label]) => <button key={kind} role="menuitem" type="button" onClick={() => { setRepeat(presetRepeat(kind, content.time.date)); close(); }}>{label}</button>)}
          <div className="cal-menu-divider"/><button role="menuitem" type="button" onClick={() => { setRepeatOpen(true); close(); }}>{t("自定义…")}</button></div></div>
          <button type="button" role="menuitemcheckbox" aria-checked={allDay} onClick={() => { const time = content.time ?? { date: todayInZone(draft.zone), startTime: '09:00', durationMinutes: 60, timeZone: draft.zone }; onPatch({ calendar: { ...content.calendar, allDay: !allDay }, time: { ...time, startTime: allDay ? '09:00' : '00:00', durationMinutes: allDay ? 60 : Math.max(1440, Math.ceil(time.durationMinutes / 1440) * 1440) } }); close(); }}>{t("全天")}{allDay && <CalendarIcon name="check" size={14}/>}</button>
          <button type="button" role="menuitem" disabled={!content.time} onClick={() => { setDetails('reminder'); close(); }}>{t("设置提醒")}</button>
          <button type="button" role="menuitem" onClick={() => { setDetails('course'); close(); }}>{t("教学关联")}</button>
          {content.time && !content.repeat && <button type="button" role="menuitem" onClick={() => { setDetails('unschedule'); close(); }}>{t("移回未排期")}</button>}
          <div className="cal-menu-divider"/><button type="button" role="menuitem" className="is-danger" onClick={() => { onDelete(); close(); }}>{t("删除任务")}</button>
        </>}
      </CalendarMenu><IconButton name="close" label={t("关闭任务")} onClick={onClose}/>
    </div></header>
    <input id="calendar-entry-title" name="entry-title" ref={title} className="cal-input" placeholder={t("输入任务标题")} maxLength="300" value={content.title} onChange={e => onPatch({ title: e.target.value })}/>
    {content.time ? <>
      <div className="cal-field-pair"><label className="cal-field">{t("开始日期")}<input name="entry-date" type="date" min="1900-01-01" max="2100-12-31" value={content.time.date} onChange={e => patchTime({ date: e.target.value })}/></label><label className="cal-field">{t("结束日期")}<input name="entry-end-date" type="date" min={content.time.date} max="2100-12-31" value={end.date} onChange={e => onPatch({ time: changeEnd(content, e.target.value, end.time) })}/></label></div>
      {!allDay && <div className="cal-field-pair"><label className="cal-field">{t("开始时间")}<input name="entry-start" type="time" step="300" value={content.time.startTime} onChange={e => patchTime({ startTime: e.target.value })}/></label><label className="cal-field">{t("结束时间")}<input name="entry-end" type="time" step="300" value={end.time} onChange={e => onPatch({ time: changeEnd(content, end.date, e.target.value) })}/></label></div>}
    </> : <button className="cal-assign-time" onClick={() => onPatch({ time: { date: todayInZone(draft.zone), startTime: '09:00', durationMinutes: 60, timeZone: draft.zone } })}><CalendarIcon name="clock" size={16}/>{t("安排时间")}</button>}
    {content.time && content.time.timeZone !== draft.zone && <p className="cal-help cal-scheduling-zone">{t("排课时区：")}{content.time.timeZone}</p>}
    {adjustment && <p className="cal-help">{t("夏令时跳时，这次实际开始于")} {adjustment.date} {adjustment.startTime}（{adjustment.timeZone}）。</p>}
    <div className="cal-field"><span>{t("标签")}</span><TagPicker tags={content.calendar.tags} labels={labels} onChange={tags => patchCalendar({ tags })} onLabels={onLabels} accountKey={accountKey}/></div>
    {content.repeat && <button className="cal-repeat-summary" onClick={() => setRepeatOpen(true)}><CalendarIcon name="repeat" size={14}/>{repeatLabel(content.repeat)}{draft.origin && t(" · 仅此任务")}</button>}
    {content.reminder && <button className="cal-detail-summary" onClick={() => setDetails('reminder')}><CalendarIcon name="clock" size={14}/>{reminderLabel(content.reminder)}</button>}
    <CourseSummary course={content.course} state={draft.courseState} onClick={() => setDetails('course')}/>
    <label className="cal-field cal-notes-label"><span>{t("备注")}</span><div ref={notes} className="cal-notes" role="textbox" aria-label={t("备注")} aria-multiline="true" contentEditable suppressContentEditableWarning data-placeholder={t("添加备注…")} onInput={e => patchCalendar({ notes: e.currentTarget.innerText })} onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}/></label>
    <EntryItems items={content.items} repeating={Boolean(content.repeat)} onChange={items => onPatch({ items })} onMove={onMoveItem} onRemoveLast={draft.id && !content.title.trim() ? onDelete : null}/>
    {draft.entry?.updatedAt && <time className="cal-updated">{new Intl.DateTimeFormat(i18n.resolvedLanguage, { timeZone: draft.zone, hour: 'numeric', minute: '2-digit' }).format(new Date(draft.entry.updatedAt))}</time>}
    {errorPanel}
    {draft.savePaused && <ConflictPreview content={draft.baseline} courseState={draft.serverCourseState} labels={labels} onAdopt={() => setDetails('adopt')}/>}
    <CalendarOverlay present={repeatOpen || Boolean(details)}>
    {repeatOpen && <RepeatDialog value={content.repeat} date={content.time.date} onSave={setRepeat} onClose={() => setRepeatOpen(false)}/>}
    {details === 'reminder' && <ReminderDialog value={content.reminder} onClose={() => setDetails(null)} onSave={reminder => { onPatch({ reminder }); setDetails(null); }}/>}
    {details === 'course' && <CourseDialog draft={draft} onClose={() => setDetails(null)} onSave={(course, single) => { onPatch({ course }, false, single ? 'instance' : null); setDetails(null); }}/>}
    {details === 'adopt' && <CalendarDialog title={t("采用服务器内容")} onClose={() => setDetails(null)}><p>{t("用服务器内容替换当前本地输入？未保存的本地修改将被丢弃。")}</p><footer><button onClick={() => setDetails(null)}>{t("取消")}</button><button className="is-primary" onClick={() => { onAdoptServer(); setDetails(null); }}>{t("采用")}</button></footer></CalendarDialog>}
    {details === 'unschedule' && <CalendarDialog title={t("移回未排期")} onClose={() => setDetails(null)}><p>{t("移除这项任务的时间和提醒，并取消它与实际记录的关联。实际教学记录会保留。")}</p><footer><button onClick={() => setDetails(null)}>{t("取消")}</button><button className="is-primary" onClick={() => { onPatch({ time: null, repeat: null, reminder: null, course: { ...content.course, recordIds: [] }, calendar: { ...content.calendar, allDay: false } }); setDetails(null); }}>{t("移回未排期")}</button></footer></CalendarDialog>}
    </CalendarOverlay>
  </section>;
}
