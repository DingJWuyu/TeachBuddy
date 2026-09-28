import { useTranslation } from 'react-i18next';

import { recordContentText } from '@refatos/shared';
import { useRef } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { ModuleDisclosure } from '../workbench/ModuleMotion.jsx';
import { RECORD_FIELDS } from './RecordFields.jsx';
import { sourceLabel } from './model.js';

export const EMPTY_FILTER = { query: '', from: '', to: '', field: '', source: '' };
export const hasRecordFilter = filter => Object.keys(EMPTY_FILTER).some(key => Boolean(filter[key]));
export function matchesRecord(record, filter) {
  if (filter.from && record.recordedOn < filter.from || filter.to && record.recordedOn > filter.to) return false;
  if (filter.field && !record[filter.field]?.trim()) return false;
  if (filter.source && !record.sources.some(source => `${source.kind}:${source.id}` === filter.source)) return false;
  const text = [record.note, recordContentText(record.content), ...RECORD_FIELDS.map(field => record[field.key]), ...record.sources.flatMap(source => [sourceLabel(source), source.labelAtLink])]
    .join(' ').normalize('NFKC').toLocaleLowerCase();
  return filter.query.trim().normalize('NFKC').toLocaleLowerCase().split(/\s+/).every(term => text.includes(term));
}

export function RecordSearch({ filter, onChange, records, advanced, onAdvanced, onClose }) {
  const { t } = useTranslation('classes');
  const search = useRef(null);
  const sources = new Map(records.flatMap(record => record.sources.map(source => [`${source.kind}:${source.id}`, sourceLabel(source)])));
  return <div className="c-record-search">
    <div className="c-search-row">
      <div className="wb-search"><Icon name="search" size={15} /><input ref={search} autoFocus className="wb-input" type="search" aria-label={t("搜索课堂记录")}
        placeholder={t("搜索记录、问题或资料名称")} value={filter.query} onChange={event => onChange({ query: event.target.value })} /></div>
      <button className="wb-button c-text-action" aria-expanded={advanced} onClick={() => onAdvanced(!advanced)}>{t("筛选")}</button>
      <button className="wb-icon-button" aria-label={t("关闭查找记录")} title={t("关闭查找记录")} onClick={onClose}><Icon name="close" size={16} /></button>
    </div>
    <ModuleDisclosure open={advanced}>
      <div className="c-record-filters">
        <label className="wb-field"><span className="wb-label">{t("从哪天")}</span><input className="wb-input" type="date" value={filter.from} onChange={event => onChange({ from: event.target.value })} /></label>
        <label className="wb-field"><span className="wb-label">{t("到哪天")}</span><input className="wb-input" type="date" value={filter.to} onChange={event => onChange({ to: event.target.value })} /></label>
        <label className="wb-field"><span className="wb-label">{t("记录内容")}</span><select className="wb-input" value={filter.field} onChange={event => onChange({ field: event.target.value })}>
          <option value="">{t("全部内容")}</option>{RECORD_FIELDS.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
        </select></label>
        <label className="wb-field"><span className="wb-label">{t("关联资料")}</span><select className="wb-input" value={filter.source} onChange={event => onChange({ source: event.target.value })}>
          <option value="">{t("全部资料")}</option>{[...sources].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
      </div>
    </ModuleDisclosure>
    {filter.from && filter.to && filter.from > filter.to && <p className="c-field-error" role="status">{t("开始日期不能晚于结束日期。")}</p>}
    {hasRecordFilter(filter) && <button className="wb-button c-text-action" onClick={() => { onChange(EMPTY_FILTER); search.current?.focus(); }}>{t("清除筛选")}</button>}
  </div>;
}
