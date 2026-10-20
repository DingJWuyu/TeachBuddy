import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { CalendarDialog } from './CalendarControls.jsx';
import { repeatLabel, titleOf, todayInZone } from './calendarModel.js';
import { listOccurrences } from './api.js';

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
