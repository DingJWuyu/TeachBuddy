/**
 * "加入备课" from the question bank: pick an existing lesson or create one, pick
 * the target (a section or 本课材料), then commit one lesson PUT so a batch is
 * atomic. A created lesson is kept if adding fails, so retrying never creates a
 * second lesson.
 */

import { useEffect, useState } from 'react';
import { Icon } from '../workbench/icons.jsx';
import { createLesson, getLesson, listLessons, updateLesson } from '../lessons/api.js';
import { appendReferencesToLesson, targetReferences } from '../lessons/model.js';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { newRequestKey } from '../workbench/uuid.js';
import { excerptFor } from '../workbench/documents.js';

const MATERIALS = { type: 'materials', sectionId: null };

export function AddToLessonDialog({ accountKey, questions, onClose, onDone }) {
  const [lessons, setLessons] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [target, setTarget] = useState(MATERIALS);
  const [creating, setCreating] = useState(false);
  const [skipped, setSkipped] = useState([]);
  const [result, setResult] = useState(null);

  const createSubmit = useIdempotentSubmit({ accountKey, name: 'pending:lesson-create' });
  const addSubmit = useIdempotentSubmit({ accountKey, name: 'pending:add-to-lesson' });

  useEffect(() => {
    let cancelled = false;
    listLessons({ state: 'active' })
      .then((items) => { if (!cancelled) setLessons(items); })
      .catch((error) => { if (!cancelled) setLoadError(error.problem || { message: '无法加载备课列表' }); });
    return () => { cancelled = true; };
  }, []);

  async function openLesson(lessonId) {
    setSelectedLessonId(lessonId);
    setLoadError(null);
    try {
      const full = await getLesson(lessonId);
      setLesson(full);
      setTarget(MATERIALS);
    } catch (error) {
      setLoadError(error.problem || { message: '无法读取备课' });
    }
  }

  /** Which selected questions are new for this position, and which are already there. */
  function planFor(lessonObject, position) {
    const placed = new Set(targetReferences(lessonObject, position).map((reference) => reference.questionId));
    return {
      duplicates: questions.filter((question) => placed.has(question.id)),
      inputs: questions
        .filter((question) => !placed.has(question.id))
        .map((question) => ({
          id: newRequestKey(),
          questionId: question.id,
          questionVersion: question.version,
          note: ''
        }))
    };
  }

  async function addTo(lessonObject, position) {
    const plan = planFor(lessonObject, position);
    setSkipped(plan.duplicates);
    if (plan.inputs.length === 0) {
      setResult(lessonObject);
      onDone?.(lessonObject);
      return;
    }
    const payload = addSubmit.pending?.payload
      ?? appendReferencesToLesson(lessonObject, position, plan.inputs);
    if (!payload) {
      setLoadError({ message: '目标环节已不存在' });
      return;
    }
    const saved = await addSubmit.submit(
      ({ key, payload: body }) => updateLesson({ key, id: lessonObject.id, payload: body }),
      payload
    );
    if (saved) {
      setResult(saved);
      onDone?.(saved);
    }
  }

  /** Create the target lesson once; an add failure after this never creates it again. */
  async function createTargetLesson() {
    if (!newTitle.trim()) return null;
    setCreating(true);
    const created = await createSubmit.submit(
      ({ key, payload }) => createLesson({ key, payload }),
      { title: newTitle.trim(), intro: { version: 1, blocks: [] }, sections: [], materials: [] }
    );
    setCreating(false);
    if (created) {
      setLesson(created);
      setSelectedLessonId(created.id);
    }
    return created;
  }

  async function handleConfirm() {
    setSkipped([]);
    const existing = lesson;
    const targetLesson = existing ?? await createTargetLesson();
    if (!targetLesson) return;
    await addTo(targetLesson, existing ? target : MATERIALS);
  }

  const busy = createSubmit.isRunning || addSubmit.isRunning || creating;
  const problem = addSubmit.problem || createSubmit.problem || loadError;
  const targetLabel = target.type === 'materials'
    ? '本课材料'
    : (lesson?.sections || []).find((section) => section.id === target.sectionId)?.title || '环节';

  return (
    <div className="wb-dialog-host" data-overlay="dialog">
      <div className="wb-dialog-scrim" onClick={onClose} role="presentation" />
      <div className="wb-dialog wb-add-dialog" role="dialog" aria-modal="true" aria-label="加入备课">
        <header className="wb-dialog-head">
          <h2>加入备课</h2>
          <button type="button" className="wb-icon-button" aria-label="关闭" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        {result ? (
          <div className="wb-add-result" data-region="add-result">
            <p>已加入「{result.title}」 · {targetLabel}</p>
            {skipped.length > 0 && (
              <p className="wb-muted" data-region="add-skipped">
                已在此处，跳过：{skipped.map((item) => excerptFor(item.title, item.body, 16)).join('、')}
              </p>
            )}
            <div className="wb-dialog-actions">
              <a className="wb-button" href={`/lessons/${result.id}`}>前往备课</a>
              <button type="button" className="wb-button is-primary" onClick={onClose}>留在题库</button>
            </div>
          </div>
        ) : (
          <>
            <div className="wb-dialog-section">
              <h3>目标备课</h3>
              {lessons.length > 0 && (
                <ul className="wb-choice-list" data-region="lesson-choices">
                  {lessons.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`wb-choice${selectedLessonId === item.id ? ' is-active' : ''}`}
                        aria-pressed={selectedLessonId === item.id}
                        onClick={() => openLesson(item.id)}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="wb-new-lesson">
                <input
                  className="wb-input"
                  aria-label="新备课课题"
                  placeholder="新建备课"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                />
                <button
                  type="button"
                  className="wb-button"
                  disabled={!newTitle.trim() || busy}
                  onClick={createTargetLesson}
                >
                  新建
                </button>
              </div>
            </div>

            {lesson && (
              <div className="wb-dialog-section">
                <h3>目标位置</h3>
                <ul className="wb-choice-list" data-region="target-choices">
                  <li>
                    <button
                      type="button"
                      className={`wb-choice${target.type === 'materials' ? ' is-active' : ''}`}
                      aria-pressed={target.type === 'materials'}
                      onClick={() => setTarget(MATERIALS)}
                    >
                      本课材料
                    </button>
                  </li>
                  {(lesson.sections || []).map((section) => (
                    <li key={section.id}>
                      <button
                        type="button"
                        className={`wb-choice${target.sectionId === section.id ? ' is-active' : ''}`}
                        aria-pressed={target.sectionId === section.id}
                        onClick={() => setTarget({ type: 'section', sectionId: section.id })}
                      >
                        {section.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {problem && <p className="wb-inline-error" data-region="add-problem">{problem.message}</p>}

            <div className="wb-dialog-actions">
              {addSubmit.pending || createSubmit.pending ? (
                <button
                  type="button"
                  className="wb-button is-primary"
                  onClick={async () => {
                    if (createSubmit.pending) {
                      const created = await createSubmit.retry(({ key, payload }) => createLesson({ key, payload }));
                      if (created) {
                        setLesson(created);
                        setSelectedLessonId(created.id);
                      }
                      return;
                    }
                    await addSubmit.retry(({ key, payload }) => updateLesson({ key, id: lesson.id, payload }));
                  }}
                >
                  重试确认
                </button>
              ) : (
                <button
                  type="button"
                  className="wb-button is-primary"
                  name="confirm-add"
                  disabled={busy || (!lesson && !newTitle.trim())}
                  onClick={handleConfirm}
                >
                  {busy ? '正在加入…' : '加入'}
                </button>
              )}
              <button type="button" className="wb-button" onClick={onClose}>取消</button>
            </div>
            <p className="wb-muted" data-region="add-count">已选 {questions.length} 题，将按选择顺序加入</p>
          </>
        )}
      </div>
    </div>
  );
}
