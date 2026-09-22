/**
 * Questions module page: 找题 pane plus the current question pane, draft entry,
 * selection and the 加入备课 flow. Both panes stay mounted so the list keeps its
 * scroll while the teacher moves between questions.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { useScene } from '../workbench/useScene.js';
import { listLocalNames, readLocal } from '../workbench/storage.js';
import { navigate } from '../workbench/routes.js';
import { Icon } from '../workbench/icons.jsx';
import { listQuestions } from './api.js';
import { QuestionList } from './QuestionList.jsx';
import QuestionDetail from './QuestionDetail.jsx';
import { AddToLessonDialog } from './AddToLessonDialog.jsx';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function questionDrafts(accountKey) {
  return listLocalNames(accountKey)
    .filter((name) => name.startsWith('draft:question:'))
    .map((name) => name.slice('draft:question:'.length))
    .filter((draftId) => !UUID.test(draftId))
    .map((draftId) => {
      const record = readLocal(accountKey, `draft:question:${draftId}`);
      const label = draftId === 'new-paste'
        ? '收录文字草稿'
        : draftId.startsWith('copy-') ? '改编草稿' : '自建题目草稿';
      return { id: draftId, label, savedAt: record?.savedAt || 0 };
    })
    .sort((left, right) => right.savedAt - left.savedAt);
}

export default function QuestionsPage({ route }) {
  const shell = useWorkbenchShell();
  const [scene, patchScene] = useScene(shell.accountKey, 'questions', {
    q: '',
    state: 'active',
    starred: false,
    selected: [],
    editMode: false,
    listScrollTop: 0
  });
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [drafts, setDrafts] = useState(() => questionDrafts(shell.accountKey));
  const [addQuestions, setAddQuestions] = useState(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setStatus('loading');
    listQuestions({ q: scene.q, state: scene.state, starred: scene.starred ? true : undefined })
      .then((rows) => {
        if (seq !== seqRef.current) return;
        setItems(rows);
        setError(null);
        setStatus('ready');
      })
      .catch((problem) => {
        if (seq !== seqRef.current) return;
        setError(problem.problem || { message: '读取失败' });
        setStatus('error');
      });
  }, [scene.q, scene.state, scene.starred, reloadToken, shell.generation]);

  useEffect(() => {
    setDrafts(questionDrafts(shell.accountKey));
  }, [shell.accountKey, route.name, route.id, reloadToken]);

  const selectedQuestions = scene.selected
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const listHeaderActions = (
    <div className="wb-head-actions">
      <button type="button" className="wb-button" name="new-manual" onClick={() => navigate('/questions/new-manual')}>
        <Icon name="plus" size={15} />
        自建
      </button>
      <button type="button" className="wb-button" name="new-paste" onClick={() => navigate('/questions/new-paste')}>
        <Icon name="copy" size={15} />
        收录文字
      </button>
    </div>
  );

  const selectionBar = scene.selected.length > 0 && (
    <div className="wb-selection-bar" data-region="selection">
      <span>已选 {scene.selected.length} 题（按选择顺序）</span>
      <button
        type="button"
        className="wb-button is-primary"
        name="add-to-lesson"
        disabled={selectedQuestions.length === 0}
        onClick={() => setAddQuestions(selectedQuestions)}
      >
        加入备课
      </button>
      <button type="button" className="wb-button" name="clear-selection" onClick={() => patchScene({ selected: [] })}>
        清除选择
      </button>
    </div>
  );

  const narrow = shell.narrow;
  const showDetail = route.name === 'question';

  return (
    <div
      className="wb-split"
      data-region="questions"
      data-view={narrow && showDetail ? 'detail' : 'list'}
    >
      <QuestionList
        items={items}
        status={status}
        error={error}
        query={scene.q}
        state={scene.state}
        starred={scene.starred}
        drafts={drafts}
        selected={scene.selected}
        headerActions={listHeaderActions}
        onQueryChange={(q) => patchScene({ q })}
        onStateChange={(state) => patchScene({ state })}
        onStarredChange={(starred) => patchScene({ starred })}
        onToggleSelect={(id) => patchScene((current) => ({
          selected: current.selected.includes(id)
            ? current.selected.filter((item) => item !== id)
            : [...current.selected, id]
        }))}
        onOpen={(id) => navigate(`/questions/${id}`)}
        onOpenDraft={(draft) => navigate(`/questions/${draft.id}`)}
        onRetry={refresh}
        scrollTop={scene.listScrollTop || 0}
        onScrollTop={(top) => patchScene({ listScrollTop: top })}
      />

      <section className={`wb-content-pane${showDetail ? '' : ' is-empty'}`} data-region="question-pane">
        {narrow && showDetail && (
          <div className="wb-picker-head" data-region="detail-back">
            <button type="button" className="wb-button" name="back-to-list" onClick={() => navigate('/questions')}>
              <Icon name="back" size={15} />
              返回列表
            </button>
          </div>
        )}
        {showDetail ? (
          <QuestionDetail
            key={route.id}
            id={route.id}
            onChanged={refresh}
            onAddToLesson={(questions) => setAddQuestions(questions)}
          />
        ) : (
          <div className="wb-content-empty" data-region="question-empty">
            <p className="wb-empty-note">从左侧选择题目，或自建、收录一道题</p>
          </div>
        )}
        {selectionBar}
      </section>

      {addQuestions && (
        <AddToLessonDialog
          accountKey={shell.accountKey}
          questions={addQuestions}
          onClose={() => setAddQuestions(null)}
          onDone={() => {
            patchScene({ selected: [] });
            refresh();
          }}
        />
      )}
    </div>
  );
}
