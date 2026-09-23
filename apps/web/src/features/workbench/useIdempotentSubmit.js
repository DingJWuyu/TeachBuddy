import { useCallback, useEffect, useRef, useState } from 'react';
import { newRequestKey } from './uuid.js';
import { readLocal, removeLocal, writeLocal } from './storage.js';
import { unconfirmedProblem } from './problems.js';

const idle = () => ({ status: 'idle', problem: null, pending: null, result: null });
function restore(accountKey, name) {
  const pending = accountKey && name ? readLocal(accountKey, name) : null;
  return pending ? { status: 'unconfirmed', problem: unconfirmedProblem('上次操作的结果未确认，请重试确认'), pending, result: null } : idle();
}
/** Persist the exact operation before the network call, including immediate
 * navigation. A response after unmount leaves the request available to confirm. */
export function useIdempotentSubmit({ accountKey, name } = {}) {
  const [state, setState] = useState(() => restore(accountKey, name));
  const stateRef = useRef(state);
  const seqRef = useRef(0);
  const commit = useCallback(next => {
    stateRef.current = next;
    if (accountKey && name) {
      if (next.pending) writeLocal(accountKey, name, next.pending);
      else removeLocal(accountKey, name);
    }
    setState(next);
  }, [accountKey, name]);
  useEffect(() => {
    const restored = restore(accountKey, name);
    stateRef.current = restored; setState(restored);
    return () => { seqRef.current += 1; };
  }, [accountKey, name]);
  const perform = useCallback(async (run, pending) => {
    const seq = ++seqRef.current;
    commit({ status: 'running', problem: null, pending, result: null });
    try {
      const result = await run({ key: pending.key, payload: pending.payload });
      if (seq !== seqRef.current) return null;
      commit({ status: 'done', problem: null, pending: null, result });
      return result;
    } catch (error) {
      if (seq !== seqRef.current) return null;
      const problem = error.problem || unconfirmedProblem('操作结果未确认');
      const unknown = ['unconfirmed', 'identity'].includes(problem.kind);
      commit({ status: unknown ? 'unconfirmed' : 'failed', problem, pending: unknown ? pending : null, result: null });
      return null;
    }
  }, [commit]);
  const submit = useCallback((run, payload) => {
    if (stateRef.current.status === 'running' || stateRef.current.pending) return Promise.resolve(null);
    return perform(run, { key: newRequestKey(), payload });
  }, [perform]);
  const retry = useCallback(run => {
    const current = stateRef.current;
    if (current.status === 'running' || !current.pending) return Promise.resolve(null);
    return perform(run, current.pending);
  }, [perform]);
  const reset = useCallback(() => {
    if (stateRef.current.pending) return false;
    seqRef.current += 1; commit(idle()); return true;
  }, [commit]);
  return { ...state, submit, retry, reset, isRunning: state.status === 'running' };
}
