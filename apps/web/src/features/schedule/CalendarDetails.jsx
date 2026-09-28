import { useEffect, useState } from 'react';
import { CalendarDialog } from './CalendarControls.jsx';
import { titleOf } from './calendarModel.js';
import * as api from './api.js';

export const reminderLabel = reminder => reminder.minutes === 0 ? '结束时提醒' : `结束${reminder.side === 'before' ? '前' : '后'} ${reminder.minutes} 分钟提醒`;

export function ReminderDialog({ value, onSave, onClose }) {
  const [side, setSide] = useState(value?.side ?? 'before');
  const [minutes, setMinutes] = useState(value?.minutes ?? 10);
  return <CalendarDialog title="提醒" onClose={onClose}>
    <p className="cal-help">到时在工作台通知中提醒。关闭期间到期的提醒，会在下次打开时显示。</p>
    <div className="cal-field-pair"><label className="cal-field">提醒时机<select value={side} onChange={e => setSide(e.target.value)}><option value="before">结束前</option><option value="after">结束后</option></select></label>
      <label className="cal-field">分钟数<input type="number" min="0" max="10080" value={minutes} onChange={e => setMinutes(e.target.value)}/></label></div>
    <p className="cal-help">填写 0 表示结束时提醒。</p>
    <footer>{value && <button onClick={() => onSave(null)}>关闭提醒</button>}<button onClick={onClose}>取消</button><button className="is-primary" disabled={minutes === '' || !Number.isInteger(Number(minutes)) || minutes < 0 || minutes > 10080} onClick={() => onSave({ side, minutes: Number(minutes) })}>完成</button></footer>
  </CalendarDialog>;
}

