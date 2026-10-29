import { randomUUID } from 'node:crypto';
import { toolDefinitions, valid, agentProblem } from './schema.js';
import { timestamp } from './store.js';
import { validProposal } from './proposals.js';
import { requestFingerprint } from '../workbench/mutations.js';
export const terminal = state => !['prepared', 'executing'].includes(state);
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
function projectNativeResult(doc, call) {
  // The SDK may already have persisted its fallback result after a failed
  // receipt. Replace that message in place, keeping entry identity and parent.
  const entry = doc.entries.find(e => e.message?.role === 'toolResult' && e.message.toolCallId === call.toolCallId);
  if (entry) entry.message = nativeResult(call); else appendNative(doc, nativeResult(call));
}
export function updateOperation(doc, emit, operation, patch) {
  Object.assign(operation, patch, { updatedAt: timestamp() });
  emit('operation', operation);
  for (const call of doc.snapshot.toolCalls.filter(c => c.operationId === operation.id)) {
    Object.assign(call, { state: operation.state, result: operation.result, problem: operation.problem, updatedAt: operation.updatedAt });
    emit('toolCall', call);
    if (terminal(call.state)) projectNativeResult(doc, call);
  }
}
export function prepareCalls(doc, emit, turnId, message) {
  for (const raw of message.content ?? []) {
    if (raw.type !== 'toolCall') continue;
    if (doc.snapshot.toolCalls.some(c => c.turnId === turnId && c.toolCallId === raw.id)) continue;
    const tool = toolDefinitions.find(t => t.name === raw.name);
    if (!tool) throw new Error('Unknown tool');
    const accepted = valid(`Tool_${tool.operationId}`, raw.arguments) && (tool.operationId !== 'proposeTeachingCard' || validProposal(raw.arguments.card));
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
function settleOperation(doc, emit, operation) {
  updateOperation(doc, emit, operation, { state: operation.state === 'prepared' ? 'cancelled' : 'unconfirmed',
    problem: operation.state === 'prepared' ? null : agentProblem('operation-unconfirmed') });
}
function settleRead(doc, emit, call) {
  call.state = call.state === 'prepared' ? 'cancelled' : 'interrupted'; call.updatedAt = timestamp();
  emit('toolCall', call); projectNativeResult(doc, call);
}
export function settleTool(doc, emit, call) {
  if (terminal(call.state)) return;
  if (call.operationId) settleOperation(doc, emit, doc.snapshot.operations.find(o => o.id === call.operationId));
  else settleRead(doc, emit, call);
}
export function settleCalls(doc, emit, turnId) {
  for (const operation of doc.snapshot.operations.filter(o => o.turnId === turnId && !terminal(o.state))) {
    settleOperation(doc, emit, operation);
  }
  for (const call of doc.snapshot.toolCalls.filter(c => c.turnId === turnId && !c.operationId && !terminal(c.state))) {
    settleRead(doc, emit, call);
  }
}
export function operationDefinition(name) {
  if (name === 'createEntry') return { method: 'POST', path: '/api/modules/schedule/entries', response: value => valid('ProposalEntryResult', value) };
  if (name === 'createQuestionV2') return { method: 'POST', path: '/api/modules/questions/v2/items', response: value => valid('ProposalQuestionResult', value) };
  return toolDefinitions.find(tool => tool.operationId === name);
}
