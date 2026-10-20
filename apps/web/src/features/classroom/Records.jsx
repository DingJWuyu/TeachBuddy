import React, { Fragment } from 'react';
import { useEffect, useRef, useState } from 'react';
import { tx } from '../../i18n/presentation.js';
import { cx } from '../../components/ui/classNames.js';
import { Icon, Menu, Empty, Search, Spinner } from './ui.jsx';
import { today, longDate, monthLabel } from './util.js';
import { weekdayName } from '../../i18n/presentation.js';

/*
 * Free notes about a student or the whole class: a date and the whole story
 * in one piece. Write at the top, read back along a timeline, find by words
 * and dates. No categories, no daily ratings.
 */

const RANGES = [['all', '全部时间'], ['7', '最近 7 天'], ['30', '最近 30 天'], ['90', '最近 3 个月']];
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function Composer({ placeholder, onSave, initial, onCancel, autoFocus }) {
  const [body, setBody] = useState(initial?.body ?? '');
  const [date, setDate] = useState(initial?.date ?? today());
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [body]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, []);
  const save = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({ body, date });
      if (!initial) { setBody(''); setDate(today()); }
    } catch { /* The journal retains the text and reports the error. */ } finally { setBusy(false); }
  };
  return (
    <div className={cx('cr-composer', initial && 'is-editing')}>
      <textarea
        ref={ref}
        rows={2}
        value={body}
        placeholder={placeholder}
        maxLength={20000}
        aria-label={placeholder}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } if (e.key === 'Escape' && onCancel) onCancel(); }}
      />
      <div className="cr-composer-bar">
        <label className="cr-date-pill">
          <Icon name="calendar" size={14} stroke={2} />
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} aria-label={tx('日期')} />
        </label>
        <span className="cr-grow" />
        {onCancel && <button type="button" className="cr-btn is-small" onClick={onCancel}>{tx('取消')}</button>}
        <button type="button" className="cr-btn is-primary is-small" disabled={!body.trim() || busy} onClick={save}>{initial ? tx('保存') : tx('记下')}</button>
      </div>
    </div>
  );
}

export function Journal({ ctx, subject, placeholder }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [range, setRange] = useState('all');
  const [editing, setEditing] = useState(null);
  const [fresh, setFresh] = useState(null);
  const key = subject.kind === 'student' ? 'studentId' : 'classId';
  const load = async () => {
    try {
      const res = await ctx.api.get('/records', { [key]: subject.id, q: q.trim(), from: range === 'all' ? '' : daysAgo(Number(range)) });
      setItems(res.items); setError(null);
    } catch (err) { setError(err); }
  };
  useEffect(() => { const t = setTimeout(load, q ? 220 : 0); return () => clearTimeout(t); }, [subject.id, q, range]);

  const create = async ({ body, date }) => {
    try {
      const saved = await ctx.api.post('/records', { subject, date, body });
      setFresh(saved.id);
      await load();
    } catch (err) { ctx.toast(err.message, 'error'); throw err; }
  };
  const update = async (item, { body, date }) => {
    try {
      await ctx.api.put(`/records/${item.id}`, { baseVersion: item.version, body, date });
      setEditing(null);
      await load();
      ctx.toast(tx('已保存'));
    } catch (err) { ctx.toast(err.message, 'error'); throw err; }
  };
  const archive = async (item) => {
    try {
      await ctx.api.remove('records', item);
      await load();
      ctx.toast(tx('记录已归档'));
    } catch (err) { ctx.toast(err.message, 'error'); }
  };

  const groups = [];
  for (const item of items || []) {
    const month = item.date.slice(0, 7);
    if (!groups.length || groups.at(-1).month !== month) groups.push({ month, items: [] });
    groups.at(-1).items.push(item);
  }
  const filtered = Boolean(q.trim() || range !== 'all');

  return (
    <div className="cr-journal">
      <Composer placeholder={placeholder} onSave={create} />
      <div className="cr-toolbar is-quiet">
        <Search value={q} onChange={setQ} placeholder={tx('搜索记录里的文字')} />
        <Menu
          label={tx('时间范围')}
          trigger={({ open, toggle }) => (
            <button type="button" className={cx('cr-btn is-small', (open || range !== 'all') && 'is-on')} onClick={toggle} aria-expanded={open}>
              <Icon name="calendar" size={14} stroke={2} />{tx(RANGES.find(([k]) => k === range)[1])}
            </button>
          )}
          items={RANGES.map(([k, label]) => ({ label: tx(label), check: range === k, onClick: () => setRange(k) }))}
        />
        <span className="cr-grow" />
        {items && <span className="cr-muted">{tx('{{n}} 条', { n: items.length })}</span>}
      </div>
      {error ? <Empty compact icon="info" title={tx('班级暂时无法读取')} text={error.message}><button type="button" className="cr-btn" onClick={load}>{tx('重新加载')}</button></Empty> : !items ? <div className="cr-loading is-inline"><Spinner /></div> : !items.length ? (
        filtered
          ? <Empty compact icon="search" title={tx('没有符合条件的记录')} text={tx('换个关键词或时间范围看看。')} />
          : <Empty compact icon="pencil" title={tx('还没有记录')} text={subject.kind === 'student' ? tx('一句话、一次谈话、一个约定，都值得记下来。') : tx('教到哪里、共同的问题、下一节课的想法，写成一条就好。')} />
      ) : (
        <ol className="cr-timeline">
          {groups.map((g) => (
            <li key={g.month} className="cr-month">
              <h4>{monthLabel(g.month)}</h4>
              <ol>
                {g.items.map((item) => (
                  <li key={item.id} className={cx('cr-entry', fresh === item.id && 'is-fresh')}>
                    <div className="cr-entry-date">
                      <strong>{Number(item.date.slice(8, 10))}</strong>
                      <small>{weekdayName(item.date)}</small>
                    </div>
                    {editing === item.id ? (
                      <Composer initial={item} autoFocus onSave={(v) => update(item, v)} onCancel={() => setEditing(null)} />
                    ) : (
                      <article className="cr-entry-card">
                        <p>{item.body}</p>
                        <div className="cr-entry-actions">
                          <button type="button" className="cr-icon-btn is-small" aria-label={tx('编辑')} title={tx('编辑')} onClick={() => setEditing(item.id)}><Icon name="pencil" size={14} stroke={2} /></button>
                          <button type="button" className="cr-icon-btn is-small" aria-label={tx('归档')} title={tx('归档')} onClick={() => archive(item)}><Icon name="trash" size={14} stroke={2} /></button>
                        </div>
                      </article>
                    )}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
