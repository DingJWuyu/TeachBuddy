import { useMemo, useState } from 'react';
import { localizeText, priorityLabels, recurrenceLabels, statusLabels } from '../../utils/labels.js';

function getDefaultDueAt() {
  const date = new Date(Date.now() + 3600000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const initialForm = {
  title: '',
  dueAt: getDefaultDueAt(),
  priority: 'medium',
  status: 'pending',
  recurrence: 'none',
  recurrenceInterval: 1
};

export default function ReminderCenterPanel({ title, data, onCreate, onUpdate, onDelete, onCompleteRecurring }) {
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);

  const filteredData = useMemo(() => data.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesStatus && item.title.toLowerCase().includes(search.toLowerCase());
  }), [data, search, statusFilter]);

  function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      ...form,
      dueAt: new Date(form.dueAt).toISOString(),
      source: editingId ? (form.source || 'manual') : 'manual',
      recurrenceInterval: Number(form.recurrenceInterval || 1)
    };

    if (editingId) {
      onUpdate(editingId, payload);
      setEditingId(null);
    } else {
      onCreate(payload);
    }

    setForm({ ...initialForm, dueAt: getDefaultDueAt() });
  }

  function toggleStatus(item) {
    if (item.status !== 'done') {
      onCompleteRecurring(item.id);
      return;
    }

    onUpdate(item.id, { ...item, status: 'pending' });
  }

  function handleEdit(item) {
    setEditingId(item.id);
    const date = new Date(item.dueAt);
    const localDue = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({
      title: item.title,
      dueAt: localDue,
      priority: item.priority,
      status: item.status,
      source: item.source || 'manual',
      recurrence: item.recurrence || 'none',
      recurrenceInterval: item.recurrenceInterval || 1
    });
  }

  return (
    <section className="panel-stack">
      <div className="card split-card">
        <div>
          <h2>{title}</h2>
          <p className="muted">截止时间、重复任务以及与课程关联的提醒，都集中在这里。</p>
        </div>
        <span className="badge">{data.filter((item) => item.status !== 'done').length} 个活动提醒</span>
      </div>

      <div className="card">
        <h3>{editingId ? '编辑提醒' : '新建提醒'}</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="full-span">
            <span>标题</span>
            <input value={localizeText(form.title)} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="准备周一的练习单" required />
          </label>
          <label>
            <span>截止时间</span>
            <input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} required />
          </label>
          <label>
            <span>优先级</span>
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </label>
          <label>
            <span>状态</span>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="pending">待处理</option>
              <option value="done">已完成</option>
            </select>
          </label>
          <label>
            <span>重复</span>
            <select value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value })}>
              <option value="none">不重复</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </label>
          <label>
            <span>间隔</span>
            <input type="number" min="1" value={form.recurrenceInterval} onChange={(event) => setForm({ ...form, recurrenceInterval: event.target.value })} />
          </label>
          <div className="full-span form-actions">
            <button className="primary-button" type="submit">{editingId ? '更新提醒' : '保存提醒'}</button>
            {editingId && (
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...initialForm, dueAt: getDefaultDueAt() });
                }}
              >
                取消编辑
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索提醒..." />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">{statusLabels.all}</option>
            <option value="pending">{statusLabels.pending}</option>
            <option value="done">{statusLabels.done}</option>
          </select>
        </div>
      </div>

      <div className="card list-card">
        {filteredData.map((item) => (
          <div key={item.id} className="item-card">
            <div className="item-card-header">
              <div>
                <strong>{localizeText(item.title)}</strong>
                <p className="muted">
                  {new Date(item.dueAt).toLocaleString('zh-CN')} | {priorityLabels[item.priority] || localizeText(item.priority)} | {item.recurrence && item.recurrence !== 'none' ? `重复：${recurrenceLabels[item.recurrence] || localizeText(item.recurrence)}` : '单次'}
                </p>
              </div>
              <div className="inline-actions">
                <button className="ghost-button" onClick={() => toggleStatus(item)}>
                  {item.status === 'done' ? '标记为待处理' : '完成'}
                </button>
                <button className="ghost-button" onClick={() => handleEdit(item)}>编辑</button>
                <button className="danger-button" onClick={() => onDelete(item.id)}>删除</button>
              </div>
            </div>
            <p><strong>状态：</strong> {statusLabels[item.status] || localizeText(item.status)}</p>
          </div>
        ))}
        {!filteredData.length && <p className="muted">没有符合搜索条件的提醒。</p>}
      </div>
    </section>
  );
}
