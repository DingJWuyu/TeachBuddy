import { useTranslation } from 'react-i18next';
import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDialog, CalendarIcon, CalendarMenu, CalendarOverlay, IconButton, isConfirmKey } from './CalendarControls.jsx';
import { COLORS, changeEnd, defaultTime, endOf, endTimeProblem, formatClock, monthDays, presetRepeat, repeatAnchor, repeatLabel, todayInZone, weekday } from './calendarModel.js';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import * as api from './api.js';
import { ConflictPreview, CourseDialog, CourseSummary, ReminderDialog, reminderLabel } from './CalendarDetails.jsx';
import { EntryItems } from './CalendarItems.jsx';
import { dstAdjustment, weekdayLabel } from './model.js';

export function RepeatDialog({ value, date, anchor = date, onSave, onClose }) {
  const { t } = useTranslation("schedule");
  const [rule, setRule] = useState(() => ({ ...presetRepeat('weekly', date), ...value }));
  const [count, setCount] = useState(value?.count || 4);
  const [ending, setEnding] = useState(value?.count ? 'count' : value?.until && value.until !== '2100-12-31' ? 'until' : 'never');
  const [day, setDay] = useState(Number(anchor.slice(8)));
  const [month, setMonth] = useState(Number(anchor.slice(5, 7)));
  const [ordinal, setOrdinal] = useState(Math.ceil(Number(anchor.slice(8)) / 7));
  const [dayOfWeek, setDayOfWeek] = useState(weekday(anchor));
  const initial = { ...presetRepeat('weekly', date), ...value };
  const changed = rule.frequency !== initial.frequency || rule.interval !== initial.interval
    || (rule.frequency === 'weekly' && JSON.stringify([...rule.weekdays].sort()) !== JSON.stringify([...initial.weekdays].sort()))
    || (rule.frequency === 'monthly' && (rule.monthly !== initial.monthly || (rule.monthly === 'weekday'
      ? ordinal !== Math.ceil(Number(anchor.slice(8)) / 7) || dayOfWeek !== weekday(anchor) : day !== Number(anchor.slice(8)))))
    || (rule.frequency === 'yearly' && (month !== Number(anchor.slice(5, 7)) || day !== Number(anchor.slice(8))));
  const nextDate = changed ? repeatAnchor(date, rule, { day, month, ordinal, dayOfWeek }, anchor) : date;
  const until = rule.until === '2100-12-31' ? nextDate : rule.until;
  const days = Array.from({ length: rule.frequency === 'yearly' ? monthDays(`2000-${String(month).padStart(2, '0')}`) : 31 }, (_, i) => i + 1);
  const patch = value => setRule(current => ({ ...current, ...value }));
  return <CalendarDialog title={t("重复")} onClose={onClose}>
    <div className="cal-repeat-row"><span>{t("每")}</span><input aria-label={t("重复间隔")} type="number" min="1" max="999" value={rule.interval} onChange={e => patch({ interval: Number(e.target.value) })}/><select aria-label={t("重复单位")} value={rule.frequency} onChange={e => { patch({ frequency: e.target.value }); if (e.target.value === 'yearly') setDay(current => Math.min(current, monthDays(`2000-${String(month).padStart(2, '0')}`))); }}><option value="daily">{t("天")}</option><option value="weekly">{t("周")}</option><option value="monthly">{t("月")}</option><option value="yearly">{t("年")}</option></select></div>
    {rule.frequency === 'weekly' && <div className="cal-repeat-row"><span>{t("在")}</span><div className="cal-repeat-days">{[1, 2, 3, 4, 5, 6, 0].map((day, index) => <button key={day} type="button" aria-label={weekdayLabel(`2024-01-${String(index + 1).padStart(2, '0')}`)} aria-pressed={rule.weekdays.includes(day)} className={rule.weekdays.includes(day) ? 'is-selected' : ''} onClick={() => patch({ weekdays: rule.weekdays.includes(day) ? rule.weekdays.filter(x => x !== day) : [...rule.weekdays, day] })}>{weekdayLabel(`2024-01-${String(index + 1).padStart(2, '0')}`)}</button>)}</div></div>}
    {rule.frequency === 'monthly' && <>
      <label className="cal-field cal-repeat-mode">{t("重复方式")}<select value={rule.monthly} onChange={e => patch({ monthly: e.target.value })}><option value="date">{t("按日期")}</option><option value="weekday">{t("按星期")}</option></select></label>
      {rule.monthly === 'date' ? <label className="cal-field">{t("每月日期")}<select aria-label={t("每月日期")} value={day} onChange={e => setDay(Number(e.target.value))}>{days.map(value => <option key={value} value={value}>{t("{{day}} 日", { day: value })}</option>)}</select></label>
        : <div className="cal-repeat-row"><select aria-label={t("每月第几周")} value={ordinal} onChange={e => setOrdinal(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{t("第{{ordinal}}个", { ordinal: t(`ordinal.${value}`) })}</option>)}</select><select aria-label={t("每月星期")} value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 0].map(value => <option key={value} value={value}>{weekdayLabel(`2024-01-${String(value || 7).padStart(2, '0')}`)}</option>)}</select></div>}
    </>}
    {rule.frequency === 'yearly' && <div className="cal-repeat-row"><select aria-label={t("每年月份")} value={month} onChange={e => { const value = Number(e.target.value); setMonth(value); setDay(current => Math.min(current, monthDays(`2000-${String(value).padStart(2, '0')}`))); }}>{Array.from({ length: 12 }, (_, i) => i + 1).map(value => <option key={value} value={value}>{t("{{month}} 月", { month: value })}</option>)}</select><select aria-label={t("每年日期")} value={day} onChange={e => setDay(Number(e.target.value))}>{days.map(value => <option key={value} value={value}>{t("{{day}} 日", { day: value })}</option>)}</select></div>}
    <fieldset className="cal-repeat-end"><legend>{t("结束")}</legend>
      <label><input type="radio" name="repeat-end" checked={ending === 'never'} onChange={() => setEnding('never')}/>{t("从不")}</label>
      <label><input type="radio" name="repeat-end" checked={ending === 'until'} onChange={() => setEnding('until')}/>{t("于")}<input type="date" aria-label={t("重复结束日期")} min={nextDate ?? date} max="2100-12-31" disabled={ending !== 'until'} value={until ?? date} onChange={e => patch({ until: e.target.value })}/></label>
      <label><input type="radio" name="repeat-end" checked={ending === 'count'} onChange={() => setEnding('count')}/>{t("次数")}<input type="number" aria-label={t("重复次数")} min="1" max="10000" disabled={ending !== 'count'} value={count} aria-invalid={ending === 'count' && (!String(count).trim() || !Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > 10000)} onChange={e => setCount(e.target.value)}/>{t("次")}</label>
    </fieldset><footer><button onClick={onClose}>{t("取消")}</button><button className="is-primary" data-dialog-confirm="" disabled={!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 999 || (rule.frequency === 'weekly' && !rule.weekdays.length) || !nextDate || nextDate > '2100-12-31' || (ending === 'until' && (!until || until < nextDate || until > '2100-12-31')) || (ending === 'count' && (!String(count).trim() || !Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > 10000))} onClick={() => onSave({ ...rule, until: ending === 'until' ? until : '2100-12-31', count: ending === 'count' ? Number(count) : 0 }, nextDate)}>{t("完成")}</button></footer>
  </CalendarDialog>;
}

