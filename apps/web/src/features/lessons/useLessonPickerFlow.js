/**
 * In-lesson picking flow (U5): save the draft, keep the target and selection in
 * the scene, add the batch through the normal save lifecycle, and handle a target
 * that changed on the server without ever discarding the teacher's input silently.
 */

import { useEffect, useState } from 'react';
import { addReferences, newReference } from './model.js';

export function useLessonPickerFlow({ savable, scene, patchScene, isNew, navigate }) {
  const [entering, setEntering] = useState(false);
  const [problem, setProblem] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [targetGone, setTargetGone] = useState(false);
  const [conflict, setConflict] = useState(false);

  // While the lesson is still loading there is no id to compare with; showing the
  // restored picker instead of flashing the editor is the honest choice.
  const currentLessonId = savable.baseline?.id ?? null;
  const picker = scene.picker && (currentLessonId === null || scene.picker.lessonId === currentLessonId)
    ? scene.picker
    : null;

  const saveStatus = savable.status;

  // The batch is committed through the normal save lifecycle; its outcome is read
  // from the fresh status instead of a stale closure.
  useEffect(() => {
    if (!pendingConfirm) return;
    if (saveStatus === 'saved' || saveStatus === 'clean') {
      setPendingConfirm(false);
      setProblem(null);
      patchScene({ picker: null });
      return;
    }
    if (['conflict', 'failed', 'unconfirmed', 'deleted', 'identity'].includes(saveStatus)) {
      setPendingConfirm(false);
      setProblem(savable.problem);
      setConflict(saveStatus === 'conflict');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConfirm, saveStatus, patchScene]);

  async function enter(target) {
    setProblem(null);
    setTargetGone(false);
    setConflict(false);
    if (savable.pending) {
      setProblem({ message: '先确认上一次保存结果，再进入取题' });
      return;
    }
    setEntering(true);
    let lessonId = savable.baseline?.id || null;
    if (isNew || saveStatus === 'dirty' || saveStatus === 'failed') {
      const saved = await savable.save();
      if (!saved) {
        setEntering(false);
        setProblem({ message: '当前备课未能保存，先处理保存问题再取题' });
        return;
      }
      lessonId = saved.id;
    }
    setEntering(false);
    if (!lessonId) return;
    patchScene({ picker: { lessonId, target, selected: [] } });
    if (isNew) navigate(`/lessons/${lessonId}`, { replace: true });
  }

  function confirm(items) {
    if (!picker) return;
    const byId = new Map(items.map((item) => [item.id, item]));
    const references = picker.selected
      .map((questionId) => byId.get(questionId))
      .filter(Boolean)
      .map((question) => newReference(question));
    if (references.length === 0) {
      patchScene({ picker: null });
      return;
    }
    const nextInput = addReferences(savable.input, picker.target, references);
    setPendingConfirm(true);
    savable.save({ input: nextInput });
  }

  /** Take the server version after an explicit confirmation, then re-check the target. */
  async function takeServerVersion() {
    const target = picker?.target;
    setConflict(false);
    const adopted = await savable.adoptServer();
    if (!adopted || !target) return;
    if (target.type === 'section'
      && !(adopted.sections || []).some((section) => section.id === target.sectionId)) {
      setTargetGone(true);
    }
  }

  return {
    picker,
    entering,
    problem,
    conflict,
    targetGone,
    enter,
    confirm,
    takeServerVersion,
    cancel: () => patchScene({ picker: null }),
    moveToMaterials: () => {
      setTargetGone(false);
      patchScene({ picker: { ...picker, target: { type: 'materials', sectionId: null } } });
    },
    dismissTargetGone: () => {
      setTargetGone(false);
      patchScene({ picker: null });
    },
    setSelection: (selected) => patchScene((current) => ({ picker: { ...current.picker, selected } })),
    dismissConflict: () => setConflict(false),
    startConfirm: () => setPendingConfirm(false)
  };
}
