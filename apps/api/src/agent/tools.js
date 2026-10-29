import { randomUUID } from 'node:crypto';
import { toolDefinitions, agentProblem } from './schema.js';
import { contractError, problems } from '../workbench/problems.js';
import { operationDefinition } from './record-tools.js';

export function createToolExecutor({ records, operations }) {
  function operationResult(operation, key, principal) {
    const definition = operationDefinition(operation.request.operationId);
    try {
      if (typeof operations[operation.request.operationId] !== 'function') throw contractError(problems.notFound());
      const response = operations[operation.request.operationId]({ principal, arguments: operation.request.arguments, key });
      if (![200, 201].includes(response?.status) || !definition.response(response.body)) throw new Error('Unexpected business response');
      return { state: 'confirmed', result: response.body, problem: null };
    } catch (error) {
      return ['/problems/workbench/', '/problems/materials/', '/problems/math/'].some(prefix => error.problem?.type?.startsWith(prefix)) && [400, 403, 404, 409, 422].includes(error.status)
        ? { state: 'rejected', result: null, problem: error.problem }
        : { state: 'unconfirmed', result: null, problem: agentProblem('operation-unconfirmed') };
    }
  }
  function executeOperation(account, conversationId, operationId, principal) {
    const { operation, key, started } = records.beginOperation(account, conversationId, operationId);
    if (!started) return operation;
    // Keep the business call outside the record transaction: executing is durable
    // before the synchronous mutation, and its result is a separate commit.
    const result = operationResult(operation, key, principal);
    try {
      return records.recordOperationResult(account, conversationId, operationId, result);
    } catch (error) {
      records.preserveUnknownOperation(account, conversationId, operationId);
      throw error;
    }
  }
  function execute(account, conversationId, toolCallId, principal) {
    const prepared = records.beginTool(account, conversationId, toolCallId);
    if (prepared.result) return prepared.result;
    const { call } = prepared;
    if (call.operationId) {
      executeOperation(account, conversationId, call.operationId, principal);
      return records.toolResult(account, conversationId, toolCallId);
    }
    const tool = toolDefinitions.find(t => t.name === call.name);
    let state, result = null, problem = null;
    try {
      const response = tool.operationId === 'proposeTeachingCard'
        ? { status: 200, body: { proposalId: randomUUID(), card: structuredClone(call.arguments.card) } }
        : operations[tool.operationId]({ principal, arguments: call.arguments });
      if (response?.then || ![200, 201].includes(response?.status) || !tool.response(response.body)) throw new Error('Unexpected business response');
      state = 'read'; result = response.body;
    } catch (error) {
      if (['/problems/workbench/', '/problems/materials/', '/problems/math/'].some(prefix => error.problem?.type?.startsWith(prefix)) && [400, 403, 404, 409, 422].includes(error.status)) { state = 'rejected'; problem = error.problem; }
      else { state = 'failed'; problem = agentProblem('tool-failed'); }
    }
    return records.recordReadResult(account, conversationId, toolCallId, { state, result, problem });
  }
  return { execute, executeOperation,
    availableTools: toolDefinitions.filter(tool => tool.operationId === 'proposeTeachingCard' || typeof operations[tool.operationId] === 'function'),
    reconcile(account, conversationId, id, principal) {
      const { operation, key } = records.reconciliation(account, conversationId, id);
      if (operation.state !== 'unconfirmed') return operation;
      // An absent owner cannot inspect the original receipt. Keep it unresolved.
      if (typeof operations[operation.request.operationId] !== 'function') return operation;
      return records.recordOperationResult(account, conversationId, id, operationResult(operation, key, principal));
    }
  };
}