function LabelDialog({ label, accountKey, onSaved, onClose }) {
  const { t } = useTranslation("schedule");
  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState(label?.color ?? COLORS[0]);
  const latest = useRef({ name, color }); latest.current = { name, color };
  const savedLabel = useRef(label);
  const ownsPending = useRef(false);
  const active = useRef(true);
  const saving = useRef(false);
  const [serverLabel, setServerLabel] = useState(null);
  const [readError, setReadError] = useState('');
  const operation = useIdempotentSubmit({ accountKey, name: 'pending:schedule-label' });
  const run = ({ key, payload }) => payload.id ? api.updateLabel({ key, id: payload.id, payload: payload.body }) : api.createLabel({ key, payload: payload.body });
  const close = () => { active.current = false; onClose(); };
  async function save(deleted = false) {
    if (saving.current) return;
    saving.current = true;
    try {
      if (operation.pending) {
        const original = operation.pending.payload;
        const result = await operation.retry(run);
        if (!result) return;
        if (!active.current) { onSaved(result, false); return; }
        onSaved(result, ownsPending.current && !original.id && !result.deleted);
        if (ownsPending.current || label?.id === result.id) savedLabel.current = result;
        if (ownsPending.current && result.deleted) { onClose(); return; }
      }
      // 原键只确认原请求；确认后再用新键保存期间继续输入的内容。
      while (latest.current.name.trim()) {
        const desired = { name: latest.current.name.trim(), color: latest.current.color };
        const previous = savedLabel.current;
        if (!deleted && previous && previous.name === desired.name && previous.color === desired.color) { onClose(); return; }
        ownsPending.current = true;
        const result = await operation.submit(run, { id: previous?.id,
          body: previous ? { ...desired, expectedVersion: previous.version, deleted } : desired });
        if (!result) return;
        if (!active.current) { onSaved(result, false); return; }
        savedLabel.current = result;
        onSaved(result, !previous && !result.deleted);
        if (result.deleted) { onClose(); return; }
      }
    } finally { saving.current = false; }
  }
  async function readLatest() {
    try {
      const current = (await api.listLabels()).find(value => value.id === savedLabel.current?.id);
      if (!current) { setReadError(t("标签已删除，请取消编辑")); return; }
      savedLabel.current = current; setServerLabel(current); setReadError(''); operation.reset(); onSaved(current, false);
    } catch (error) { setReadError(error.problem?.message ?? t("读取失败，请重试")); }
  }
  return <CalendarDialog title={label ? t("编辑标签") : t("创建标签")} onClose={close}>
    <label className="cal-field">{t("名称")}<input aria-label={t("标签名称")} maxLength="60" value={name} onChange={e => setName(e.target.value)}/></label>
    <fieldset className="cal-label-colors"><legend>{t("颜色")}</legend>{COLORS.map(value => <button key={value} type="button" aria-label={t("颜色 {{value}}", { value: value })} aria-pressed={color === value} style={{ background: value }} onClick={() => setColor(value)}>{value === color && <CalendarIcon name="check" size={16}/>}</button>)}</fieldset>
    {(operation.problem || readError) && <p className="cal-error" role="alert">{readError || operation.problem.message}{operation.problem?.kind === 'conflict' && <button onClick={readLatest}>{t("读取最新版本")}</button>}</p>}
    {serverLabel && <div className="cal-field cal-label-server"><span>{t("最新标签")}</span><span className="cal-tag" style={{ '--tag-color': serverLabel.color }}>{serverLabel.name}</span></div>}
    <footer>{label && <button className="is-danger" disabled={operation.isRunning} onClick={() => save(true)}>{t("删除标签")}</button>}<button onClick={close}>{t("取消")}</button><button className="is-primary" data-dialog-confirm="" disabled={!name.trim() || operation.isRunning} onClick={() => save()}>{operation.pending ? t("重试确认") : t("保存")}</button></footer>
  </CalendarDialog>;
}
export function TagPicker({ tags, labels, onChange, accountKey, onLabels }) {
  const { t } = useTranslation("schedule");
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const tagsRef = useRef(tags); tagsRef.current = tags;
  const matching = labels.filter(label => label.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <><CalendarMenu label={t("标签")} className="cal-tag-picker" trigger={<><span className="cal-tags">{tags.length && labels.some(x => tags.includes(x.id)) ? labels.filter(x => tags.includes(x.id)).map(label => <span className="cal-tag" style={{ '--tag-color': label.color }} key={label.id}>{label.name}</span>) : <span className="cal-placeholder">{t("选择标签...")}</span>}</span><CalendarIcon name="down" size={16}/></>}>
    {close => <><div className="cal-tag-search"><CalendarIcon name="tag" size={16}/><input type="search" aria-label={t("搜索标签")} placeholder={t("搜索标签")} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => {
      if (e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229) return;
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) e.stopPropagation();
      const first = e.currentTarget.closest('.cal-menu')?.querySelector('.cal-tag-results button[role]:not(:disabled)');
      if (e.key === 'ArrowDown') { e.preventDefault(); first?.focus(); }
      if (isConfirmKey(e)) { e.preventDefault(); e.stopPropagation(); first?.click(); first?.focus(); }
    }}/></div><div className="cal-tag-results">{matching.map(label => <div className="cal-label-option" key={label.id}><button type="button" role="menuitemcheckbox" aria-checked={tags.includes(label.id)} disabled={!tags.includes(label.id) && tags.length >= 30} title={!tags.includes(label.id) && tags.length >= 30 ? t("最多选择30个标签") : undefined} onClick={() => onChange(tags.includes(label.id) ? tags.filter(x => x !== label.id) : [...tags, label.id])}><span className="cal-tag" style={{ '--tag-color': label.color }}>{label.name}</span>{tags.includes(label.id) && <CalendarIcon name="check" size={14}/>}</button><IconButton name="edit" label={t("编辑标签 {{name}}", { name: label.name })} onClick={() => { setEditing({ ...label, clientId: crypto.randomUUID() }); close(); }}/></div>)}{!matching.length && <p className="cal-tag-empty">{t("没有匹配的标签")}</p>}</div><div className="cal-menu-divider"/><button type="button" role="menuitem" disabled={tags.length >= 30} title={tags.length >= 30 ? t("最多选择30个标签") : undefined} onClick={() => { setEditing({ clientId: crypto.randomUUID() }); close(); }}>{t("+ 创建标签")}</button></>}
  </CalendarMenu><CalendarOverlay present={Boolean(editing)}>{editing && <LabelDialog key={editing.clientId} label={editing.id ? editing : null} accountKey={accountKey} onClose={() => setEditing(null)} onSaved={(label, select) => {
    onLabels(label);
    if (select && tagsRef.current.length < 30 && !tagsRef.current.includes(label.id)) onChange([...tagsRef.current, label.id]);
  }}/>}</CalendarOverlay></>;
}

