import { useTranslation } from 'react-i18next';

import { useEffect, useState } from 'react';
import { listClassOverview } from './api.js';
import { formatRecordedOn } from './model.js';
import { Icon } from '../workbench/icons.jsx';
import { MenuItem, Popover } from '../workbench/ModuleOverlays.jsx';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useScrollRestore } from '../workbench/useScrollRestore.js';
import { setClassDeletion } from './api.js';

function ArchivedClass({ accountKey, classroom, onSelect, onChanged, onDelete }) {
  const { t } = useTranslation('classes');
  const restore = useIdempotentSubmit({ accountKey, name: `pending:class-deletion:${classroom.id}` });
  async function recover() {
    const run = ({ key, payload }) => setClassDeletion({ key, id: classroom.id, payload });
    const result = restore.pending ? await restore.retry(run)
      : await restore.submit(run, { expectedVersion: classroom.version, deleted: false });
    if (result) onChanged(result);
  }
  return <li className="c-home-card" data-class-id={classroom.id}>
    <button className="c-home-open" onClick={() => onSelect(classroom.id)}>
      <span className="c-class-avatar"><Icon name="classes" size={22} /></span><span>{classroom.name}</span><Icon name="chevron" size={16} />
    </button>
    <div className="c-home-card-actions">
      <button className="wb-button" disabled={restore.isRunning} onClick={recover}>{restore.pending ? t("重试确认") : t("恢复班级")}</button>
      <Popover label={t("班级操作 · {{className}}", { className: classroom.name })}>{({ close }) => <MenuItem icon="trash" danger
        disabled={restore.isRunning || Boolean(restore.pending)} onClick={() => { close(); onDelete(classroom); }}>{t("彻底删除")}</MenuItem>}</Popover>
    </div>
    {restore.problem && <p className="c-field-error" role="status">{restore.problem.message}</p>}
  </li>;
}

export function ClassHome({ accountKey, items, status, error, archived, onViewChange, onSelect,
  onCreate, onReload, onChanged, onDelete, scrollTop, onScrollTop }) {
  const { t } = useTranslation('classes');
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (archived) return;
    let cancelled = false;
    listClassOverview().then(rows => {
      if (!cancelled) { setOverview(new Map(rows.map(item => [item.id, item]))); setOverviewError(false); }
    }).catch(() => { if (!cancelled) setOverviewError(true); });
    return () => { cancelled = true; };
  }, [accountKey, archived, items, reload]);
  const scroll = useScrollRestore(scrollTop || 0, onScrollTop, `${archived}:${items.length}`);
  return <section className="c-class-placeholder c-class-home" data-region="class-home">
    <header className="c-class-head">
      {archived ? <button className="wb-icon-button" aria-label={t("返回班级主页")} title={t("返回班级主页")} onClick={() => onViewChange(false)}><Icon name="back" size={20} /></button>
        : <span className="c-module-icon"><Icon name="classes" size={23} /></span>}
      <h1>{archived ? t("已归档班级") : t("班级教学")}</h1><span className="c-head-spacer" />
      {!archived && <Popover label={t("班级管理")}>{({ close }) => <MenuItem icon="folder" onClick={() => { close(); onViewChange(true); }}>{t("已归档班级")}</MenuItem>}</Popover>}
    </header>
    {status === 'loading' && !items.length && <p className="wb-muted c-pane-note">{t("正在加载班级…")}</p>}
    {status === 'error' && <div className="wb-inline-error c-pane-note" role="alert"><span>{error?.message || t("无法加载班级")}</span><button className="wb-button" onClick={onReload}>{t("重试加载")}</button></div>}
    {status === 'ready' && !items.length && <div className="c-welcome" data-region="class-placeholder-empty">
      <span className="c-welcome-icon"><Icon name={archived ? 'folder' : 'prep'} size={32} /></span>
      <h2>{archived ? t("没有已归档的班级") : t("每个班，都有自己的教学记录")}</h2>
      {!archived && <><p>{t("记住教到了哪里、课堂上遇到的问题，")}<br />{t("下次上课前，回来接着看。")}</p>
        <button className="wb-button is-primary" name="new-class" onClick={onCreate}><Icon name="plus" size={17} />{t("创建班级")}</button>
        <span className="c-welcome-hint">{t("先建一个班，课后写一句就能开始。")}</span></>}
      {archived && <button className="wb-button" onClick={() => onViewChange(false)}>{t("返回我的班级")}</button>}
    </div>}
    {items.length > 0 && <div className="c-home-scroll" ref={scroll.ref} onScroll={scroll.onScroll}>
      <div className="c-home-toolbar">{archived ? <span className="wb-muted">{t("共 {{count}} 个班级", { count: items.length })}</span> : <h2>{t("我的班级")}<span>{items.length}</span></h2>}
        {!archived && <button className="wb-button is-primary" onClick={onCreate}><Icon name="plus" size={16} />{t("创建班级")}</button>}
      </div>
      {overviewError && <p className="wb-muted" role="status">{t("未能更新班级进度。")}<button className="wb-button c-text-action" onClick={() => setReload(value => value + 1)}>{t("重试进度")}</button></p>}
      <ul className="c-home-grid">{items.map(classroom => archived
        ? <ArchivedClass key={classroom.id} accountKey={accountKey} classroom={classroom} onSelect={onSelect} onChanged={onChanged} onDelete={onDelete} />
        : <li key={classroom.id} className="c-home-card" data-class-id={classroom.id}>
          <button className="c-home-open" aria-label={classroom.name} onClick={() => onSelect(classroom.id)}>
            <span className="c-class-avatar"><Icon name="classes" size={22} /></span><span>{classroom.name}
              {overview?.has(classroom.id) && <span className="c-home-summary">
                {overview.get(classroom.id).position ? <><span>{t("最近教到")}</span><span className="c-home-summary-text">{overview.get(classroom.id).position.text}</span><time>{formatRecordedOn(overview.get(classroom.id).position.recordedOn)}</time></>
                  : overview.get(classroom.id).latest ? <><span>{t("最近记录")}</span><span className="c-home-summary-text">{overview.get(classroom.id).latest.text}</span><time>{formatRecordedOn(overview.get(classroom.id).latest.recordedOn)}</time></> : <span>{t("还没有课堂记录")}</span>}
              </span>}
            </span><Icon name="chevron" size={16} />
          </button>
        </li>)}</ul>
    </div>}
  </section>;
}
