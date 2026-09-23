/** Lessons module entry: my lessons list, drafts and the lesson route. */

import { useEffect, useRef, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';
import { listLocalNames } from '../workbench/storage.js';
import { navigate } from '../workbench/routes.js';
import { Icon } from '../workbench/icons.jsx';
import { useScrollRestore } from '../workbench/useScrollRestore.js';
import { listLessons } from './api.js';
import LessonDetail from './LessonDetail.jsx';
import { useLessonOrder, LessonOrderButtons } from './LessonOrder.jsx';

function LessonsIndex() {
  const shell = useWorkbenchShell();
  const [scene, patchScene] = useScene(shell.accountKey, 'lessons', { listQuery: '', listState: 'active' });
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const order = useLessonOrder(() => setReloadToken(token => token + 1));
  const [hasDraft, setHasDraft] = useState(() => listLocalNames(shell.accountKey).includes('draft:lesson:new'));
  const seqRef = useRef(0);
  const scroll = useScrollRestore(scene.listScrollTop || 0, (top) => patchScene({ listScrollTop: top }), items.length);

  useEffect(() => {
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setStatus('loading');
    listLessons({ q: scene.listQuery, state: scene.listState })
      .then((rows) => {
        if (seq !== seqRef.current) return;
        setItems(rows);
        setStatus('ready');
      })
      .catch((problem) => {
        if (seq !== seqRef.current) return;
        setError(problem.problem || { message: '读取失败' });
        setStatus('error');
      });
  }, [scene.listQuery, scene.listState, reloadToken, shell.generation]);

  useEffect(() => {
    setHasDraft(listLocalNames(shell.accountKey).includes('draft:lesson:new'));
  }, [shell.accountKey, reloadToken]);

  return (
    <div className="wb-page wb-lessons-index" data-region="lessons-index">
      <header className="wb-list-head">
        <div className="wb-search">
          <Icon name="search" size={15} />
          <input
            className="wb-input"
            type="search"
            aria-label="搜索备课"
            placeholder="搜索课题或文稿"
            value={scene.listQuery}
            onChange={(event) => patchScene({ listQuery: event.target.value })}
          />
        </div>
        <div className="wb-filters" role="group" aria-label="备课过滤">
          <button
            type="button"
            className={`wb-chip${scene.listState === 'active' ? ' is-active' : ''}`}
            aria-pressed={scene.listState === 'active'}
            onClick={() => patchScene({ listState: 'active' })}
          >
            进行中
          </button>
          <button
            type="button"
            className={`wb-chip${scene.listState === 'deleted' ? ' is-active' : ''}`}
            aria-pressed={scene.listState === 'deleted'}
            onClick={() => patchScene({ listState: 'deleted' })}
          >
            已删除
          </button>
        </div>
        <button type="button" className="wb-button is-primary" name="new-lesson" onClick={() => navigate('/lessons/new')}>
          <Icon name="plus" size={15} />
          新建备课
        </button>
      </header>

      {hasDraft && (
        <div className="wb-draft-list" data-region="lesson-draft">
          <button type="button" className="wb-draft-row" onClick={() => navigate('/lessons/new')}>
            <Icon name="prep" size={15} />
            <span>未命名备课草稿</span>
            <span className="wb-muted">草稿在此设备</span>
          </button>
        </div>
      )}

      {status === 'loading' && <p className="wb-muted">正在加载备课…</p>}
      {order.feedback}
      {status === 'error' && (
        <div className="wb-inline-error" data-region="lessons-error">
          <p>{error?.message}</p>
          <button type="button" className="wb-button" onClick={() => setReloadToken((token) => token + 1)}>重试</button>
        </div>
      )}
      {status === 'ready' && items.length === 0 && (
        <p className="wb-empty-note" data-region="lessons-empty">还没有备课，先新建一份</p>
      )}
      <div className="wb-lessons-scroll" data-region="lessons-scroll" ref={scroll.ref} onScroll={scroll.onScroll}>
        {items.length > 0 && (
        <ul className="wb-card-list" data-region="lesson-rows">
          {items.map((item, index) => (
            <li key={item.id} className="wb-lesson-list-row">
              <button type="button" className="wb-card-row" onClick={() => navigate(`/lessons/${item.id}`)}>
                <span className="wb-card-title">{item.title}</span>
                <span className="wb-row-tags">
                  {item.deletedAt && <span className="wb-tag is-deleted">已删除</span>}
                  <span className="wb-muted">版本 {item.version}</span>
                </span>
              </button>
              <LessonOrderButtons item={item} index={index} items={items} order={order} />
            </li>
          ))}
        </ul>
        )}
      </div>
    </div>
  );
}

export default function LessonsPage({ route }) {
  if (route.name === 'lesson') return <LessonDetail key={route.id} id={route.id} />;
  return <LessonsIndex />;
}
