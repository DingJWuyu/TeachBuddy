import { deviceRequestStore, clearDeviceRequestAccount } from '../../../platform/device/deviceRequestStore.js';
import { isDeletedAccount } from '../../../platform/device/storage.js';
import { sendHttpRequest } from '../../../platform/http/request.js';
import { seedQuestions, seedSchedule, seedResources, seedMath } from './workspace.js';
import { seedClassroom } from './classroom.js';

/** A user-triggered sample load is a resumable sequence of ordinary API writes.
 * Each step owns one persisted body/key and its confirmed object ID. */
export async function seedSampleWeek({ accountKey, transport, signal }) {
  const storageKey = `teachbuddy:agent:${accountKey}:sample-week:v1`;
  let journal = JSON.parse(localStorage.getItem(storageKey) || 'null') ?? { day: new Date().toISOString().slice(0, 10), ids: {}, steps: {} };
  function persist(next) {
    signal?.throwIfAborted();
    if (isDeletedAccount(accountKey)) throw new Error('Account unavailable');
    localStorage.setItem(storageKey, JSON.stringify(next)); journal = next;
  }
  persist(journal);
  const id = name => {
    if (!journal.ids[name]) persist({ ...journal, ids: { ...journal.ids, [name]: crypto.randomUUID() } });
    return journal.ids[name];
  };
  async function get(path) {
    const response = await sendHttpRequest(transport, path, { signal, timeoutMs: 20000 });
    const value = await response.json();
    if (!response.ok) throw Object.assign(new Error(value.detail || 'Sample read failed'), { problem: value });
    return value;
  }
  async function write(step, method, path, input) {
    const saved = journal.steps[step];
    if (saved?.result) return saved.result;
    const binary = input instanceof FormData;
    let pending = saved;
    const binaryOptions = { database: 'teachbuddy-sample-week', storeName: 'requests', account: accountKey, name: `pending:sample-week:${step}` };
    if (!pending) {
      pending = { key: crypto.randomUUID(), method, path, ...(binary ? { binary: true } : { body: input }) };
      if (binary) await deviceRequestStore({ ...binaryOptions, action: 'put', value: { key: pending.key, file: input.get('file') } });
      persist({ ...journal, steps: { ...journal.steps, [step]: pending } });
    }
    let body;
    if (pending.binary) {
      const original = await deviceRequestStore(binaryOptions);
      if (!original?.file) throw new Error('Sample upload bytes unavailable');
      body = new FormData(); body.append('file', original.file, original.file.name);
    } else body = JSON.stringify(pending.body);
    const response = await sendHttpRequest(transport, pending.path, { method: pending.method, signal, timeoutMs: 60000,
      headers: { 'Idempotency-Key': pending.key, ...(pending.binary ? {} : { 'Content-Type': 'application/json' }) }, body });
    const value = await response.json();
    if (!response.ok) {
      // A declared rejection did not commit this step; an unknown result retains it.
      if (response.status >= 400 && response.status < 500 && response.status !== 401) {
        const steps = { ...journal.steps }; delete steps[step]; persist({ ...journal, steps });
        if (pending.binary) await deviceRequestStore({ ...binaryOptions, action: 'delete' });
      }
      throw Object.assign(new Error(value.detail || 'Sample write failed'), { problem: value });
    }
    const result = { id: value.id, version: value.version, ...(value.questions ? { questions: value.questions } : {}) };
    persist({ ...journal, steps: { ...journal.steps, [step]: { ...pending, result } } });
    if (pending.binary) await deviceRequestStore({ ...binaryOptions, action: 'delete' });
    return result;
  }
  const job = { get, write, id, day: journal.day };
  await seedQuestions(job); await seedSchedule(job); await seedResources(job); await seedMath(job); await seedClassroom(job);
  persist({ ...journal, complete: true });
}

export const clearSampleWeekDeviceData = account => clearDeviceRequestAccount({ database: 'teachbuddy-sample-week', storeName: 'requests', account });