const linkLabel = link => link?.currentLabel || link?.labelAtLink || '已关联资料';
export function CourseDialog({ draft, onSave, onClose }) {
  const [course, setCourse] = useState(() => structuredClone(draft.content.course));
  const [options, setOptions] = useState(null);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const state = draft.courseState ?? {};
  const canLinkRecords = Boolean(draft.content.time && (!draft.content.repeat || draft.origin));
  useEffect(() => {
    let live = true;
    setError('');
    Promise.all([api.listClasses(), api.listLessons()]).then(([classes, lessons]) => {
      if (live) setOptions({ classes, lessons });
    }).catch(e => { if (live) setError(e.problem?.message ?? '未能加载教学资料'); });
    return () => { live = false; };
  }, [revision]);
  useEffect(() => {
    let live = true;
    setRecords(null);
    if (course.classId && canLinkRecords) api.listClassRecords(course.classId).then(items => {
      if (live) setRecords(items);
    }).catch(e => { if (live) setError(e.problem?.message ?? '未能加载教学记录'); });
    else setRecords([]);
    return () => { live = false; };
  }, [course.classId, canLinkRecords, revision]);
  const preserved = (id, items, link) => id && !items.some(x => x.id === id) ? <option value={id}>{linkLabel(link)}{link?.deleted ? '（已删除）' : '（已关联）'}</option> : null;
  return <CalendarDialog title="教学关联" onClose={onClose}>
    <p className="cal-help">关联已有备课和实际教学记录。修改日程不会改写教学记录。</p>
    {error && <p className="cal-error" role="alert">{error}<button onClick={() => setRevision(x => x + 1)}>重试加载</button></p>}
    {!options ? !error && <p role="status">正在加载…</p> : <div className="cal-details-fields">
      <label className="cal-field">班级<select aria-label="班级" value={course.classId ?? ''} onChange={e => setCourse({ ...course, classId: e.target.value || null, recordIds: [] })}><option value="">不关联班级</option>{preserved(course.classId, options.classes, state.classroom)}{options.classes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label className="cal-field">备课<select aria-label="备课" value={course.lessonId ?? ''} onChange={e => setCourse({ ...course, lessonId: e.target.value || null })}><option value="">不关联备课</option>{preserved(course.lessonId, options.lessons, state.lesson)}{options.lessons.map(x => <option key={x.id} value={x.id}>{x.title || '未命名备课'}</option>)}</select></label>
      {course.classId && canLinkRecords && <fieldset className="cal-record-options"><legend>实际教学记录</legend>{records === null ? <p role="status">正在加载记录…</p> : <>
        {records.length === 0 && !course.recordIds.length && <p className="cal-help">这个班级还没有教学记录。</p>}
        {[...records.map(record => ({ id: record.id, label: `${record.recordedOn} · ${record.note || record.position || record.unfinished || record.commonIssues || record.nextNote || '课堂记录'}` })), ...(state.records ?? []).filter(x => course.recordIds.includes(x.id) && !records.some(record => record.id === x.id)).map(x => ({ id: x.id, label: `${linkLabel(x)}${x.deleted ? '（已删除）' : ''}` }))].map(record => <label key={record.id}><input type="checkbox" checked={course.recordIds.includes(record.id)} onChange={e => setCourse({ ...course, recordIds: e.target.checked ? [...course.recordIds, record.id] : course.recordIds.filter(x => x !== record.id) })}/><span>{record.label}</span></label>)}
      </>}</fieldset>}
      {draft.content.repeat && <p className="cal-help">{draft.origin ? '教学记录只关联当前这次任务。' : '先保存重复任务，再打开具体日期关联教学记录。'}</p>}
    </div>}
    <footer><button onClick={onClose}>取消</button><button className="is-primary" disabled={!options || Boolean(error)} onClick={() => onSave(course, Boolean(draft.origin && (course.recordIds.length || draft.content.course.recordIds.length)))}>完成</button></footer>
  </CalendarDialog>;
}

export function CourseSummary({ course, state, onClick }) {
  if (!course.classId && !course.lessonId && !course.recordIds.length) return null;
  return <button className="cal-detail-summary" onClick={onClick}><span>教学关联</span><span>{[course.classId && (linkLabel(state?.classroom) + (state?.classroom?.deleted ? '（已删除）' : '')), course.lessonId && (linkLabel(state?.lesson) + (state?.lesson?.deleted ? '（已删除）' : '')), course.recordIds.length > 0 && `${course.recordIds.length} 条记录`].filter(Boolean).join(' · ')}</span></button>;
}

export function DeletedDialog({ entries, onOpen, onClose, revision }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setError('');
    Promise.all([api.listEntries({ state: 'deleted' }), Promise.all(entries.filter(x => x.repeat).map(async entry => {
      const result = await api.listExceptions(entry.id);
      return result.items.filter(x => x.mode === 'cancelled' && x.eligible).map(x => ({ ...entry, origin: x.originDate, cancelled: true }));
    }))]).then(([deleted, cancelled]) => { if (live) setItems([...deleted, ...cancelled.flat()]); })
      .catch(e => { if (live) setError(e.problem?.message ?? '未能加载已删除任务'); });
    return () => { live = false; };
  }, [revision, retry]);
  return <CalendarDialog title="已删除任务" onClose={onClose}>
    <p className="cal-help">打开任务可查看并恢复。取消的单次任务也在这里。</p>
    {error ? <p className="cal-error" role="alert">{error}<button onClick={() => setRetry(x => x + 1)}>重试加载</button></p> : !items ? <p role="status">正在加载…</p> : !items.length ? <p className="cal-help">没有已删除任务。</p> : <div className="cal-deleted-list">{items.map(entry => <button key={`${entry.id}:${entry.origin ?? ''}`} onClick={() => onOpen(entry.id, entry.origin ?? (entry.repeat ? entry.time.date : null))}><span>{titleOf(entry)}</span><small>{entry.cancelled ? `${entry.origin} · 单次取消` : '已删除'}</small></button>)}</div>}
  </CalendarDialog>;
}
