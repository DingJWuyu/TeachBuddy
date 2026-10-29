import { randomUUID } from 'node:crypto';
import { contractError, problems } from '../workbench/problems.js';
import { requestFingerprint } from '../workbench/mutations.js';
import { agentError, agentProblem } from './schema.js';
import { timestamp, emptyUsage } from './store.js';
import { proposalRequest, proposalSize } from './proposals.js';
import { appendNative, nativeResult, outcome, terminal, operationDefinition, prepareCalls, settleCalls, updateOperation } from './record-tools.js';

// Owns conversation transitions. The store's mutable document and event writer
// stay here; HTTP, the SDK and business execution exchange intent and results.
export function createAgentRecords({ store, operations }) {
  const active = account => store.list(account).flatMap(d => d.snapshot.turns).find(t => t.state === 'running');
  const pending = account => store.list(account).some(d => d.snapshot.operations.some(o => ['executing', 'unconfirmed'].includes(o.state)));
  function references(principal, refs, sending) {
    const seen = new Set();
    return refs.map((ref, index) => {
      const key = `${ref.kind}:${ref.id}:${ref.kind === 'question' ? ref.sectionId ?? '' : ref.originDate ?? ''}`;
      if (seen.has(key)) throw contractError(problems.invalidInput(`/body/references/${index}`, 'invalid-type'));
      seen.add(key);
      const { object, snapshot = object } = operations.readReference(principal, ref);
      if (sending && (object.version !== ref.version || object.deletedAt !== null || (ref.kind === 'question' && ref.sectionId && !object.sections?.some(section => section.id === ref.sectionId)) || (ref.kind === 'entry' && snapshot.occurrence && snapshot.occurrence.state !== 'active'))) {
        throw agentError('reference-conflict', { field: `/body/references/${index}`, currentVersion: object.version });
      }
      return { input: ref, title: object.title, snapshot, capturedAt: timestamp() };
    });
  }
  function operation(account, id, operationId) {
    const doc = store.read(account, id);
    const value = doc.snapshot.operations.find(o => o.id === operationId);
    if (!value) throw contractError(problems.notFound());
    return { operation: value, key: doc.journals[value.id].key };
  }
  function recordOperationResult(account, id, operationId, result) {
    return store.update(account, id, (doc, emit) => {
      const value = doc.snapshot.operations.find(o => o.id === operationId);
      updateOperation(doc, emit, value, result);
      return value;
    });
  }
  function finish(account, id, turnId, reason = null) {
    store.update(account, id, (doc, emit) => {
      const turn = doc.snapshot.turns.find(t => t.id === turnId);
      if (turn.state !== 'running') return;
      settleCalls(doc, emit, turnId);
      const calls = doc.snapshot.toolCalls.filter(c => c.turnId === turnId);
      reason = doc.stops.includes(turnId) ? 'user-stop' : (calls.some(c => c.state === 'unconfirmed') ? 'tool-unconfirmed' : calls.some(c => c.state === 'rejected') ? 'tool-rejected' : calls.some(c => c.state === 'failed') ? 'tool-failed' : reason);
      turn.state = reason === 'user-stop' ? 'stopped' : reason ? 'failed' : 'completed';
      turn.reason = reason; turn.endedAt = timestamp(); emit('turn', turn);
      for (const message of doc.snapshot.messages.filter(m => m.turnId === turnId && m.role === 'assistant')) {
        if (message.state === 'streaming' || reason) { message.state = reason ? 'partial' : 'complete'; emit('message', message); }
      }
    });
  }
  return {
    active,
    finishTurn: finish,
    create: store.create,
    snapshot: store.snapshot,
    events: store.events,
    conversations(account) { return store.list(account).map(d => d.snapshot.conversation).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)); },
    editConversation(account, id, patch) {
      return store.update(account, id, doc => {
        if (patch.title !== undefined) {
          doc.snapshot.conversation.title = patch.title.trim();
          doc.snapshot.conversation.titleEdited = true;
        }
        if (patch.pinned !== undefined) doc.snapshot.conversation.pinned = patch.pinned;
        return doc.snapshot.conversation;
      }, { touch: false });
    },
    remove(account, id) {
      const snapshot = store.snapshot(account, id);
      if (snapshot.turns.some(t => t.state === 'running')) throw agentError('turn-active');
      if (snapshot.operations.some(o => ['prepared', 'executing', 'unconfirmed'].includes(o.state))) throw agentError('pending-operation');
      return store.remove(account, id);
    },
    saveDraft(principal, id, input) {
      return store.update(principal.accountKey, id, (doc, emit) => {
        if (doc.snapshot.draft.version !== input.baseVersion) throw agentError('draft-conflict', { currentVersion: doc.snapshot.draft.version });
        references(principal, input.references, false);
        doc.snapshot.draft = { version: doc.snapshot.draft.version + 1, text: input.text, references: input.references, updatedAt: timestamp() };
        emit('draft', doc.snapshot.draft); return doc.snapshot.draft;
      });
    },
    acceptTurn(principal, id, input, configured) {
      return store.update(principal.accountKey, id, (doc, emit) => {
        if (!configured) throw agentError('model-unavailable');
        if (active(principal.accountKey)) throw agentError('turn-active');
        if (pending(principal.accountKey)) throw agentError('pending-operation');
        const draft = doc.snapshot.draft;
        if (draft.version !== input.draftVersion) throw agentError('draft-conflict', { currentVersion: draft.version });
        if (!draft.text.trim()) throw contractError(problems.invalidInput('/body/text', 'required'));
        const refs = references(principal, draft.references, true), now = timestamp(), turnId = randomUUID();
        const message = { id: randomUUID(), turnId, role: 'user', text: draft.text, references: refs, state: 'complete', createdAt: now };
        const turn = { id: turnId, conversationId: id, userMessageId: message.id, modelId: input.modelId, state: 'running', reason: null, createdAt: now, endedAt: null, usage: emptyUsage() };
        if (!doc.snapshot.messages.length && !doc.snapshot.conversation.titleEdited) doc.snapshot.conversation.title = Array.from(draft.text).slice(0, 32).join('');
        doc.snapshot.messages.push(message); doc.snapshot.turns.push(turn);
        doc.snapshot.draft = { version: draft.version + 1, text: '', references: [], updatedAt: now };
        emit('message', message); emit('turn', turn); emit('draft', doc.snapshot.draft);
        return { turn, message, draft: doc.snapshot.draft };
      });
    },
    requestStop(account, id, turnId) {
      return store.update(account, id, doc => {
        const turn = doc.snapshot.turns.find(t => t.id === turnId);
        if (!turn) throw contractError(problems.notFound());
        if (turn.state === 'running' && !doc.stops.includes(turnId)) doc.stops.push(turnId);
        return turn;
      });
    },
    prepareProposal(account, id, proposalId, slot) {
      return store.update(account, id, (doc, emit) => {
        if (active(account)) throw agentError('turn-active');
        const call = doc.snapshot.toolCalls.find(value => value.name === 'wb_propose_teaching_card' && value.state === 'read' && value.result.proposalId === proposalId);
        if (!call) throw contractError(problems.notFound());
        const card = call.result.card;
        if (slot >= proposalSize(card)) throw contractError(problems.invalidInput('/body/slot', 'out-of-range'));
        let value = doc.snapshot.operations.find(o => o.proposalSource?.proposalId === proposalId && o.proposalSource.slot === slot);
        if (value && value.state !== 'cancelled') return value;
        if (pending(account)) throw agentError('pending-operation');
        for (let previous = 0; previous < slot; previous++) {
          if (!doc.snapshot.operations.some(o => o.proposalSource?.proposalId === proposalId && o.proposalSource.slot === previous && o.state === 'confirmed')) throw contractError(problems.invalidInput('/body/slot', 'out-of-range'));
        }
        const request = proposalRequest(card, slot);
        if (typeof operations[request.operationId] !== 'function') throw contractError(problems.notFound());
        if (value) { updateOperation(doc, emit, value, { state: 'prepared', result: null, problem: null }); return value; }
        const definition = operationDefinition(request.operationId), now = timestamp();
        value = { id: randomUUID(), turnId: call.turnId, toolCallId: call.toolCallId, proposalSource: { proposalId, slot }, request,
          state: 'prepared', result: null, problem: null, createdAt: now, updatedAt: now };
        doc.snapshot.operations.push(value);
        const journal = { key: randomUUID(), method: definition.method, path: definition.path, body: request.arguments.body };
        doc.journals[value.id] = { ...journal, fingerprint: requestFingerprint(journal) };
        emit('operation', value); return value;
      });
    },
    beginOperation(account, id, operationId) {
      const current = operation(account, id, operationId);
      if (current.operation.state !== 'prepared') return { ...current, started: false };
      store.update(account, id, (doc, emit) => updateOperation(doc, emit, doc.snapshot.operations.find(o => o.id === operationId), { state: 'executing' }));
      return { ...operation(account, id, operationId), started: true };
    },
    reconciliation(account, id, operationId) {
      const current = operation(account, id, operationId);
      if (active(account)) throw agentError('turn-active');
      return current;
    },
    recordOperationResult,
    preserveUnknownOperation(account, id, operationId) {
      return recordOperationResult(account, id, operationId, { state: 'unconfirmed', result: null, problem: agentProblem('operation-unconfirmed') });
    },
    beginTool(account, id, toolCallId) {
      const doc = store.read(account, id), call = doc.snapshot.toolCalls.find(c => c.toolCallId === toolCallId);
      if (!call) throw new Error('Tool call was not persisted');
      if (terminal(call.state)) return { result: nativeResult(call) };
      const turn = doc.snapshot.turns.find(t => t.id === call.turnId);
      if (turn.state !== 'running' || doc.stops.includes(turn.id)) throw new Error('Turn stopped');
      if (!call.operationId) store.update(account, id, (d, emit) => {
        const value = d.snapshot.toolCalls.find(c => c.toolCallId === toolCallId);
        value.state = 'executing'; value.updatedAt = timestamp(); emit('toolCall', value);
      });
      return { call };
    },
    toolResult(account, id, toolCallId) {
      return nativeResult(store.snapshot(account, id).toolCalls.find(c => c.toolCallId === toolCallId));
    },
    recordReadResult(account, id, toolCallId, result) {
      return store.update(account, id, (doc, emit) => {
        const call = doc.snapshot.toolCalls.find(c => c.toolCallId === toolCallId);
        if (!terminal(call.state)) {
          Object.assign(call, result, { updatedAt: timestamp() }); emit('toolCall', call); appendNative(doc, nativeResult(call));
        }
        return nativeResult(call);
      });
    },
    openTurn(account, id, turnId) {
      const doc = store.read(account, id), turn = doc.snapshot.turns.find(t => t.id === turnId);
      const user = doc.snapshot.messages.find(m => m.id === turn.userMessageId);
      const proposalResults = doc.snapshot.operations.filter(o => o.proposalSource && o.state === 'confirmed');
      const prompt = user.text + (proposalResults.length ? '\n<此前已保存的提案结果>\n' + JSON.stringify(proposalResults) + '\n</此前已保存的提案结果>' : '') + (user.references.length ? '\n<引用数据>\n' + JSON.stringify(user.references) + '\n</引用数据>' : '');
      const messageIds = new Map();
      function projectAssistant(d, emit, message, complete) {
        const text = message.content.filter(c => c.type === 'text').map(c => c.text).join('');
        if (!text) return;
        if (!messageIds.has(message.timestamp)) messageIds.set(message.timestamp, randomUUID());
        const messageId = messageIds.get(message.timestamp);
        let item = d.snapshot.messages.find(m => m.id === messageId);
        if (!item) {
          item = { id: messageId, turnId, role: 'assistant', text: '', references: [], state: 'streaming', createdAt: timestamp() };
          d.snapshot.messages.push(item);
        }
        item.text = text; item.state = complete ? 'complete' : 'streaming'; emit('message', item);
      }
      return {
        modelId: turn.modelId, entries: doc.entries, prompt,
        stopped: () => store.read(account, id).stops.includes(turnId),
        beforeTool() {
          const calls = store.snapshot(account, id).toolCalls.filter(c => c.turnId === turnId);
          if (calls.some(c => ['rejected', 'failed', 'unconfirmed'].includes(c.state))) {
            store.update(account, id, (d, emit) => settleCalls(d, emit, turnId));
            throw new Error('Previous tool failed');
          }
          return calls.length <= 24;
        },
        beginRequest() {
          const snapshot = store.snapshot(account, id);
          if (snapshot.toolCalls.some(c => c.turnId === turnId && !['read', 'confirmed'].includes(c.state))) throw new Error('Tool failed');
          if (snapshot.turns.find(t => t.id === turnId).usage.requestsStarted >= 12) return false;
          return store.update(account, id, (d, emit) => {
            const value = d.snapshot.turns.find(t => t.id === turnId);
            value.usage.requestsStarted++; value.usage.complete = false;
            (d.requests[turnId] ??= []).push({ ordinal: value.usage.requestsStarted, startedAt: timestamp(), reported: false }); emit('turn', value);
            return true;
          });
        },
        assistantUpdate(message) {
          store.update(account, id, (d, emit) => {
            if (d.snapshot.turns.find(t => t.id === turnId).state === 'running') projectAssistant(d, emit, message, false);
          });
        },
        append(message, sessionEntries, appendToSession) {
          const old = message.role === 'toolResult' && store.read(account, id).entries.find(e => e.message?.role === 'toolResult' && e.message.toolCallId === message.toolCallId);
          if (old) {
            if (!sessionEntries.some(e => e.message?.toolCallId === message.toolCallId)) appendToSession();
            return old.id;
          }
          const { entryId, header, entries } = appendToSession();
          store.update(account, id, (d, emit) => {
            d.entries = [header, ...entries];
            d.pi = { package: '@earendil-works/pi-coding-agent', version: '0.85.1', entriesVersion: 3, sessionId: header.id };
            (d.nativeLinks ??= {})[entryId] = { turnId, role: message.role, toolCallId: message.toolCallId ?? null };
            if (message.role !== 'assistant') return;
            prepareCalls(d, emit, turnId, message); projectAssistant(d, emit, message, true);
            const row = (d.requests[turnId] ?? []).at(-1);
            if (row && !row.reported && message.usage && message.stopReason !== 'error' && message.stopReason !== 'aborted') {
              row.reported = true; row.usage = message.usage;
              const value = d.snapshot.turns.find(t => t.id === turnId), usage = value.usage;
              usage.requestsReported++;
              for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'totalTokens']) if (Number.isFinite(message.usage[key])) usage[key] = (usage[key] ?? 0) + message.usage[key];
              usage.complete = usage.requestsReported === usage.requestsStarted; emit('turn', value);
            }
          });
          return entryId;
        },
        toolOutcome(toolCallId) {
          const call = store.snapshot(account, id).toolCalls.find(c => c.toolCallId === toolCallId);
          return call && terminal(call.state) ? outcome(call) : undefined;
        }
      };
    },
    recover() {
      for (const account of store.accounts()) for (const doc of store.list(account)) {
        if (!doc.snapshot.turns.some(t => t.state === 'running') && !doc.snapshot.operations.some(o => o.proposalSource && ['prepared', 'executing'].includes(o.state))) continue;
        store.update(account, doc.snapshot.conversation.id, (d, emit) => {
          for (const value of d.snapshot.operations.filter(o => o.proposalSource && ['prepared', 'executing'].includes(o.state))) {
            updateOperation(d, emit, value, { state: value.state === 'prepared' ? 'cancelled' : 'unconfirmed', result: null, problem: value.state === 'prepared' ? null : agentProblem('operation-unconfirmed') });
          }
          for (const turn of d.snapshot.turns.filter(t => t.state === 'running')) {
            settleCalls(d, emit, turn.id); Object.assign(turn, { state: 'interrupted', reason: 'server-restart', endedAt: timestamp() }); emit('turn', turn);
            for (const message of d.snapshot.messages.filter(m => m.turnId === turn.id && m.role === 'assistant')) { message.state = 'partial'; emit('message', message); }
          }
        });
      }
    }
  };
}
