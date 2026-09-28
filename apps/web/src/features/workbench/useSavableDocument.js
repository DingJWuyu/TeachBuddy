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
import { useForegroundRefresh } from './useForegroundRefresh.js';
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

// Older drafts stored only the version. Keep that CAS baseline while newer
// drafts retain the exact confirmed object, independently of comparison reads.
function restoreBaseline(local, serverObject = null) {
  if (local?.baseline) return local.baseline;
  if (!serverObject || local?.baselineVersion == null) return null;
  return { ...serverObject, id: local.baselineId ?? serverObject?.id, version: local.baselineVersion };
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
            status: local?.status === 'conflict' ? 'conflict' : local?.pending ? 'unconfirmed' : 'dirty',
            loadState: 'error',
            loadError,
            input: local?.input ?? null,
            baseline: restoreBaseline(local),
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

      const baseline = restoreBaseline(local, serverObject);
      const serverVersion = serverObject.version ?? null;
      const versionMoved = baseline ? baseline.version !== serverVersion : !sameInput(local.input, serverInput);
      // An unresolved conflict remains unresolved even for older drafts whose
      // stored baseline was already advanced by a comparison read.
      const conflict = versionMoved || local.status === 'conflict';
      if (local.pending || conflict) {
        commit({
          status: conflict ? 'conflict' : 'unconfirmed',
          loadState: 'ready',
          input: local.input,
          baseline: baseline ?? serverObject,
          serverObject,
          pending: local.pending ?? null,
          problem: conflict
            ? { kind: 'conflict', currentVersion: serverVersion, message: '内容已在别处修改' }
            : null,
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
      seqRef.current += 1;
    };
  }, [accountKey, enabled, kind, draftId, generation, commit]);

  // Saving may be followed immediately by navigation. Persist the latest state
  // before resolving save(), as the next render/effect may never be mounted.
  const persistDraft = useCallback((current) => {
    if (!enabled || !accountKey || !draftId || !current.input) return;
    const name = draftName(kind, draftId);
    // A legacy draft has no complete object to restore when the read fails.
    // Leave its stored version intact until a successful read can reconcile it.
    if (current.loadState === 'error' && !current.baseline) return;
    if (current.pending || keepsDraft(current.status)) {
      const stored = writeLocal(accountKey, name, {
        input: current.input,
        baseline: current.baseline,
        baselineId: current.baseline?.id ?? null,
        baselineVersion: current.baseline?.version ?? null,
        pending: current.pending,
        status: current.status,
        savedAt: current.savedAt
      });
      if (stored !== current.localDraft) commit({ localDraft: stored });
    } else if (isSettled(current.status)) {
      removeLocal(accountKey, name);
      if (current.localDraft) commit({ localDraft: false });
    }
  }, [accountKey, commit, draftId, enabled, kind]);

  useEffect(() => {
    persistDraft(stateRef.current);
  }, [persistDraft, state]);

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
    persistDraft(stateRef.current);
  }, [commit, persistDraft]);

  const submit = useCallback(async ({ retry = false, input: inputOverride } = {}) => {
    const current = stateRef.current;
    const nextInput = inputOverride ?? current.input;
    if (!nextInput || !enabled || current.loadState !== 'ready') return null;
    if (current.status === 'saving' || current.status === 'identity') return null;
    if (current.pending && !retry) return null;

    const targetId = mode === 'update' ? (current.baseline?.id ?? null) : null;
    const key = retry && current.pending ? current.pending.key : newRequestKey();
    const payload = retry && current.pending
      ? current.pending.payload
      : (targetId
        ? apiRef.current.buildUpdate(nextInput, current.baseline)
        : apiRef.current.buildCreate(nextInput, current.baseline));
    // Replaying an old request confirms its original snapshot, not the draft
    // the teacher may have edited after that request lost its response.
    const submittedInput = retry && current.pending ? current.pending.submittedInput : nextInput;
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
        apiVersion: retry ? current.pending?.apiVersion : (kind === "lesson" ? 3 : undefined),
        createdAt: Date.now()
      }
    });

    persistDraft(stateRef.current);

    try {
      const result = targetId
        ? await apiRef.current.update({ key, id: targetId, payload, version: retry ? current.pending?.apiVersion ?? 2 : 3 })
        : await apiRef.current.create({ key, payload, version: retry ? current.pending?.apiVersion ?? 2 : 3 });
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
              baseline: result,
              serverObject: current,
              pending: null,
              problem: {
                kind: 'conflict',
                currentVersion: current.version,
                message: `保存已确认，但服务器上还有更新的版本 ${current.version}`
              },
              savedAt: Date.now()
            }));
            persistDraft(stateRef.current);
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
        serverObject: null,
        // The confirmed input is re-derived from the server object so the editor
        // shows exactly what was stored (server-built snapshots included).
        input: unchanged ? apiRef.current.inputFromObject(result) : latest.input,
        pending: null,
        problem: null,
        savedAt: Date.now(),
        localDraft: !unchanged
      }));
      persistDraft(stateRef.current);
      return result;
    } catch (error) {
      if (seq !== seqRef.current || generationRef.current !== generation) return null;
      const problem = error.problem || unconfirmedProblem('保存失败');
      if (problem.kind === 'unconfirmed') {
        commit({ status: 'unconfirmed', problem });
      } else if (problem.kind === 'conflict') {
        commit({ status: 'conflict', problem, pending: null });
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
  }, [commit, enabled, generation, kind, mode, persistDraft]);

  /** Re-read the server object and adopt it, dropping the local draft. */
  const adoptServer = useCallback(async () => {
    if (!apiRef.current.load || stateRef.current.pending) return null;
    const before = stateRef.current.input;
    const epoch = seqRef.current;
    try {
      const object = await apiRef.current.load();
      if (epoch !== seqRef.current || !sameInput(before, stateRef.current.input) || stateRef.current.pending) return null;
      const seq = seqRef.current + 1;
      seqRef.current = seq;
      commit({
        status: 'clean',
        loadState: 'ready',
        loadError: null,
        input: apiRef.current.inputFromObject(object),
        baseline: object,
        serverObject: null,
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

  const refreshServer = useCallback(async () => {
    if (!apiRef.current.load) return null;
    const epoch = seqRef.current;
    try {
      const object = await apiRef.current.load();
      if (epoch !== seqRef.current) return null;
      const latest = stateRef.current;
      if (latest.pending || !['clean', 'saved'].includes(latest.status)) {
        if (!latest.pending && (latest.status === 'conflict' || (latest.baseline && latest.baseline.version !== object.version)))
          commit({ status: 'conflict', serverObject: object, problem: { kind: 'conflict', currentVersion: object.version, message: '内容已在别处修改' } });
      } else {
        commit({ baseline: object, input: apiRef.current.inputFromObject(object), serverObject: null });
      }
      return object;
    } catch { return null; }
  }, [commit]);

  useForegroundRefresh(() => enabled && stateRef.current.baseline ? refreshServer() : null);

  return {
    ...state,
    refreshServer,
    setInput,
    save: submit,
    retryConfirm: () => submit({ retry: true }),
    adoptServer,
    checkpoint: (id = draftId, { move = false } = {}) => {
      const current = stateRef.current;
      const stored = writeLocal(accountKey, draftName(kind, id), {
        input: current.input, baseline: current.baseline, baselineId: current.baseline?.id ?? null,
        baselineVersion: current.baseline?.version ?? null, pending: current.pending,
        status: current.status, savedAt: current.savedAt
      });
      // Transfer only this confirmed creation, and only after its newer input
      // is safe under the server identity. Other drafts and pending requests stay.
      if (stored && move && id !== draftId && !current.pending && current.baseline?.id === id) {
        removeLocal(accountKey, draftName(kind, draftId));
      }
      return stored;
    },
    compareServer: (object) => commit({ status: 'conflict', serverObject: object, problem: { kind: 'conflict', currentVersion: object.version, message: '内容已在别处修改' } }),
    discardDraft,
    isSaving: state.status === 'saving'
  };
}
