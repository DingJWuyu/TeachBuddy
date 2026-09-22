/**
 * One-shot idempotent operation (delete, restore, add reference).
 *
 * The contract treats an unknown result as unconfirmed: the original key and
 * body are kept, persisted for this account, and the only offered action is to
 * resend exactly that request.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { newRequestKey } from './uuid.js';
import { readLocal, removeLocal, writeLocal } from './storage.js';
import { unconfirmedProblem } from './problems.js';

export function useIdempotentSubmit({ accountKey, name } = {}) {
  const [state, setState] = useState(() => {
    const stored = accountKey && name ? readLocal(accountKey, name) : null;
    return stored
      ? {
        status: 'unconfirmed',
        problem: unconfirmedProblem('上次操作的结果未确认，请重试确认'),
        pending: stored,
        result: null
      }
      : { status: 'idle', problem: null, pending: null, result: null };
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const seqRef = useRef(0);

  useEffect(() => {
    if (!accountKey || !name) return;
    if (state.pending) writeLocal(accountKey, name, state.pending);
    else removeLocal(accountKey, name);
  }, [accountKey, name, state.pending]);

  const submit = useCallback(async (run, payload) => {
    const current = stateRef.current;
    if (current.status === 'running') return null;
    if (current.pending) return null;
    const pending = { key: newRequestKey(), payload };
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setState({ status: 'running', problem: null, pending, result: null });
    try {
      const result = await run({ key: pending.key, payload });
      if (seq !== seqRef.current) return null;
      setState({ status: 'done', problem: null, pending: null, result });
      return result;
    } catch (error) {
      if (seq !== seqRef.current) return null;
      const problem = error.problem || unconfirmedProblem('操作结果未确认');
      if (problem.kind === 'unconfirmed') {
        setState({ status: 'unconfirmed', problem, pending, result: null });
      } else {
        setState({ status: 'failed', problem, pending: null, result: null });
      }
      return null;
    }
  }, []);

  const retry = useCallback(async (run) => {
    const pending = stateRef.current.pending;
    if (!pending) return null;
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setState((current) => ({ ...current, status: 'running' }));
    try {
      const result = await run({ key: pending.key, payload: pending.payload });
      if (seq !== seqRef.current) return null;
      setState({ status: 'done', problem: null, pending: null, result });
      return result;
    } catch (error) {
      if (seq !== seqRef.current) return null;
      const problem = error.problem || unconfirmedProblem('操作结果未确认');
      setState((current) => ({
        ...current,
        status: problem.kind === 'unconfirmed' ? 'unconfirmed' : 'failed',
        problem,
        pending: problem.kind === 'unconfirmed' ? pending : null
      }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    seqRef.current += 1;
    setState({ status: 'idle', problem: null, pending: null, result: null });
  }, []);

  return { ...state, submit, retry, reset, isRunning: state.status === 'running' };
}
