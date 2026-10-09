import i18n from '../../i18n/index.js';
import { useTranslation } from 'react-i18next';
const t = (key, options) => i18n.t(key, { ns: 'math', ...options });
import { Icon } from '../workbench/icons.jsx';

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

export default function WorkspaceHome({ items, search, deleted, busy, onSearch, onDeleted, onNew, onOpen, onImport, onImportSource, onRestore, onPurge }) {
  const { t } = useTranslation('math');
  return <div className="mw-home">
    <header className="mw-home-heading"><div><h1 id="math-start-heading" tabIndex={-1}>{t('数学工坊')}</h1><p>{t('公式、图形与讲解，做成一份课堂作品。')}</p></div><button className="mw-button is-primary" disabled={busy} onClick={onNew}><Icon name="plus" size={18}/>{t('新建作品')}</button></header>
    <div className="mw-library-toolbar"><label className="mw-search"><Icon name="search" size={18}/><input aria-label={t('搜索作品')} placeholder={t('搜索作品')} value={search} onChange={event => onSearch(event.target.value)}/></label>
      <details className="mw-home-menu"><summary>{t(deleted ? '已归档' : '作品操作')} <Icon name="chevron" size={14}/></summary><div><button disabled={busy} onClick={onImportSource}>{t('导入可编辑源')}</button><button disabled={busy} onClick={onImport}>{t('导入 HTML 演示')}</button><button onClick={() => onDeleted(!deleted)}>{t(deleted ? '查看当前作品' : '查看已归档作品')}</button></div></details>
    </div>
    <section className="mw-library" aria-label={t('我的作品')}>
      {items.map(item => <article className="mw-library-row" key={item.id}><button disabled={busy} onClick={() => onOpen(item)}><span className="mw-library-symbol"><Icon name="math" size={23}/></span><span><strong>{item.title}</strong><small>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : t('数学作品')}</small></span><Icon name="chevron" size={16}/></button>{deleted && <div><button className="mw-button" disabled={busy} onClick={() => onRestore(item)}>{t('恢复')}</button><button className="mw-button" disabled={busy} onClick={() => onPurge(item)}>{t('彻底删除')}</button></div>}</article>)}
      {!items.length && <div className="mw-library-empty"><WorkIllustration kind="dynamic"/><h2>{t(search ? '没有找到匹配的作品' : deleted ? '没有已归档的作品' : '从一个数学想法开始')}</h2>{!search && !deleted && <p>{t('新建作品，直接写公式、画图，或与 AI 一起制作。')}</p>}</div>}
    </section>
  </div>;
}
