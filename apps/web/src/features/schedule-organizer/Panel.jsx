import { useMemo, useState } from 'react';
import { dayLabels, localizeText } from '../../utils/labels.js';

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const initialForm = {
  day: 'Sunday',
  startTime: '08:00',
  endTime: '08:40',
  subject: '',
  className: '',
  room: '',
  note: ''
};

export default function ScheduleOrganizerPanel({ data, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);

  const filteredData = useMemo(() => data.filter((item) => {
    const matchesDay = dayFilter === 'all' || item.day === dayFilter;
    const haystack = `${item.subject} ${item.className} ${item.room || ''} ${item.note || ''}`.toLowerCase();
    return matchesDay && haystack.includes(search.toLowerCase());
  }), [data, dayFilter, search]);

  const weekBoard = useMemo(() => (
    Object.fromEntries(
      weekDays.map((day) => [day, data.filter((item) => item.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime))])
    )
  ), [data]);

  function handleSubmit(event) {
    event.preventDefault();
    if (editingId) {
      onUpdate(editingId, form);
      setEditingId(null);
    } else {
      onCreate(form);
    }
    setForm(initialForm);
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      day: item.day,
      startTime: item.startTime,
      endTime: item.endTime,
      subject: item.subject,
      className: item.className,
      room: item.room || '',
      note: item.note || ''
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(initialForm);
  }

  return (
    <section className="panel-stack">
      <div className="card split-card">
        <div>
          <h2>排课管理</h2>
          <p className="muted">每周教学时段支持冲突检测、编辑和看板视图，让你的每周安排不再一团雾。</p>
        </div>
        <span className="badge">{data.length} 个时段</span>
      </div>

      <div className="card">
        <h3>{editingId ? '编辑课程时段' : '添加课程时段'}</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            <span>星期</span>
            <select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>
              {weekDays.map((day) => <option key={day} value={day}>{dayLabels[day]}</option>)}
            </select>
          </label>
          <label>
            <span>开始时间</span>
            <input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required />
          </label>
          <label>
            <span>结束时间</span>
            <input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} required />
          </label>
          <label>
            <span>科目</span>
            <input value={localizeText(form.subject)} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="物理" required />
          </label>
          <label>
            <span>班级</span>
            <input value={localizeText(form.className)} onChange={(event) => setForm({ ...form, className: event.target.value })} placeholder="STD IX" required />
          </label>
          <label>
            <span>教室</span>
            <input value={localizeText(form.room)} onChange={(event) => setForm({ ...form, room: event.target.value })} placeholder="3 号教室" />
          </label>
          <label className="full-span">
            <span>备注</span>
            <textarea value={localizeText(form.note)} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="实验准备、作业检查、复习等。" />
          </label>
          <div className="full-span form-actions">
            <button className="primary-button" type="submit">{editingId ? '更新时段' : '保存时段'}</button>
            {editingId && <button className="ghost-button" type="button" onClick={cancelEdit}>取消编辑</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索科目、班级、教室或备注..." />
          <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)}>
            <option value="all">全部日期</option>
            {weekDays.map((day) => <option key={day} value={day}>{dayLabels[day]}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">每周看板</p>
            <h3>日历式排课视图</h3>
          </div>
          <span className="badge">只读看板</span>
        </div>
        <div className="week-grid">
          {weekDays.map((day) => (
            <div key={day} className="week-column">
              <div className="week-column-head">{dayLabels[day]}</div>
              <div className="week-column-body">
                {weekBoard[day].length ? weekBoard[day].map((item) => (
                  <div key={item.id} className="week-slot">
                    <strong>{item.startTime}-{item.endTime}</strong>
                    <span>{localizeText(item.subject)}</span>
                    <small>{localizeText(item.className)}{item.room ? ` | ${localizeText(item.room)}` : ''}</small>
                  </div>
                )) : <p className="muted tiny-text">暂无课程</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card list-card">
        {filteredData.map((item) => (
          <div key={item.id} className="item-card">
            <div className="item-card-header">
              <div>
                <strong>{dayLabels[item.day] || localizeText(item.day)} | {localizeText(item.subject)}</strong>
                <p className="muted">{localizeText(item.className)} | {item.startTime}-{item.endTime}{item.room ? ` | ${localizeText(item.room)}` : ''}</p>
              </div>
              <div className="inline-actions">
                <button className="ghost-button" onClick={() => handleEdit(item)}>编辑</button>
                <button className="danger-button" onClick={() => onDelete(item.id)}>删除</button>
              </div>
            </div>
            {item.note && <p>{localizeText(item.note)}</p>}
          </div>
        ))}
        {!filteredData.length && <p className="muted">没有符合筛选条件的排课时段。</p>}
      </div>
    </section>
  );
}
