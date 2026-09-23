import { useRef, useState } from 'react';
import { useWorkbenchShell } from '../workbench/shellContext.js';
import { useIdempotentSubmit } from '../workbench/useIdempotentSubmit.js';
import { workbenchGet, workbenchPut, WorkbenchError } from '../workbench/apiClient.js';
import { unexpectedSuccessProblem } from '../workbench/problems.js';

export function useLessonOrder(onSaved) {
  const { accountKey } = useWorkbenchShell();
  const submit = useIdempotentSubmit({ accountKey, name: 'pending:lesson-order' });
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function send({ key, payload }) {
    const { body } = await workbenchPut('/api/modules/lessons/v3/order', payload, key);
    if (body?.version !== payload.baseVersion + 1 || JSON.stringify(body.lessonIds) !== JSON.stringify(payload.lessonIds)) throw new WorkbenchError(unexpectedSuccessProblem('排序结果无法确认'));
    return body;
  }
  async function move(id, neighborId) {
    if (busy.current || submit.pending) return;
    busy.current = true;
    setReading(true); setError('');
    try {
      const { body } = await workbenchGet('/api/modules/lessons/v3/order');
      const ids = [...body.lessonIds];
      const from = ids.indexOf(id), to = ids.indexOf(neighborId);
      if (from < 0 || to < 0) throw new Error('列表已变化，请刷新后重试');
      [ids[from], ids[to]] = [ids[to], ids[from]];
      if (await submit.submit(send, { baseVersion: body.version, lessonIds: ids })) onSaved();
    } catch (problem) { setError(problem.message || '无法读取课题顺序，请重试'); }
    finally { busy.current = false; setReading(false); }
  }
  return { move, busy: reading || submit.isRunning || Boolean(submit.pending),
    feedback: (error || submit.problem || submit.pending) && <div className="wb-inline-error" role="alert">
      {error || submit.problem?.message}
      {submit.pending && <button className="wb-button" disabled={submit.isRunning} onClick={async () => { if (await submit.retry(send)) onSaved(); }}>重试确认排序</button>}
    </div> };
}

export function LessonOrderButtons({ item, index, items, order }) {
  return <span className="wb-lesson-order-buttons">
    <button type="button" className="wb-icon-button" aria-label={`上移课题 ${item.title}`} disabled={order.busy || index === 0} onClick={() => order.move(item.id, items[index - 1].id)}>↑</button>
    <button type="button" className="wb-icon-button" aria-label={`下移课题 ${item.title}`} disabled={order.busy || index === items.length - 1} onClick={() => order.move(item.id, items[index + 1].id)}>↓</button>
  </span>;
}
