import express from 'express';
import { createGuards, asyncHandler, readIdempotencyKey, isWriteMethod } from '../workbench/http.js';
import { contractError, problems, mapErrorToResponse, sendProblem } from '../workbench/problems.js';
import { validateIdPath, validateNoQuery } from '../workbench/schema.js';
import { validate, agentError } from './schema.js';
import { createAgentStore } from './store.js';
import { createAgentRecords } from './records.js';
import { createToolExecutor } from './tools.js';
import { createPiRuntime, MODEL_IDS } from './runtime.js';
export { migrations } from './store.js';
export function createAgent({ db, mutations, identity, trustedOrigins, operations, config }) {
  const store = createAgentStore(db);
  const records = createAgentRecords({ store, operations });
  records.recover();
  const executor = createToolExecutor({ records, operations });
  const runtime = createPiRuntime({ records, executor, identity, config });
  const router = express.Router();
  const guards = createGuards({ identity, trustedOrigins });
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => isWriteMethod(req.method) ? guards.originGuard(req, res, next) : next());
  router.use(guards.protectionGuard, guards.identityGuard, express.json({ limit: '2mb' }));
  router.use((req, res, next) => {
    if (isWriteMethod(req.method) && req.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return next(contractError(problems.unsupportedMediaType()));
    next();
  });
  function account(req) { return req.workbenchPrincipal.accountKey; }
  function write(schema, handler, after) {
    return asyncHandler(async (req, res) => {
      validateNoQuery(req.query);
      for (const [name, value] of Object.entries(req.params)) validateIdPath(value, `/path/${name}`);
      if (schema === 'SubmitTurn' && req.body?.modelId && !MODEL_IDS.includes(req.body.modelId)) throw agentError('model-not-allowed');
      validate(schema, req.body);
      const key = readIdempotencyKey(req);
      let fresh = false;
      const result = mutations.execute({ principal: req.workbenchPrincipal, key, method: req.method, path: req.originalUrl.split('?')[0], body: req.body }, () => { fresh = true; return handler(req); });
      res.status(result.status).json(result.body);
      // Side effects such as starting the model run only after a fresh commit, never on an idempotent replay.
      if (fresh && after) after(req, result.body);
    });
  }
  router.get('/configuration', (req, res) => {
    validateNoQuery(req.query); const turn = records.active(account(req));
    res.json({ models: MODEL_IDS.map(id => ({ id, state: runtime.configured ? 'ready' : 'unconfigured' })), defaultModelId: MODEL_IDS[0],
      activeTurn: turn ? { conversationId: turn.conversationId, turnId: turn.id } : null, billing: { actualCost: null, balance: null } });
  });
  router.get('/conversations', (req, res) => {
    validateNoQuery(req.query);
    res.json({ items: records.conversations(account(req)) });
  });
  router.post('/conversations', write('CreateConversation', req => ({ status: 201, body: records.create(account(req)) })));
  router.get('/conversations/:conversationId', (req, res) => {
    validateIdPath(req.params.conversationId); validateNoQuery(req.query);
    res.json(records.snapshot(account(req), req.params.conversationId));
  });
  router.patch('/conversations/:conversationId', write('ConversationPatch', req => ({ status: 200,
    body: records.editConversation(account(req), req.params.conversationId, req.body)
  })));
  router.delete('/conversations/:conversationId', write('EmptyCommand', req => ({ status: 200,
    body: records.remove(account(req), req.params.conversationId)
  })));
  router.put('/conversations/:conversationId/draft', write('DraftInput', req => ({ status: 200,
    body: records.saveDraft(req.workbenchPrincipal, req.params.conversationId, req.body)
  })));
  router.post('/conversations/:conversationId/turns', write('SubmitTurn', req => ({ status: 202,
    body: records.acceptTurn(req.workbenchPrincipal, req.params.conversationId, req.body, runtime.configured)
  }), (req, result) => { void runtime.run(account(req), req.params.conversationId, result.turn.id, req).catch(() => {}); }));
  router.post('/conversations/:conversationId/turns/:turnId/stop', write('EmptyCommand', req => ({ status: 200,
    body: records.requestStop(account(req), req.params.conversationId, req.params.turnId)
  }), (req) => runtime.stop(req.params.turnId)));
  router.post('/conversations/:conversationId/proposals/:proposalId/execute', write('ExecuteProposal', req => ({ status: 200,
    body: records.prepareProposal(account(req), req.params.conversationId, req.params.proposalId, req.body.slot)
  }), (req, operation) => {
    try { executor.executeOperation(account(req), req.params.conversationId, operation.id, req.workbenchPrincipal); } catch { /* Persisted journal supplies recovery. */ }
  }));
  router.post('/conversations/:conversationId/operations/:operationId/reconcile', write('EmptyCommand', req => ({ status: 200,
    body: executor.reconcile(account(req), req.params.conversationId, req.params.operationId, req.workbenchPrincipal)
  })));
  router.get('/conversations/:conversationId/events', asyncHandler(async (req, res) => {
    validateIdPath(req.params.conversationId);
    if (Object.keys(req.query).some(k => k !== 'after') || (req.query.after !== undefined && !/^\d+$/.test(req.query.after))) throw contractError(problems.invalidInput('/query/after', 'invalid-type'));
    // after is the only cursor; Last-Event-ID is deliberately ignored so a reconnect cannot pick a second position.
    let cursor = Number(req.query.after ?? 0);
    const snapshot = records.snapshot(account(req), req.params.conversationId);
    if (!Number.isSafeInteger(cursor)) throw contractError(problems.invalidInput('/query/after', 'invalid-type'));
    if (cursor > snapshot.lastEventSeq) throw agentError('cursor-ahead');
    res.set('Content-Type','text/event-stream'); res.flushHeaders();
    let closed = false, busy = false, heartbeat = Date.now();
    async function flush() {
      if (closed || busy) return; busy = true;
      try {
        // Re-check identity before every batch so a signed-out stream closes instead of delivering later events.
        if ((await identity.resolvePrincipal(req))?.accountKey !== account(req)) return res.end();
        for (const event of records.events(account(req), req.params.conversationId, cursor)) {
          res.write(`id: ${event.seq}\nevent: change\ndata: ${JSON.stringify(event)}\n\n`); cursor = event.seq;
        }
        if (Date.now() - heartbeat >= 10000) { res.write(': heartbeat\n\n'); heartbeat = Date.now(); }
      } catch { res.end(); } finally { busy = false; }
    }
    const timer = setInterval(flush, 250);
    res.on('close', () => { closed = true; clearInterval(timer); }); await flush();
  }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const mapped = error.problem?.type?.startsWith('/problems/agent/') ? error : mapErrorToResponse(error);
    sendProblem(res, mapped.status, mapped.problem);
  });
  return { router, runtime, close: () => runtime.close() };
}
