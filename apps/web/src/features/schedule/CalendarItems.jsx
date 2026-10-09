import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { CalendarDialog, CalendarIcon, CalendarMenu, isConfirmKey } from './CalendarControls.jsx';
import { moveItemInArray } from './model.js';
import { repeatLabel, titleOf, todayInZone } from './calendarModel.js';
import { listOccurrences } from './api.js';

export function EntryItems({ items, repeating, onChange, onMove, onRemoveLast }) {
  const { t } = useTranslation("schedule");
  const root = useRef(null);
  const focusItem = useRef(null);
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState(null);
  useEffect(() => {
    const cancel = event => {
      if (event.key !== 'Escape' || !gesture.current) return;
      event.preventDefault(); event.stopImmediatePropagation();
      suppressClick.current = true;
      gesture.current = null; setDrag(null);
    };
    document.addEventListener('keydown', cancel, true);
    return () => document.removeEventListener('keydown', cancel, true);
  }, []);
  const add = () => {
    const id = crypto.randomUUID();
    focusItem.current = id;
    onChange([...items.filter(item => item.text.trim()), { id, text: '', priority: 'normal' }]);
  };
  const drop = event => {
    const current = gesture.current;
    gesture.current = null; setDrag(null);
    if (!current) return;
    suppressClick.current = current.moved || performance.now() - current.started > 250;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (current.target === null) return;
    const next = items.filter(item => item.id !== current.id);
    const moved = items.find(item => item.id === current.id);
    if (moved) { next.splice(current.target, 0, moved); onChange(next); }
  };
  useEffect(() => {
    if (!focusItem.current) return;
    const input = root.current?.querySelector(`[data-item-id="${focusItem.current}"] input`);
    if (input) { input.focus(); focusItem.current = null; }
  }, [items]);
  const patch = (id, value) => onChange(items.map(x => x.id === id ? { ...x, ...value } : x));
  return <div className="cal-entry-items" ref={root}>
    <header className="cal-items-heading"><h3>{t("事项")}{items.length > 0 && <span>({items.length})</span>}</h3>{items.length > 0 && <button className="cal-add-item" data-add-item="" aria-label={t("添加事项")} title={t("添加事项")} disabled={items.length >= 200} onClick={add}><CalendarIcon name="plus" size={18}/></button>}</header>
    {items.map((item, index) => <div className={`cal-item-row${item.completed ? ' is-completed' : ''}${drag?.id === item.id ? ' is-dragging' : ''}${drag?.before === item.id ? ' is-drop-before' : ''}${drag?.after === item.id ? ' is-drop-after' : ''}`} key={item.id} data-item-id={item.id}>
      <button type="button" className="cal-item-bullet" aria-label={t("拖动事项 {{value}}", { value: index + 1 })} aria-pressed={Boolean(item.completed)} title={item.completed ? t("标为未完成") : t("完成事项")} onClick={() => {
        if (!suppressClick.current) patch(item.id, { completed: !item.completed });
        suppressClick.current = false;
      }} onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.currentTarget.focus();
        suppressClick.current = false;
        gesture.current = { id: item.id, x: event.clientX, y: event.clientY, target: null, started: performance.now(), moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const current = gesture.current;
        if (!current || Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) return;
        current.moved = true;
        const rows = [...root.current.querySelectorAll('.cal-item-row')].filter(row => row.dataset.itemId !== current.id);
        let target = rows.findIndex(row => { const rect = row.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2; });
        if (target === -1) target = rows.length;
        current.target = target;
        setDrag({ id: current.id, before: rows[target]?.dataset.itemId, after: target === rows.length ? rows.at(-1)?.dataset.itemId : null });
      }} onPointerUp={drop} onPointerCancel={() => { suppressClick.current = true; gesture.current = null; setDrag(null); }} onKeyDown={event => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); onChange(moveItemInArray(items, index, event.key === 'ArrowUp' ? -1 : 1));
      }}>•</button>
      <input aria-label={t("事项 {{value}}", { value: index + 1 })} placeholder={t("写一件要做的事")} maxLength="4000" value={item.text} onChange={e => patch(item.id, { text: e.target.value })} onKeyDown={e => {
        if (!isConfirmKey(e)) return;
        e.preventDefault();
        if (e.currentTarget.value.trim() && items.length < 200) add(); else e.currentTarget.blur();
      }} onBlur={e => {
        if (!e.currentTarget.value.trim() && !e.relatedTarget?.closest('[data-add-item]')) onChange(items.filter(x => x.id !== item.id));
      }}/>
      <CalendarMenu label={t("事项 {{value}} 操作", { value: index + 1 })} trigger={<CalendarIcon name="more" size={16}/>}>
        {close => <>
          {!repeating && onMove && <button role="menuitem" disabled={!item.text.trim()} onClick={() => { onMove(item.id); close(); }}>{t("移到其他安排…")}</button>}
          <div className="cal-menu-divider"/><button role="menuitem" className="is-danger" onClick={() => { if (items.length === 1 && onRemoveLast) onRemoveLast(); else onChange(items.filter(x => x.id !== item.id)); close(); }}>{t("删除事项")}</button>
        </>}
      </CalendarMenu>
    </div>)}
    {!items.length && <button className="cal-add-first-item" data-add-item="" onClick={add}><CalendarIcon name="plus" size={18}/>{t("添加事项")}</button>}
  </div>;
}