export default function CalendarEditor({ draft, onPatch, onClose, onConfirm, onDelete,  onMoveItem, locked, labels, onLabels, accountKey, status, onRetry, onReload, onAdoptServer, error }) {
  const { t } = useTranslation("schedule");
  const content = draft.content;
  const end = endOf(content);
  const endIssue = endTimeProblem(content);
  const timeErrorId = useId();
  const timeError = endIssue && <span id={timeErrorId} className="cal-time-error" role="alert" title={endIssue}><CalendarIcon name="alert" size={12}/>{t("时间无效")}</span>;
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const notes = useRef(null);
  const title = useRef(null);
  useEffect(() => { if (!draft.id) title.current?.focus({ preventScroll: true }); }, [draft.clientId]);
  useEffect(() => { if (notes.current && document.activeElement !== notes.current) notes.current.textContent = content.calendar.notes; }, [draft.clientId, content.calendar.notes]);
  const patchCalendar = value => onPatch({ calendar: { ...content.calendar, ...value } });
  const patchTime = value => onPatch({ time: { ...content.time, ...value } });
  const confirmField = event => {
    if (!isConfirmKey(event)) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); onConfirm();
  };
  const setRepeat = (repeat, date = content.time.date) => { onPatch({ repeat, time: { ...content.time, date } }, true); setRepeatOpen(false); };
  const allDay = content.calendar.allDay;
  const adjustment = dstAdjustment(content);
  const errorPanel = error && error !== endIssue && <div className="cal-error cal-save-feedback" role="alert">{error}<div>{onReload && <button onClick={onReload}>{t("读取最新版本")}</button>}<button onClick={onRetry} disabled={status === 'running'}>{status === 'unconfirmed' ? t("重试确认") : t("重新保存")}</button></div></div>;
  if (locked) return <section className="cal-editor">{errorPanel}<h3>{t("正在移动事项")}</h3><p className="cal-help">{t("确认移动结果后可继续编辑，原内容已保存。")}</p></section>;
  if (draft.readOnly) return <section className="cal-editor" data-region="entry-editor">{errorPanel}<header className="cal-editor-heading"><span>{draft.readOnly}</span><IconButton name="close" label={t("关闭任务")} onClick={onClose}/></header><h3>{content.title}</h3>{content.time && <p className="cal-help">{content.time.date} · {content.time.startTime}</p>}{content.calendar.notes && <div className="cal-notes">{content.calendar.notes}</div>}{content.items.map(item => <p key={item.id}>{item.text}</p>)}</section>;
  return <section className="cal-editor" data-region="entry-editor">
    {errorPanel}
    <header className="cal-editor-heading"><label htmlFor="calendar-entry-title">{t("标题")}</label><div>
      {content.time && <button type="button" className="cal-unschedule-button" onClick={() => setDetails('unschedule')}><CalendarIcon name="inbox" size={15}/>{t("移回未排期")}</button>}
      <CalendarMenu label={t("任务操作")} className="cal-task-menu" trigger={<CalendarIcon name="more" size={18}/>}>
        {close => <>{content.time && <><div className="cal-submenu-host"><button role="menuitem" type="button">{t("重复")}<CalendarIcon name="right" size={15}/></button><div className="cal-submenu" role="menu">
          {[['none', t("不重复")], ['daily', t("每天")], ['weekdays', t("每个工作日")], ['weekly', t("每周")], ['biweekly', t("每两周")], ['monthly', t("每月（日期）")], ['monthly-weekday', t("每月（星期）")], ['yearly', t("每年")]].map(([kind, label]) => <button key={kind} role="menuitem" type="button" onClick={() => { setRepeat(presetRepeat(kind, content.time.date)); close(); }}>{label}</button>)}
          <div className="cal-menu-divider"/><button role="menuitem" type="button" onClick={() => { setRepeatOpen(true); close(); }}>{t("自定义…")}</button></div></div>
          <button type="button" role="menuitemcheckbox" aria-checked={allDay} onClick={() => { const time = content.time ?? { date: todayInZone(draft.zone), startTime: '09:00', durationMinutes: 60, timeZone: draft.zone }; onPatch({ calendar: { ...content.calendar, allDay: !allDay }, time: { ...time, startTime: allDay ? '09:00' : '00:00', durationMinutes: allDay ? 60 : Math.max(1440, Math.ceil(time.durationMinutes / 1440) * 1440) } }); close(); }}>{t("全天")}{allDay && <CalendarIcon name="check" size={14}/>}</button>
          <button type="button" role="menuitem" onClick={() => { setDetails('reminder'); close(); }}>{t("设置提醒")}</button></>}
          <button type="button" role="menuitem" onClick={() => { setDetails('course'); close(); }}>{t("教学关联")}</button>
          <div className="cal-menu-divider"/><button type="button" role="menuitem" className="is-danger" onClick={() => { onDelete(); close(); }}>{t("删除任务")}</button>
        </>}
      </CalendarMenu><IconButton name="close" label={t("关闭任务")} onClick={onClose}/>
    </div></header>
    <input id="calendar-entry-title" name="entry-title" ref={title} className="cal-input" placeholder={t("输入任务标题")} maxLength="300" value={content.title} onChange={e => onPatch({ title: e.target.value })} onKeyDown={confirmField}/>
    {content.time ? <>
      <div className="cal-field-pair"><label className="cal-field">{t("开始日期")}<input name="entry-date" type="date" min="1900-01-01" max="2100-12-31" value={content.time.date} onChange={e => patchTime({ date: e.target.value })} onKeyDown={confirmField}/></label><label className="cal-field cal-end-field">{t("结束日期")}<input aria-invalid={allDay && endIssue ? true : undefined} aria-describedby={allDay && endIssue ? timeErrorId : undefined} name="entry-end-date" type="date" min={content.time.date} max="2100-12-31" value={end.date} onChange={e => onPatch({ time: changeEnd(content, e.target.value, end.time) })} onKeyDown={confirmField}/>{allDay && timeError}</label></div>
      {!allDay && <div className="cal-field-pair"><label className="cal-field">{t("开始时间")}<input name="entry-start" type="time" step="300" value={content.time.startTime} onChange={e => patchTime({ startTime: e.target.value })} onKeyDown={confirmField}/></label><label className="cal-field cal-end-field">{t("结束时间")}<input aria-invalid={endIssue ? true : undefined} aria-describedby={endIssue ? timeErrorId : undefined} name="entry-end" type="time" step="300" value={end.time} onChange={e => onPatch({ time: changeEnd(content, end.date, e.target.value) })} onKeyDown={confirmField}/>{timeError}</label></div>}
    </> : <button className="cal-assign-time" onClick={() => onPatch({ time: defaultTime(draft.zone) })}><CalendarIcon name="clock" size={16}/>{t("安排时间")}</button>}
    {content.time && content.time.timeZone !== draft.zone && <p className="cal-help cal-scheduling-zone">{t("排课时区：")}{content.time.timeZone}</p>}
    {adjustment && <p className="cal-help">{t("夏令时跳时，这次实际开始于")} {adjustment.date} {adjustment.startTime}（{adjustment.timeZone}）。</p>}
    {(content.repeat || content.reminder || content.course.classId || content.course.recordIds.length > 0) && <div className="cal-time-options">
      {content.repeat && <button className="cal-repeat-summary" onClick={() => setRepeatOpen(true)}><CalendarIcon name="repeat" size={14}/><span>{repeatLabel(content.repeat, draft.forceSeries ? content.time.date : draft.entry?.time?.date ?? content.time.date)}</span></button>}
      {content.reminder && <button className="cal-detail-summary cal-reminder-summary" onClick={() => setDetails('reminder')}><CalendarIcon name="clock" size={14}/><span>{reminderLabel(content.reminder)}</span></button>}
      <CourseSummary course={content.course} state={draft.courseState} onClick={() => setDetails('course')}/>
    </div>}
    <div className="cal-field"><span>{t("标签")}</span><TagPicker tags={content.calendar.tags} labels={labels} onChange={tags => patchCalendar({ tags })} onLabels={onLabels} accountKey={accountKey}/></div>
    <label className="cal-field cal-notes-label"><span>{t("备注")}</span><div ref={notes} className="cal-notes" role="textbox" aria-label={t("备注")} aria-multiline="true" contentEditable suppressContentEditableWarning data-placeholder={t("添加备注…")} data-empty={!content.calendar.notes.trim()} onInput={e => patchCalendar({ notes: e.currentTarget.innerText })} onKeyDown={confirmField} onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}/></label>
    <EntryItems items={content.items} repeating={Boolean(content.repeat)} onChange={items => onPatch({ items })} onMove={draft.id || content.title.trim() ? onMoveItem : null} onRemoveLast={draft.id && !content.title.trim() ? onDelete : null}/>
    {draft.savePaused && <ConflictPreview content={draft.baseline} courseState={draft.serverCourseState} labels={labels} onAdopt={() => setDetails('adopt')}/>}
    <CalendarOverlay present={repeatOpen || Boolean(details)}>
    {repeatOpen && <RepeatDialog value={content.repeat} date={content.time.date} anchor={draft.forceSeries ? content.time.date : draft.entry?.time?.date ?? content.time.date} onSave={setRepeat} onClose={() => setRepeatOpen(false)}/>}
    {details === 'reminder' && <ReminderDialog value={content.reminder} onClose={() => setDetails(null)} onSave={reminder => { onPatch({ reminder }); setDetails(null); }}/>}
    {details === 'course' && <CourseDialog draft={draft} onClose={() => setDetails(null)} onSave={course => { onPatch({ course }); setDetails(null); }}/>}
    {details === 'adopt' && <CalendarDialog title={t("采用服务器内容")} onClose={() => setDetails(null)}><p>{t("用服务器内容替换当前本地输入？未保存的本地修改将被丢弃。")}</p><footer><button onClick={() => setDetails(null)}>{t("取消")}</button><button className="is-primary" data-dialog-confirm="" onClick={() => { onAdoptServer(); setDetails(null); }}>{t("采用")}</button></footer></CalendarDialog>}
    {details === 'unschedule' && <CalendarDialog title={t("移回未排期")} onClose={() => setDetails(null)}><p>{t("移除这项任务的时间和提醒，并取消它与实际记录的关联。实际教学记录会保留。")}</p><footer><button onClick={() => setDetails(null)}>{t("取消")}</button><button className="is-primary" data-dialog-confirm="" onClick={() => { onPatch({ time: null, repeat: null, reminder: null, course: { ...content.course, recordIds: [] }, calendar: { ...content.calendar, allDay: false } }); setDetails(null); }}>{t("移回未排期")}</button></footer></CalendarDialog>}
    </CalendarOverlay>
  </section>;
}
