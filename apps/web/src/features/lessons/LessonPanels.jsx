/** Auxiliary panel tools for the lessons module: 我的备课 and 本课大纲. */

import { useEffect, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { Icon } from '../workbench/icons.jsx';
import { navigate } from '../workbench/routes.js';
import { listLessons } from './api.js';
import { useLessonOrder, LessonOrderButtons } from './LessonOrder.jsx';

export function LessonIndex({ currentId }) {
  const shell = useWorkbenchShell();
  const [state, setState] = useState('active');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [revision, setRevision] = useState(0);
  const order = useLessonOrder(() => setRevision(value => value + 1));

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    listLessons({ q: query, state })
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, [query, state, revision, currentId, shell.generation]);

  return (
    <div className="wb-module wb-tool" data-region="lesson-index">
      <div className="wb-search">
        <Icon name="search" size={15} />
        <input
          className="wb-input"
          type="search"
          aria-label="搜索备课"
          placeholder="搜索备课"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="wb-filters" role="group" aria-label="备课过滤">
        <button
          type="button"
          className={`wb-chip${state === 'active' ? ' is-active' : ''}`}
          aria-pressed={state === 'active'}
          onClick={() => setState('active')}
        >
          进行中
        </button>
        <button
          type="button"
          className={`wb-chip${state === 'deleted' ? ' is-active' : ''}`}
          aria-pressed={state === 'deleted'}
          onClick={() => setState('deleted')}
        >
          已删除
        </button>
      </div>
      {status === 'error' && <p className="wb-muted">读取失败</p>}
      {order.feedback}
      {status === 'ready' && items.length === 0 && <p className="wb-empty-note">没有备课</p>}
      <ul className="wb-tool-list" data-region="lesson-index-list">
        {items.map((item, index) => (
          <li key={item.id} className="wb-lesson-list-row">
            <button
              type="button"
              className={`wb-nav-row${currentId === item.id ? ' is-active' : ''}`}
              aria-pressed={currentId === item.id}
              onClick={() => navigate(`/lessons/${item.id}`)}
            >
              <span className="wb-nav-label">{item.title}</span>
              {item.deletedAt && <span className="wb-tag is-deleted">已删除</span>}
            </button>
            <LessonOrderButtons item={item} index={index} items={items} order={order} />
          </li>
        ))}
      </ul>
      <button type="button" className="wb-button" name="new-lesson" onClick={() => navigate('/lessons/new')}>
        新建备课
      </button>
    </div>
  );
}

export function LessonOutline({ input, onFocus, onMove, readOnly = false }) {
  const sections = input.sections || [];
  if (sections.length === 0) {
    return <p className="wb-empty-note" data-region="outline-empty">还没有环节</p>;
  }
  return (
    <ol className="wb-module wb-outline" data-region="lesson-outline">
      {sections.map((section, index) => (
        <li key={section.id}>
          <button type="button" className="wb-outline-row" onClick={() => onFocus(section.id)}>
            <span>{section.title}</span>
          </button>
          <button
            type="button"
            className="wb-icon-button"
            aria-label={`大纲上移 ${section.title}`}
            disabled={readOnly || index === 0}
            onClick={() => onMove(section.id, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="wb-icon-button"
            aria-label={`大纲下移 ${section.title}`}
            disabled={readOnly || index === sections.length - 1}
            onClick={() => onMove(section.id, 1)}
          >
            ↓
          </button>
        </li>
      ))}
    </ol>
  );
}
