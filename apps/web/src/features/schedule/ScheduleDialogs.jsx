import { ConfirmButton } from '../../components/ui/confirm.jsx';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { CalendarDialog, CalendarIcon } from './CalendarControls.jsx';
import { COLORS, monthDays, presetRepeat, repeatAnchor, weekday } from './calendarModel.js';
import { useIdempotentSubmit } from '../../platform/saving/useIdempotentSubmit.js';
import * as api from './api.js';
import { weekdayLabel } from './model.js';

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

export function LabelDialog({ label, accountKey, onSaved, onClose }) {
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
    <footer>{label && <ConfirmButton className="cal-label-delete" label={t("删除标签")} text={t("删除标签")} disabled={operation.isRunning} onConfirm={() => save(true)}/>}<button onClick={close}>{t("取消")}</button><button className="is-primary" data-dialog-confirm="" disabled={!name.trim() || operation.isRunning} onClick={() => save()}>{operation.pending ? t("重试确认") : t("保存")}</button></footer>
  </CalendarDialog>;
}
