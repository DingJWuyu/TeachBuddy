import { useEffect, useRef, useState } from 'react';
import { CalendarDialog, CalendarIcon, CalendarMenu } from './CalendarControls.jsx';
import { buildPriorityRows, formatInstantLabel, moveItemInArray, PRIORITY_LABEL, PRIORITY_VALUES, TIME_ZONES } from './model.js';
import { titleOf } from './calendarModel.js';

export function EntryItems({ items, repeating, onChange, onMove, onRemoveLast }) {
  const root = useRef(null);
  const count = useRef(items.length);
  useEffect(() => {
    if (items.length > count.current) root.current?.querySelector('.cal-item-row:last-of-type input')?.focus();
    count.current = items.length;
  }, [items.length]);
  const patch = (id, value) => onChange(items.map(x => x.id === id ? { ...x, ...value } : x));
  return <div className="cal-entry-items" ref={root}>
    {items.length > 0 && <h3>事项 <span>{items.length}</span></h3>}
    {items.map((item, index) => <div className="cal-item-row" key={item.id} data-item-id={item.id}>
      <span className={`cal-priority-mark is-${item.priority}`} title={`${PRIORITY_LABEL[item.priority]}优先级`}/>
      <input aria-label={`事项 ${index + 1}`} placeholder="写一件要做的事" maxLength="4000" value={item.text} onChange={e => patch(item.id, { text: e.target.value })}/>
      <CalendarMenu label={`事项 ${index + 1} 操作`} trigger={<CalendarIcon name="more" size={16}/>}>
        {close => <>{PRIORITY_VALUES.map(value => <button key={value} role="menuitemradio" aria-checked={item.priority === value} onClick={() => { patch(item.id, { priority: value }); close(); }}>{PRIORITY_LABEL[value]}优先级{item.priority === value && <CalendarIcon name="check" size={14}/>}</button>)}
          <div className="cal-menu-divider"/>
          <button role="menuitem" disabled={index === 0} onClick={() => { onChange(moveItemInArray(items, index, -1)); close(); }}>上移</button>
          <button role="menuitem" disabled={index === items.length - 1} onClick={() => { onChange(moveItemInArray(items, index, 1)); close(); }}>下移</button>
          {!repeating && <button role="menuitem" disabled={!item.text.trim()} onClick={() => { onMove(item.id); close(); }}>移到其他安排…</button>}
          <div className="cal-menu-divider"/><button role="menuitem" className="is-danger" onClick={() => { if (items.length === 1 && onRemoveLast) onRemoveLast(); else onChange(items.filter(x => x.id !== item.id)); close(); }}>删除事项</button>
        </>}
      </CalendarMenu>
    </div>)}
    <button className="cal-add-item" disabled={items.length >= 200} onClick={() => onChange([...items, { id: crypto.randomUUID(), text: '', priority: 'normal' }])}><CalendarIcon name="plus" size={14}/>添加事项</button>
  </div>;
}

export function MoveItemDialog({ item, sourceId, entries, onMove, onClose, busy, error, pending }) {
  const [targetId, setTargetId] = useState('');
  const targets = entries.filter(x => x.id !== sourceId && !x.repeat);
  const target = targets.find(x => x.id === targetId);
  return <CalendarDialog title="移动事项" onClose={onClose}>
    <p className="cal-move-item-text">{item.text}</p><p className="cal-help">只移动这条事项，保留它的优先级。目标安排的时间和教学关联保持原样。</p>
    <label className="cal-field">移到<select aria-label="移到" value={targetId} disabled={busy || pending} onChange={e => setTargetId(e.target.value)}><option value="">新建未排期任务</option>{targets.map(x => <option key={x.id} value={x.id}>{titleOf(x)} · {x.time ? `${x.time.date} ${x.time.startTime}` : '未排期'}</option>)}</select></label>
    {error && <p className="cal-error" role="alert">{error}</p>}
    <footer><button onClick={onClose}>取消</button><button className="is-primary" disabled={busy} onClick={() => onMove(item.id, target ?? null)}>{pending ? '重试确认' : '移动事项'}</button></footer>
  </CalendarDialog>;
}

export function PriorityDialog({ occurrences, entries, zone, onPriority, onOpen, onClose }) {
  const rows = buildPriorityRows(occurrences, entries.filter(x => !x.time));
  return <CalendarDialog title="优先事项" onClose={onClose}>
    <p className="cal-help">当前日历范围内的事项，以及全部未排期事项。</p>
    {!rows.length && <p className="cal-help">还没有事项。打开任务，用“添加事项”写下要做的事。</p>}
    {PRIORITY_VALUES.map(priority => {
      const group = rows.filter(row => row.item.priority === priority);
      return group.length > 0 && <section className="cal-priority-group" key={priority}><h3><span className={`cal-priority-mark is-${priority}`}/>{PRIORITY_LABEL[priority]}优先级 <small>{group.length}</small></h3>
        {group.map(row => <div className="cal-priority-row" key={`${row.entryId}:${row.originDate}:${row.itemId}`}><button onClick={() => onOpen(row.entryId, row.originDate)}><span>{row.item.text}</span><small>{row.kind === 'unscheduled' ? '未排期' : formatInstantLabel(new Date(row.sortStart).toISOString(), zone)} · {row.label}</small></button><select aria-label={`优先级 ${row.item.text}`} value={row.item.priority} onChange={e => onPriority(row, e.target.value)}>{PRIORITY_VALUES.map(value => <option key={value} value={value}>{PRIORITY_LABEL[value]}</option>)}</select></div>)}
      </section>;
    })}
  </CalendarDialog>;
}

export function TimeZoneDialog({ zone, onSave, onClose, busy, error, pending }) {
  const [value, setValue] = useState(zone);
  const zones = [...new Set([...TIME_ZONES, zone, ...(Intl.supportedValuesOf?.('timeZone') ?? [])])];
  return <CalendarDialog title="显示时区" onClose={onClose}>
    <p className="cal-help">用于日历显示和新建任务。已有课程保留原排课时区与实际时刻，教学记录日期保持原样。</p>
    <label className="cal-field">账户显示时区<select value={value} disabled={busy || pending} onChange={e => setValue(e.target.value)}>{zones.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
    {error && <p className="cal-error" role="alert">{error}</p>}
    <footer><button onClick={onClose}>取消</button><button className="is-primary" disabled={busy} onClick={() => onSave(value)}>{pending ? '重试确认' : '保存时区'}</button></footer>
  </CalendarDialog>;
}
