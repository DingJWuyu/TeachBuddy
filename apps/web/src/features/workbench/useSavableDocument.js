/**
 * Save lifecycle for one editable workbench object.
 *
 * Contract rules encoded here:
 * - "已保存" only after a matching known 2xx JSON whose id/version equals this
 *   submission, and only while the editor has no newer input.
 * - unknown result (5xx, dropped connection, unknown body) keeps the original
 *   key and body; the next confirmation resends exactly that request.
 * - a late response never touches a newer draft, another object or another
 *   identity generation.
 * - local drafts are a convenience; they are never reported as saved.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { readLocal, removeLocal, writeLocal } from './storage.js';
import { unconfirmedProblem } from './problems.js';
import { keepsDraft, isSettled } from './saveStates.js';
import { newRequestKey } from './uuid.js';

function draftName(kind, draftId) {
  return `draft:${kind}:${draftId}`;
}

function sameInput(left, right) {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (error) {
    return false;
  }
}

const EMPTY_STATE = {
  status: 'loading',
  loadState: 'loading',
  loadError: null,
  input: null,
  baseline: null,
  pending: null,
  problem: null,
  serverObject: null,
  localDraft: false,
  savedAt: null
};

export function useSavableDocument({
  accountKey,
  generation = 0,
  kind,
  draftId,
  mode = 'update',
  enabled = true,
  load,
  create,
  update,
  buildCreate,
  buildUpdate,
  inputFromObject,
  prepareDraft
}) {
  const [state, setState] = useState(EMPTY_STATE);
  const stateRef = useRef(EMPTY_STATE);
  const seqRef = useRef(0);
  const generationRef = useRef(generation);
  const apiRef = useRef({});
  apiRef.current = { load, create, update, buildCreate, buildUpdate, inputFromObject, prepareDraft };

  generationRef.current = generation;

  const commit = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(stateRef.current) : { ...stateRef.current, ...updater };
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  // Load the server object and the local draft, then reconcile the two.
  useEffect(() => {
    if (!enabled || !accountKey || !draftId) {
      commit({ status: 'loading', loadState: 'loading' });
      return undefined;
    }
    let cancelled = false;
    seqRef.current += 1;
    const api = apiRef.current;
    const local = readLocal(accountKey, draftName(kind, draftId));
    commit({ ...EMPTY_STATE, status: 'loading', loadState: 'loading', localDraft: Boolean(local) });

    (async () => {
      let serverObject = null;
      let loadError = null;
      let missing = false;
      if (api.load) {
        try {
          serverObject = await api.load();
        } catch (error) {
          const problem = error.problem || unconfirmedProblem('无法读取服务器内容');
          if (problem.kind === 'not-found') missing = true;
          else loadError = problem;
        }
      }
      if (cancelled) return;

      if (!serverObject) {
        if (loadError) {
          // Keep whatever the teacher typed locally; reading failed, not saving.
          commit({
            status: local?.pending ? 'unconfirmed' : 'dirty',
            loadState: 'error',
            loadError,
            input: local?.input ?? null,
            baseline: null,
            pending: local?.pending ?? null,
            localDraft: Boolean(local)
          });
          return;
        }
        if (missing) {
          commit({ ...EMPTY_STATE, status: 'missing', loadState: 'missing', input: local?.input ?? null });
          return;
        }
        // Fresh draft (create or copy).
        let prepared = { input: null, baseline: null };
        try {
          prepared = (await api.prepareDraft?.()) || prepared;
        } catch (error) {
          const problem = error.problem || unconfirmedProblem('无法准备草稿');
          if (!cancelled) {
            commit({ ...EMPTY_STATE, status: 'failed', loadState: 'ready', problem, input: local?.input ?? null });
          }
          return;
        }
        if (cancelled) return;
        commit({
          status: local?.pending ? 'unconfirmed' : (local?.input ? 'dirty' : 'clean'),
          loadState: 'ready',
          input: local?.input ?? prepared.input,
          baseline: prepared.baseline,
          pending: local?.pending ?? null,
          localDraft: Boolean(local)
        });
        return;
      }

      const serverInput = api.inputFromObject(serverObject);
      if (!local) {
        commit({
          status: 'clean',
          loadState: 'ready',
          input: serverInput,
          baseline: serverObject,
          pending: null,
          localDraft: false
        });
        return;
      }

      const localVersion = local.baselineVersion ?? null;
      const serverVersion = serverObject.version ?? null;
      const versionMoved = localVersion !== null && localVersion !== serverVersion;
      if (local.pending) {
        commit({
          status: versionMoved ? 'conflict' : 'unconfirmed',
          loadState: 'ready',
          input: local.input,
          baseline: versionMoved ? serverObject : { ...serverObject, version: localVersion },
          pending: local.pending,
          problem: versionMoved
            ? { kind: 'conflict', currentVersion: serverVersion, message: '内容已在别处修改' }
            : null,
          localDraft: true
        });
        return;
      }
      if (versionMoved) {
        commit({
          status: 'conflict',
          loadState: 'ready',
          input: local.input,
          baseline: serverObject,
          pending: null,
          problem: { kind: 'conflict', currentVersion: serverVersion, message: '内容已在别处修改' },
          localDraft: true
        });
        return;
      }
      const keptInput = local.input ?? serverInput;
      commit({
        status: sameInput(keptInput, serverInput) ? 'clean' : 'dirty',
        loadState: 'ready',
        input: keptInput,
        baseline: serverObject,
        serverObject,
        pending: null,
        localDraft: !sameInput(keptInput, serverInput)
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [accountKey, enabled, kind, draftId, generation, commit]);

  // Persist the draft, or drop it once the server confirmed the current input.
  useEffect(() => {
    if (!enabled || !accountKey || !draftId || !state.input) return;
    const name = draftName(kind, draftId);
    if (state.pending || keepsDraft(state.status)) {
      const stored = writeLocal(accountKey, name, {
        input: state.input,
        baselineId: state.baseline?.id ?? null,
        baselineVersion: state.baseline?.version ?? null,
        pending: state.pending,
        status: state.status,
        savedAt: state.savedAt
      });
      if (stored !== state.localDraft) commit({ localDraft: stored });
    } else if (isSettled(state.status)) {
      removeLocal(accountKey, name);
      if (state.localDraft) commit({ localDraft: false });
    }
  }, [accountKey, commit, draftId, enabled, kind, state.baseline, state.input, state.localDraft, state.pending, state.savedAt, state.status]);

  const setInput = useCallback((updater) => {
    commit((current) => {
      if (current.status === 'saving') {
        // New input is a later submission; it must not be marked as saved.
        return { ...current, input: typeof updater === 'function' ? updater(current.input) : updater, status: 'saving' };
      }
      const nextInput = typeof updater === 'function' ? updater(current.input) : updater;
      if (sameInput(nextInput, current.input)) return current;
      const status = current.status === 'clean' || current.status === 'saved' ? 'dirty' : current.status;
      return { ...current, input: nextInput, status };
    });
  }, [commit]);

  const submit = useCallback(async ({ retry = false, input: inputOverride } = {}) => {
    const current = stateRef.current;
    const nextInput = inputOverride ?? current.input;
    if (!nextInput || !enabled) return null;
    if (current.status === 'saving' || current.status === 'identity') return null;
    if (current.pending && !retry) return null;

    const targetId = mode === 'update' ? (current.baseline?.id ?? null) : null;
    const key = retry && current.pending ? current.pending.key : newRequestKey();
    const payload = retry && current.pending
      ? current.pending.payload
      : (targetId
        ? apiRef.current.buildUpdate(nextInput, current.baseline)
        : apiRef.current.buildCreate(nextInput, current.baseline));
    const submittedInput = nextInput;
    const seq = seqRef.current + 1;
    seqRef.current = seq;

    commit({
      status: 'saving',
      input: nextInput,
      problem: null,
      pending: {
        key,
        id: targetId,
        payload,
        submittedInput,
        createdAt: Date.now()
      }
    });

    try {
      const result = targetId
        ? await apiRef.current.update({ key, id: targetId, payload })
        : await apiRef.current.create({ key, payload });
      // A late response never touches newer input, another object or a newer identity.
      if (seq !== seqRef.current || generationRef.current !== generation) return null;
      if (retry && targetId && apiRef.current.load) {
        // A confirmed replay proves the old submission landed; the object may
        // have moved since, and the newer read must not be downgraded.
        try {
          const current = await apiRef.current.load();
          if (seq !== seqRef.current || generationRef.current !== generation) return null;
          if (current.version !== result.version) {
            commit((latest) => ({
              ...latest,
              status: 'conflict',
              baseline: current,
              pending: null,
              problem: {
                kind: 'conflict',
                currentVersion: current.version,
                message: `保存已确认，但服务器上还有更新的版本 ${current.version}`
              },
              savedAt: Date.now()
            }));
            return result;
          }
        } catch (error) {
          // Reading back failed; the confirmed replay still stands as the baseline.
        }
      }
      const unchanged = sameInput(stateRef.current.input, submittedInput);
      commit((latest) => ({
        ...latest,
        status: unchanged ? 'saved' : 'dirty',
        baseline: result,
        // The confirmed input is re-derived from the server object so the editor
        // shows exactly what was stored (server-built snapshots included).
        input: unchanged ? apiRef.current.inputFromObject(result) : latest.input,
        pending: null,
        problem: null,
        savedAt: Date.now(),
        localDraft: !unchanged
      }));
      return result;
    } catch (error) {
      if (seq !== seqRef.current || generationRef.current !== generation) return null;
      const problem = error.problem || unconfirmedProblem('保存失败');
      if (problem.kind === 'unconfirmed') {
        commit({ status: 'unconfirmed', problem });
      } else if (problem.kind === 'conflict') {
        commit({ status: 'conflict', problem });
        // "查看服务器版本" must show what is actually on the server now.
        if (apiRef.current.load) {
          apiRef.current.load()
            .then((object) => {
              if (seq !== seqRef.current || generationRef.current !== generation) return;
              commit((latest) => (latest.status === 'conflict' ? { ...latest, serverObject: object } : latest));
            })
            .catch(() => {});
        }
      } else if (problem.kind === 'identity') {
        commit({ status: 'identity', problem });
      } else if (problem.kind === 'deleted') {
        commit({ status: 'deleted', problem, pending: null });
      } else {
        commit({ status: 'failed', problem, pending: null });
      }
      return null;
    }
  }, [commit, enabled, generation]);

  /** Re-read the server object and adopt it, dropping the local draft. */
  const adoptServer = useCallback(async () => {
    if (!apiRef.current.load) return null;
    try {
      const object = await apiRef.current.load();
      const seq = seqRef.current + 1;
      seqRef.current = seq;
      commit({
        status: 'clean',
        loadState: 'ready',
        loadError: null,
        input: apiRef.current.inputFromObject(object),
        baseline: object,
        pending: null,
        problem: null,
        localDraft: false
      });
      return object;
    } catch (error) {
      const problem = error.problem || unconfirmedProblem('无法读取服务器内容');
      commit({ loadState: 'error', loadError: problem });
      return null;
    }
  }, [commit]);

  /** Explicit "放弃草稿": back to the last server-confirmed input. */
  const discardDraft = useCallback(() => {
    const current = stateRef.current;
    if (current.pending) return false;
    if (!current.baseline) return false;
    commit({
      status: 'clean',
      input: apiRef.current.inputFromObject(current.baseline),
      problem: null,
      localDraft: false
    });
    return true;
  }, [commit]);

  return {
    ...state,
    setInput,
    save: submit,
    retryConfirm: () => submit({ retry: true }),
    adoptServer,
    discardDraft,
    isSaving: state.status === 'saving'
  };
}
