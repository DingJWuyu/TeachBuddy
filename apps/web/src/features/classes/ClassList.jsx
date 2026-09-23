import { useScene } from '../workbench/useScene.js';
/**
 * Class list pane: the only entry when there is no class yet, the deleted
 * filter for restoring one, and the create form. The list keeps its scroll
 * while the teacher moves between classes.
 */
import { useState } from 'react';
import { ModulePresence } from '../workbench/ModuleMotion.jsx';
import { Icon } from '../workbench/icons.jsx';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { useScrollRestore } from '../workbench/useScrollRestore.js';
import { createClass } from './api.js';

export function ClassList({
  accountKey,
  items,
  status,
  error,
  listState,
  onListStateChange,
  selectedId,
  onSelect,
  onCreated,
  onReload,
  scrollTop,
  onScrollTop
}) {
  const [scene, patchScene] = useScene(accountKey, 'class-create', { creating: false, name: '' });
  const { creating, name } = scene;
  const setCreating = value => patchScene({ creating: value });
  const setName = value => patchScene({ name: value });
  const [localError, setLocalError] = useState(null);
  const submit = useIdempotentSubmit({ accountKey, name: 'pending:class-create' });
  const scroll = useScrollRestore(scrollTop || 0, onScrollTop, items.length);

  async function save() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setLocalError('班级名称不能为空');
      return;
    }
    setLocalError(null);
    const payload = { name };
    const created = await submit.submit(({ key, payload: body }) => createClass({ key, payload: body }), payload);
    if (created) {
      setName('');
      setCreating(false);
      onCreated(created);
    }
  }

  async function retryCreate() {
    const created = await submit.retry(({ key, payload }) => createClass({ key, payload }));
    if (created) {
      setName('');
      setCreating(false);
      onCreated(created);
    }
  }

  return (
    <aside className="wb-list-pane c-class-pane" data-region="class-list">
      <div className="wb-list-head">
        <div className="c-list-toolbar">
          <div className="wb-filters" role="group" aria-label="班级过滤">
            <button
              type="button"
              className={`wb-chip${listState === 'active' ? ' is-active' : ''}`}
              aria-pressed={listState === 'active'}
              onClick={() => onListStateChange('active')}
            >
              我的班级
            </button>
            <button
              type="button"
              className={`wb-chip${listState === 'deleted' ? ' is-active' : ''}`}
              aria-pressed={listState === 'deleted'}
              onClick={() => onListStateChange('deleted')}
            >
              已删除
            </button>
          </div>
          {listState === 'active' && !creating && (
            <button type="button" className="wb-button is-primary" name="new-class" onClick={() => setCreating(true)}>
              <Icon name="plus" size={14} />
              新建
            </button>
          )}
        </div>
        <ModulePresence present={creating} mode="collapse">
        {creating && (
          <div className="c-create-class" data-region="class-create">
            <input
              className="wb-input"
              aria-label="班级名称"
              placeholder="班级名称"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') save();
                if (event.key === 'Escape') {
                  setName('');
                  setCreating(false);
                }
              }}
            />
            <div className="c-create-actions">
              <button type="button" className="wb-button" onClick={() => { setName(''); setCreating(false); }}>取消</button>
              <button
                type="button"
                className="wb-button is-primary"
                name={submit.status === 'unconfirmed' ? 'retry-confirm' : 'create-class'}
                onClick={() => (submit.status === 'unconfirmed' ? retryCreate() : save())}
              >
                {submit.status === 'unconfirmed' ? '重试确认' : '创建'}
              </button>
            </div>
          </div>
        )}
        </ModulePresence>
        {localError && <p className="c-field-error" data-region="class-create-error">{localError}</p>}
        {submit.status === 'unconfirmed' && !creating && (
          <p className="c-field-error">上次新建的结果未确认，可再次重试确认</p>
        )}
        {submit.status === 'failed' && (
          <p className="c-field-error" data-region="class-create-error">{submit.problem?.message || '新建失败'}</p>
        )}
      </div>

      {status === 'loading' && <p className="wb-muted c-pane-note">正在加载班级…</p>}
      {status === 'error' && (
        <div className="wb-inline-error c-pane-note" data-region="classes-error">
          <span>{error?.message || '无法加载班级'}</span>
          <button type="button" className="wb-button" onClick={onReload}>重试</button>
        </div>
      )}
      {status === 'ready' && items.length === 0 && (
        <p className="wb-empty-note c-pane-note" data-region="class-empty">
          {listState === 'deleted' ? '没有已删除的班级' : '还没有班级，先新建一个'}
        </p>
      )}
      <div className="wb-list-scroll c-class-scroll" ref={scroll.ref} onScroll={scroll.onScroll} data-region="class-rows-scroll">
        <ul className="wb-card-list" data-region="class-rows">
          {items.map((classroom) => (
            <li key={classroom.id}>
              <button
                type="button"
                className={`wb-card-row c-class-row${selectedId === classroom.id ? ' is-active' : ''}`}
                data-class-id={classroom.id}
                aria-current={selectedId === classroom.id ? 'true' : undefined}
                onClick={() => onSelect(classroom.id)}
              >
                <span className="wb-card-title">{classroom.name}</span>
                <span className="wb-row-tags">
                  {classroom.deletedAt && <span className="wb-tag is-deleted">已删除</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
