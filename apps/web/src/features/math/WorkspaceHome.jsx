import i18n from '../../i18n/index.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuxiliaryAssistant } from '../workbench/shellContext.js';
import { MathWebAssistant } from './web-ai/MathWebAssistant.jsx';
import { MathMenu, MenuItem } from './MathMenu.jsx';
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: 'math', ...options });
import { Icon } from '../../components/icons.jsx';

export function mathStatusLabel(status) {
  const labels = {
    '已保存': t('已保存'), '未保存': t('未保存'), '保存结果待确认': t('保存结果待确认'),
    '保存中': t('保存中'), '保存失败': t('保存失败'),
  };
  return labels[status] ?? status;
}

export const workshopKinds = [
  { kind: 'geogebra', get title() { return t("GeoGebra 数学画布"); }, get purpose() { return t("自由作图，与 AI 一起修改同一份作品"); } },
  { kind: 'formula', get title() { return t("公式"); }, get purpose() { return t("排出清晰公式，放进讲义或课件"); } },
  { kind: 'plane', get title() { return t("平面图形"); }, get purpose() { return t("画函数图像、几何图形与标注"); } },
  { kind: 'space', get title() { return t("空间图形"); }, get purpose() { return t("制作立体几何示意图"); } },
  { kind: 'dynamic', get title() { return t("动态演示"); }, get purpose() { return t("拖动参数，观察图形如何变化"); } },
];

export function WorkIllustration({ kind }) {
  return <svg className="math-work-illustration" viewBox="0 0 220 100" fill="none" aria-hidden="true">
    {kind === 'formula' ? <g fill="currentColor" fontFamily="serif" textAnchor="middle">
      <text x="48" y="58" fontSize="23">x =</text><text x="139" y="38" fontSize="22">−b ± √(b²−4ac)</text>
      <path d="M76 48H204" stroke="currentColor"/><text x="139" y="74" fontSize="22">2a</text>
    </g> : kind === 'space' ? <g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="m67 29 57-18 36 25v48l-57 8-36-24zM67 29l36 24 57-17M103 53v39"/>
      <path d="M124 11v48l-57 9M124 59l36 25" strokeDasharray="4 4" opacity=".45"/>
    </g> : <g stroke="currentColor" strokeWidth="1.6">
      <path d="M32 72h158M101 88V10" opacity=".22"/>
      <path d="M48 16Q101 128 154 16"/>
      {kind === 'dynamic' && <><path d="M80 16Q133 92 186 16" strokeDasharray="4 4" opacity=".4"/>
        <path d="M65 91h98" strokeWidth="3" opacity=".25"/><circle cx="128" cy="91" r="5" fill="currentColor"/></>}
    </g>}
  </svg>;
}

export default function WorkspaceHome({ items, search, deleted, busy, client, accountKey, onSearch, onDeleted, onNew, onOpen, onImport, onImportSource, onRestore, onPurge }) {
  const { t, i18n } = useTranslation('math');
  const actions = useRef({ onNew, busy });
  actions.current = { onNew, busy };
  useAuxiliaryAssistant(useCallback(() => <MathWebAssistant key={accountKey} accountKey={accountKey} onStart={request => { if (!actions.current.busy) return actions.current.onNew(request); }}/>, [accountKey]));
  return <div className="mw-home">
    <header className="mw-home-heading"><div className="mw-home-title"><Icon name="math" size={26}/><h1 id="math-start-heading" tabIndex={-1}>{t('数学工坊')}</h1></div><button className="mw-button is-primary" disabled={busy} onClick={onNew}><Icon name="plus" size={18}/>{t('新建作品')}</button></header>
    <div className="mw-library-toolbar"><h2>{t(deleted ? '已归档' : '我的作品')}<span>{items.length}</span></h2><div className="mw-library-actions"><label className="mw-search"><Icon name="search" size={17}/><input aria-label={t('搜索作品')} placeholder={t('搜索作品')} value={search} onChange={event => onSearch(event.target.value)}/></label>
      <MathMenu label={t('作品操作')} className="mw-home-actions">{({ close }) => <><MenuItem onClick={() => { close(); onImportSource(); }} disabled={busy}>{t('导入作品')}</MenuItem><MenuItem onClick={() => { close(); onImport(); }} disabled={busy}>{t('导入网页')}</MenuItem><MenuItem onClick={() => { close(); onDeleted(!deleted); }}>{t(deleted ? '我的作品' : '已归档')}</MenuItem></>}</MathMenu>
    </div></div>
    <section className="mw-library" aria-label={t('我的作品')}>
      {items.map(item => <article className="mw-library-row" key={item.id}><button disabled={busy} onClick={() => onOpen(item)}><WorkThumbnail item={item} client={client}/><span className="mw-library-caption"><strong>{item.title}</strong><small>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(i18n.resolvedLanguage, { month: 'long', day: 'numeric' }) : t('数学作品')}</small></span></button>{deleted && <div className="mw-archive-actions"><button className="mw-button" disabled={busy} onClick={() => onRestore(item)}>{t('恢复')}</button><button className="mw-button" disabled={busy} onClick={() => onPurge(item)}>{t('彻底删除')}</button></div>}</article>)}
      {!items.length && <div className="mw-library-empty"><Icon name="math" size={32}/><h2>{t(search ? '没有找到作品' : deleted ? '没有归档作品' : '还没有作品')}</h2><p>{t(search ? '试试其他名称。' : deleted ? '归档的作品会放在这里。' : '新建作品，写公式、画图或制作演示。')}</p></div>}
    </section>
  </div>;
}

function WorkThumbnail({ item, client }) {
  const { t } = useTranslation('math');
  const [url, setUrl] = useState(null);
  const id = item.render?.posterFileId;
  useEffect(() => {
    let live = true, objectUrl;
    setUrl(null);
    if (id && client) client.blob(`/api/workbench/files/${id}/content`).then(blob => { if (live) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(() => {});
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, client]);
  return <span className="mw-library-thumbnail">{url ? <img src={url} alt="" onError={() => setUrl(null)}/> : <span><Icon name={item.source?.kind === 'html' ? 'prep' : 'math'} size={30}/><span>{t(item.source?.kind === 'html' ? '网页演示' : '数学作品')}</span></span>}</span>;
}
