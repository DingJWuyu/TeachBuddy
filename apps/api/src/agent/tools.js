import { randomUUID } from 'node:crypto';
import { toolDefinitions, valid, agentProblem } from './schema.js';
import { timestamp } from './store.js';
import { requestFingerprint } from '../workbench/mutations.js';
const terminal = state => !['prepared', 'executing'].includes(state);
export function outcome(call) {
  if (call.state === 'read') return { state: call.state, result: call.result };
  if (call.state === 'confirmed') return { state: call.state, operationId: call.operationId, result: call.result };
  if (['cancelled', 'interrupted'].includes(call.state)) return { state: call.state, operationId: call.operationId };
  return { state: call.state, operationId: call.operationId, problem: call.problem };
}
export function nativeResult(call) {
  const details = outcome(call);
  return { role: 'toolResult', toolCallId: call.toolCallId, toolName: call.name,
    content: [{ type: 'text', text: JSON.stringify(details) }], details,
    isError: !['read', 'confirmed'].includes(call.state), timestamp: Date.now() };
}
export function appendNative(doc, message) {
  if (message.role === 'toolResult' && doc.entries.some(e => e.message?.role === 'toolResult' && e.message.toolCallId === message.toolCallId)) return;
  const parentId = doc.entries.at(-1)?.id ?? null;
  doc.entries.push({ type: 'message', id: randomUUID(), parentId, timestamp: timestamp(), message: structuredClone(message) });
}
export function updateOperation(doc, emit, operation, patch) {
  Object.assign(operation, patch, { updatedAt: timestamp() });
  emit('operation', operation);
  for (const call of doc.snapshot.toolCalls.filter(c => c.operationId === operation.id)) {
    Object.assign(call, { state: operation.state, result: operation.result, problem: operation.problem, updatedAt: operation.updatedAt });
    emit('toolCall', call);
    if (terminal(call.state)) {
      // Reconciliation replaces the same result, preserving its native entry identity.
      const entry = doc.entries.find(e => e.message?.role === 'toolResult' && e.message.toolCallId === call.toolCallId);
      if (entry) entry.message = nativeResult(call); else appendNative(doc, nativeResult(call));
    }
  }
}
export function prepareCalls(doc, emit, turnId, message) {
  for (const raw of message.content ?? []) {
    if (raw.type !== 'toolCall') continue;
    if (doc.snapshot.toolCalls.some(c => c.turnId === turnId && c.toolCallId === raw.id)) continue;
    const tool = toolDefinitions.find(t => t.name === raw.name);
    if (!tool) throw new Error('Unknown tool');
    const accepted = valid(`Tool_${tool.operationId}`, raw.arguments);
    const now = timestamp();
    const call = { turnId, toolCallId: raw.id, ordinal: doc.snapshot.toolCalls.filter(c => c.turnId === turnId).length + 1,
      name: tool.name, arguments: accepted ? structuredClone(raw.arguments) : null, operationId: null,
      state: accepted ? 'prepared' : 'rejected', result: null,
      problem: accepted ? null : { type: '/problems/workbench/invalid-input', field: '/body', reason: 'invalid-type' }, createdAt: now, updatedAt: now };
    if (accepted && tool.mutation) {
      const args = call.arguments;
      const path = tool.path.replace('{id}', args.id);
      const fingerprint = requestFingerprint({ method: tool.method, path, body: args.body });
      let operation = doc.snapshot.operations.find(o => o.turnId === turnId && o.state === 'confirmed' && doc.journals[o.id].fingerprint === fingerprint);
      if (!operation) {
        operation = { id: randomUUID(), turnId, toolCallId: raw.id, request: { operationId: tool.operationId, arguments: args }, state: 'prepared', result: null, problem: null, createdAt: now, updatedAt: now };
        doc.snapshot.operations.push(operation);
        doc.journals[operation.id] = { key: randomUUID(), method: tool.method, path, body: args.body, fingerprint };
        emit('operation', operation);
      }
      Object.assign(call, { operationId: operation.id, state: operation.state, result: operation.result, problem: operation.problem });
    }
    doc.snapshot.toolCalls.push(call); emit('toolCall', call);
    if (terminal(call.state)) appendNative(doc, nativeResult(call));
  }
}
export function settleCalls(doc, emit, turnId) {
  for (const operation of doc.snapshot.operations.filter(o => o.turnId === turnId && !terminal(o.state))) {
    updateOperation(doc, emit, operation, { state: operation.state === 'prepared' ? 'cancelled' : 'unconfirmed',
      problem: operation.state === 'prepared' ? null : agentProblem('operation-unconfirmed') });
  }
  for (const call of doc.snapshot.toolCalls.filter(c => c.turnId === turnId && !c.operationId && !terminal(c.state))) {
    call.state = call.state === 'prepared' ? 'cancelled' : 'interrupted'; call.updatedAt = timestamp();
    emit('toolCall', call); appendNative(doc, nativeResult(call));
  }
}
export function createToolExecutor({ store, operations }) {
  function execute(account, conversationId, toolCallId, principal) {
    let doc = store.read(account, conversationId);
    let call = doc.snapshot.toolCalls.find(c => c.toolCallId === toolCallId);
    if (!call) throw new Error('Tool call was not persisted');
    if (terminal(call.state)) return nativeResult(call);
    const turn = doc.snapshot.turns.find(t => t.id === call.turnId);
    if (turn.state !== 'running' || doc.stops.includes(turn.id)) throw new Error('Turn stopped');
    const tool = toolDefinitions.find(t => t.name === call.name);
    store.update(account, conversationId, (d, emit) => {
      const c = d.snapshot.toolCalls.find(c => c.toolCallId === toolCallId);
      if (c.operationId) updateOperation(d, emit, d.snapshot.operations.find(o => o.id === c.operationId), { state: 'executing' });
      else { c.state = 'executing'; c.updatedAt = timestamp(); emit('toolCall', c); }
    });
    let state, result = null, problem = null;
    try {
      const operation = doc.snapshot.operations.find(o => o.id === call.operationId);
      const response = operations[tool.operationId]({ principal, arguments: call.arguments, key: operation ? doc.journals[operation.id].key : undefined });
      if (response?.then || ![200, 201].includes(response?.status) || !tool.response(response.body)) throw new Error('Unexpected business response');
      state = tool.mutation ? 'confirmed' : 'read'; result = response.body;
    } catch (error) {
      if (['/problems/workbench/', '/problems/materials/', '/problems/math/'].some(prefix => error.problem?.type?.startsWith(prefix)) && [400,403,404,409,422].includes(error.status)) { state = 'rejected'; problem = error.problem; }
      else { state = tool.mutation ? 'unconfirmed' : 'failed'; problem = agentProblem(tool.mutation ? 'operation-unconfirmed' : 'tool-failed'); }
    }
    return store.update(account, conversationId, (d, emit) => {
      const c = d.snapshot.toolCalls.find(c => c.toolCallId === toolCallId);
      if (c.operationId) updateOperation(d, emit, d.snapshot.operations.find(o => o.id === c.operationId), { state, result, problem });
      else if (!terminal(c.state)) {
        Object.assign(c, { state, result, problem, updatedAt: timestamp() }); emit('toolCall', c); appendNative(d, nativeResult(c));
      }
      return nativeResult(c);
    });
  }
  return { execute,
    reconcile(account, conversationId, id, principal) {
      const doc = store.read(account, conversationId);
      const operation = doc.snapshot.operations.find(o => o.id === id);
      if (operation.state !== 'unconfirmed') return operation;
      const tool = toolDefinitions.find(t => t.operationId === operation.request.operationId);
      let patch;
      try {
        const response = operations[tool.operationId]({ principal, arguments: operation.request.arguments, key: doc.journals[id].key });
        if (![200,201].includes(response?.status) || !tool.response(response.body)) throw new Error('Unexpected business response');
        patch = { state: 'confirmed', result: response.body, problem: null };
      } catch (error) {
        patch = ['/problems/workbench/', '/problems/materials/', '/problems/math/'].some(prefix => error.problem?.type?.startsWith(prefix)) && [400,403,404,409,422].includes(error.status)
          ? { state: 'rejected', result: null, problem: error.problem }
          : { state: 'unconfirmed', result: null, problem: agentProblem('operation-unconfirmed') };
      }
      return store.update(account, conversationId, (d, emit) => {
        const op = d.snapshot.operations.find(o => o.id === id); updateOperation(d, emit, op, patch); return op;
      });
    }
  };
}
