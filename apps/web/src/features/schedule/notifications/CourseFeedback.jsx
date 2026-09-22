/** Record creation and schedule linking are two separate confirmed saves. */
import { useState } from 'react';
import { RecordComposer } from '../../classes/index.jsx';
import { useWorkbenchShell } from '../../workbench/shellContext.js';
import { useScene } from '../../workbench/useScene.js';
import { useIdempotentSubmit } from '../../workbench/useIdempotentSubmit.js';
import { navigate } from '../../workbench/routes.js';
import * as api from '../api.js';

export default function CourseFeedback({ entryId, originDate, course, timeZone, onLinked }) {
  const shell = useWorkbenchShell();
  const name = `course-feedback:${entryId}:${originDate ?? ''}`;
  const [scene, patch] = useScene(shell.accountKey, name, { record: null, linked: false });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const submit = useIdempotentSubmit({ accountKey: shell.accountKey, name: `pending:${name}` });
  const run = ({ key, payload }) => payload.originDate
    ? api.setException({ key, id: entryId, originDate: payload.originDate, payload: payload.body })
    : api.updateEntry({ key, id: entryId, payload: payload.body });
  async function link(record = scene.record) {
    setError(null);
    try {
      let result;
      if (submit.pending) result = await submit.retry(run);
      else {
        const entry = await api.getEntry(entryId);
        const occurrence = await api.getOccurrence(entryId, originDate);
        const content = originDate ? occurrence : entry;
        if (content.course.classId !== record.classId) throw new Error('安排班级已改变，请在安排中重新选择记录');
        const body = Object.fromEntries(['title', 'items', 'time', 'course', 'reminder'].map(key => [key, content[key]]));
        body.course = { ...content.course, recordIds: [...new Set([...content.course.recordIds, record.id])] };
        const payload = originDate
          ? { expectedVersion: entry.version, mode: 'override', content: body }
          : { ...body, repeat: entry.repeat, expectedVersion: entry.version };
        result = await submit.submit(run, { originDate, body: payload });
      }
      if (result) { patch({ linked: true }); onLinked(result); }
    } catch (problem) { setError(problem.message); }
  }
  return <div className="sch-field" data-region="course-feedback">
    {course.recordIds.map(id => <button key={id} type="button" className="wb-text-button"
      onClick={() => navigate(`/classes/${course.classId}/records/${id}`)}>查看实际记录</button>)}
    {!open && !scene.record && <button type="button" className="wb-button" onClick={() => setOpen(true)}>记课后情况</button>}
    {open && !scene.record && <RecordComposer key={name} accountKey={shell.accountKey} classId={course.classId}
      timeZone={timeZone} draftKey={name}
      initialSources={course.lessonId ? [{ kind: 'lesson', id: course.lessonId, label: '本次备课' }] : []}
      onCreated={record => { patch({ record, linked: false }); setOpen(false); }} />}
    {scene.record && <div>
      <p>{scene.linked ? '记录已保存并关联安排' : '记录已保存，尚未关联安排'}</p>
      <button type="button" className="wb-text-button" onClick={() => navigate(`/classes/${scene.record.classId}/records/${scene.record.id}`)}>打开已保存记录</button>
      {!scene.linked && <button type="button" className="wb-button" disabled={submit.isRunning} onClick={() => link()}>
        {submit.problem || error ? '重试关联' : '关联回本次安排'}</button>}
      {scene.linked && <button type="button" className="wb-text-button" onClick={() => { patch({ record: null, linked: false }); setOpen(true); }}>再记一句</button>}
    </div>}
    {(submit.problem || error) && <p role="alert">{error || submit.problem.message}</p>}
  </div>;
}