export function MoveItemDialog({ item, sourceId, entries, onMove, onClose, onReload, busy, error, pending }) {
  const { t } = useTranslation("schedule");
  const [targetId, setTargetId] = useState('');
  const [scope, setScope] = useState('');
  const [origin, setOrigin] = useState('');
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const targets = entries.filter(x => x.id !== sourceId);
  const target = targets.find(x => x.id === targetId);
  useEffect(() => {
    let active = true;
    setDates([]); setOrigin(''); setLoadError('');
    if (!target?.repeat) { setLoading(false); return; }
    setLoading(true);
    listOccurrences({ from: target.time.date, to: target.repeat.until }).then(result => {
      if (!active) return;
      const options = result.items.filter(x => x.key.entryId === target.id && x.state === 'active');
      setDates(options);
      const today = todayInZone(target.time.timeZone);
      setOrigin((options.find(x => x.time.date >= today) ?? options[0])?.key.originDate ?? '');
    }).catch(() => { if (active) setLoadError(t("未能加载任务日期，请重新选择目标")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [target?.id, target?.version, t]);
  const selected = dates.find(x => x.key.originDate === origin);
  const full = (target?.repeat && scope === 'instance' ? selected?.items.length : target?.items.length) >= 200;
  const unavailable = full || Boolean(target?.repeat && (!scope || scope === 'instance' && (!selected || loading || loadError)));
  return <CalendarDialog title={t("移动事项")} onClose={onClose}>
    <p className="cal-move-item-text">{item.text}</p>
    <label className="cal-field">{t("移到")}<select aria-label={t("移到")} value={targetId} disabled={busy || pending} onChange={e => { setTargetId(e.target.value); setScope(''); }}><option value="">{t("新建未排期任务")}</option>{targets.map(x => <option key={x.id} value={x.id}>{titleOf(x)} · {x.repeat ? repeatLabel(x.repeat, x.time.date) : x.time ? `${x.time.date} ${x.time.startTime}` : t("未排期")}</option>)}</select></label>
    {target?.repeat && <>
      <fieldset className="cal-move-scope"><legend>{t("这条事项需要在哪些任务中？")}</legend>
        <label><input type="radio" name="move-repeat-scope" value="series" checked={scope === 'series'} disabled={busy || pending} onChange={() => setScope('series')}/><span>{t("每次重复都需要")}</span></label>
        <label><input type="radio" name="move-repeat-scope" value="instance" checked={scope === 'instance'} disabled={busy || pending} onChange={() => setScope('instance')}/><span>{t("只在某一次需要")}</span></label>
      </fieldset>
      {scope === 'instance' && <label className="cal-field">{t("任务日期")}<select aria-label={t("任务日期")} value={origin} disabled={loading || busy || pending} onChange={e => setOrigin(e.target.value)}>
        {!dates.length && <option value="">{loading ? t("正在加载…") : t("没有可选择的任务日期")}</option>}
        {dates.map(x => <option key={x.key.originDate} value={x.key.originDate}>{x.time.date} · {x.calendar.allDay ? t("全天") : x.time.startTime}</option>)}
      </select></label>}
      {scope === 'instance' && loadError && <p className="cal-error" role="alert">{loadError}</p>}
    </>}
    {full && !pending && <p className="cal-error" role="alert">{t("目标已有200条事项，请选择其他安排")}</p>}
    {error && <p className="cal-error" role="alert">{error}{onReload && <button onClick={onReload}>{t("读取最新安排")}</button>}</p>}
    <footer><button onClick={onClose}>{t("取消")}</button><button className="is-primary" data-dialog-confirm="" disabled={busy || !pending && unavailable} onClick={() => onMove(item.id, target ?? null, target?.repeat ? { toScope: scope, toOriginDate: scope === 'instance' ? origin : null, toIndex: scope === 'instance' ? selected.items.length : target.items.length } : null)}>{pending ? t("重试确认") : t("移动事项")}</button></footer>
  </CalendarDialog>;
}
