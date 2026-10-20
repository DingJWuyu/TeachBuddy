import express from 'express';
import { randomUUID } from 'node:crypto';
import { createGuards, asyncHandler, readIdempotencyKey, isWriteMethod } from '../workbench/http.js';
import { contractError, problems, mapErrorToResponse, sendProblem } from '../workbench/problems.js';
import { validateIdPath, validateNoQuery } from '../workbench/schema.js';
import { validate, agentError } from './schema.js';
import { createAgentStore, timestamp, emptyUsage } from './store.js';
import { createToolExecutor } from './tools.js';
import { createPiRuntime, MODEL_IDS } from './runtime.js';
export { migrations } from './store.js';
export function createAgent({ db, mutations, identity, trustedOrigins, operations, config }) {
  const store = createAgentStore(db);
  const executor = createToolExecutor({ store, operations });
  const runtime = createPiRuntime({ store, executor, identity, config }); runtime.recover();
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
  function active(key) { return store.list(key).flatMap(d => d.snapshot.turns).find(t => t.state === 'running'); }
  function pending(key) { return store.list(key).some(d => d.snapshot.operations.some(o => ['executing','unconfirmed'].includes(o.state))); }
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
      if (fresh && after) after(req, result.body);
    });
  }
  router.get('/configuration', (req, res) => {
    validateNoQuery(req.query); const turn = active(account(req));
    res.json({ models: MODEL_IDS.map(id => ({ id, state: runtime.configured ? 'ready' : 'unconfigured' })), defaultModelId: MODEL_IDS[0],
      activeTurn: turn ? { conversationId: turn.conversationId, turnId: turn.id } : null, billing: { actualCost: null, balance: null } });
  });
  router.get('/conversations', (req, res) => {
    validateNoQuery(req.query);
    res.json({ items: store.list(account(req)).map(d => d.snapshot.conversation).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)) });
  });
  router.post('/conversations', write('CreateConversation', req => ({ status: 201, body: store.create(account(req)) })));
  router.get('/conversations/:conversationId', (req, res) => {
    validateIdPath(req.params.conversationId); validateNoQuery(req.query);
    res.json(store.snapshot(account(req), req.params.conversationId));
  });
  router.patch('/conversations/:conversationId', write('ConversationPatch', req => ({ status: 200,
    body: store.update(account(req), req.params.conversationId, d => {
      if (req.body.title !== undefined) d.snapshot.conversation.title = req.body.title.trim();
      if (req.body.pinned !== undefined) d.snapshot.conversation.pinned = req.body.pinned;
      return d.snapshot.conversation;
    }, { touch: false })
  })));
  router.delete('/conversations/:conversationId', write('EmptyCommand', req => {
    const doc = store.snapshot(account(req), req.params.conversationId);
    if (doc.turns.some(t => t.state === 'running')) throw agentError('turn-active');
    if (doc.operations.some(o => ['prepared', 'executing', 'unconfirmed'].includes(o.state))) throw agentError('pending-operation');
    return { status: 200, body: store.remove(account(req), req.params.conversationId) };
  }));
  router.put('/conversations/:conversationId/draft', write('DraftInput', req => ({ status: 200,
    body: store.update(account(req), req.params.conversationId, (d, emit) => {
      if (d.snapshot.draft.version !== req.body.baseVersion) throw agentError('draft-conflict', { currentVersion: d.snapshot.draft.version });
      references(req.workbenchPrincipal, req.body.references, false);
      d.snapshot.draft = { version: d.snapshot.draft.version + 1, text: req.body.text, references: req.body.references, updatedAt: timestamp() };
      emit('draft', d.snapshot.draft); return d.snapshot.draft;
    })
  })));
  router.post('/conversations/:conversationId/turns', write('SubmitTurn', req => ({ status: 202,
    body: store.update(account(req), req.params.conversationId, (d, emit) => {
      if (!runtime.configured) throw agentError('model-unavailable');
      if (active(account(req))) throw agentError('turn-active');
      if (pending(account(req))) throw agentError('pending-operation');
      const draft = d.snapshot.draft;
      if (draft.version !== req.body.draftVersion) throw agentError('draft-conflict', { currentVersion: draft.version });
      if (!draft.text.trim()) throw contractError(problems.invalidInput('/body/text', 'required'));
      const refs = references(req.workbenchPrincipal, draft.references, true); const now = timestamp(); const turnId = randomUUID();
      const message = { id: randomUUID(), turnId, role: 'user', text: draft.text, references: refs, state: 'complete', createdAt: now };
      const turn = { id: turnId, conversationId: req.params.conversationId, userMessageId: message.id, modelId: req.body.modelId, state: 'running', reason: null, createdAt: now, endedAt: null, usage: emptyUsage() };
      if (!d.snapshot.messages.length) d.snapshot.conversation.title = Array.from(draft.text).slice(0,32).join('');
      d.snapshot.messages.push(message); d.snapshot.turns.push(turn);
      d.snapshot.draft = { version: draft.version + 1, text: '', references: [], updatedAt: now };
      emit('message', message); emit('turn', turn); emit('draft', d.snapshot.draft);
      return { turn, message, draft: d.snapshot.draft };
    })
  }), (req, result) => { void runtime.run(account(req), req.params.conversationId, result.turn.id, req).catch(() => {}); }));
  router.post('/conversations/:conversationId/turns/:turnId/stop', write('EmptyCommand', req => ({ status: 200,
    body: store.update(account(req), req.params.conversationId, (d) => {
      const turn = d.snapshot.turns.find(t => t.id === req.params.turnId);
      if (!turn) throw contractError(problems.notFound());
      if (turn.state === 'running' && !d.stops.includes(turn.id)) d.stops.push(turn.id);
      return turn;
    })
  }), (req) => runtime.stop(req.params.turnId)));
  router.post('/conversations/:conversationId/proposals/:proposalId/execute', write('ExecuteProposal', req => {
    const key = account(req);
    store.read(key, req.params.conversationId);
    if (active(key)) throw agentError('turn-active');
    return { status: 200, body: executor.prepareProposal(key, req.params.conversationId, req.params.proposalId, req.body.slot) };
  }, (req, operation) => {
    try { executor.executeOperation(account(req), req.params.conversationId, operation.id, req.workbenchPrincipal); } catch { /* Persisted journal supplies recovery. */ }
  }));
  router.post('/conversations/:conversationId/operations/:operationId/reconcile', write('EmptyCommand', req => {
    const d = store.read(account(req), req.params.conversationId);
    if (!d.snapshot.operations.some(o => o.id === req.params.operationId)) throw contractError(problems.notFound());
    if (active(account(req))) throw agentError('turn-active');
    return { status: 200, body: executor.reconcile(account(req), req.params.conversationId, req.params.operationId, req.workbenchPrincipal) };
  }));
  router.get('/conversations/:conversationId/events', asyncHandler(async (req, res) => {
    validateIdPath(req.params.conversationId);
    if (Object.keys(req.query).some(k => k !== 'after') || (req.query.after !== undefined && !/^\d+$/.test(req.query.after))) throw contractError(problems.invalidInput('/query/after', 'invalid-type'));
    let cursor = Number(req.query.after ?? 0);
    const snapshot = store.snapshot(account(req), req.params.conversationId);
    if (!Number.isSafeInteger(cursor)) throw contractError(problems.invalidInput('/query/after', 'invalid-type'));
    if (cursor > snapshot.lastEventSeq) throw agentError('cursor-ahead');
    res.set('Content-Type','text/event-stream'); res.flushHeaders();
    let closed = false, busy = false, heartbeat = Date.now();
    async function flush() {
      if (closed || busy) return; busy = true;
      try {
        if ((await identity.resolvePrincipal(req))?.accountKey !== account(req)) return res.end();
        for (const event of store.events(account(req), req.params.conversationId, cursor)) {
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
  return { router, store, runtime, close: () => runtime.close() };
}
