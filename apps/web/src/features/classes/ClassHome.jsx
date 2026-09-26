import { Icon } from '../workbench/icons.jsx';
import { MenuItem, Popover } from '../workbench/ModuleOverlays.jsx';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useScrollRestore } from '../workbench/useScrollRestore.js';
import { setClassDeletion } from './api.js';

function ArchivedClass({ accountKey, classroom, onSelect, onChanged, onDelete }) {
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
      <button className="wb-button" disabled={restore.isRunning} onClick={recover}>{restore.pending ? '重试确认' : '恢复班级'}</button>
      <Popover label={`班级操作 · ${classroom.name}`}>{({ close }) => <MenuItem icon="trash" danger
        disabled={restore.isRunning || Boolean(restore.pending)} onClick={() => { close(); onDelete(classroom); }}>彻底删除</MenuItem>}</Popover>
    </div>
    {restore.problem && <p className="c-field-error" role="status">{restore.problem.message}</p>}
  </li>;
}

export function ClassHome({ accountKey, items, status, error, archived, onViewChange, onSelect,
  onCreate, onReload, onChanged, onDelete, scrollTop, onScrollTop }) {
  const scroll = useScrollRestore(scrollTop || 0, onScrollTop, `${archived}:${items.length}`);
  return <section className="c-class-placeholder c-class-home" data-region="class-home">
    <header className="c-class-head">
      {archived ? <button className="wb-icon-button" aria-label="返回班级主页" title="返回班级主页" onClick={() => onViewChange(false)}><Icon name="back" size={20} /></button>
        : <span className="c-module-icon"><Icon name="classes" size={23} /></span>}
      <h1>{archived ? '已归档班级' : '班级教学'}</h1><span className="c-head-spacer" />
      {!archived && <Popover label="班级管理">{({ close }) => <MenuItem icon="folder" onClick={() => { close(); onViewChange(true); }}>已归档班级</MenuItem>}</Popover>}
    </header>
    {status === 'loading' && !items.length && <p className="wb-muted c-pane-note">正在加载班级…</p>}
    {status === 'error' && <div className="wb-inline-error c-pane-note" role="alert"><span>{error?.message || '无法加载班级'}</span><button className="wb-button" onClick={onReload}>重试加载</button></div>}
    {status === 'ready' && !items.length && <div className="c-welcome" data-region="class-placeholder-empty">
      <span className="c-welcome-icon"><Icon name={archived ? 'folder' : 'prep'} size={32} /></span>
      <h2>{archived ? '没有已归档的班级' : '每个班，都有自己的教学记录'}</h2>
      {!archived && <><p>记住教到了哪里、课堂上遇到的问题，<br />下次上课前，回来接着看。</p>
        <button className="wb-button is-primary" name="new-class" onClick={onCreate}><Icon name="plus" size={17} />创建班级</button>
        <span className="c-welcome-hint">先建一个班，课后写一句就能开始。</span></>}
      {archived && <button className="wb-button" onClick={() => onViewChange(false)}>返回我的班级</button>}
    </div>}
    {items.length > 0 && <div className="c-home-scroll" ref={scroll.ref} onScroll={scroll.onScroll}>
      <div className="c-home-toolbar">{archived ? <span className="wb-muted">共 {items.length} 个班级</span> : <h2>我的班级<span>{items.length}</span></h2>}
        {!archived && <button className="wb-button is-primary" onClick={onCreate}><Icon name="plus" size={16} />创建班级</button>}
      </div>
      <ul className="c-home-grid">{items.map(classroom => archived
        ? <ArchivedClass key={classroom.id} accountKey={accountKey} classroom={classroom} onSelect={onSelect} onChanged={onChanged} onDelete={onDelete} />
        : <li key={classroom.id} className="c-home-card" data-class-id={classroom.id}>
          <button className="c-home-open" onClick={() => onSelect(classroom.id)}>
            <span className="c-class-avatar"><Icon name="classes" size={22} /></span><span>{classroom.name}</span><Icon name="chevron" size={16} />
          </button>
        </li>)}</ul>
    </div>}
  </section>;
}
