import { useRef, useState } from 'react';
import { tx } from '../../i18n/presentation.js';

/** One open form owns one submission, including the read after a confirmed write.
 * The HTTP adapter continues to own unknown writes and their original keys.
 * A failed read retains the saved identity/version; completing releases it for
 * the next student. This session deliberately lasts only as long as the form. */
export function useClassroomSubmission({ api, collection, initial, reload }) {
  const confirmed = useRef(null);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(body, complete) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    let reading = false;
    try {
      const signature = JSON.stringify(body);
      if (confirmed.current?.signature !== signature) {
        const target = confirmed.current?.saved || initial;
        const saved = target
          ? await api.put(`/${collection}/${target.id}`, { baseVersion: target.version, ...body })
          : await api.post(`/${collection}`, body);
        confirmed.current = { saved, signature };
      }
      reading = true;
      await reload({ propagate: true });
      complete(confirmed.current.saved);
      confirmed.current = null;
    } catch (err) {
      setError(reading ? tx('班级暂时无法读取') : err.message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, submit };
}
