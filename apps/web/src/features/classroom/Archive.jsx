import React from 'react';
import { useEffect, useState } from 'react';
import { tx } from '../../i18n/presentation.js';
import { Icon, Avatar, Empty, Spinner } from './ui.jsx';
import { longDate } from './util.js';

/* Archived classes, students, exams and notes. Restoring a parent does not
   bring back children that were archived on their own. */
export function Archive({ ctx }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = async () => {
    const [c, s, e, r] = await Promise.all(['classes', 'students', 'exams', 'records'].map((n) => ctx.api.get(`/${n}`, { state: 'deleted' })));
    const recordStudents = new Map([...ctx.data.students, ...s.items].map(student => [student.id, student]));
    const missing = [...new Set(r.items.filter(record => record.scope === 'student' && !recordStudents.has(record.subjectId)).map(record => record.subjectId))];
    const parents = await Promise.all(missing.map(id => ctx.api.get(`/students/${id}`)));
    for (const student of parents) recordStudents.set(student.id, student);
    setItems({ classes: c.items, students: s.items, exams: e.items, records: r.items, recordStudents });
  };
  useEffect(() => { load().catch(setError); }, []);
  const restore = async (collection, item) => {
    try {
      await ctx.api.remove(collection, item, false);
      await Promise.all([load(), ctx.reload()]);
      ctx.toast(tx('已恢复'));
    } catch (err) {
      ctx.toast(err.message, 'error');
      await load().catch(setError);
    }
  };
  const className = (id) => ctx.data.classes.find((c) => c.id === id)?.name || items?.classes.find((c) => c.id === id)?.name || '';
  const restoreReason = (collection, item) => {
    const student = collection === 'students' ? item : collection === 'records' && item.scope === 'student' ? items.recordStudents.get(item.subjectId) : null;
    const classId = student?.classId || (collection === 'records' && item.scope === 'class' ? item.subjectId : null);
    if (classId && items.classes.some(cls => cls.id === classId)) return tx('请先恢复所属班级');
    if (collection === 'records' && student?.deletedAt) return tx('请先恢复所属学生');
    return '';
  };
  const empty = items && !items.classes.length && !items.students.length && !items.exams.length && !items.records.length;
  const section = (title, collection, list, render) => list.length > 0 && (
    <section className="cr-panel">
      <div className="cr-panel-head"><h3>{title}</h3><span className="cr-muted">{list.length}</span></div>
      <ul className="cr-archive">
        {list.map((item) => (
          <li key={item.id}>
            {render(item)}
            <button type="button" className="cr-btn is-small" disabled={Boolean(restoreReason(collection, item))} onClick={() => restore(collection, item)}><Icon name="restore" size={13} stroke={2} />{tx('恢复')}</button>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <div className="cr-page">
      <header className="cr-head">
        <div className="cr-head-title is-plain">
          <div>
            <h2>{tx('已归档')}</h2>
            <span>{tx('归档的内容都在这里，关系和历史成绩原样保留。')}</span>
          </div>
        </div>
      </header>
      <div className="cr-page-scroll">
        {error ? <Empty icon="info" title={tx('班级暂时无法读取')} text={error.message}><button type="button" className="cr-btn" onClick={() => { setError(null); load().catch(setError); }}>{tx('重新加载')}</button></Empty> : !items ? <div className="cr-loading is-inline"><Spinner /></div> : empty ? (
          <Empty icon="trash" title={tx('没有归档的内容')} text={tx('归档的班级、学生、考试和记录会放在这里，随时可以恢复。')} />
        ) : (
          <>
            {section(tx('班级'), 'classes', items.classes, (c) => <span className="cr-archive-text"><strong>{c.name}</strong><small>{c.term}</small></span>)}
            {section(tx('学生'), 'students', items.students, (s) => <><Avatar name={s.name} id={s.id} size="sm" /><span className="cr-archive-text"><strong>{s.name}</strong><small>{className(s.classId)}</small>{restoreReason('students', s) && <small>{restoreReason('students', s)}</small>}</span></>)}
            {section(tx('考试'), 'exams', items.exams, (e) => <span className="cr-archive-text"><strong>{e.name}</strong><small>{longDate(e.date)}</small></span>)}
            {section(tx('记录'), 'records', items.records, (r) => <span className="cr-archive-text"><strong className="is-clamp">{r.body}</strong><small>{longDate(r.date)}</small>{restoreReason('records', r) && <small>{restoreReason('records', r)}</small>}</span>)}
          </>
        )}
      </div>
    </div>
  );
}
