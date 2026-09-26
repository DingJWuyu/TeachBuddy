import { useRef, useState } from 'react';
import { useScene } from '../workbench/useScene.js';
import { useModuleDialogFocus } from '../workbench/ModuleMotion.jsx';
import { Icon } from '../workbench/icons.jsx';
import { MenuItem, Popover } from '../workbench/ModuleOverlays.jsx';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useScrollRestore } from '../workbench/useScrollRestore.js';
import { createClass } from './api.js';

export function ClassList({ items, status, error, onArchived, selectedId,
  onSelect, onCreate, onReload, scrollTop, onScrollTop, onClose }) {
  const scroll = useScrollRestore(scrollTop || 0, onScrollTop, items.length);
  return <aside className="c-class-pane" data-region="class-list" aria-label="我的班级">
    <header className="c-list-head">
      <h2><Icon name="classes" size={20} />我的班级</h2>
      {onClose ? <button type="button" className="wb-icon-button" title="关闭班级列表" aria-label="关闭班级列表" onClick={onClose}><Icon name="close" /></button>
        : <Popover label="班级列表操作">{({ close }) => <MenuItem icon="folder" onClick={() => { close(); onArchived(); }}>已归档班级</MenuItem>}</Popover>}
    </header>
    <p className="c-list-caption">每个班的进度与反馈，分别记在这里。</p>
    {status === 'loading' && <p className="wb-muted c-pane-note">正在加载班级…</p>}
    {status === 'error' && <div className="wb-inline-error c-pane-note" role="alert"><span>{error?.message || '无法加载班级'}</span><button className="wb-button" onClick={onReload}>重试</button></div>}
    <div className="c-class-scroll" ref={scroll.ref} onScroll={scroll.onScroll} data-region="class-rows-scroll">
      {status === 'ready' && items.length === 0 && <p className="wb-empty-note" data-region="class-empty">还没有班级</p>}
      <ul className="c-class-rows">
        {items.map(classroom => <li key={classroom.id}>
          <button type="button" className={`c-class-row${selectedId === classroom.id ? ' is-active' : ''}`}
            data-class-id={classroom.id} aria-current={selectedId === classroom.id ? 'true' : undefined} onClick={() => onSelect(classroom.id)}>
            <span className="c-class-avatar"><Icon name="classes" size={19} /></span>
            <span className="c-class-name">{classroom.name}</span>
            {selectedId === classroom.id && <Icon name="check" size={15} />}
          </button>
        </li>)}
      </ul>
    </div>
    <footer className="c-list-footer">
      <button type="button" className="wb-button c-create-button" name="new-class" onClick={onCreate}><Icon name="plus" size={16} />创建班级</button>
      {onClose && <button className="wb-text-button" onClick={onArchived}>已归档班级</button>}
    </footer>
  </aside>;
}

export function ClassCreateDialog({ accountKey, onCreated, onClose }) {
  const [scene, patchScene] = useScene(accountKey, 'class-create', { name: '' });
  const [localError, setLocalError] = useState(null);
  const submit = useIdempotentSubmit({ accountKey, name: 'pending:class-create' });
  const dialog = useRef(null);
  const busy = submit.status === 'running';
  useModuleDialogFocus(dialog, () => { if (!busy) onClose(); });
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!scene.name.trim()) { setLocalError('填写一个班级名称，例如：高一（1）班'); return; }
    setLocalError(null);
    const created = submit.status === 'unconfirmed'
      ? await submit.retry(({ key, payload }) => createClass({ key, payload }))
      : await submit.submit(({ key, payload }) => createClass({ key, payload }), { name: scene.name });
    if (created) { patchScene({ name: '', creating: false }); onCreated(created); }
  }
  return <div className="wb-dialog-host wb-module-dialog c-create-dialog-host" data-overlay="dialog">
    <div className="wb-dialog-scrim" role="presentation" onClick={() => { if (!busy) onClose(); }} />
    <form ref={dialog} className="wb-dialog c-create-dialog" role="dialog" aria-modal="true" aria-label="创建班级" onSubmit={save}>
      <h2>创建班级</h2><p>为这个班单独记录教学进度和课堂反馈。</p>
      <label className="wb-field"><span className="wb-label">班级名称</span>
        <input className="wb-input" aria-label="班级名称" placeholder="例如：高一（1）班" value={scene.name} disabled={busy || submit.status === 'unconfirmed'}
          onChange={event => { patchScene({ name: event.target.value }); setLocalError(null); }} /></label>
      {(localError || submit.status === 'failed') && <p className="c-field-error" role="alert">{localError || submit.problem?.message || '创建失败，请重试'}</p>}
      {submit.status === 'unconfirmed' && <p className="c-field-error" role="status">暂时无法确认是否创建，班级名称已保留。</p>}
      <div className="wb-dialog-actions"><button type="button" className="wb-button" disabled={busy} onClick={onClose}>取消</button>
        <button type="submit" className="wb-button is-primary" name="create-class" disabled={busy}>{busy ? '创建中…' : submit.status === 'unconfirmed' ? '重试确认' : '创建班级'}</button></div>
    </form>
  </div>;
}
